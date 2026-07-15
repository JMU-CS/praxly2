import { FileJson, Bot, BrainCircuit } from 'lucide-react';
import type { MouseEvent } from 'react';

import { LANG_LABELS, type SupportedLang } from '../LanguageSelector';
import { LanguageLogo } from '../LanguageLogo';
import type { Panel } from './types';

interface AddPanelStripProps {
  sourceLang: SupportedLang;
  panels: Panel[];
  showAiSidePanel: boolean;
  showMemDia: boolean;
  /** True while the AI panel is being resized (highlights the handle). */
  aiResizeActive: boolean;
  onTogglePanel: (lang: SupportedLang) => void;
  onToggleAiPanel: () => void;
  onToggleMemDia: () => void;
  /** Starts an AI-panel resize drag from this strip's left edge. */
  onStartAiResize: (e: MouseEvent) => void;
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
  sourceLang,
  panels,
  showAiSidePanel,
  showMemDia,
  aiResizeActive,
  onTogglePanel,
  onToggleAiPanel,
  onToggleMemDia,
  onStartAiResize,
}: AddPanelStripProps) {
  return (
    <div className="add-panel-dropdown w-16 h-full flex flex-col items-center gap-3 pt-4 overflow-y-auto bg-slate-900 border-l border-slate-800 shrink-0 relative z-[150] shadow-[-10px_0_20px_rgba(0,0,0,0.5)]">
      {/* The strip sits between the code panes and the AI panel, so its left
          edge doubles as a second resize handle for the AI panel. */}
      {showAiSidePanel && (
        <div
          className={`absolute top-0 left-0 w-1 h-full cursor-col-resize z-[200] transition-colors ${
            aiResizeActive ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/40'
          }`}
          onMouseDown={onStartAiResize}
          aria-hidden="true"
        />
      )}

      {PANEL_LANGS.map((lang) => {
        const isOpen = panels.some((panel) => panel.lang === lang);
        const isSourceLanguage = lang === sourceLang;
        const label = LANG_LABELS[lang];

        return (
          <button
            key={lang}
            onClick={() => onTogglePanel(lang)}
            disabled={isSourceLanguage}
            aria-pressed={isOpen}
            className={
              isSourceLanguage
                ? 'p-3 rounded-xl border bg-slate-800 text-slate-600 border-slate-700 opacity-50 cursor-not-allowed'
                : toggleButtonClasses(isOpen)
            }
            title={
              isSourceLanguage
                ? `Currently editing in ${label}`
                : isOpen
                  ? `Close ${label} view`
                  : `Open ${label} view`
            }
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
        title={showAiSidePanel ? 'Close AI Assistant' : 'Open AI Assistant'}
      >
        <Bot size={24} />
      </button>

      {/* Memory Diagram — shows live variable state alongside each pane */}
      <button
        onClick={onToggleMemDia}
        aria-pressed={showMemDia}
        className={toggleButtonClasses(showMemDia)}
        title={showMemDia ? 'Close Memory Diagram (MemDia)' : 'Open Memory Diagram (MemDia)'}
      >
        <BrainCircuit size={24} />
      </button>
    </div>
  );
}
