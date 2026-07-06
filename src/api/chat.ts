import keycloak from './keycloak';
import type { SimpleMessage } from './llm';

const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ??
  {}) as Record<string, string | undefined>;

const BACKEND_URL = env.VITE_BACKEND_URL ?? 'https://k12api.torta-server.duckdns.org';

async function authHeaders(): Promise<Record<string, string>> {
  await keycloak.updateToken(30).catch(() => {});
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${keycloak.token ?? ''}`,
  };
}

export interface SessionMeta {
  id: string;
  title: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface SessionDetail extends SessionMeta {
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>;
}

export async function listChats(): Promise<SessionMeta[]> {
  const res = await fetch(`${BACKEND_URL}/api/chats`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`Failed to load chats: ${res.status}`);
  return res.json() as Promise<SessionMeta[]>;
}

export async function getChat(id: string): Promise<SessionDetail> {
  const res = await fetch(`${BACKEND_URL}/api/chats/${id}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`Failed to load chat: ${res.status}`);
  return res.json() as Promise<SessionDetail>;
}

export async function deleteChatApi(id: string): Promise<void> {
  await fetch(`${BACKEND_URL}/api/chats/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
}

export async function renameChatApi(id: string, title: string): Promise<void> {
  await fetch(`${BACKEND_URL}/api/chats/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ title }),
  });
}

export function toSimpleMessages(messages: SessionDetail['messages']): SimpleMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, text: m.content }));
}
