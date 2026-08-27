import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { MessagePrimitive, useMessage, useThread } from '@assistant-ui/react';
import type { SimpleMessage } from '../../api/llm';
import { Markdown } from './Markdown';
import { displayModelName } from './byok';
import {
  threadMessageError,
  threadMessageModel,
  threadMessageText,
  toSimpleMessages,
} from './threadMessages';

export const UserMessage = () => (
  <MessagePrimitive.Root className="flex justify-end">
    <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap bg-indigo-600 text-white">
      <MessagePrimitive.Parts />
    </div>
  </MessagePrimitive.Root>
);

export const TypingDots = () => (
  <span className="inline-flex items-center gap-1 py-0.5" aria-label="Assistant is thinking">
    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
  </span>
);

/** Message text for a run that ended in an error, or null if it didn't. */
function useErrorText(): string | null {
  return useMessage((m) => threadMessageError(m));
}

/**
 * Which model answered, shown under the bubble so a mid-conversation model
 * change is visible. Absent on replies stored before the backend recorded the
 * model — no label is better than the wrong one.
 *
 * Stripping the provider prefix happens here, at the point of display, so it
 * also covers transcripts already cached with the id the backend sent.
 */
const ModelLabel = ({ model }: { model: string | undefined }) =>
  model ? <span className="mt-0.5 px-1 text-xs text-muted">{displayModelName(model)}</span> : null;

export const AssistantMessage = () => {
  const isRunning = useMessage((m) => m.status?.type === 'running');
  const text = useMessage((m) => threadMessageText(m));
  const model = useMessage((m) => threadMessageModel(m));
  const errorText = useErrorText();

  // A failed turn used to render as an empty gray bubble — the reply never
  // arrived, so there was nothing to show. Say what went wrong instead.
  if (errorText) {
    return (
      <MessagePrimitive.Root className="flex flex-col items-start">
        <div className="min-w-0 max-w-[85%] rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm leading-relaxed text-red-200">
          {/* Anything that streamed before the failure is still worth keeping. */}
          {text.trim() && (
            <div className="mb-2 text-slate-200">
              <Markdown text={text} />
            </div>
          )}
          <div className="flex items-start gap-2">
            <TriangleAlert size={14} className="mt-0.5 shrink-0 text-red-400" aria-hidden="true" />
            {/* min-w-0 lets this flex child shrink, and wrap-anywhere breaks the
                long unspaced tokens (URLs, JSON) that error text tends to carry
                — without both, the message pushes past the bubble's edge. */}
            <span className="block max-h-48 min-w-0 overflow-y-auto wrap-anywhere">
              {errorText}
            </span>
          </div>
        </div>
        <ModelLabel model={model} />
      </MessagePrimitive.Root>
    );
  }

  // A finished turn with no text and no recorded error. It means the reply was
  // never stored — a failure whose error text didn't survive the round trip —
  // and rendering it bare leaves an unexplained empty bubble on screen.
  //
  // The !errorText guard is redundant against the early return above and kept
  // deliberately: this branch must never be what a message carrying an error
  // falls into, and that has to stay true if the branches are ever reordered.
  if (!errorText && !isRunning && !text.trim()) {
    return (
      <MessagePrimitive.Root className="flex flex-col items-start">
        <div className="max-w-[85%] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm leading-relaxed text-muted italic">
          No reply was recorded for this turn.
        </div>
        <ModelLabel model={model} />
      </MessagePrimitive.Root>
    );
  }

  return (
    <MessagePrimitive.Root className="flex flex-col items-start">
      <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed bg-slate-800 text-slate-200 border border-slate-700">
        {isRunning && !text.trim() ? <TypingDots /> : <Markdown text={text} />}
      </div>
      <ModelLabel model={model} />
    </MessagePrimitive.Root>
  );
};

/** Mirrors the active thread's messages back to the parent so they can be cached. */
export function MessageSync({
  chatId,
  onMessages,
}: {
  chatId: string;
  onMessages: (chatId: string, messages: SimpleMessage[]) => void;
}) {
  const messages = useThread((t) => t.messages);
  useEffect(() => {
    onMessages(chatId, toSimpleMessages(messages));
  }, [messages, chatId, onMessages]);
  return null;
}
