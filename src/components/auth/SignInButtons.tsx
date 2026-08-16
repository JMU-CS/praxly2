import { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { fetchProviders, getAuthError, loginWithGoogle, loginWithKeycloak } from '../../api/auth';
import { PolicyLinks } from '../PolicyLinks';

/**
 * The sign-in choices, shared by the AI panel and the account page so both
 * always offer the same providers.
 *
 * The Google button only appears once the backend confirms it's configured —
 * a deployment without Google credentials shows the Keycloak login alone.
 */

/** Google's brand mark, per their sign-in branding guidelines. */
function GoogleMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function SignInButtons({ compact = false }: { compact?: boolean }) {
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const error = getAuthError();

  useEffect(() => {
    let active = true;
    fetchProviders().then((p) => {
      if (active) setGoogleAvailable(p.google);
    });
    return () => {
      active = false;
    };
  }, []);

  const size = compact ? 'px-4 py-2 text-xs' : 'px-4 py-2.5 text-sm';

  return (
    <div className={`flex w-full flex-col items-center gap-2 ${compact ? '' : 'max-w-xs'}`}>
      {error && (
        <p className="w-full rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {googleAvailable && (
        <button
          onClick={loginWithGoogle}
          className={`flex w-full items-center justify-center gap-2 rounded-md border border-slate-600 bg-white text-slate-800 ${size} font-medium transition-colors hover:bg-slate-100`}
        >
          <GoogleMark size={16} />
          Sign in with Google
        </button>
      )}

      <button
        onClick={() => void loginWithKeycloak()}
        className={`flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 text-white ${size} transition-colors hover:bg-indigo-500`}
      >
        <LogIn size={14} />
        Sign in with Praxly
      </button>

      {/* Both buttons hand the browser to a duckdns host, which reads as a
          phishing redirect if you are not expecting it. Name it here so the
          address bar confirms something the user was already told. */}
      <p className="mt-3 text-center text-xs text-muted">
        Signing in is in beta. Both options currently use{' '}
        <strong className="font-semibold whitespace-nowrap text-slate-300">
          torta-server.duckdns.org
        </strong>
        , a temporary backend for testing. Signing in will move to{' '}
        <strong className="font-semibold whitespace-nowrap text-slate-300">
          praxly.cs.jmu.edu
        </strong>{' '}
        once the server is ready.
      </p>

      {/* Before either button, not after signing in: what an account stores is
          worth reading while it is still a choice. */}
      <PolicyLinks className="mt-3 text-center" />
    </div>
  );
}
