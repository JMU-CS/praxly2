import { getToken } from './auth';

/**
 * Shared configuration for every k12-llm-backend call.
 *
 * BACKEND_URL is defined in backend.ts and re-exported here so callers keep
 * importing their base URL and headers from one place.
 */

export { BACKEND_URL } from './backend';

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
