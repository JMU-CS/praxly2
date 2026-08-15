import type { MouseEvent, RefObject } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { EditorView } from '@codemirror/view';
import type { ViewUpdate } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

import { LANG_LABELS, type SupportedLang } from '../LanguageSelector';
import { LanguageLogo } from '../LanguageLogo';
import { MemDia } from './MemDia';
import { BlocklyPaneLazy } from './BlocklyPaneLazy';

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
  extensions: Extension[];
  /** Editor text size in px (Settings → text size) — sizes Blockly text. */
  fontSize: number;
  memDiaState: 'open' | 'closed';
  onToggleMemDiaCollapse: () => void;
  onToggleSourceLangDropdown: () => void;
  onSelectSourceLang: (lang: SupportedLang) => void;
  onCodeChange: (value: string) => void;
  onCreateEditor: (view: EditorView) => void;
  onEditorUpdate?: (update: ViewUpdate) => void;
  onMemDiaResizeMouseDown: (e: MouseEvent, paneId: string) => void;
  onResizeEditor: (e: MouseEvent) => void;
  editorResizeActive: boolean;
}

const SOURCE_OPTIONS: SupportedLang[] = ['blocks', 'csp', 'java', 'javascript', 'praxis', 'python'];

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-800';

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
  fontSize,
  memDiaState,
  onToggleMemDiaCollapse,
  onToggleSourceLangDropdown,
  onSelectSourceLang,
  onCodeChange,
  onCreateEditor,
  onEditorUpdate,
  onMemDiaResizeMouseDown,
  onResizeEditor,
  editorResizeActive,
}: SourcePaneProps) {
  return (
    <div className="flex shrink-0 relative group/editor z-[10]" style={{ width }}>
      <div className="flex-1 flex flex-col border-r border-slate-800 overflow-hidden">
        {/* Pane header */}
        <div className="h-10 bg-slate-900 flex items-center justify-between px-4 border-b border-slate-800 text-xs font-bold uppercase tracking-widest text-slate-400 shrink-0">
          <div className="flex items-center relative h-full source-lang-dropdown">
            <button
              onClick={onToggleSourceLangDropdown}
              aria-label={`Source language: ${sourceLang}. Click to change`}
              aria-expanded={showSourceLangDropdown}
              aria-haspopup="listbox"
              className={`flex items-center gap-2 py-2 text-indigo-400 hover:text-indigo-300 transition-colors uppercase ${focusRing}`}
            >
              {sourceLang === 'ast' ? 'AST VIEW' : sourceLang}
              <ChevronDown size={12} aria-hidden="true" />
            </button>
            {showSourceLangDropdown && (
              <div
                role="listbox"
                aria-label="Select source language"
                className="absolute top-full left-0 w-44 bg-slate-800 border border-slate-700 rounded-md shadow-xl overflow-hidden mt-1 z-[110]"
              >
                {SOURCE_OPTIONS.map((lang) => (
                  <button
                    key={lang}
                    role="option"
                    aria-selected={lang === sourceLang}
                    onClick={() => onSelectSourceLang(lang)}
                    /* Explicit text colour: rows inherit the header's
                       slate-400, which drops to 3.9:1 once hover paints
                       slate-700 underneath it. */
                    className={`flex items-center gap-2.5 w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors ${focusRing}`}
                  >
                    <LanguageLogo lang={lang} size={14} />
                    {LANG_LABELS[lang]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span>SOURCE</span>
        </div>

        {/* Editor + MemDia */}
        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden" ref={editorRef}>
          <div className="flex-1 relative overflow-hidden">
            {sourceLang === 'blocks' ? (
              <BlocklyPaneLazy value={code} onChange={onCodeChange} fontSize={fontSize} />
            ) : (
              <CodeMirror
                value={code}
                height="100%"
                theme={vscodeDark}
                extensions={[
                  ...extensions,
                  EditorView.contentAttributes.of({ 'aria-label': 'Source code editor' }),
                ]}
                onChange={onCodeChange}
                onCreateEditor={onCreateEditor}
                onUpdate={onEditorUpdate}
                className="h-full font-mono"
              />
            )}
          </div>

          {showMemDia && memDiaState === 'closed' && (
            <div
              className="border-t border-slate-700/60 flex items-center h-6 px-3 bg-slate-900 shrink-0 cursor-pointer hover:bg-slate-800 transition-colors"
              onClick={onToggleMemDiaCollapse}
              role="button"
              aria-label="Open MemDia panel"
            >
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-300/70">
                MemDia
              </span>
              <ChevronUp size={10} className="text-emerald-300/70 ml-auto" aria-hidden="true" />
            </div>
          )}

          {showMemDia && memDiaState === 'open' && (
            <>
              <div
                className={`h-1 shrink-0 cursor-row-resize transition-colors ${
                  resizingMemDiaPaneId === 'source'
                    ? 'bg-emerald-500'
                    : 'bg-transparent hover:bg-emerald-500/40'
                }`}
                onMouseDown={(e) => onMemDiaResizeMouseDown(e, 'source')}
                aria-hidden="true"
              />
              <div className="h-8 flex items-center gap-2 px-3 bg-slate-900 border-t border-slate-700/60 shrink-0">
                <button
                  onClick={onToggleMemDiaCollapse}
                  aria-label="Close MemDia panel"
                  aria-expanded={true}
                  className={`p-0.5 text-muted hover:text-emerald-300 transition-colors rounded ${focusRing}`}
                  title="Close MemDia"
                >
                  <ChevronDown size={12} aria-hidden="true" />
                </button>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                  MemDia
                </span>
              </div>
              <div className="shrink-0 overflow-hidden" style={{ height: memDiaHeight }}>
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

      {/* Horizontal resize handle */}
      <div
        className={`absolute top-0 right-0 w-1 h-full cursor-col-resize z-[20] transition-colors ${
          editorResizeActive ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/30'
        }`}
        onMouseDown={onResizeEditor}
        aria-hidden="true"
      />
    </div>
  );
}
