/**
 * Settings → text size. Persisted on its own key (not part of the session
 * snapshot) because it is a display preference, not part of the program.
 */

import { useState } from 'react';

import type { TextSize } from '../components/editor/EditorHeader';

const STORAGE_KEY = 'praxly-text-size';

/**
 * Editor font size in px. The slider steps 1px at a time across this range,
 * so its value is the pixel size itself — no position→px mapping.
 *
 * The bottom of the range sits at the same 13px floor the UI chrome holds to
 * (see the type scale in index.css). This size applies only to the monospace
 * code panes, Blockly, and the output console.
 */
export const TEXT_SIZE_MIN = 13;
export const TEXT_SIZE_MAX = 19;
export const TEXT_SIZE_DEFAULT = 16;

/**
 * Earlier builds stored a 1–5 slider position rather than a pixel size. Read
 * those back through the old `10 + position * 2` mapping so an existing
 * preference survives the change instead of being taken literally as 1–5px.
 */
function readStoredSize(): TextSize {
  const stored = Number(localStorage.getItem(STORAGE_KEY));
  if (!stored) return TEXT_SIZE_DEFAULT;
  const px = stored <= 5 ? 10 + stored * 2 : stored;
  return Math.min(TEXT_SIZE_MAX, Math.max(TEXT_SIZE_MIN, px));
}

export function useTextSize() {
  const [textSize, setStoredSize] = useState<TextSize>(readStoredSize);

  const setTextSize = (size: TextSize) => {
    setStoredSize(size);
    localStorage.setItem(STORAGE_KEY, String(size));
  };

  // CodeMirror reads this through a CSS variable; Blockly panes take the
  // numeric value to re-theme their SVG text.
  return { textSize, setTextSize, fontSizePx: textSize };
}
