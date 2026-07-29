/**
 * Settings → text size. Persisted on its own key (not part of the session
 * snapshot) because it is a display preference, not part of the program.
 */

import { useState } from 'react';

import type { TextSize } from '../components/editor/EditorHeader';

const STORAGE_KEY = 'praxly-text-size';

export function useTextSize() {
  const [textSize, setStoredSize] = useState<TextSize>(
    () => (Number(localStorage.getItem(STORAGE_KEY)) || 3) as TextSize
  );

  const setTextSize = (size: TextSize) => {
    setStoredSize(size);
    localStorage.setItem(STORAGE_KEY, String(size));
  };

  // CodeMirror reads this through a CSS variable; Blockly panes take the
  // numeric value to re-theme their SVG text.
  const fontSizePx = 10 + textSize * 2;

  return { textSize, setTextSize, fontSizePx };
}
