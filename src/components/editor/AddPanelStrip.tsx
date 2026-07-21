import { FileJson, Bot, BrainCircuit } from 'lucide-react';

import { LANG_LABELS, type SupportedLang } from '../LanguageSelector';
import { LanguageLogo } from '../LanguageLogo';
import type { Panel } from './types';

interface AddPanelStripProps {
  panels: Panel[];
  showAiSidePanel: boolean;
  showMemDia: boolean;
  onTogglePanel: (lang: SupportedLang) => void;
  onToggleAiPanel: () => void;
  onToggleMemDia: () => void;
}

const PANEL_LANGS: SupportedLang[] = [
  'ast',
  'blocks',
  'csp',
  'java',
  'javascript',
  'praxis',
  'python',
];

const toggleButtonClasses = (active: boolean) =>
  `p-3 rounded-xl transition-all shadow-lg active:scale-90 border ${
    active
      ? 'bg-indigo-600 text-white border-indigo-500'
      : 'bg-slate-800 hover:bg-indigo-600 text-indigo-400 hover:text-white border-slate-700'
  }`;

export function AddPanelStrip({
  panels,
  showAiSidePanel,
  showMemDia,
  onTogglePanel,
  onToggleAiPanel,
  onToggleMemDia,
}: AddPanelStripProps) {
  return (
    <div className="add-panel-dropdown w-16 h-full flex flex-col items-center gap-3 pt-4 overflow-y-auto bg-slate-900 border-r border-slate-800 shrink-0 relative z-[150] shadow-[10px_0_20px_rgba(0,0,0,0.5)]">
      {PANEL_LANGS.map((lang) => {
        const isOpen = panels.some((panel) => panel.lang === lang);
        const label = LANG_LABELS[lang];

        return (
          <button
            key={lang}
            onClick={() => onTogglePanel(lang)}
            aria-pressed={isOpen}
            className={toggleButtonClasses(isOpen)}
            title={label}
          >
            {lang === 'ast' ? <FileJson size={24} /> : <LanguageLogo lang={lang} size={24} />}
          </button>
        );
      })}

      <div className="w-8 h-px bg-slate-700 shrink-0" aria-hidden="true" />

      {/* AI assistant — opens the side chat */}
      <button
        onClick={onToggleAiPanel}
        aria-pressed={showAiSidePanel}
        className={toggleButtonClasses(showAiSidePanel)}
        title="AI Assistant"
      >
        <Bot size={24} />
      </button>

      {/* Memory Diagram — shows live variable state alongside each pane */}
      <button
        onClick={onToggleMemDia}
        aria-pressed={showMemDia}
        className={toggleButtonClasses(showMemDia)}
        title="Memory Diagram"
      >
        <BrainCircuit size={24} />
      </button>
    </div>
  );
}
