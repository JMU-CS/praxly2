import { useState } from 'react';
import { useByokStore, type ByokProvider } from '../../store/appStore';

/**
 * Shared bring-your-own-key logic used by both the Account page section and the
 * AI panel's onboarding gate, so the two never drift. The provider list is
 * ordered with Gemini first (the recommended default); "" means the
 * school-provided model (the fallback that needs no key).
 */

export const PROVIDER_OPTIONS: Array<{
  value: ByokProvider | '';
  label: string;
  hint?: string;
  docs?: string;
}> = [
  {
    value: 'gemini',
    label: 'Gemini (recommended)',
    hint: 'aistudio.google.com',
    docs: 'ai.google.dev/gemini-api/docs/models',
  },
  {
    value: 'anthropic',
    label: 'Claude',
    hint: 'platform.anthropic.com',
    docs: 'platform.claude.com/docs/en/about-claude/models',
  },
  {
    value: 'openai',
    label: 'ChatGPT',
    hint: 'platform.openai.com',
    docs: 'developers.openai.com/api/docs/models',
  },
  { value: '', label: 'School-provided model' },
];

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

export function useByokDraft() {
  const { provider, apiKey, model, configured, setByok, clearByok } = useByokStore();

  // Gemini is the default selection until the user has made an explicit choice.
  const [draftProvider, setDraftProvider] = useState<ByokProvider | ''>(
    configured ? (provider ?? '') : 'gemini'
  );
  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftModel, setDraftModel] = useState(model);

  const needsKey = draftProvider !== '';
  const canSave = !needsKey || draftKey.trim().length > 0;
  const selected = PROVIDER_OPTIONS.find((o) => o.value === draftProvider);
  const hint = selected?.hint;
  const docs = selected?.docs;

  const save = (): boolean => {
    if (!canSave) return false;
    if (draftProvider === '') {
      clearByok();
    } else {
      setByok({ provider: draftProvider, apiKey: draftKey.trim(), model: draftModel.trim() });
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
    needsKey,
    canSave,
    hint,
    docs,
    save,
  };
}
