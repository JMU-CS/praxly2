import type { MouseEvent } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

import type { SupportedLang } from '../LanguageSelector';

interface EmbedSourcePaneProps {
  lang: SupportedLang;
  code: string;
  width: number;
  extensions: Extension[];
  resizeActive: boolean;
  onCodeChange: (value: string) => void;
  onCreateEditor: (view: EditorView) => void;
  onStartResize: (e: MouseEvent) => void;
}

/** Editable source column, identical in both embed layouts. */
export function EmbedSourcePane({
  lang,
  code,
  width,
  extensions,
  resizeActive,
  onCodeChange,
  onCreateEditor,
  onStartResize,
}: EmbedSourcePaneProps) {
  return (
    <div
      className="flex shrink-0 relative group/source z-[10] border-r border-slate-800"
      style={{ width }}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-10 bg-slate-900 flex items-center px-4 border-b border-slate-800 text-xs font-bold uppercase tracking-widest text-slate-400 shrink-0">
          Source ({lang})
        </div>
        <div className="flex-1 relative bg-slate-950 overflow-hidden">
          <CodeMirror
            value={code}
            height="100%"
            theme={vscodeDark}
            extensions={[
              ...extensions,
              EditorView.contentAttributes.of({ 'aria-label': `${lang} source code editor` }),
            ]}
            editable={true}
            onChange={onCodeChange}
            onCreateEditor={onCreateEditor}
            className="h-full font-mono"
          />
        </div>
      </div>
      <div
        className={`absolute top-0 right-0 w-1 h-full cursor-col-resize z-[20] transition-colors ${
          resizeActive ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/30'
        }`}
        onMouseDown={onStartResize}
        aria-hidden="true"
      />
    </div>
  );
}
