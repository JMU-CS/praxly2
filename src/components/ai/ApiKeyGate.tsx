import { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { CUSTOM_MODEL, KEY_INPUT_PROPS, maskCls, useByokDraft } from './byok';
import { GetKeyCallout } from './GetKeyCallout';
import type { ByokProvider } from '../../store/appStore';

/**
 * One-time onboarding gate shown in the AI panel after sign-in, before the user
 * has chosen a model. They must pick something before they can start chatting —
 * pre-selected to the school-provided model for Praxly accounts, and to Gemini
 * for Google sign-ins, which have no school fallback and must bring a key.
 */
export function ApiKeyGate({ onDone }: { onDone: () => void }) {
  const draft = useByokDraft();
  const [showKey, setShowKey] = useState(false);

  const handleContinue = () => {
    if (draft.save()) onDone();
  };

  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1';
  const inputCls =
    'w-full rounded-md bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-muted px-3 py-2 focus:outline-none focus:border-indigo-500 transition-colors';

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-2 text-slate-200">
        <KeyRound size={16} className="text-indigo-300" />
        <h3 className="text-sm font-semibold">Choose your AI model</h3>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        Choose the AI model you want to use. You may need to provide a key, which you can get at the
        link below. The key will be stored in your browser, not on our server, and will only be used
        to make requests to the AI model.
      </p>

      <div>
        <label htmlFor="gate-provider" className={labelCls}>
          Model
        </label>
        <select
          id="gate-provider"
          value={draft.draftProvider}
          onChange={(e) => draft.setDraftProvider(e.target.value as ByokProvider | '')}
          className={inputCls}
        >
          {draft.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {draft.needsKey && (
        <>
          <div>
            <label htmlFor="gate-key" className={labelCls}>
              API key
            </label>
            <div className="relative">
              <input
                id="gate-key"
                {...KEY_INPUT_PROPS}
                value={draft.draftKey}
                onChange={(e) => draft.setDraftKey(e.target.value)}
                placeholder="Paste your API key"
                className={`${inputCls} pr-9 ${maskCls(!showKey)}`}
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {draft.hint && <GetKeyCallout host={draft.hint} />}
          </div>

          <div>
            <label htmlFor="gate-model" className={labelCls}>
              Model name <span className="normal-case font-normal text-muted">(optional)</span>
            </label>
            <select
              id="gate-model"
              value={draft.modelChoice}
              onChange={(e) => draft.chooseModel(e.target.value)}
              className={inputCls}
            >
              <option value="">Recommended model</option>
              {draft.modelSuggestions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value={CUSTOM_MODEL}>Other…</option>
            </select>
            {/* The list is only a shortlist, so "Other" keeps every model the
                provider offers reachable. */}
            {draft.modelIsCustom && (
              <input
                type="text"
                value={draft.draftModel}
                onChange={(e) => draft.setDraftModel(e.target.value)}
                placeholder="Enter a model name"
                aria-label="Model name"
                autoComplete="off"
                spellCheck={false}
                className={`${inputCls} mt-2`}
              />
            )}
            {draft.docs && (
              <p className="mt-1 text-xs text-muted break-words">
                See models at{' '}
                <a
                  href={`https://${draft.docs}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-300 underline hover:text-indigo-200"
                >
                  {draft.docs}
                </a>
              </p>
            )}
          </div>
        </>
      )}

      <button
        onClick={handleContinue}
        disabled={!draft.canSave}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Continue
      </button>
    </div>
  );
}
