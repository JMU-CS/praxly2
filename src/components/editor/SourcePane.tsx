import type { MouseEvent, RefObject } from 'react';
import { ChevronDown } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';

import type { SupportedLang } from '../LanguageSelector';
import { MemDia } from './MemDia';

interface SourcePaneProps {
  width: number;
  sourceLang: SupportedLang;
  showSourceLangDropdown: boolean;
  code: string;
  showMemDia: boolean;
  resizingMemDiaPaneId: string | null;
  memDiaHeight: number;
  currentVariables: Record<string, any>;
  editorRef: RefObject<HTMLDivElement | null>;
  extensions: any[];
  onToggleSourceLangDropdown: () => void;
  onSelectSourceLang: (lang: SupportedLang) => void;
  onCodeChange: (value: string) => void;
  onCreateEditor: (view: any) => void;
  onMemDiaResizeMouseDown: (e: MouseEvent, paneId: string) => void;
  onResizeEditor: (e: MouseEvent) => void;
  editorResizeActive: boolean;
}

const SOURCE_OPTIONS: SupportedLang[] = ['csp', 'java', 'praxis', 'python'];

export function SourcePane({
  width,
  sourceLang,
  showSourceLangDropdown,
  code,
  showMemDia,
  resizingMemDiaPaneId,
  memDiaHeight,
  currentVariables,
  editorRef,
  extensions,
  onToggleSourceLangDropdown,
  onSelectSourceLang,
  onCodeChange,
  onCreateEditor,
  onMemDiaResizeMouseDown,
  onResizeEditor,
  editorResizeActive,
}: SourcePaneProps) {
  return (
    <div className="flex shrink-0 relative group/editor z-[10]" style={{ width }}>
      <div className="flex-1 flex flex-col border-r border-slate-800 overflow-hidden">
        <div className="h-10 bg-slate-900 flex items-center justify-between px-4 border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-500 shrink-0">
          <div className="flex items-center relative h-full source-lang-dropdown">
            <button
              onClick={onToggleSourceLangDropdown}
              className="flex items-center gap-2 py-2 text-indigo-400 hover:text-indigo-300 transition-colors uppercase"
            >
              {sourceLang === 'ast' ? 'AST VIEW' : sourceLang}
              <ChevronDown size={12} />
            </button>
            {showSourceLangDropdown && (
              <div className="absolute top-full left-0 w-40 bg-slate-800 border border-slate-700 rounded-md shadow-xl overflow-hidden mt-1 z-[110]">
                {SOURCE_OPTIONS.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => onSelectSourceLang(lang)}
                    className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-700 transition-colors"
                  >
                    {lang === 'csp'
                      ? 'CSP'
                      : lang === 'java'
                        ? 'Java'
                        : lang === 'praxis'
                          ? 'Praxis'
                          : 'Python'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span>SOURCE</span>
        </div>

        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden" ref={editorRef}>
          <div className="flex-1 relative overflow-hidden">
            <CodeMirror
              value={code}
              height="100%"
              theme={vscodeDark}
              extensions={extensions}
              onChange={onCodeChange}
              onCreateEditor={onCreateEditor}
              className="text-sm h-full font-mono"
            />
          </div>

          {showMemDia && (
            <>
              <div
                className={`h-1 shrink-0 cursor-row-resize transition-colors ${
                  resizingMemDiaPaneId === 'source'
                    ? 'bg-emerald-500'
                    : 'bg-transparent hover:bg-emerald-500/40'
                }`}
                onMouseDown={(e) => onMemDiaResizeMouseDown(e, 'source')}
              />
              <div className="shrink-0 border-t border-slate-800" style={{ height: memDiaHeight }}>
                <MemDia
                  paneTitle="Source"
                  paneLang={sourceLang}
                  currentVariables={currentVariables}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div
        className={`absolute top-0 right-0 w-1 h-full cursor-col-resize z-[20] transition-colors ${
          editorResizeActive ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/30'
        }`}
        onMouseDown={onResizeEditor}
      />
    </div>
  );
}
