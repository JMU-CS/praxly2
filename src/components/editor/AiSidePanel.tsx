import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Plus, UserCircle, X } from 'lucide-react';
import type { MouseEvent } from 'react';
import Fuse from 'fuse.js';
import { currentUserKey, isAuthenticated } from '../../api/auth';
import {
  listChats,
  getChat,
  deleteChatApi,
  renameChatApi,
  toSimpleMessages,
  HttpError,
} from '../../api/chat';
import { type LlmPanel, type SimpleMessage, type TurnIds } from '../../api/llm';
import {
  useAiConsentStore,
  useByokStore,
  useChatStore,
  type SessionMeta,
} from '../../store/appStore';
import { randomId } from '../../utils/id';
import { ChatThread, type Chat } from '../ai/ChatThread';
import { HistoryPanel } from '../ai/HistoryPanel';
import { ApiKeyGate } from '../ai/ApiKeyGate';
import { AiTermsModal } from '../ai/AiTermsModal';
import { SignInButtons } from '../auth/SignInButtons';
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
  historyLoaded: true, // nothing to fetch — it exists only in this browser
});

const titleFrom = (text: string): string => {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > 40 ? `${clean.slice(0, 40)}…` : clean || 'New chat';
};

const sessionToChat = (s: SessionMeta, messages?: SimpleMessage[]): Chat => ({
  id: s.id,
  title: s.title ?? 'New chat',
  messages: messages ?? [],
  sessionId: s.id,
  parentMessageId: null,
  // A cache hit is the history; anything else still needs fetching.
  historyLoaded: messages !== undefined,
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
    claimFor,
  } = useChatStore();

  const signedIn = isAuthenticated();
  const configured = useByokStore((s) => s.configured);
  const termsAccepted = useAiConsentStore((s) => s.accepted);
  const acceptTerms = useAiConsentStore((s) => s.accept);

  const [localChats, setLocalChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [search, setSearch] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped by "Try again" to re-run the message load for the active chat.
  const [reloadNonce, setReloadNonce] = useState(0);

  // Load session list from backend (skipped if sessions already in persisted
  // store). Always ends with at least one chat selected — a fresh local chat
  // is created when the user has no history, so the panel is ready to type
  // into without pressing "+" first.
  useEffect(() => {
    if (!signedIn) return;

    const showChats = (chats: Chat[]) => {
      const withFallback = chats.length > 0 ? chats : [makeNewChat()];
      setLocalChats(withFallback);
      setActiveId(withFallback[0].id);
    };

    // The persisted store is one localStorage key shared by every account that
    // has used this browser. Hand it to whoever is signed in now; if it was
    // someone else's, it gets wiped and we fall through to a fresh fetch.
    const switchedAccount = claimFor(currentUserKey());
    const cachedSessions = switchedAccount ? [] : sessions;

    if (cachedSessions.length > 0) {
      showChats(cachedSessions.map((s) => sessionToChat(s, getCachedMessages(s.id))));
      return;
    }
    listChats()
      .then((s) => {
        setSessions(s);
        showChats(s.map((sess) => sessionToChat(sess)));
      })
      // Backend unreachable — still give the user an empty chat to type into.
      .catch(() => showChats([]));
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
        prev.map((c) => (c.id === activeId ? { ...c, messages: cached, historyLoaded: true } : c))
      );
      return;
    }

    const sessionId = chat.sessionId;
    setLoadError(null);
    setLoadingMessages(true);
    getChat(sessionId)
      .then((detail) => {
        const messages = toSimpleMessages(detail.messages);
        const parentMessageId = detail.messages.at(-1)?.id ?? null;
        setMessages(sessionId, messages);
        setLocalChats((prev) =>
          prev.map((c) =>
            c.id === activeId ? { ...c, messages, parentMessageId, historyLoaded: true } : c
          )
        );
      })
      .catch((e: unknown) => {
        // 404 means the session isn't ours (or no longer exists) — a stale
        // entry we should forget, not retry. Dropping it also stops the panel
        // waiting on history that is never going to arrive.
        if (e instanceof HttpError && (e.status === 404 || e.status === 403)) {
          removeSession(sessionId);
          setLocalChats((prev) => {
            const next = prev.filter((c) => c.sessionId !== sessionId);
            return next.length > 0 ? next : [makeNewChat()];
          });
          return;
        }
        setLoadError(e instanceof Error ? e.message : 'Failed to load this chat.');
      })
      .finally(() => setLoadingMessages(false));
  }, [activeId, reloadNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const retryLoad = useCallback(() => setReloadNonce((n) => n + 1), []);

  // Keep a valid selection when the active chat is dropped above.
  useEffect(() => {
    if (localChats.length > 0 && !localChats.some((c) => c.id === activeId)) {
      setActiveId(localChats[0]!.id);
    }
  }, [localChats, activeId]);

  const activeChat = localChats.find((c) => c.id === activeId) ?? null;

  // Latest chat list for event handlers. Side effects (API calls, store
  // writes) must never run inside a setState updater — React is free to
  // invoke updaters more than once (it does in StrictMode), which is exactly
  // how duplicate sessions ended up persisted in the chat store.
  const localChatsRef = useRef(localChats);
  localChatsRef.current = localChats;

  const handleMessages = useCallback(
    (chatId: string, messages: SimpleMessage[]) => {
      const chat = localChatsRef.current.find((c) => c.id === chatId);
      if (!chat) return;

      const firstUser = messages.find((m) => m.role === 'user');
      const title = firstUser ? titleFrom(firstUser.text) : chat.title;
      if (chat.sessionId) {
        if (title !== chat.title) {
          renameChatApi(chat.sessionId, title).catch(() => {});
          updateSession(chat.sessionId, { title });
        }
        setMessages(chat.sessionId, messages);
      }

      setLocalChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, messages, title } : c)));
    },
    [updateSession, setMessages]
  );

  const handleSessionId = useCallback(
    (chatId: string, sessionId: string) => {
      const chat = localChatsRef.current.find((c) => c.id === chatId);
      if (!chat || chat.sessionId) return;

      addSession({
        id: sessionId,
        title: null,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      setLocalChats((prev) =>
        prev.map((c) => (c.id === chatId && !c.sessionId ? { ...c, sessionId } : c))
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
          {/* Chat controls appear only once the user has chosen a model. */}
          {signedIn && configured && (
            <>
              <button onClick={newChat} className={iconBtn} title="New chat">
                <Plus size={18} />
              </button>
              <button
                onClick={() => setShowHistory((s) => !s)}
                className={`${iconBtn} ${showHistory ? 'text-indigo-300 bg-slate-800' : ''}`}
                title="Chat history"
              >
                <History size={18} />
              </button>
            </>
          )}
          {/* Signed out, the panel body below is the sign-in surface — it has
              to be, now that there is more than one provider to choose from. */}
          {signedIn && (
            <Link to="/v2/account" className={iconBtn} title="Manage your account">
              <UserCircle size={18} />
            </Link>
          )}
          <button onClick={onClose} className={iconBtn} title="Close AI panel">
            <X size={18} />
          </button>
        </div>
      </div>

      {!signedIn ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-sm text-slate-400">Sign in to use the AI assistant.</p>
          <SignInButtons compact />
        </div>
      ) : !configured ? (
        // Onboarding gate: must pick a model before anything else is reachable.
        <ApiKeyGate onDone={() => setShowHistory(false)} />
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
        loadError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-slate-400">{loadError}</p>
            <button
              onClick={retryLoad}
              className="rounded-md bg-indigo-600 px-4 py-2 text-xs text-white transition-colors hover:bg-indigo-500"
            >
              Try again
            </button>
          </div>
        ) : loadingMessages || !activeChat.historyLoaded ? (
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

      {/* Usage-tracking consent — required before using the AI; must accept or the panel closes. */}
      {signedIn && !termsAccepted && <AiTermsModal onAccept={acceptTerms} onDecline={onClose} />}
    </div>
  );
}
