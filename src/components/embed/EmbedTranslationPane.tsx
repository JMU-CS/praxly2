import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import type { Program } from '../../language/ast';
import { LANG_LABELS, type SupportedLang } from '../LanguageSelector';
import { HighlightableCodeMirror } from '../HighlightableCodeMirror';
import { JSONTree } from '../JSONTree';

/** Languages the embed's translation pane can switch between. */
const TARGET_OPTIONS: SupportedLang[] = ['python', 'java', 'csp', 'praxis'];

interface EmbedTranslationPaneProps {
  ast: Program | null;
  translationCode: string;
  targetLang: SupportedLang;
  showAst: boolean;
  menuOpen: boolean;
  highlightedLines: number[];
  /** Run/Debug controls, rendered under this pane's header. */
  actions: ReactNode;
  onToggleMenu: () => void;
  onSelectTarget: (lang: SupportedLang) => void;
  onSelectAst: () => void;
}

/** Read-only translation (or AST) column, shown for `?to=` embed links. */
export function EmbedTranslationPane({
  ast,
  translationCode,
  targetLang,
  showAst,
  menuOpen,
  highlightedLines,
  actions,
  onToggleMenu,
  onSelectTarget,
  onSelectAst,
}: EmbedTranslationPaneProps) {
  return (
    <div className="flex flex-1 relative z-[10] border-l border-slate-800 min-w-0">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-slate-900 border-b border-slate-800 shrink-0">
          {/* Header with language selector */}
          <div className="h-10 flex items-center justify-between px-4">
            <div className="relative">
              <button
                onClick={onToggleMenu}
                aria-expanded={menuOpen}
                aria-haspopup="listbox"
                aria-label={`Translation language: ${showAst ? LANG_LABELS.ast : targetLang}. Click to change`}
                className="flex items-center gap-2 py-2 text-indigo-400 hover:text-indigo-300 transition-colors text-xs font-bold uppercase"
              >
                {showAst ? LANG_LABELS.ast : targetLang}
                <ChevronDown size={12} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div
                  role="listbox"
                  aria-label="Select translation language"
                  className="absolute top-full left-0 w-40 bg-slate-800 border border-slate-700 rounded-md shadow-xl overflow-hidden mt-1 z-[110]"
                >
                  {TARGET_OPTIONS.map((lang) => (
                    <button
                      key={lang}
                      role="option"
                      aria-selected={lang === targetLang && !showAst}
                      onClick={() => onSelectTarget(lang)}
                      className={`block w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors ${
                        targetLang === lang && !showAst ? 'bg-indigo-600 text-white' : ''
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                  <div className="border-t border-slate-700" />
                  <button
                    role="option"
                    aria-selected={showAst}
                    onClick={onSelectAst}
                    className={`block w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors ${
                      showAst ? 'bg-indigo-600 text-white' : ''
                    }`}
                  >
                    Show {LANG_LABELS.ast}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="h-10 flex items-center gap-2 px-4 border-t border-slate-800 bg-slate-900/50">
            {actions}
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-950 relative">
          {showAst ? (
            <div className="text-xs font-mono h-full overflow-auto p-4 custom-scrollbar">
              {ast ? (
                <JSONTree data={ast} />
              ) : (
                <div className="text-muted text-center mt-10 italic">Valid code required...</div>
              )}
            </div>
          ) : (
            <HighlightableCodeMirror
              value={translationCode}
              language={targetLang}
              highlightedLines={highlightedLines}
              readOnly={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}
