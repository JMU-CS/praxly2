import keycloak from './keycloak';
import { useByokStore, useChatStore } from '../store/appStore';

/**
 * One sign-in surface for the whole app, over two providers:
 *
 *   - Keycloak — the existing realm login, tokens handled by keycloak-js
 *   - Google   — the OAuth 2 authorization-code flow, run server-side by
 *                k12-llm-backend, which hands back a session token
 *
 * Components should call these helpers instead of touching `keycloak`
 * directly, so both providers stay interchangeable everywhere.
 */

const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ??
  {}) as Record<string, string | undefined>;

const BACKEND_URL = env.VITE_BACKEND_URL ?? 'https://k12api.torta-server.duckdns.org';

export type AuthProvider = 'keycloak' | 'google';

const GOOGLE_TOKEN_KEY = 'google_token';
const GOOGLE_EXPIRES_KEY = 'google_token_expires_at';
const GOOGLE_NONCE_KEY = 'google_auth_nonce';

interface GoogleSession {
  token: string;
  expiresAt: number;
}

/** Reads the stored Google session, discarding it once expired. */
function readGoogleSession(): GoogleSession | null {
  const token = localStorage.getItem(GOOGLE_TOKEN_KEY);
  const expiresAt = Number(localStorage.getItem(GOOGLE_EXPIRES_KEY) ?? 0);
  if (!token) return null;
  if (!expiresAt || Date.now() >= expiresAt) {
    clearGoogleSession();
    return null;
  }
  return { token, expiresAt };
}

function clearGoogleSession(): void {
  localStorage.removeItem(GOOGLE_TOKEN_KEY);
  localStorage.removeItem(GOOGLE_EXPIRES_KEY);
}

/** Error text set by the last redirect back from Google, if it failed. */
let googleAuthError: string | null = null;

const AUTH_ERRORS: Record<string, string> = {
  access_denied: 'Google sign-in was cancelled.',
  email_unverified: 'That Google account has no verified email address.',
  exchange_failed: "Google sign-in failed — couldn't verify the account.",
  invalid_state: 'Google sign-in expired or was tampered with. Please try again.',
  missing_state: 'Google sign-in expired or was tampered with. Please try again.',
  missing_code: 'Google did not return an authorization code. Please try again.',
  nonce_mismatch: 'Google sign-in could not be matched to this browser. Please try again.',
};

export function getAuthError(): string | null {
  return googleAuthError;
}

/**
 * Consumes the `#token=…` fragment the backend redirects back with.
 *
 * Runs before anything renders (see main.tsx) and always strips the fragment,
 * so the session token never lingers in the address bar or in history.
 */
function captureRedirectResult(): void {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return;

  const params = new URLSearchParams(hash);
  const token = params.get('token');
  const error = params.get('auth_error');
  if (!token && !error) return; // some other fragment — leave it alone

  const expectedNonce = sessionStorage.getItem(GOOGLE_NONCE_KEY);
  sessionStorage.removeItem(GOOGLE_NONCE_KEY);

  if (error) {
    googleAuthError = AUTH_ERRORS[error] ?? 'Google sign-in failed. Please try again.';
  } else if (token) {
    // The nonce proves this redirect answers the sign-in *this* tab started.
    if (!expectedNonce || params.get('nonce') !== expectedNonce) {
      googleAuthError = AUTH_ERRORS['nonce_mismatch']!;
    } else {
      const expiresIn = Number(params.get('expires_in') ?? 0);
      localStorage.setItem(GOOGLE_TOKEN_KEY, token);
      localStorage.setItem(
        GOOGLE_EXPIRES_KEY,
        String(Date.now() + (expiresIn > 0 ? expiresIn : 3600) * 1000)
      );
    }
  }

  params.delete('token');
  params.delete('nonce');
  params.delete('provider');
  params.delete('expires_in');
  params.delete('auth_error');
  const rest = params.toString();
  window.history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search + (rest ? `#${rest}` : '')
  );
}

/**
 * Boots authentication: picks up a Google redirect if there is one, otherwise
 * restores the Keycloak session. Resolves once the app can safely render.
 */
