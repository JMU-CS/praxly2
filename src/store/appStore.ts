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
  /** Account key (see currentUserKey) the cached sessions belong to. */
  owner: string | null;
  /**
   * Points the cache at `userKey`, wiping it when that isn't who it was cached
   * for. Returns true when it wiped, so callers know to re-fetch.
   */
  claimFor: (userKey: string | null) => boolean;
  /** Drops everything — used on sign-out. */
  clearChats: () => void;
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
  /** True once the user has made an explicit model choice (any provider,
   * including school-provided). Drives the panel's one-time onboarding gate. */
  configured: boolean;
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
      configured: false,
      // Saving any choice (a real key or school-provided) counts as configured.
      setByok: ({ provider, apiKey, model }) => set({ provider, apiKey, model, configured: true }),
      clearByok: () => set({ provider: null, apiKey: '', model: '', configured: true }),
    }),
    {
      name: 'praxly-byok',
      version: 1,
      // Existing users who already picked a provider shouldn't be re-onboarded.
      migrate: (persisted) => {
        const s = persisted as Partial<ByokStore> | undefined;
        return { ...s, configured: s?.configured ?? s?.provider != null } as ByokStore;
      },
    }
  )
);

/** Who the user is and how the tutor should pitch its answers. */
export type AiRole = 'student' | 'teacher';
export type AiLevel = 'novice' | 'intermediate' | 'advanced';
/** Which tutoring use case the panel is in; 'auto' lets the AI infer it. */
export type AiUseCase = 'auto' | 'explain' | 'tutor' | 'practice';

interface AiPrefsStore {
  role: AiRole;
  level: AiLevel;
  useCase: AiUseCase;
  setRole: (role: AiRole) => void;
  setLevel: (level: AiLevel) => void;
  setUseCase: (useCase: AiUseCase) => void;
}

/**
 * Tutor profile preferences. Persisted so the choice survives refreshes; sent
 * with every chat request so the backend can fill the prompt's user_role,
 * user_level, and use_case variables.
 */
export const useAiPrefsStore = create<AiPrefsStore>()(
  persist(
    (set) => ({
      role: 'student',
      level: 'novice',
      useCase: 'auto',
      setRole: (role) => set({ role }),
      setLevel: (level) => set({ level }),
      setUseCase: (useCase) => set({ useCase }),
    }),
    { name: 'praxly-ai-prefs' }
  )
);

interface AiConsentStore {
  /** True once the user has accepted the AI usage-tracking notice. */
  accepted: boolean;
  accept: () => void;
}

/** One-time consent that AI interactions are logged for usage analysis. */
export const useAiConsentStore = create<AiConsentStore>()(
  persist(
    (set) => ({
      accepted: false,
      accept: () => set({ accepted: true }),
    }),
    { name: 'praxly-ai-consent' }
  )
);

interface EditorBridge {
  /** Registered by EditorPage; lets AI chat code blocks open in the editor. */
  openCode: ((code: string, language: string) => void) | null;
  setOpenCode: (fn: EditorBridge['openCode']) => void;
}

/** Not persisted — just a live callback bridge between the chat panel and the editor. */
export const useEditorBridge = create<EditorBridge>()((set) => ({
  openCode: null,
  setOpenCode: (openCode) => set({ openCode }),
}));

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
      owner: null,
      claimFor: (userKey) => {
        const { owner } = get();
        if (owner === userKey) return false;
        // Either a different account, or a cache written before we tracked
        // ownership at all — in both cases it isn't safe to show.
        set({ sessions: [], messageCache: {}, owner: userKey });
        return true;
      },
      clearChats: () => set({ sessions: [], messageCache: {}, owner: null }),
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
      // Only persist session metadata — message content is re-fetched on demand.
      // `owner` rides along so a reload can tell whose sessions these are.
      partialize: (s) => ({ sessions: s.sessions, owner: s.owner }),
      // v1: scrub duplicate sessions that older builds persisted (they called
      // addSession from inside a React state updater, which can run twice).
      // v2: sessions written before `owner` existed can't be attributed to an
      // account, so drop them — the backend is the source of truth and the
      // panel re-fetches immediately.
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as { sessions?: SessionMeta[]; owner?: string | null } | undefined;
        if (version < 2) return { ...state, sessions: [], owner: null };
        return { ...state, sessions: dedupeSessions(state?.sessions ?? []) };
      },
    }
  )
);
