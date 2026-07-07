import type { SimpleMessage } from '../../api/llm';

/**
 * Minimal structural type for assistant-ui thread messages — lets helpers
 * accept both ThreadMessage and the adapter's run() message shape without
 * depending on assistant-ui's internal generics.
 */
export interface ThreadLikeMessage {
  role: string;
  content: readonly unknown[];
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

/** Converts an assistant-ui thread to the SimpleMessage shape we cache. */
export function toSimpleMessages(messages: readonly ThreadLikeMessage[]): SimpleMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', text: threadMessageText(m) }))
    .filter((m) => m.text.length > 0);
}
