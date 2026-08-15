import type { SimpleMessage } from '../../api/llm';

/**
 * Minimal structural type for assistant-ui thread messages — lets helpers
 * accept both ThreadMessage and the adapter's run() message shape without
 * depending on assistant-ui's internal generics.
 */
export interface ThreadLikeMessage {
  role: string;
  content: readonly unknown[];
  metadata?: { custom?: Record<string, unknown> | undefined } | undefined;
  status?:
    | { readonly type: string; readonly reason?: string; readonly error?: unknown }
    | undefined;
}

/** Shown when a run failed without a usable message of its own. */
export const GENERIC_ERROR = 'Something went wrong talking to the AI service. Please try again.';

/** The model name a run stashed on the message, or undefined if it didn't. */
export function threadMessageModel(message: ThreadLikeMessage): string | undefined {
  const model = message.metadata?.custom?.model;
  return typeof model === 'string' && model.trim() ? model : undefined;
}

/** The failure text for a message whose run errored, or null if it didn't. */
export function threadMessageError(message: ThreadLikeMessage): string | null {
  if (message.status?.type !== 'incomplete' || message.status.reason !== 'error') return null;
  const { error } = message.status;
  return typeof error === 'string' && error.trim() ? error.trim() : GENERIC_ERROR;
}

function partText(part: unknown): string {
  return typeof part === 'object' && part !== null && 'text' in part
    ? String((part as { text: unknown }).text)
    : '';
}

/** Flattens one thread message's content parts to plain text. */
export function threadMessageText(message: ThreadLikeMessage): string {
  return message.content.map(partText).join('');
}

/**
 * Converts an assistant-ui thread to the SimpleMessage shape we cache.
 *
 * A failed turn is kept even though it has no text of its own — the error is
 * what there is to show, and dropping it used to make the failure disappear
 * the moment the panel was reopened.
 */
export function toSimpleMessages(messages: readonly ThreadLikeMessage[]): SimpleMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      const model = threadMessageModel(m);
      const error = threadMessageError(m);
      return {
        role: m.role as 'user' | 'assistant',
        text: threadMessageText(m),
        ...(model ? { model } : {}),
        ...(error ? { error } : {}),
      };
    })
    .filter((m) => m.text.length > 0 || m.error);
}
