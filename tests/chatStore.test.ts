import { describe, it, expect, beforeEach, vi } from 'vitest';

// Scratch: exercises the per-account scoping of the persisted chat store.
const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
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
