import { useMemo, useRef } from 'react';
import { X, Send } from 'lucide-react';
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  ThreadPrimitive,
  ComposerPrimitive,
  type ChatModelAdapter,
} from '@assistant-ui/react';
import { streamAssistant, type SimpleMessage, type LlmPanel } from '../../api/llm';
import { UserMessage, AssistantMessage, MessageSync } from './MessageComponents';

const MAX_INPUT_CHARS = 2000;

export interface Chat {
  id: string;
  title: string;
  messages: SimpleMessage[];
  sessionId: string | null;
}

interface ChatThreadProps {
  chat: Chat;
  panels: LlmPanel[];
  selection: string;
  onClearSelection: () => void;
  onMessages: (chatId: string, messages: SimpleMessage[]) => void;
  onSessionId: (chatId: string, sessionId: string) => void;
}

export function ChatThread({
  chat,
  panels,
  selection,
  onClearSelection,
  onMessages,
  onSessionId,
}: ChatThreadProps) {
  const panelsRef = useRef(panels);
  panelsRef.current = panels;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const sessionIdRef = useRef(chat.sessionId);
  sessionIdRef.current = chat.sessionId;

  const initialMessages = useRef(
    chat.messages.map((m) => ({ role: m.role, content: m.text }))
  ).current;

  const chatId = chat.id;

  const adapter = useMemo<ChatModelAdapter>(
    () => ({
      async *run({ messages, abortSignal }) {
        const simple: SimpleMessage[] = messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            text: m.content.map((p) => ('text' in p ? p.text : '')).join(''),
          }))
          .filter((m) => m.text.length > 0);

        let last = '';
        for await (const text of streamAssistant({
          messages: simple,
          panels: panelsRef.current,
          selection: selectionRef.current,
          signal: abortSignal,
          sessionId: sessionIdRef.current,
          onSessionId: (id) => onSessionId(chatId, id),
        })) {
          last = text;
          yield { content: [{ type: 'text', text }] };
        }

        if (last.trim().length === 0) {
          yield { content: [{ type: 'text', text: '(No response — please try asking again.)' }] };
        }
      },
    }),
    [chatId, onSessionId]
  );

  const runtime = useLocalRuntime(adapter, { initialMessages });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <MessageSync chatId={chat.id} onMessages={onMessages} />
      <ThreadPrimitive.Root className="flex-1 flex flex-col min-h-0">
        <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          <ThreadPrimitive.Empty>
            <p className="text-xs text-slate-500 text-center mt-6">Ask anything about your code.</p>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
        </ThreadPrimitive.Viewport>

        <div className="border-t border-slate-800 p-3 shrink-0">
          {selection.trim().length > 0 && (
            <div className="mb-2 flex items-start gap-2 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                  Asking about selected code
                </p>
                <p className="truncate font-mono text-[11px] text-slate-300">{selection.trim()}</p>
              </div>
              <button
                onClick={onClearSelection}
                className="shrink-0 p-0.5 text-slate-400 hover:text-slate-200 transition-colors"
                title="Clear selected code"
              >
                <X size={12} />
              </button>
            </div>
          )}
          <ComposerPrimitive.Root className="flex gap-2 items-end">
            <ComposerPrimitive.Input
              placeholder="Ask about your code… (Enter to send)"
              rows={2}
              maxLength={MAX_INPUT_CHARS}
              className="flex-1 resize-none rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 px-3 py-2 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <ComposerPrimitive.Send
              className="p-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              title="Send"
            >
              <Send size={14} />
            </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
        </div>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
