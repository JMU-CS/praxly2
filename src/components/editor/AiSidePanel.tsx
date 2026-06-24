import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { History, LogIn, Plus, Search, Send, Trash2, X } from 'lucide-react';
import type { MouseEvent } from 'react';
import keycloak from '../../auth/keycloak';
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  useThread,
  useMessage,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  type ChatModelAdapter,
} from '@assistant-ui/react';
import { streamAssistant, type SimpleMessage, type LlmPanel } from '../../util/llm';

// Max characters a user may send in one message. Keeps requests bounded so we
// don't overload the model's context window. Easy to tune.
const MAX_INPUT_CHARS = 2000;

interface AiSidePanelProps {
  width: number;
  isResizing: boolean;
  onStartResize: (e: MouseEvent) => void;
  onClose: () => void;
  panels: LlmPanel[];
  selection: string;
  onClearSelection: () => void;
}

interface Chat {
  id: string;
  title: string;
  messages: SimpleMessage[];
  /** Backend session ID — null until the first message is sent. */
  sessionId: string | null;
}

const newChatId = (): string =>
  window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).slice(2);

const makeChat = (): Chat => ({
  id: newChatId(),
  title: 'New chat',
  messages: [],
  sessionId: null,
});

const titleFrom = (text: string): string => {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > 40 ? `${clean.slice(0, 40)}…` : clean || 'New chat';
};

const UserMessage = () => (
  <MessagePrimitive.Root className="flex justify-end">
    <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap bg-indigo-600 text-white">
      <MessagePrimitive.Parts />
    </div>
  </MessagePrimitive.Root>
);

const TypingDots = () => (
  <span className="inline-flex items-center gap-1 py-0.5" aria-label="Assistant is thinking">
    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
  </span>
);

const AssistantMessage = () => {
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

/**
 * Mirrors the active thread's messages back into the parent chat store so they
 * survive switching chats (within the session).
 */
function MessageSync({
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

/**
 * One conversation: its own assistant-ui runtime seeded from the saved messages.
 * Re-mounted (via `key`) when the active chat changes.
 */
function ChatThread({
  chat,
  panels,
  selection,
  onClearSelection,
  onMessages,
  onSessionId,
}: {
  chat: Chat;
  panels: LlmPanel[];
  selection: string;
  onClearSelection: () => void;
  onMessages: (chatId: string, messages: SimpleMessage[]) => void;
  onSessionId: (chatId: string, sessionId: string) => void;
}) {
  const panelsRef = useRef(panels);
  panelsRef.current = panels;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const sessionIdRef = useRef(chat.sessionId);
  sessionIdRef.current = chat.sessionId;

  // Captured once at mount so the runtime isn't reset on every parent render.
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

        {/* Input area */}
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

export function AiSidePanel({
  width,
  isResizing,
  onStartResize,
  onClose,
  panels,
  selection,
  onClearSelection,
}: AiSidePanelProps) {
  const [chats, setChats] = useState<Chat[]>(() => [makeChat()]);
  const [activeId, setActiveId] = useState<string>(() => chats[0].id);
  const [showHistory, setShowHistory] = useState(false);
  const [search, setSearch] = useState('');

  // Keep activeId pointing at a chat that still exists.
  useEffect(() => {
    if (chats.length > 0 && !chats.some((c) => c.id === activeId)) {
      setActiveId(chats[0].id);
    }
  }, [chats, activeId]);

  const activeChat = chats.find((c) => c.id === activeId) ?? chats[0];

  const handleMessages = useCallback((chatId: string, messages: SimpleMessage[]) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const firstUser = messages.find((m) => m.role === 'user');
        return { ...c, messages, title: firstUser ? titleFrom(firstUser.text) : 'New chat' };
      })
    );
  }, []);

  const handleSessionId = useCallback((chatId: string, sessionId: string) => {
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, sessionId } : c)));
  }, []);

  const newChat = useCallback(() => {
    const c = makeChat();
    setChats((prev) => [c, ...prev]);
    setActiveId(c.id);
    setShowHistory(false);
  }, []);

  const openChat = useCallback((id: string) => {
    setActiveId(id);
    setShowHistory(false);
  }, []);

  const deleteChat = useCallback((id: string) => {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      return next.length > 0 ? next : [makeChat()];
    });
  }, []);

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.text.toLowerCase().includes(q))
    );
  }, [chats, search]);

  const iconBtn =
    'p-1 text-slate-400 hover:text-slate-100 transition-colors rounded hover:bg-slate-800';

  return (
    <div
      className="shrink-0 flex flex-col bg-slate-900 border-l border-slate-800 relative z-[140]"
      style={{ width }}
    >
      {/* Resize handle */}
      <div
        className={`absolute top-0 left-0 w-1 h-full cursor-col-resize z-[200] transition-colors ${
          isResizing ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/40'
        }`}
        onMouseDown={onStartResize}
      />

      {/* Header */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-slate-800 bg-slate-900/80 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
          AI Assistant
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={newChat} className={iconBtn} title="New chat">
            <Plus size={15} />
          </button>
          <button
            onClick={() => setShowHistory((s) => !s)}
            className={`${iconBtn} ${showHistory ? 'text-indigo-300 bg-slate-800' : ''}`}
            title="Chat history"
          >
            <History size={15} />
          </button>
          <button onClick={onClose} className={iconBtn} title="Close AI panel">
            <X size={15} />
          </button>
        </div>
      </div>

      {!keycloak.authenticated ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-xs text-slate-400">Sign in to use the AI assistant.</p>
          <button
            onClick={() => keycloak.login()}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white text-xs hover:bg-indigo-500 transition-colors"
          >
            <LogIn size={14} />
            Sign in
          </button>
        </div>
      ) : showHistory ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Search */}
          <div className="p-2 border-b border-slate-800">
            <div className="flex items-center gap-2 rounded-md bg-slate-800 border border-slate-700 px-2">
              <Search size={13} className="text-slate-500 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats…"
                className="flex-1 bg-transparent py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>
          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
            {filteredChats.length === 0 && (
              <p className="text-xs text-slate-500 text-center mt-6">No chats found.</p>
            )}
            {filteredChats.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                  c.id === activeId ? 'bg-slate-800' : 'hover:bg-slate-800/60'
                }`}
                onClick={() => openChat(c.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-slate-200">{c.title}</p>
                  <p className="text-[10px] text-slate-500">
                    {c.messages.length === 0
                      ? 'Empty'
                      : `${c.messages.length} message${c.messages.length === 1 ? '' : 's'}`}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(c.id);
                  }}
                  className="shrink-0 p-1 text-slate-500 opacity-0 group-hover:opacity-100 hover:text-red-400 transition"
                  title="Delete chat"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ChatThread
          key={activeChat.id}
          chat={activeChat}
          panels={panels}
          selection={selection}
          onClearSelection={onClearSelection}
          onMessages={handleMessages}
          onSessionId={handleSessionId}
        />
      )}
    </div>
  );
}
