import { Plus, FileJson, Check, Bot } from 'lucide-react';
import type { MouseEvent } from 'react';

import type { SupportedLang } from '../LanguageSelector';
import { LanguageLogo } from '../LanguageLogo';
import type { Panel } from './types';

interface AddPanelStripProps {
  showAddMenu: boolean;
  sourceLang: SupportedLang;
  panels: Panel[];
  showAiSidePanel: boolean;
  /** True while the AI panel is being resized (highlights the handle). */
  aiResizeActive: boolean;
  onToggleMenu: () => void;
  onTogglePanel: (lang: SupportedLang) => void;
  onToggleAiPanel: () => void;
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

const LANG_LABELS: Record<SupportedLang, string> = {
  ast: 'AST',
  blocks: 'Blocks',
  csp: 'CSP',
  java: 'Java',
  javascript: 'JavaScript',
  praxis: 'Praxis',
  python: 'Python',
};

export function AddPanelStrip({
  showAddMenu,
  sourceLang,
  panels,
  showAiSidePanel,
  aiResizeActive,
  onToggleMenu,
  onTogglePanel,
  onToggleAiPanel,
  onStartAiResize,
}: AddPanelStripProps) {
  return (
    <div className="add-panel-dropdown w-16 flex flex-col items-center gap-3 pt-4 bg-slate-900 border-l border-slate-800 shrink-0 relative z-[150] shadow-[-10px_0_20px_rgba(0,0,0,0.5)]">
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
      <div className="relative">
        <button
          onClick={onToggleMenu}
          className="p-3 bg-slate-800 hover:bg-indigo-600 rounded-xl text-indigo-400 hover:text-white transition-all shadow-lg active:scale-90 border border-slate-700"
          title="Add Translation View"
        >
          <Plus size={24} />
        </button>

        {showAddMenu && (
          <div className="absolute top-0 right-full mr-3 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.7)] overflow-hidden z-[999] animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="p-3 text-[11px] font-bold text-slate-400 border-b border-slate-700 bg-slate-900/50 uppercase tracking-widest">
              Open View
            </div>
            <div className="p-1">
              {PANEL_LANGS.map((lang) => {
                const isOpen = panels.some((panel) => panel.lang === lang);
                const isSourceLanguage = lang === sourceLang;
                const isDisabled = isSourceLanguage;

                return (
                  <button
                    key={lang}
                    onClick={() => !isDisabled && onTogglePanel(lang)}
                    disabled={isDisabled}
                    className={`flex items-center justify-between gap-3 w-full text-left px-3 py-2.5 text-xs rounded-md transition-colors group ${
                      isDisabled
                        ? 'text-slate-600 cursor-not-allowed opacity-50'
                        : isOpen
                          ? 'text-emerald-300 hover:bg-slate-700'
                          : 'text-slate-300 hover:bg-indigo-600 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {lang === 'ast' ? (
                        <FileJson
                          size={14}
                          className="opacity-60 group-hover:opacity-100 shrink-0"
                        />
                      ) : (
                        <span className="shrink-0">
                          <LanguageLogo lang={lang} size={14} />
                        </span>
                      )}
                      {LANG_LABELS[lang]}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {isSourceLanguage && (
                        <span className="text-[10px] uppercase tracking-wide text-slate-500">
                          Source
                        </span>
                      )}
                      {isOpen && !isSourceLanguage && (
                        <Check size={12} className="text-emerald-400" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* AI assistant — opens the side chat */}
      <button
        onClick={onToggleAiPanel}
        aria-pressed={showAiSidePanel}
        className={`p-3 rounded-xl transition-all shadow-lg active:scale-90 border ${
          showAiSidePanel
            ? 'bg-indigo-600 text-white border-indigo-500'
            : 'bg-slate-800 hover:bg-indigo-600 text-indigo-400 hover:text-white border-slate-700'
        }`}
        title={showAiSidePanel ? 'Close AI Assistant' : 'Open AI Assistant'}
      >
        <Bot size={24} />
      </button>
    </div>
  );
}
