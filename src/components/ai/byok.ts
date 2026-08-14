import { useState } from 'react';
import { currentProvider } from '../../api/auth';
import { useByokStore, type ByokProvider } from '../../store/appStore';

/**
 * Shared bring-your-own-key logic used by both the Account page section and the
 * AI panel's onboarding gate, so the two never drift. The provider list is
 * ordered with Gemini first (the recommended default); "" means the
 * school-provided model (the fallback that needs no key).
 */

const ALL_PROVIDER_OPTIONS: Array<{ value: ByokProvider | ''; label: string; hint?: string }> = [
  { value: 'gemini', label: 'Gemini (recommended)', hint: 'aistudio.google.com/apikey' },
  { value: '', label: 'School-provided model' },
  { value: 'anthropic', label: 'Claude', hint: 'console.anthropic.com' },
  { value: 'openai', label: 'ChatGPT', hint: 'platform.openai.com/api-keys' },
];

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

/** Kept as a constant export for callers that render the full list. */
export const PROVIDER_OPTIONS = ALL_PROVIDER_OPTIONS;

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

export function useByokDraft() {
  const { provider, apiKey, model, configured, setByok, clearByok } = useByokStore();
  const schoolModelAllowed = canUseSchoolModel();
  const options = providerOptions();

  // Gemini is the default selection until the user has made an explicit choice,
  // and the only sensible starting point when there is no school fallback.
  const [draftProvider, setDraftProvider] = useState<ByokProvider | ''>(
    configured && (provider ?? '') !== '' ? (provider ?? 'gemini') : 'gemini'
  );
  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftModel, setDraftModel] = useState(model);

  // Without the school fallback a key is always required, whatever is selected.
  const needsKey = draftProvider !== '' || !schoolModelAllowed;
  const canSave = !needsKey || draftKey.trim().length > 0;
  const hint = options.find((o) => o.value === draftProvider)?.hint;

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
    needsKey,
    canSave,
    hint,
    save,
    options,
    schoolModelAllowed,
  };
}
