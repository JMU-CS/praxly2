import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import type { ByokProvider } from '../../store/appStore';
import { PROVIDER_OPTIONS, useByokDraft } from '../ai/byok';
import { cardCls, inputCls, primaryBtnCls } from './styles';
import type { Notify } from './types';

/** Bring-your-own-key settings: which model powers the AI Assistant. */
export function AiSettingsSection({ notify }: { notify: Notify }) {
  const draft = useByokDraft();
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    if (!draft.save()) return;
    notify(
      'success',
      draft.draftProvider === '' ? 'Using the school-provided model.' : 'API key saved.'
    );
  };

  return (
    <div className={`${cardCls} divide-y divide-slate-800`}>
      <div className="p-6">
        <h2 className="text-lg text-slate-100">AI model &amp; API key</h2>
        <p className="mt-1 text-sm text-slate-400">
          Pick which model powers the AI Assistant. Using your own API key gives the best experience
          — it stays in this browser and is only used to make your requests. The school-provided
          model works without a key.
        </p>
      </div>
      <div className="space-y-4 p-6 max-w-md">
        <div>
          <label htmlFor="byok-provider" className="mb-1 block text-xs font-medium text-slate-500">
            Model
          </label>
          <select
            id="byok-provider"
            value={draft.draftProvider}
            onChange={(e) => draft.setDraftProvider(e.target.value as ByokProvider | '')}
            className={inputCls}
          >
            {PROVIDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {draft.needsKey && (
          <>
            <div>
              <label htmlFor="byok-key" className="mb-1 block text-xs font-medium text-slate-500">
                API key
              </label>
              <div className="relative">
                <input
                  id="byok-key"
                  type={showKey ? 'text' : 'password'}
                  value={draft.draftKey}
                  onChange={(e) => draft.setDraftKey(e.target.value)}
                  placeholder="Paste your API key"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {draft.hint && (
                <p className="mt-1 text-xs text-slate-500">
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
              <label htmlFor="byok-model" className="mb-1 block text-xs font-medium text-slate-500">
                Model name <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                id="byok-model"
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

        <div className="pt-2">
          <button onClick={handleSave} disabled={!draft.canSave} className={primaryBtnCls}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
