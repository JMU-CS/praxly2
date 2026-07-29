/**
 * Highlight-to-chat: tracks what the user has selected in the source editor and
 * where to float the "Ask AI" button, so the selection can be sent to the AI
 * panel as context.
 */

import { useCallback, useState } from 'react';
import type { ViewUpdate } from '@codemirror/view';

export interface SelectionCoords {
  top: number;
  left: number;
}

export function useAiSelection() {
  const [selection, setSelection] = useState('');
  const [coords, setCoords] = useState<SelectionCoords | null>(null);

  const onEditorUpdate = useCallback((update: ViewUpdate) => {
    if (!update.selectionSet && !update.docChanged && !update.geometryChanged) return;

    const sel = update.state.selection.main;
    if (sel.empty) {
      setSelection('');
      setCoords(null);
      return;
    }

    setSelection(update.state.sliceDoc(sel.from, sel.to));
    const pos = update.view.coordsAtPos(sel.to);
    setCoords(pos ? { top: pos.bottom + 4, left: pos.left } : null);
  }, []);

  const clear = useCallback(() => {
    setSelection('');
    setCoords(null);
  }, []);

  return { selection, coords, onEditorUpdate, clear };
}
