/**
 * Highlight-to-chat: tracks what the user has selected in the source editor, so
 * the AI panel can show it as the context a question is about (see the
 * "Asking about selected code" chip in ChatThread).
 */

import { useCallback, useState } from 'react';
import type { ViewUpdate } from '@codemirror/view';

export function useAiSelection() {
  const [selection, setSelection] = useState('');

  const onEditorUpdate = useCallback((update: ViewUpdate) => {
    if (!update.selectionSet && !update.docChanged) return;

    const sel = update.state.selection.main;
    setSelection(sel.empty ? '' : update.state.sliceDoc(sel.from, sel.to));
  }, []);

  const clear = useCallback(() => setSelection(''), []);

  return { selection, onEditorUpdate, clear };
}
