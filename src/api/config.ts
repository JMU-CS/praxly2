import keycloak from './keycloak';

/**
 * Shared configuration for every k12-llm-backend call.
 *
 * Config (optional — defaults point to the shared dev server):
 *   VITE_BACKEND_URL - k12-llm-backend base URL
 */

const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ??
  {}) as Record<string, string | undefined>;

export const BACKEND_URL = env.VITE_BACKEND_URL ?? 'https://k12api.torta-server.duckdns.org';

/** Refreshes the Keycloak token if needed and returns standard request headers. */
export async function authHeaders(): Promise<Record<string, string>> {
  await keycloak.updateToken(30).catch(() => {});
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${keycloak.token ?? ''}`,
  };
}

/** Like authHeaders, but throws when the user isn't signed in (chat requires auth). */
export async function requireAuthHeaders(): Promise<Record<string, string>> {
  const headers = await authHeaders();
  if (!keycloak.token) {
    throw new Error('Not authenticated — please refresh the page to log in.');
  }
  return headers;
}
