import { BACKEND_URL, requireAuthHeaders } from './config';
import { useAiPrefsStore, useByokStore } from '../store/appStore';
import { languageSpecFor } from '../components/ai/languageSpecs';

/**
 * Talks to the k12-llm-backend (Hono / Node) through Keycloak auth.
 * The backend proxies to LiteLLM server-side so no LiteLLM key is needed here.
 *
 * Each request carries only the newest user message plus the id of the
 * message it replies to (parentMessageId); the backend reloads the rest of
 * the conversation from its database, so payloads stay small no matter how
 * long the chat gets.
 */

export interface SimpleMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** One open editor panel: a language and its current code. */
export interface LlmPanel {
  language: string;
  code: string;
}

/** Ids of the rows the backend persisted for one completed turn. */
export interface TurnIds {
  sessionId: string;
  userMessageId: string;
  assistantMessageId: string;
}

export interface StreamOptions {
  /** The user's newest message — previous turns are never resent. */
  message: string;
  panels: LlmPanel[];
  /** Code the student highlighted — appended to the message. */
  selection?: string;
  signal?: AbortSignal;
  /** Backend session ID — if null, the backend creates a new session. */
  sessionId?: string | null;
  /** Id of the last message in the thread (normally the previous assistant reply). */
  parentMessageId?: string | null;
  /** Called with the session ID once the backend returns the X-Session-Id header. */
  onSessionId?: (id: string) => void;
  /** Called with the persisted message ids when the stream finishes. */
  onComplete?: (ids: TurnIds) => void;
}

/** Longest error text worth showing in a chat bubble. */
const MAX_ERROR_CHARS = 300;

/**
 * Makes an error string safe to render in the chat.
 *
 * The backend already reduces provider failures to one sentence, but this is
 * the last stop before the text reaches a bubble — an older backend, a proxy,
 * or an unexpected code path can still hand us a wall of JSON. Collapsing the
 * whitespace and capping the length keeps the bubble the size of a message.
 */
function displayableError(raw: string): string {
  const flat = raw.replace(/\s+/g, ' ').trim();
  return flat.length > MAX_ERROR_CHARS ? `${flat.slice(0, MAX_ERROR_CHARS - 1)}…` : flat;
}

/** BYOK headers — set only when the user configured their own provider key. */
function byokHeaders(): Record<string, string> {
  const { provider, apiKey, model } = useByokStore.getState();
  if (!provider || !apiKey.trim()) return {};
  return {
    'X-LLM-Provider': provider,
    'X-LLM-Api-Key': apiKey.trim(),
    ...(model.trim() ? { 'X-LLM-Model': model.trim() } : {}),
  };
}

/**
 * Streams the assistant's reply from the k12-llm-backend.
 * Yields the full accumulated text each time a new chunk arrives.
 */
export async function* streamAssistant(opts: StreamOptions): AsyncGenerator<string> {
  const headers = { ...(await requireAuthHeaders()), ...byokHeaders() };

  // Every panel the student actually has code in. The first is "primary" (its
  // language names the request); any others are appended so the tutor can
  // answer questions that compare the open panels.
  const filledPanels = opts.panels.filter((p) => p.code.trim().length > 0);
  const primaryPanel = filledPanels[0];
  const editorCode = filledPanels
    .map((p) => `${p.language}:\n\`\`\`${p.language}\n${p.code}\n\`\`\``)
    .join('\n\n');

  const message = opts.selection?.trim()
    ? `${opts.message}\n\nI've highlighted this specific snippet:\n\`\`\`\n${opts.selection}\n\`\`\``
    : opts.message;

  const response = await fetch(`${BACKEND_URL}/api/praxly/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      sessionId: opts.sessionId ?? undefined,
      // Deliberately omitted: with no parentMessageId the backend rebuilds the
      // whole stored conversation for this session, which is the complete and
      // correct transcript. Sending one made the backend cut history off just
      // before the previous assistant reply, so the model saw two user
      // questions in a row and answered the older one. Restore this only
      // alongside message editing, which is what the cutoff exists for.
      parentMessageId: undefined,
      // All non-empty panels, each labeled with its language.
      code: editorCode,
      language: primaryPanel?.language,
      // Praxly specs for every open panel's language — fills {{language_spec}}
      // so the tutor only describes what Praxly supports, and can compare the
      // languages the student actually has open.
      languageSpec: languageSpecFor(filledPanels.map((p) => p.language)),
      // Tutor profile — fills the prompt's user_role / user_level / use_case.
      role: useAiPrefsStore.getState().role,
      level: useAiPrefsStore.getState().level,
      useCase: useAiPrefsStore.getState().useCase,
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    // The backend explains itself in {"error": "..."} — surface that sentence
    // rather than a raw JSON blob, because it lands in front of the student as
    // the error bubble's text.
    const raw = await response.text().catch(() => '');
    let detail = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed.error) detail = parsed.error;
    } catch {
      // Not JSON (a proxy error page, say) — fall back to the raw body.
    }
    throw new Error(
      displayableError(detail) || `The AI service returned an error (${response.status}).`
    );
  }

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

      let parsed: {
        type?: string;
        delta?: string;
        message?: string;
        sessionId?: string;
        userMessageId?: string;
        assistantMessageId?: string;
      };
      try {
        parsed = JSON.parse(data);
      } catch {
        continue; // ignore malformed SSE lines
      }

      if (parsed.type === 'text-delta' && parsed.delta) {
        acc += parsed.delta;
        yield acc;
      } else if (parsed.type === 'complete' && parsed.assistantMessageId) {
        opts.onComplete?.({
          sessionId: parsed.sessionId ?? sessionId ?? '',
          userMessageId: parsed.userMessageId ?? '',
          assistantMessageId: parsed.assistantMessageId,
        });
      } else if (parsed.type === 'error') {
        throw new Error(
          displayableError(parsed.message ?? '') || 'The AI service reported an error.'
        );
      }
    }
  }
}
