/**
 * Wires a CodeMirror instance to debugger line highlighting: keeps the view
 * reference and re-dispatches the decoration effect whenever the highlighted
 * lines change.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { EditorView } from '@codemirror/view';

import { dispatchLineHighlighting } from '../utils/codemirrorConfig';

export function useHighlightedEditor(highlightedLines: number[]) {
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    dispatchLineHighlighting(viewRef, highlightedLines);
  }, [highlightedLines]);

  const onCreateEditor = useCallback((view: EditorView) => {
    viewRef.current = view;
  }, []);

  return onCreateEditor;
}
