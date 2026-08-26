import { useState } from 'react';
import { currentProvider } from '../../api/auth';
import { useByokStore, type ByokProvider } from '../../store/appStore';

/**
 * Shared bring-your-own-key logic used by both the Account page section and the
 * AI panel's onboarding gate, so the two never drift.
 *
 * "" means the school-provided model — the fallback that needs no key — and it
 * leads the list because it is what a Praxly account opens on (see
 * defaultDraftProvider). Google sign-ins never see it: providerOptions() drops
 * it, leaving Gemini first, which is what they open on and the key we recommend
 * they bring.
 */

const ALL_PROVIDER_OPTIONS: Array<{
  value: ByokProvider | '';
  label: string;
  hint?: string;
  docs?: string;
}> = [
  { value: '', label: 'School-provided model' },
  {
    value: 'gemini',
    label: 'Gemini (Google)',
    hint: 'aistudio.google.com',
    docs: 'ai.google.dev/gemini-api/docs/models',
  },
  {
    value: 'openai',
    label: 'GPT (OpenAI)',
    hint: 'platform.openai.com',
    docs: 'developers.openai.com/api/docs/models',
  },
  {
    value: 'anthropic',
    label: 'Claude (Anthropic)',
    hint: 'platform.anthropic.com',
    docs: 'platform.claude.com/docs/en/about-claude/models',
  },
];

/**
 * Model ids offered in the model picker, per provider. Suggestions only — the
 * picker's "Other" option takes anything typed by hand, because a provider can
 * ship a new model long before this list is updated. Kept short on purpose:
 * the models a class is likely to want, not the whole catalog.
 */
export const MODEL_SUGGESTIONS: Record<ByokProvider, string[]> = {
  gemini: ['gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemma-4-31b-it'],
  openai: ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'],
  anthropic: ['claude-fable-5', 'claude-opus-5', 'claude-sonnet-5'],
};

/** The model picker's "Other" value — reveals the free-text field. */
export const CUSTOM_MODEL = '__custom__';

/**
 * Suggestions for the selected option. The school-provided model hides the
 * model field entirely, and `save()` files it under Gemini, so '' follows suit.
 */
export const modelSuggestionsFor = (provider: ByokProvider | ''): string[] =>
  MODEL_SUGGESTIONS[provider === '' ? 'gemini' : provider];

/** True when `model` is a hand-entered id rather than one of our suggestions —
 *  i.e. whether the picker should open with its free-text field showing. */
export const isCustomModel = (provider: ByokProvider | '', model: string): boolean => {
  const trimmed = model.trim();
  return trimmed !== '' && !modelSuggestionsFor(provider).includes(trimmed);
};

/**
 * Props shared by both API-key inputs. An API key is a secret, but it is not a
 * password: `type="password"` makes Chrome warn about a password field outside a
 * form and makes 1Password/LastPass/Bitwarden offer to save it. So the field
 * stays `type="text"` and is masked with CSS instead, and the `data-*ignore`
 * attributes tell the common password managers to leave it alone.
 */
export const KEY_INPUT_PROPS = {
  type: 'text',
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  'data-1p-ignore': 'true',
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
} as const;

/** Tailwind class that dot-masks the value without `type="password"`. */
export const maskCls = (masked: boolean) => (masked ? '[-webkit-text-security:disc]' : '');

/**
 * The school-provided model runs on the school's LiteLLM budget, so it is
 * offered only to Praxly school accounts. Google sign-ins must bring their own
 * key — the backend enforces the same rule, this just keeps the UI honest
 * instead of letting them pick an option every request would then reject.
 */
export function canUseSchoolModel(): boolean {
  return currentProvider() === 'keycloak';
}

export function providerOptions(): typeof ALL_PROVIDER_OPTIONS {
  return canUseSchoolModel()
    ? ALL_PROVIDER_OPTIONS
    : ALL_PROVIDER_OPTIONS.filter((o) => o.value !== '');
}

/** Model families as they read in prose, without the picker's parenthetical. */
const PROVIDER_NAMES: Record<ByokProvider, string> = {
  gemini: 'Gemini',
  anthropic: 'Claude',
  openai: 'GPT',
};

