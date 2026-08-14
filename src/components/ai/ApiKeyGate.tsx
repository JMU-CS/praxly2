import { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useByokDraft } from './byok';
import type { ByokProvider } from '../../store/appStore';

/**
 * One-time onboarding gate shown in the AI panel after sign-in, before the user
 * has chosen a model. They must pick something (Gemini is pre-selected; the
 * school-provided model is a no-key fallback) before they can start chatting.
 */
export function ApiKeyGate({ onDone }: { onDone: () => void }) {
  const draft = useByokDraft();
  const [showKey, setShowKey] = useState(false);

  const handleContinue = () => {
    if (draft.save()) onDone();
  };

  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1';
  const inputCls =
    'w-full rounded-md bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 px-3 py-2 focus:outline-none focus:border-indigo-500 transition-colors';

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-2 text-slate-200">
        <KeyRound size={16} className="text-indigo-300" />
        <h3 className="text-sm font-semibold">Choose your AI model</h3>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        {draft.schoolModelAllowed
          ? 'Pick a model to power the assistant. Use your own API key for the best experience, or the school-provided model to get started without one. You can change this later in your account.'
          : 'Add your own API key to power the assistant. The school-provided model is only available to Praxly school accounts — signed in with Google, you supply your own key. You can change this later in your account.'}
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
                type={showKey ? 'text' : 'password'}
                value={draft.draftKey}
                onChange={(e) => draft.setDraftKey(e.target.value)}
                placeholder="Paste your API key"
                autoComplete="off"
                spellCheck={false}
                className={`${inputCls} pr-9`}
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
            {draft.hint && (
              <p className="mt-1 text-[11px] text-slate-500">
                Get a key at{' '}
                <a
                  href={`https://${draft.hint}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-300 underline hover:text-indigo-200"
                >
                  {draft.hint}
                </a>
              </p>
            )}
          </div>

          <div>
            <label htmlFor="gate-model" className={labelCls}>
              Model name <span className="normal-case font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="gate-model"
              type="text"
              value={draft.draftModel}
              onChange={(e) => draft.setDraftModel(e.target.value)}
              placeholder="Leave blank for the recommended model"
              autoComplete="off"
              spellCheck={false}
              className={inputCls}
            />
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
