import { BACKEND_URL, authHeaders } from './config';
import type { SimpleMessage } from './llm';

/** Session list / detail endpoints — chat content lives in the backend DB. */

export interface SessionMeta {
  id: string;
  title: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface SessionDetail extends SessionMeta {
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>;
}

/** Carries the status code so callers can tell "gone" from "try again later". */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export async function listChats(): Promise<SessionMeta[]> {
  const res = await fetch(`${BACKEND_URL}/api/chats`, { headers: await authHeaders() });
  if (!res.ok) throw new HttpError(`Failed to load chats (${res.status})`, res.status);
  return res.json() as Promise<SessionMeta[]>;
}

export async function getChat(id: string): Promise<SessionDetail> {
  const res = await fetch(`${BACKEND_URL}/api/chats/${id}`, { headers: await authHeaders() });
  if (!res.ok) throw new HttpError(`Failed to load chat (${res.status})`, res.status);
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
