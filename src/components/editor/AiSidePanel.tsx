import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, KeyRound, LogIn, Plus, X } from 'lucide-react';
import type { MouseEvent } from 'react';
import Fuse from 'fuse.js';
import keycloak from '../../api/keycloak';
import { listChats, getChat, deleteChatApi, renameChatApi, toSimpleMessages } from '../../api/chat';
import { type LlmPanel, type SimpleMessage, type TurnIds } from '../../api/llm';
import { useByokStore, useChatStore, type SessionMeta } from '../../store/appStore';
import { randomId } from '../../utils/id';
import { ChatThread, type Chat } from '../ai/ChatThread';
import { HistoryPanel } from '../ai/HistoryPanel';
import { ApiKeySettings } from '../ai/ApiKeySettings';
import { TypingDots } from '../ai/MessageComponents';

interface AiSidePanelProps {
  width: number;
  isResizing: boolean;
  onStartResize: (e: MouseEvent) => void;
  onClose: () => void;
  panels: LlmPanel[];
  selection: string;
  onClearSelection: () => void;
}

const makeNewChat = (): Chat => ({
  id: randomId(),
  title: 'New chat',
  messages: [],
  sessionId: null,
  parentMessageId: null,
});

const titleFrom = (text: string): string => {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > 40 ? `${clean.slice(0, 40)}…` : clean || 'New chat';
};

const sessionToChat = (s: SessionMeta, messages: SimpleMessage[] = []): Chat => ({
  id: s.id,
  title: s.title ?? 'New chat',
  messages,
  sessionId: s.id,
  parentMessageId: null,
});

