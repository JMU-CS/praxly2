import { useMemo, useRef } from 'react';
import { X, Send } from 'lucide-react';
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  ThreadPrimitive,
  ComposerPrimitive,
  type ChatModelAdapter,
} from '@assistant-ui/react';
import { streamAssistant, type SimpleMessage, type LlmPanel, type TurnIds } from '../../api/llm';
import { useAiPrefsStore, type AiUseCase } from '../../store/appStore';
import { UserMessage, AssistantMessage, MessageSync } from './MessageComponents';
import { threadMessageText } from './threadMessages';

const USE_CASES: Array<{ value: AiUseCase; label: string; title: string }> = [
  { value: 'auto', label: 'Auto', title: 'Let the AI figure out what you need' },
  { value: 'explain', label: 'Explain', title: 'One clear explanation of your code' },
  { value: 'tutor', label: 'Tutor', title: 'Learn step by step, back and forth' },
  { value: 'practice', label: 'Practice', title: 'Exam-style practice questions' },
];

const MAX_INPUT_CHARS = 2000;

export interface Chat {
  id: string;
  title: string;
  messages: SimpleMessage[];
  /** Backend session id; null until the first turn completes. */
  sessionId: string | null;
  /** Id of the last persisted message — sent as parentMessageId on the next turn. */
  parentMessageId: string | null;
  /**
   * True once this chat's history is in `messages` — including when the answer
   * was "no messages". Without it, an empty-but-real session is indistinguishable
   * from one still loading, and the panel waits on it forever.
   */
  historyLoaded: boolean;
}

interface ChatThreadProps {
  chat: Chat;
  panels: LlmPanel[];
  selection: string;
  onClearSelection: () => void;
  onMessages: (chatId: string, messages: SimpleMessage[]) => void;
  onSessionId: (chatId: string, sessionId: string) => void;
  /** Fired when a turn is persisted — carries the new parentMessageId. */
  onTurnComplete: (chatId: string, ids: TurnIds) => void;
}

export function ChatThread({
  chat,
  panels,
  selection,
  onClearSelection,
  onMessages,
  onSessionId,
  onTurnComplete,
}: ChatThreadProps) {
  // Refs keep the adapter stable across renders while still reading fresh values.
  const panelsRef = useRef(panels);
  panelsRef.current = panels;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const sessionIdRef = useRef(chat.sessionId);
  sessionIdRef.current = chat.sessionId;
  const parentMessageIdRef = useRef(chat.parentMessageId);
  parentMessageIdRef.current = chat.parentMessageId;

  const initialMessages = useRef(
    chat.messages.map((m) => ({ role: m.role, content: m.text }))
  ).current;

  const chatId = chat.id;

  const adapter = useMemo<ChatModelAdapter>(
    () => ({
      async *run({ messages, abortSignal }) {
        // Only the newest user message goes over the wire — the backend
        // rebuilds the rest of the conversation from parentMessageId.
        const lastUser = [...messages].reverse().find((m) => m.role === 'user');
        const messageText = lastUser ? threadMessageText(lastUser) : '';

        let last = '';
        for await (const text of streamAssistant({
          message: messageText,
          panels: panelsRef.current,
          selection: selectionRef.current,
          signal: abortSignal,
          sessionId: sessionIdRef.current,
          parentMessageId: parentMessageIdRef.current,
          onSessionId: (id) => onSessionId(chatId, id),
          onComplete: (ids) => onTurnComplete(chatId, ids),
        })) {
          last = text;
          yield { content: [{ type: 'text', text }] };
        }

        if (last.trim().length === 0) {
          yield { content: [{ type: 'text', text: '(No response — please try asking again.)' }] };
        }
      },
    }),
    [chatId, onSessionId, onTurnComplete]
  );

  const runtime = useLocalRuntime(adapter, { initialMessages });

  const { useCase, setUseCase } = useAiPrefsStore();

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <MessageSync chatId={chat.id} onMessages={onMessages} />
      <ThreadPrimitive.Root className="flex-1 flex flex-col min-h-0">
        <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          <ThreadPrimitive.Empty>
            <p className="text-sm text-slate-500 text-center mt-6">Ask anything about your code.</p>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
        </ThreadPrimitive.Viewport>

        <div className="border-t border-slate-800 p-3 shrink-0">
          <div className="mb-2 flex rounded-md border border-slate-700 bg-slate-800 p-0.5">
            {USE_CASES.map((u) => (
              <button
                key={u.value}
                onClick={() => setUseCase(u.value)}
                title={u.title}
                className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  useCase === u.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
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
              className="flex-1 resize-none rounded-md bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 px-3 py-2 focus:outline-none focus:border-indigo-500 transition-colors"
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
