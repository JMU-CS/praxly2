import { BACKEND_URL, authHeaders } from './config';

/** Client for the backend's account self-service routes (/api/account). */

export interface AccountProfile {
  id: string;
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string | null;
  roles: string[];
  /** Which identity provider owns this account's credentials. */
  provider: 'keycloak' | 'google';
}

export interface AccountUsage {
  sessions: number;
  messages: number;
  sent: number;
  received: number;
  firstActivity: string | null;
  lastActivity: string | null;
  daily: Array<{ day: string; count: number }>;
}

async function parseOrThrow<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to ${action} (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function getAccount(): Promise<AccountProfile> {
  const res = await fetch(`${BACKEND_URL}/api/account`, { headers: await authHeaders() });
  return parseOrThrow<AccountProfile>(res, 'load account');
}

export async function getUsage(): Promise<AccountUsage> {
  const res = await fetch(`${BACKEND_URL}/api/account/usage`, { headers: await authHeaders() });
  return parseOrThrow<AccountUsage>(res, 'load usage');
}

export async function updateProfile(updates: {
  email?: string;
  firstName?: string;
  lastName?: string;
}): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/account/profile`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(updates),
  });
  await parseOrThrow(res, 'update profile');
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/account/password`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  await parseOrThrow(res, 'change password');
}
