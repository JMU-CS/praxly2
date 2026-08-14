import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import type { ByokProvider } from '../../store/appStore';
import { KEY_INPUT_PROPS, maskCls, useByokDraft } from '../ai/byok';
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
      draft.draftProvider === '' && draft.schoolModelAllowed
        ? 'Using the school-provided model.'
        : 'API key saved.'
    );
  };

  return (
    <div className={`${cardCls} divide-y divide-slate-800`}>
      <div className="p-6">
        <h2 className="text-lg text-slate-100">AI model &amp; API key</h2>
        <p className="mt-1 text-sm text-slate-400">
          Choose the AI model you want to use. You will need to provide a key, which you can get at
          the link below. The key will be stored in your browser, not on our server, and will only
          be used to make requests to the AI model.
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
              <label htmlFor="byok-key" className="mb-1 block text-xs font-medium text-slate-500">
                API key
              </label>
              <div className="relative">
                <input
                  id="byok-key"
                  {...KEY_INPUT_PROPS}
                  value={draft.draftKey}
                  onChange={(e) => draft.setDraftKey(e.target.value)}
                  placeholder="Paste your API key"
                  className={`${inputCls} pr-10 ${maskCls(!showKey)}`}
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
              {draft.docs && (
                <p className="mt-1 text-xs text-slate-500 break-words">
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

        <div className="pt-2">
          <button onClick={handleSave} disabled={!draft.canSave} className={primaryBtnCls}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
