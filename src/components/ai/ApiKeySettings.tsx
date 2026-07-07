import { useState } from 'react';
import { Check, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useByokStore, type ByokProvider } from '../../store/appStore';

/**
 * Bring-your-own-key settings, shown inside the AI side panel before/while
 * chatting. The key is kept in localStorage and sent to the k12 backend as a
 * header on each request — the backend forwards it to the provider without
 * storing it.
 */

const PROVIDER_OPTIONS: Array<{ value: ByokProvider | ''; label: string; hint?: string }> = [
  { value: '', label: 'School-provided model (default)' },
  { value: 'gemini', label: 'Gemini', hint: 'aistudio.google.com/apikey' },
  { value: 'anthropic', label: 'Claude', hint: 'console.anthropic.com' },
  { value: 'openai', label: 'ChatGPT', hint: 'platform.openai.com/api-keys' },
];

export function ApiKeySettings({ onDone }: { onDone: () => void }) {
  const { provider, apiKey, model, setByok, clearByok } = useByokStore();

  const [draftProvider, setDraftProvider] = useState<ByokProvider | ''>(provider ?? '');
  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftModel, setDraftModel] = useState(model);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const needsKey = draftProvider !== '';
  const canSave = !needsKey || draftKey.trim().length > 0;
  const hint = PROVIDER_OPTIONS.find((o) => o.value === draftProvider)?.hint;

  const handleSave = () => {
    if (!canSave) return;
    if (draftProvider === '') {
      clearByok();
    } else {
      setByok({ provider: draftProvider, apiKey: draftKey.trim(), model: draftModel.trim() });
    }
    setSaved(true);
    setTimeout(onDone, 600);
  };

  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1';
  const inputCls =
    'w-full rounded-md bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 px-3 py-2 focus:outline-none focus:border-indigo-500 transition-colors';

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-2 text-slate-200">
        <KeyRound size={16} className="text-indigo-300" />
        <h3 className="text-sm font-semibold">AI model &amp; API key</h3>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        Chat runs on the school-provided model by default. If you have your own API key you can use
        it instead — it stays in this browser and is only used to make your requests.
      </p>

      <div>
        <label htmlFor="byok-provider" className={labelCls}>
          Provider
        </label>
        <select
          id="byok-provider"
          value={draftProvider}
          onChange={(e) => setDraftProvider(e.target.value as ByokProvider | '')}
          className={inputCls}
        >
          {PROVIDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {needsKey && (
        <>
          <div>
            <label htmlFor="byok-key" className={labelCls}>
              API key
            </label>
            <div className="relative">
              <input
                id="byok-key"
                type={showKey ? 'text' : 'password'}
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
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
            {hint && <p className="mt-1 text-[11px] text-slate-500">Get a key at {hint}</p>}
          </div>

          <div>
            <label htmlFor="byok-model" className={labelCls}>
              Model <span className="normal-case font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="byok-model"
              type="text"
              value={draftModel}
              onChange={(e) => setDraftModel(e.target.value)}
              placeholder="Leave blank for the recommended model"
              autoComplete="off"
              spellCheck={false}
              className={inputCls}
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saved ? <Check size={14} /> : null}
          {saved ? 'Saved' : 'Save'}
        </button>
        <button
          onClick={onDone}
          className="px-4 py-2 rounded-md text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
