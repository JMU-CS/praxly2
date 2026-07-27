import { useEffect } from 'react';
import { MessagePrimitive, useMessage, useThread } from '@assistant-ui/react';
import type { SimpleMessage } from '../../api/llm';
import { Markdown } from './Markdown';
import { threadMessageText, toSimpleMessages } from './threadMessages';

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

export const AssistantMessage = () => {
  const isRunning = useMessage((m) => m.status?.type === 'running');
  const text = useMessage((m) => threadMessageText(m));
  return (
    <MessagePrimitive.Root className="flex justify-start">
      <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed bg-slate-800 text-slate-200 border border-slate-700">
        {isRunning && !text.trim() ? <TypingDots /> : <Markdown text={text} />}
      </div>
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
