import { describe, it, expect, beforeEach, vi } from 'vitest';

// Scratch: exercises the per-account scoping of the persisted chat store, and
// what it does (and doesn't) write to localStorage. Zustand's persist reads
// `window.localStorage` when the store module is first imported, so both have
// to exist before the dynamic imports below.
const store: Record<string, string> = {};
const fakeStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
  key: () => null,
  length: 0,
} as unknown as Storage;

(globalThis as unknown as { localStorage: Storage }).localStorage = fakeStorage;
(globalThis as unknown as { window: { localStorage: Storage } }).window = {
  localStorage: fakeStorage,
};

const meta = (id: string) => ({
  id,
  title: id,
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
});

describe('chat store account scoping', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('wipes cached sessions when a different account signs in', async () => {
    const { useChatStore } = await import('../src/store/appStore');
    const s = useChatStore.getState();

    expect(s.claimFor('keycloak:alice')).toBe(true); // fresh store, nothing to lose
    useChatStore.getState().setSessions([meta('a1'), meta('a2')]);
    expect(useChatStore.getState().sessions).toHaveLength(2);

    // Same person again: cache is kept.
    expect(useChatStore.getState().claimFor('keycloak:alice')).toBe(false);
    expect(useChatStore.getState().sessions).toHaveLength(2);

    // Someone else: wiped, and the caller is told to re-fetch.
    expect(useChatStore.getState().claimFor('google:bob')).toBe(true);
    expect(useChatStore.getState().sessions).toEqual([]);
    expect(useChatStore.getState().messageCache).toEqual({});
    expect(useChatStore.getState().owner).toBe('google:bob');
  });

  it('drops v1 sessions that predate ownership tracking', async () => {
    localStorage.setItem(
      'praxly-chat-store',
      JSON.stringify({ state: { sessions: [meta('old1'), meta('old2')] }, version: 1 })
    );
    vi.resetModules();
    const { useChatStore } = await import('../src/store/appStore');
    expect(useChatStore.getState().sessions).toEqual([]);
    expect(useChatStore.getState().owner).toBeNull();
  });

  it('persists transcripts, model labels included, for known sessions', async () => {
    const { useChatStore } = await import('../src/store/appStore');
    useChatStore.getState().clearChats();
    useChatStore.getState().claimFor('keycloak:alice');
    useChatStore.getState().setSessions([meta('s1')]);
    useChatStore.getState().setMessages('s1', [
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: 'hello', model: 'gemini-2.5-flash' },
      { role: 'assistant', text: '', error: 'The provider is rate-limiting this key.' },
    ]);
    // Not in the session list — nothing to reopen it from, so it isn't written.
    useChatStore.getState().setMessages('orphan', [{ role: 'user', text: 'stray' }]);

    const persisted = JSON.parse(localStorage.getItem('praxly-chat-store')!);
    expect(persisted.state.messageCache.s1).toHaveLength(3);
    expect(persisted.state.messageCache.s1[1].model).toBe('gemini-2.5-flash');
    expect(persisted.state.messageCache.s1[2].error).toBe(
      'The provider is rate-limiting this key.'
    );
    expect(persisted.state.messageCache.orphan).toBeUndefined();
  });

  it('stops writing transcripts once the localStorage budget is used up', async () => {
    const { useChatStore } = await import('../src/store/appStore');
    useChatStore.getState().clearChats();
    useChatStore.getState().claimFor('keycloak:alice');
    // Newest first — 'big' fits, 'older' would push past the budget.
    useChatStore.getState().setSessions([meta('big'), meta('older')]);
    const bulk = (n: number) => [{ role: 'user' as const, text: 'x'.repeat(n) }];
    useChatStore.getState().setMessages('big', bulk(600_000));
    useChatStore.getState().setMessages('older', bulk(600_000));

    const persisted = JSON.parse(localStorage.getItem('praxly-chat-store')!);
    expect(persisted.state.messageCache.big).toBeDefined();
    expect(persisted.state.messageCache.older).toBeUndefined();
    // In memory both are still there — the cap is only about what gets written.
    expect(useChatStore.getState().getCachedMessages('older')).toHaveLength(1);
  });

  it('clears everything on sign-out', async () => {
    const { useChatStore } = await import('../src/store/appStore');
    useChatStore.getState().claimFor('google:bob');
    useChatStore.getState().setSessions([meta('b1')]);
    useChatStore.getState().setMessages('b1', [{ role: 'user', text: 'hi' }]);

    useChatStore.getState().clearChats();
    expect(useChatStore.getState().sessions).toEqual([]);
    expect(useChatStore.getState().messageCache).toEqual({});
    expect(useChatStore.getState().owner).toBeNull();
  });
});
