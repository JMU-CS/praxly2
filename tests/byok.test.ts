import { describe, it, expect, vi } from 'vitest';

import {
  defaultDraftProvider,
  displayModelName,
  isCustomModel,
  modelSuggestionsFor,
  providerOptions,
} from '../src/components/ai/byok';

// canUseSchoolModel() asks the auth layer who is signed in; stub that rather
// than stand up a Keycloak session.
const auth = vi.hoisted(() => ({ provider: null as 'keycloak' | 'google' | null }));
vi.mock('../src/api/auth', () => ({ currentProvider: () => auth.provider }));

/**
 * Which option the model picker opens on. `''` is the school-provided model,
 * offered only to Praxly (Keycloak) accounts — see canUseSchoolModel.
 */
describe('defaultDraftProvider', () => {
  it('opens on the school-provided model for a Praxly account', () => {
    expect(defaultDraftProvider(false, null, true)).toBe('');
  });

  it('opens on Gemini when there is no school fallback', () => {
    expect(defaultDraftProvider(false, null, false)).toBe('gemini');
  });

  it('keeps a saved provider over either default', () => {
    expect(defaultDraftProvider(true, 'anthropic', true)).toBe('anthropic');
    expect(defaultDraftProvider(true, 'anthropic', false)).toBe('anthropic');
  });

  it('reopens on the school model for an account that saved that choice', () => {
    // clearByok() records the school model as `configured` with no provider.
    expect(defaultDraftProvider(true, null, true)).toBe('');
  });

  it('sends a Google account that lost its school model back to Gemini', () => {
    expect(defaultDraftProvider(true, null, false)).toBe('gemini');
  });
});

describe('providerOptions', () => {
  it('leads with the school model for a Praxly account, and offers all four', () => {
    auth.provider = 'keycloak';
    const options = providerOptions();
    expect(options.map((o) => o.value)).toEqual(['', 'gemini', 'openai', 'anthropic']);
  });

  it('hides the school model from a Google sign-in, leaving Gemini first', () => {
    auth.provider = 'google';
    const options = providerOptions();
    expect(options.map((o) => o.value)).toEqual(['gemini', 'openai', 'anthropic']);
  });

  it('opens on the first option it shows, whichever account it is', () => {
    // The picker must never open scrolled to an option below the top.
    for (const provider of ['keycloak', 'google'] as const) {
      auth.provider = provider;
      const options = providerOptions();
      const school = provider === 'keycloak';
      expect(defaultDraftProvider(false, null, school)).toBe(options[0]!.value);
    }
  });
});

/**
 * The model picker is a shortlist plus an "Other" escape hatch, so these two
 * decide what it shows: which ids are offered, and whether a configured model
 * needs the free-text field opened to be visible at all.
 */
describe('model suggestions', () => {
  it('offers each provider its own ids', () => {
    expect(modelSuggestionsFor('gemini')).toContain('gemini-3.7-flash');
    expect(modelSuggestionsFor('openai')).toContain('gpt-5.6-sol');
    expect(modelSuggestionsFor('anthropic')).toContain('claude-opus-5');
  });

  it('falls back to Gemini for the school-provided option, as save() does', () => {
    expect(modelSuggestionsFor('')).toEqual(modelSuggestionsFor('gemini'));
  });

  it('treats a blank model as the provider default, not a custom id', () => {
    expect(isCustomModel('gemini', '')).toBe(false);
    expect(isCustomModel('gemini', '   ')).toBe(false);
  });

  it('treats a suggested id as a list choice, whitespace and all', () => {
    expect(isCustomModel('anthropic', 'claude-sonnet-5')).toBe(false);
    expect(isCustomModel('anthropic', ' claude-sonnet-5 ')).toBe(false);
  });

  it('treats anything unlisted as custom, including another provider’s id', () => {
    expect(isCustomModel('openai', 'gpt-4o-mini')).toBe(true);
    expect(isCustomModel('openai', 'claude-opus-5')).toBe(true);
  });
});

/**
 * The id under a chat bubble comes from the backend, which reports what LiteLLM
 * called — prefixed with LiteLLM's provider route. Students see the model only.
 */
describe('displayModelName', () => {
  it("drops LiteLLM's provider prefix, whichever provider it is", () => {
    expect(displayModelName('gemini/gemma-4-31b-it')).toBe('gemma-4-31b-it');
    expect(displayModelName('gemini/gemini-flash-lite-latest')).toBe('gemini-flash-lite-latest');
    expect(displayModelName('openai/gpt-5.6-sol')).toBe('gpt-5.6-sol');
    expect(displayModelName('anthropic/claude-opus-5')).toBe('claude-opus-5');
  });

  it('keeps only the model when a gateway adds a route of its own', () => {
    expect(displayModelName('openrouter/anthropic/claude-opus-5')).toBe('claude-opus-5');
  });

  it('leaves an unprefixed id alone', () => {
    expect(displayModelName('claude-sonnet-5')).toBe('claude-sonnet-5');
    expect(displayModelName('')).toBe('');
  });

  it('falls back to the raw id rather than showing nothing', () => {
    // A prefix with no model behind it is malformed; blanking the label would
    // hide which model answered, which is the whole point of showing it.
    expect(displayModelName('gemini/')).toBe('gemini/');
  });
});
