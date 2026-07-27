import { getToken } from './auth';

/**
 * Shared configuration for every k12-llm-backend call.
 *
 * Config (optional — defaults point to the shared dev server):
 *   VITE_BACKEND_URL - k12-llm-backend base URL
 */

const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ??
  {}) as Record<string, string | undefined>;

export const BACKEND_URL = env.VITE_BACKEND_URL ?? 'https://k12api.torta-server.duckdns.org';

/**
 * Standard request headers, carrying whichever bearer token the current
 * sign-in method produced (Keycloak access token or Google session token).
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token ?? ''}`,
  };
}

/** Like authHeaders, but throws when the user isn't signed in (chat requires auth). */
export async function requireAuthHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated — please refresh the page to log in.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}
