/**
 * Drag-to-resize width for a single pane, driven by raw pointer deltas.
 *
 * Deltas (rather than an absolute anchor) are enough here because there is only
 * one divider on the page; the multi-pane editor needs the anchored maths in
 * `useEditorLayout` instead.
 */

import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';

export function useDragWidth(initialWidth: number, minWidth: number) {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  const startResize = (e: MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      setWidth((prev) => Math.max(minWidth, prev + e.movementX));
    };
    const handleMouseUp = () => setIsResizing(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minWidth]);

  return { width, isResizing, startResize };
}
