import { useState } from 'react';
import { useByokStore, type ByokProvider } from '../../store/appStore';

/**
 * Shared bring-your-own-key logic used by both the Account page section and the
 * AI panel's onboarding gate, so the two never drift. The provider list is
 * ordered with Gemini first (the recommended default); "" means the
 * school-provided model (the fallback that needs no key).
 */

export const PROVIDER_OPTIONS: Array<{ value: ByokProvider | ''; label: string; hint?: string }> = [
  { value: 'gemini', label: 'Gemini (recommended)', hint: 'aistudio.google.com/apikey' },
  { value: '', label: 'School-provided model' },
  { value: 'anthropic', label: 'Claude', hint: 'console.anthropic.com' },
  { value: 'openai', label: 'ChatGPT', hint: 'platform.openai.com/api-keys' },
];

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
  const hint = PROVIDER_OPTIONS.find((o) => o.value === draftProvider)?.hint;

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
    save,
  };
}
