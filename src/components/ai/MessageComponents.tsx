import { useEffect } from 'react';
import { MessagePrimitive, useMessage, useThread } from '@assistant-ui/react';
import type { SimpleMessage } from '../../api/llm';

export const UserMessage = () => (
  <MessagePrimitive.Root className="flex justify-end">
    <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap bg-indigo-600 text-white">
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
  const hasText = useMessage((m) =>
    m.content.some((p) => ('text' in p ? p.text.trim().length > 0 : false))
  );
  return (
    <MessagePrimitive.Root className="flex justify-start">
      <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap bg-slate-800 text-slate-200 border border-slate-700">
        {isRunning && !hasText ? <TypingDots /> : <MessagePrimitive.Parts />}
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
    const simple: SimpleMessage[] = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        text: m.content.map((p) => ('text' in p ? p.text : '')).join(''),
      }))
      .filter((m) => m.text.length > 0);
    onMessages(chatId, simple);
  }, [messages, chatId, onMessages]);
  return null;
}