/**
 * How the configured model should read under a chat bubble.
 *
 * `model` is an optional override — when it is blank the backend picks the
 * model for the provider, so the provider name is the most we can honestly
 * say.
 */
export function useModelLabel(): string {
  const { provider, apiKey, model } = useByokStore();
  if (!provider || !apiKey.trim()) return 'School-provided model';
  return model.trim() || `${PROVIDER_NAMES[provider]} default model`;
}

/**
 * Whether the panel has a usable model configuration for *this* account.
 *
 * Not the same as the store's `configured` flag: an account that picked the
 * school model and later signs in with Google no longer has a model it is
 * entitled to, so it goes back through the gate rather than failing on every
 * message the backend rejects.
 */
export function useByokReady(): boolean {
  const { configured, provider, apiKey } = useByokStore();
  if (!configured) return false;
  if (provider && apiKey.trim()) return true;
  return canUseSchoolModel();
}

/**
 * Which option the model picker opens on.
 *
 * An explicitly saved provider wins. Failing that, a Praxly school account
 * starts on the school-provided model — it is the option they already have, and
 * it needs no key. Google sign-ins have no school fallback to offer, so they
 * start on Gemini, the recommended key to bring.
 */
export function defaultDraftProvider(
  configured: boolean,
  provider: ByokProvider | null,
  schoolModelAllowed: boolean
): ByokProvider | '' {
  if (configured && provider) return provider;
  return schoolModelAllowed ? '' : 'gemini';
}

export function useByokDraft() {
  const { provider, apiKey, model, configured, setByok, clearByok } = useByokStore();
  const schoolModelAllowed = canUseSchoolModel();
  const options = providerOptions();

  const [draftProvider, setDraftProviderState] = useState<ByokProvider | ''>(() =>
    defaultDraftProvider(configured, provider, schoolModelAllowed)
  );
  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftModel, setDraftModel] = useState(model);
  // Whether the model field is in free-text mode. A saved model we don't
  // suggest opens that way, so the user sees what is actually configured.
  const [modelIsCustom, setModelIsCustom] = useState(() =>
    isCustomModel(defaultDraftProvider(configured, provider, schoolModelAllowed), model)
  );

  const modelSuggestions = modelSuggestionsFor(draftProvider);

  /** Model ids don't carry across providers, so switching resets the field —
   *  except back to the saved provider, which restores its saved model. */
  const setDraftProvider = (next: ByokProvider | '') => {
    if (next === draftProvider) return;
    const restored = next !== '' && next === provider ? model : '';
    setDraftProviderState(next);
    setDraftModel(restored);
    setModelIsCustom(isCustomModel(next, restored));
  };

  /** What the model `<select>` shows: a suggested id, '' for the provider
   *  default, or CUSTOM_MODEL while the free-text field is open. */
  const modelChoice = modelIsCustom ? CUSTOM_MODEL : draftModel;

  const chooseModel = (choice: string) => {
    setModelIsCustom(choice === CUSTOM_MODEL);
    setDraftModel(choice === CUSTOM_MODEL ? '' : choice);
  };

  // Without the school fallback a key is always required, whatever is selected.
  const needsKey = draftProvider !== '' || !schoolModelAllowed;
  const canSave = !needsKey || draftKey.trim().length > 0;
  const selected = ALL_PROVIDER_OPTIONS.find((o) => o.value === draftProvider);
  const hint = selected?.hint;
  const docs = selected?.docs;

  const save = (): boolean => {
    if (!canSave) return false;
    if (draftProvider === '' && schoolModelAllowed) {
      clearByok();
    } else {
      setByok({
        provider: draftProvider === '' ? 'gemini' : draftProvider,
        apiKey: draftKey.trim(),
        model: draftModel.trim(),
      });
    }
    return true;
  };

  return {
    draftProvider,
    setDraftProvider,
    draftKey,
    setDraftKey,
    draftModel,
    setDraftModel,
    modelSuggestions,
    modelChoice,
    chooseModel,
    modelIsCustom,
    needsKey,
    canSave,
    hint,
    docs,
    save,
    options,
    schoolModelAllowed,
  };
}
