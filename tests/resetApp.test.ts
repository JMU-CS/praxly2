import { describe, it, expect, vi } from 'vitest';

import { resetApp } from '../src/utils/resetApp';

const fakeStorage = (initial: Record<string, string>) => {
  const store = { ...initial };
  return {
    store,
    api: {
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
    } as unknown as Storage,
  };
};

describe('resetApp', () => {
  it('clears every key, including ones this build never wrote', () => {
    const { store, api } = fakeStorage({
      'praxly-editor-state': '{}',
      'praxly-chat-store': '{}',
      'praxly-byok': '{}',
      kc_token: 'abc',
      // The case the whole feature exists for: a key left by an older build,
      // which no allowlist in the current build could name.
      'praxly-some-retired-key': 'stale',
    });

    resetApp(api, () => {});
    expect(Object.keys(store)).toEqual([]);
  });

  it('reloads after clearing, not before', () => {
    const { store, api } = fakeStorage({ 'praxly-editor-state': '{}' });
    const order: string[] = [];
    const clear = api.clear.bind(api);
    api.clear = () => {
      order.push('clear');
      clear();
    };

    resetApp(api, () => order.push('reload'));

    // A reload that raced ahead of the clear would leave the stale state in
    // place and make the button look like it did nothing.
    expect(order).toEqual(['clear', 'reload']);
    expect(Object.keys(store)).toEqual([]);
  });

  it('reloads even when there was nothing stored', () => {
    const { api } = fakeStorage({});
    const reload = vi.fn();
    resetApp(api, reload);
    expect(reload).toHaveBeenCalledOnce();
  });
});
