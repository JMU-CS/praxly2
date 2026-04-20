import { Plus, FileJson, Code } from 'lucide-react';

import type { SupportedLang } from '../LanguageSelector';
import type { Panel } from './types';

interface AddPanelStripProps {
  showAddMenu: boolean;
  sourceLang: SupportedLang;
  panels: Panel[];
  onToggleMenu: () => void;
  onAddPanel: (lang: SupportedLang) => void;
}

const PANEL_LANGS: SupportedLang[] = ['python', 'java', 'csp', 'ast', 'praxis'];

export function AddPanelStrip({
  showAddMenu,
  sourceLang,
  panels,
  onToggleMenu,
  onAddPanel,
}: AddPanelStripProps) {
  return (
    <div className="w-16 flex flex-col items-center pt-4 bg-slate-900 border-l border-slate-800 shrink-0 relative z-[150] shadow-[-10px_0_20px_rgba(0,0,0,0.5)]">
      <div className="relative">
        <button
          onClick={onToggleMenu}
          className="p-3 bg-slate-800 hover:bg-indigo-600 rounded-xl text-indigo-400 hover:text-white transition-all shadow-lg active:scale-90 border border-slate-700"
          title="Add Translation View"
        >
          <Plus size={24} />
        </button>

        {showAddMenu && (
          <div className="absolute top-0 right-full mr-3 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.7)] overflow-hidden z-[999] animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="p-3 text-[11px] font-bold text-slate-400 border-b border-slate-700 bg-slate-900/50 uppercase tracking-widest">
              Open View
            </div>
            <div className="p-1">
              {PANEL_LANGS.map((lang) => {
                const isAlreadyOpen = panels.some((panel) => panel.lang === lang);
                const isSourceLanguage = lang === sourceLang;
                const isDisabled = isAlreadyOpen || isSourceLanguage;

                return (
                  <button
                    key={lang}
                    onClick={() => !isDisabled && onAddPanel(lang)}
                    disabled={isDisabled}
                    className={`flex items-center justify-between gap-3 w-full text-left px-3 py-2.5 text-xs rounded-md transition-colors capitalize group ${
                      isDisabled
                        ? 'text-slate-600 cursor-not-allowed opacity-50'
                        : 'text-slate-300 hover:bg-indigo-600 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      {lang === 'ast' ? (
                        <FileJson size={14} className="opacity-50 group-hover:opacity-100" />
                      ) : (
                        <Code size={14} className="opacity-50 group-hover:opacity-100" />
                      )}
                      {
                        {
                          ast: 'AST',
                          csp: 'CSP',
                          java: 'Java',
                          praxis: 'Praxis',
                          python: 'Python',
                        }[lang]
                      }
                    </span>
                    {isSourceLanguage && (
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">
                        Source
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
