import keycloak from '../auth/keycloak';

/**
 * Talks to the k12-llm-backend (Hono / Node) through Keycloak auth.
 * The backend proxies to LiteLLM server-side so no LiteLLM key is needed here.
 *
 * Config (optional — defaults point to the shared dev server):
 *   VITE_BACKEND_URL  - k12-llm-backend base URL
 */

const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ??
  {}) as Record<string, string | undefined>;

const BACKEND_URL = env.VITE_BACKEND_URL ?? 'https://k12api.torta-server.duckdns.org';

export interface SimpleMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** One open editor panel: a language and its current code. */
export interface LlmPanel {
  language: string;
  code: string;
}

export interface StreamOptions {
  messages: SimpleMessage[];
  panels: LlmPanel[];
  /** Code the student highlighted — appended to the last user message. */
  selection?: string;
  signal?: AbortSignal;
  /** Backend session ID — if null, the backend creates a new session. */
  sessionId?: string | null;
  /** Called with the session ID once the backend returns the X-Session-Id header. */
  onSessionId?: (id: string) => void;
}

/**
 * Streams the assistant's reply from the k12-llm-backend.
 * Yields the full accumulated text each time a new chunk arrives.
 */
export async function* streamAssistant(opts: StreamOptions): AsyncGenerator<string> {
  // Silently try to refresh the token if it's about to expire.
  await keycloak.updateToken(30).catch(() => {});

  const token = keycloak.token;
  if (!token) throw new Error('Not authenticated — please refresh the page to log in.');

  // Send the first non-empty panel as code context.
  const primaryPanel = opts.panels.find((p) => p.code.trim().length > 0);

  // Append any highlighted selection to the last user message.
  const backendMessages = opts.messages.map((m, i) => {
    const isLastUser = i === opts.messages.length - 1 && m.role === 'user';
    const content =
      isLastUser && opts.selection?.trim()
        ? `${m.text}\n\nI've highlighted this specific snippet:\n\`\`\`\n${opts.selection}\n\`\`\``
        : m.text;
    return { role: m.role, content };
  });

  const response = await fetch(`${BACKEND_URL}/api/praxly/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      sessionId: opts.sessionId ?? undefined,
      messages: backendMessages,
      code: primaryPanel?.code,
      language: primaryPanel?.language,
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`AI request failed (${response.status})${text ? `: ${text}` : ''}`);
  }

  // The backend tells us which session was used/created so we can reuse it.
  const sessionId = response.headers.get('X-Session-Id');
  if (sessionId) opts.onSessionId?.(sessionId);

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let acc = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data) as {
          type?: string;
          delta?: string;
        };
        const delta = parsed.type === 'text-delta' ? (parsed.delta ?? '') : '';
        if (delta) {
          acc += delta;
          yield acc;
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
  }
}
