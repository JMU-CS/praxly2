import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SessionMeta } from '../api/chat';
import type { SimpleMessage } from '../api/llm';

export type { SessionMeta };

interface ChatStore {
  /** Session metadata — persisted to localStorage so the list survives page refresh. */
  sessions: SessionMeta[];
  /** In-memory message cache — survives panel close/reopen within a session. */
  messageCache: Record<string, SimpleMessage[]>;
  setSessions: (sessions: SessionMeta[]) => void;
  addSession: (session: SessionMeta) => void;
  removeSession: (id: string) => void;
  updateSession: (id: string, updates: Partial<SessionMeta>) => void;
  setMessages: (sessionId: string, messages: SimpleMessage[]) => void;
  getCachedMessages: (sessionId: string) => SimpleMessage[] | undefined;
}

/** Providers users can bring their own API key for. */
export type ByokProvider = 'gemini' | 'anthropic' | 'openai';

interface ByokStore {
  /** null → use the school-provided model through the backend's own key. */
  provider: ByokProvider | null;
  apiKey: string;
  /** Optional model override; empty string → backend default for the provider. */
  model: string;
  setByok: (settings: { provider: ByokProvider | null; apiKey: string; model: string }) => void;
  clearByok: () => void;
}

/**
 * Bring-your-own-key settings. Persisted to localStorage so the key survives
 * refreshes; it is only ever sent to our backend (as X-LLM-* headers), which
 * forwards it per-request to the LLM provider without storing it.
 */
export const useByokStore = create<ByokStore>()(
  persist(
    (set) => ({
      provider: null,
      apiKey: '',
      model: '',
      setByok: ({ provider, apiKey, model }) => set({ provider, apiKey, model }),
      clearByok: () => set({ provider: null, apiKey: '', model: '' }),
    }),
    { name: 'praxly-byok' }
  )
);

/**
 * Drops sessions whose id was already seen, keeping the first occurrence.
 * The store must never hold two entries for one backend session — duplicates
 * would be persisted to localStorage and survive refreshes.
 */
const dedupeSessions = (sessions: SessionMeta[]): SessionMeta[] => {
  const seen = new Set<string>();
  return sessions.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      messageCache: {},
      setSessions: (sessions) => set({ sessions: dedupeSessions(sessions) }),
      addSession: (session) =>
        set((s) =>
          // Idempotent: re-adding a known session must not create a duplicate.
          s.sessions.some((c) => c.id === session.id) ? s : { sessions: [session, ...s.sessions] }
        ),
      removeSession: (id) =>
        set((s) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [id]: _dropped, ...rest } = s.messageCache;
          return { sessions: s.sessions.filter((c) => c.id !== id), messageCache: rest };
        }),
      updateSession: (id, updates) =>
        set((s) => ({
          sessions: s.sessions.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),
      setMessages: (sessionId, messages) =>
        set((s) => ({ messageCache: { ...s.messageCache, [sessionId]: messages } })),
      getCachedMessages: (sessionId) => get().messageCache[sessionId],
    }),
    {
      name: 'praxly-chat-store',
      // Only persist session metadata — message content is re-fetched on demand
      partialize: (s) => ({ sessions: s.sessions }),
      // v1: scrub duplicate sessions that older builds persisted (they called
      // addSession from inside a React state updater, which can run twice).
      version: 1,
      migrate: (persisted) => {
        const state = persisted as { sessions?: SessionMeta[] } | undefined;
        return { ...state, sessions: dedupeSessions(state?.sessions ?? []) };
      },
    }
  )
);
