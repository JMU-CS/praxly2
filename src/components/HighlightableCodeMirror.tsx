/**
 * HighlightableCodeMirror component that displays code with line highlighting.
 * Uses CodeMirror's StateField system to manage highlighted line decorations.
 */

import React, { useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { Decoration, EditorView } from '@codemirror/view';
import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { getCodeMirrorExtensions } from '../utils/editorUtils';
import type { SupportedLang } from './LanguageSelector';

interface HighlightableCodeMirrorProps {
  value: string;
  language: SupportedLang;
  highlightedLines: number[];
  readOnly?: boolean;
  className?: string;
}

// CodeMirror decoration helper
const highlightLineDecoration = Decoration.line({
  attributes: {
    style: 'background-color: rgba(99, 102, 241, 0.25); border-left: 3px solid rgb(99, 102, 241);',
  },
});

const highlightLinesEffect = StateEffect.define<number[]>();

const highlightedLinesField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(highlightLinesEffect)) {
        const ranges = effect.value;
        const builder = new RangeSetBuilder<Decoration>();

        for (const lineNum of ranges) {
          const line = tr.state.doc.line(lineNum + 1);
          if (line) {
            builder.add(line.from, line.from, highlightLineDecoration);
          }
        }
        return builder.finish();
      }
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const HighlightableCodeMirror: React.FC<HighlightableCodeMirrorProps> = ({
  value,
  language,
  highlightedLines,
  readOnly = false,
  className = '',
}) => {
  const editorViewRef = useRef<any>(null);

  const handleCreateEditor = (view: any) => {
    editorViewRef.current = view;
  };

  useEffect(() => {
    if (!editorViewRef.current) return;

    editorViewRef.current.dispatch({
      effects: highlightLinesEffect.of(highlightedLines),
    });
  }, [highlightedLines]);

  const extensions = getCodeMirrorExtensions(language);
  extensions.push(highlightedLinesField);

  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={vscodeDark}
      extensions={extensions}
      readOnly={readOnly}
      editable={!readOnly}
      onCreateEditor={handleCreateEditor}
      className={`text-[11px] h-full font-mono ${className}`}
    />
  );
};