export async function initAuth(): Promise<void> {
  captureRedirectResult();

  // A live Google session wins — initialising Keycloak as well would only add
  // a redirect round-trip for a user who is already signed in.
  if (readGoogleSession()) return;

  const savedToken = localStorage.getItem('kc_token') ?? undefined;
  const savedRefreshToken = localStorage.getItem('kc_refresh_token') ?? undefined;

  keycloak.onTokenExpired = () => {
    keycloak
      .updateToken(30)
      .then(() => {
        localStorage.setItem('kc_token', keycloak.token!);
        localStorage.setItem('kc_refresh_token', keycloak.refreshToken!);
      })
      .catch(() => {
        localStorage.removeItem('kc_token');
        localStorage.removeItem('kc_refresh_token');
      });
  };

  try {
    const authenticated = await keycloak.init({
      checkLoginIframe: false,
      token: savedToken,
      refreshToken: savedRefreshToken,
    });
    if (authenticated) {
      localStorage.setItem('kc_token', keycloak.token!);
      localStorage.setItem('kc_refresh_token', keycloak.refreshToken!);
    }
  } catch {
    // Keycloak unreachable — the app still loads, just signed out.
  }
}

/** Which provider the current session came from, or null when signed out. */
export function currentProvider(): AuthProvider | null {
  if (readGoogleSession()) return 'google';
  return keycloak.authenticated ? 'keycloak' : null;
}

/** Unverified read of a JWT's payload — fine client-side, where the token is ours. */
function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Stable per-account key, e.g. `google:1234567890`.
 *
 * Anything cached in localStorage that belongs to one account (chat sessions,
 * most obviously) must be tagged with this, or the next person to sign in on
 * the same browser inherits it.
 */
export function currentUserKey(): string | null {
  const google = readGoogleSession();
  if (google) {
    const sub = decodePayload(google.token)?.['sub'];
    return typeof sub === 'string' ? `google:${sub}` : null;
  }
  const sub = keycloak.authenticated ? keycloak.tokenParsed?.sub : undefined;
  return sub ? `keycloak:${sub}` : null;
}

export function isAuthenticated(): boolean {
  return currentProvider() !== null;
}

/** A bearer token for the backend, refreshing the Keycloak one if needed. */
export async function getToken(): Promise<string | null> {
  const google = readGoogleSession();
  if (google) return google.token;

  if (!keycloak.authenticated) return null;
  await keycloak.updateToken(30).catch(() => {});
  return keycloak.token ?? null;
}

export async function loginWithKeycloak(): Promise<void> {
  // initAuth() skips Keycloak entirely while a Google session is live, so a
  // session that expires with the tab open can leave keycloak-js uninitialised
  // — and login() throws in that state.
  if (!keycloak.didInitialize) {
    await keycloak.init({ checkLoginIframe: false }).catch(() => {});
  }
  keycloak.login();
}

/**
 * Starts the Google flow. The backend owns the redirect to Google (it holds
 * the client secret), so we just hand it a nonce and where to come back to.
 */
export function loginWithGoogle(): void {
  const nonce = crypto.randomUUID();
  sessionStorage.setItem(GOOGLE_NONCE_KEY, nonce);

  const returnTo = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({ returnTo, nonce });
  window.location.assign(`${BACKEND_URL}/api/auth/google/start?${params.toString()}`);
}

export function logout(redirectUri = window.location.origin + '/v2/editor'): void {
  // Cached chat sessions belong to the account that just left; leaving them in
  // localStorage would show them to whoever signs in next on this browser.
  useChatStore.getState().clearChats();
  // Same reasoning for the BYOK key — it's a personal credential, and the next
  // person to sign in on this browser would otherwise spend against it. This
  // leaves the panel on the school-provided model rather than re-onboarding.
  useByokStore.getState().clearByok();

  if (readGoogleSession()) {
    // Local sign-out only: we never asked for offline access, so there is no
    // Google-side session of ours to end, and signing the user out of Google
    // itself would be far more than they asked for.
    clearGoogleSession();
    window.location.assign(redirectUri);
    return;
  }
  keycloak.logout({ redirectUri });
}

/** Which providers the backend is configured to offer. Falls back to Keycloak. */
export async function fetchProviders(): Promise<{ keycloak: boolean; google: boolean }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/providers`);
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as { keycloak: boolean; google: boolean };
  } catch {
    return { keycloak: true, google: false };
  }
}
