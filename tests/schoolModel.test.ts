import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The school-provided model is selected by *absence*: when the frontend sends
 * no X-LLM-* headers, the backend falls back to the school's LiteLLM key
 * (praxly-chat.ts: `byok?.override.model ?? defaultModel`).
 *
 * So this walks the whole path a Praxly account takes after signing in — gate
 * default, save, resulting headers — and asserts nothing leaks into the
 * request. A stray header here would silently bill a personal key, or fail the
 * request outright for a user who has no key at all.
 */

// Zustand's persist reads window.localStorage when appStore is first imported.
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

// llm.ts drags in the Keycloak client through ./config; none of it matters to
// the header contract under test.
vi.mock('../src/api/config', () => ({
  BACKEND_URL: 'https://backend.test',
  requireAuthHeaders: async () => ({ Authorization: 'Bearer test-token' }),
}));

const auth = vi.hoisted(() => ({ provider: 'keycloak' as 'keycloak' | 'google' }));
vi.mock('../src/api/auth', () => ({ currentProvider: () => auth.provider }));

describe('school-provided model', () => {
  beforeEach(() => {
    localStorage.clear();
    auth.provider = 'keycloak';
  });

  it('sends no BYOK headers for a Praxly account that took the default', async () => {
    const { byokHeaders } = await import('../src/api/llm');
    const { useByokStore } = await import('../src/store/appStore');
    const { defaultDraftProvider, canUseSchoolModel } = await import('../src/components/ai/byok');

    // Fresh sign-in: clearAccountData() wiped the key on the last sign-out, so
    // the store is back to its defaults and the gate is armed.
    useByokStore.setState({ provider: null, apiKey: '', model: '', configured: false });

    // The gate opens on the school model...
    expect(canUseSchoolModel()).toBe(true);
    const opened = defaultDraftProvider(false, null, canUseSchoolModel());
    expect(opened).toBe('');

    // ...and pressing Continue on that selection runs clearByok (see save()).
    useByokStore.getState().clearByok();

    expect(useByokStore.getState().configured).toBe(true); // gate satisfied
    expect(byokHeaders()).toEqual({}); // nothing sent → school key
  });

  it('still sends the three headers when a key is configured', async () => {
    const { byokHeaders } = await import('../src/api/llm');
    const { useByokStore } = await import('../src/store/appStore');

    useByokStore.getState().setByok({ provider: 'openai', apiKey: 'sk-test-key', model: '' });
    expect(byokHeaders()).toEqual({
      'X-LLM-Provider': 'openai',
      'X-LLM-Api-Key': 'sk-test-key',
    });

    // An explicit model override rides along; blank means the backend's default.
    useByokStore
      .getState()
      .setByok({ provider: 'openai', apiKey: 'sk-test-key', model: 'gpt-5.6' });
    expect(byokHeaders()['X-LLM-Model']).toBe('gpt-5.6');
  });

  it('sends nothing when a provider was saved without a key', async () => {
    const { byokHeaders } = await import('../src/api/llm');
    const { useByokStore } = await import('../src/store/appStore');

    // Half-configured state must not send a provider with an empty key — the
    // backend rejects that with a 400 rather than falling back.
    useByokStore.setState({ provider: 'gemini', apiKey: '   ', model: '', configured: true });
    expect(byokHeaders()).toEqual({});
  });
});
