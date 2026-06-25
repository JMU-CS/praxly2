import { create } from 'zustand';

/** A chat session as returned by GET /api/chats */
export interface SessionMeta {
  id: string;
  title: string | null;
  updatedAt: string;
  createdAt: string;
}

interface ChatStore {
  sessions: SessionMeta[];
  setSessions: (sessions: SessionMeta[]) => void;
  addSession: (session: SessionMeta) => void;
  removeSession: (id: string) => void;
  updateSession: (id: string, updates: Partial<SessionMeta>) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  sessions: [],
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) => set((s) => ({ sessions: [session, ...s.sessions] })),
  removeSession: (id) => set((s) => ({ sessions: s.sessions.filter((c) => c.id !== id) })),
  updateSession: (id, updates) =>
    set((s) => ({
      sessions: s.sessions.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
}));