export function AiSidePanel({
  width,
  isResizing,
  onStartResize,
  onClose,
  panels,
  selection,
  onClearSelection,
}: AiSidePanelProps) {
  const {
    sessions,
    setSessions,
    addSession,
    removeSession,
    updateSession,
    setMessages,
    getCachedMessages,
  } = useChatStore();
  const byokProvider = useByokStore((s) => s.provider);

  const [localChats, setLocalChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showKeySettings, setShowKeySettings] = useState(false);
  const [search, setSearch] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Load session list from backend (skipped if sessions already in persisted store).
  useEffect(() => {
    if (!keycloak.authenticated) return;
    if (sessions.length > 0) {
      const chats = sessions.map((s) => sessionToChat(s, getCachedMessages(s.id)));
      setLocalChats(chats);
      if (chats.length > 0) setActiveId(chats[0].id);
      return;
    }
    listChats()
      .then((s) => {
        setSessions(s);
        const chats = s.map((sess) => sessionToChat(sess));
        setLocalChats(chats);
        if (chats.length > 0) setActiveId(chats[0].id);
      })
      .catch(() => {});
  }, [setSessions, getCachedMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load messages for the active chat — check cache first, fetch only if needed.
  // The backend fetch also recovers the id of the last message, which becomes
  // the parentMessageId for the next turn.
  useEffect(() => {
    if (!activeId) return;
    const chat = localChats.find((c) => c.id === activeId);
    if (!chat?.sessionId || chat.messages.length > 0) return;

    const cached = getCachedMessages(chat.sessionId);
    if (cached && chat.parentMessageId) {
      setLocalChats((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, messages: cached } : c))
      );
      return;
    }

    setLoadingMessages(true);
    getChat(chat.sessionId)
      .then((detail) => {
        const messages = toSimpleMessages(detail.messages);
        const parentMessageId = detail.messages.at(-1)?.id ?? null;
        setMessages(chat.sessionId!, messages);
        setLocalChats((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, messages, parentMessageId } : c))
        );
      })
      .catch(() => {})
      .finally(() => setLoadingMessages(false));
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeChat = localChats.find((c) => c.id === activeId) ?? null;

  const handleMessages = useCallback(
    (chatId: string, messages: SimpleMessage[]) => {
      setLocalChats((prev) =>
        prev.map((c) => {
          if (c.id !== chatId) return c;
          const firstUser = messages.find((m) => m.role === 'user');
          const title = firstUser ? titleFrom(firstUser.text) : c.title;
          if (c.sessionId && title !== c.title) {
            renameChatApi(c.sessionId, title).catch(() => {});
            updateSession(c.sessionId, { title });
          }
          if (c.sessionId) setMessages(c.sessionId, messages);
          return { ...c, messages, title };
        })
      );
    },
    [updateSession, setMessages]
  );

  const handleSessionId = useCallback(
    (chatId: string, sessionId: string) => {
      setLocalChats((prev) =>
        prev.map((c) => {
          if (c.id !== chatId || c.sessionId) return c;
          addSession({
            id: sessionId,
            title: null,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });
          return { ...c, sessionId };
        })
      );
    },
    [addSession]
  );

  // After each persisted turn, remember the assistant message id — it becomes
  // the parentMessageId the next request references instead of a transcript.
  const handleTurnComplete = useCallback((chatId: string, ids: TurnIds) => {
    setLocalChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, parentMessageId: ids.assistantMessageId } : c))
    );
  }, []);

  const newChat = useCallback(() => {
    const c = makeNewChat();
    setLocalChats((prev) => [c, ...prev]);
    setActiveId(c.id);
    setShowHistory(false);
    setShowKeySettings(false);
  }, []);

  const openChat = useCallback((id: string) => {
    setActiveId(id);
    setShowHistory(false);
  }, []);

  const deleteChat = useCallback(
    (id: string) => {
      const chat = localChats.find((c) => c.id === id);
      if (chat?.sessionId) {
        deleteChatApi(chat.sessionId).catch(() => {});
        removeSession(chat.sessionId);
      }
      setLocalChats((prev) => {
        const next = prev.filter((c) => c.id !== id);
        return next.length > 0 ? next : [makeNewChat()];
      });
      if (activeId === id) {
        const remaining = localChats.filter((c) => c.id !== id);
        setActiveId(remaining[0]?.id ?? null);
      }
    },
    [localChats, activeId, removeSession]
  );

  // Fuse index built from chat titles only — rebuilt when the list changes,
  // not on every streamed token (titles only change on new/renamed chats).
  const fuse = useMemo(
    () => new Fuse(localChats, { keys: ['title'], threshold: 0.4 }),
    [localChats]
  );

  const filteredChats = useMemo(() => {
    const q = search.trim();
    return q ? fuse.search(q).map((r) => r.item) : localChats;
  }, [search, fuse, localChats]);

  const iconBtn =
    'p-1 text-slate-400 hover:text-slate-100 transition-colors rounded hover:bg-slate-800';

  return (
    <div
      className="shrink-0 flex flex-col bg-slate-900 border-l border-slate-800 relative z-[140]"
      style={{ width }}
    >
      <div
        className={`absolute top-0 left-0 w-1 h-full cursor-col-resize z-[200] transition-colors ${
          isResizing ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/40'
        }`}
        onMouseDown={onStartResize}
      />

      <div className="h-10 px-3 flex items-center justify-between border-b border-slate-800 bg-slate-900/80 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
          AI Assistant
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={newChat} className={iconBtn} title="New chat">
            <Plus size={15} />
          </button>
          <button
            onClick={() => {
              setShowHistory((s) => !s);
              setShowKeySettings(false);
            }}
            className={`${iconBtn} ${showHistory ? 'text-indigo-300 bg-slate-800' : ''}`}
            title="Chat history"
          >
            <History size={15} />
          </button>
          <button
            onClick={() => {
              setShowKeySettings((s) => !s);
              setShowHistory(false);
            }}
            className={`${iconBtn} relative ${showKeySettings ? 'text-indigo-300 bg-slate-800' : ''}`}
            title="AI model & API key"
          >
            <KeyRound size={15} />
            {byokProvider && (
              <span
                className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400"
                title={`Using your ${byokProvider} key`}
              />
            )}
          </button>
          <button onClick={onClose} className={iconBtn} title="Close AI panel">
            <X size={15} />
          </button>
        </div>
      </div>

      {!keycloak.authenticated ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-sm text-slate-400">Sign in to use the AI assistant.</p>
          <button
            onClick={() => keycloak.login()}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white text-xs hover:bg-indigo-500 transition-colors"
          >
            <LogIn size={14} />
            Sign in
          </button>
        </div>
      ) : showKeySettings ? (
        <ApiKeySettings onDone={() => setShowKeySettings(false)} />
      ) : showHistory ? (
        <HistoryPanel
          chats={filteredChats}
          activeId={activeId}
          search={search}
          onSearchChange={setSearch}
          onOpen={openChat}
          onDelete={deleteChat}
        />
      ) : activeChat ? (
        loadingMessages || (activeChat.sessionId !== null && activeChat.messages.length === 0) ? (
          <div className="flex-1 flex items-center justify-center">
            <TypingDots />
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
            onTurnComplete={handleTurnComplete}
          />
        )
      ) : null}
    </div>
  );
}
