/**
 * Per-pane memory-diagram strips: how tall each one is, whether it is open, and
 * the drag that resizes it. Keyed by pane id ('source' for the source pane,
 * otherwise the translation panel's id) so every pane keeps its own setting.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';

import {
  MAX_MEM_DIA_HEIGHT,
  MIN_MEM_DIA_HEIGHT,
  clamp,
} from '../components/editor/layoutConstants';

const DEFAULT_HEIGHT = 160;

export function useMemDiaPanes() {
  const [states, setStates] = useState<Map<string, 'open' | 'closed'>>(new Map());
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [resizingPaneId, setResizingPaneId] = useState<string | null>(null);

  const resizeRef = useRef<{ paneId: string; startY: number; startHeight: number } | null>(null);

  const getHeight = useCallback((paneId: string) => heights[paneId] ?? DEFAULT_HEIGHT, [heights]);

  const getState = useCallback(
    (paneId: string): 'open' | 'closed' => states.get(paneId) ?? 'open',
    [states]
  );

  const toggle = useCallback((paneId: string) => {
    setStates((prev) => {
      const next = new Map(prev);
      next.set(paneId, (next.get(paneId) ?? 'open') === 'open' ? 'closed' : 'open');
      return next;
    });
  }, []);

  /** Reopens every pane — used when the diagrams are switched back on. */
  const resetStates = useCallback(() => setStates(new Map()), []);

  const startResize = useCallback(
    (e: MouseEvent, paneId: string) => {
      e.preventDefault();
      resizeRef.current = { paneId, startY: e.clientY, startHeight: getHeight(paneId) };
      setResizingPaneId(paneId);
    },
    [getHeight]
  );

  useEffect(() => {
    if (!resizingPaneId) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const drag = resizeRef.current;
      if (!drag) return;

      const deltaY = e.clientY - drag.startY;
      const rawHeight = drag.startHeight - deltaY;

      // Dragged well past its minimum, the strip collapses instead of sticking
      // at the smallest open size.
      if (rawHeight < MIN_MEM_DIA_HEIGHT - 40) {
        setStates((prev) => {
          const next = new Map(prev);
          next.set(drag.paneId, 'closed');
          return next;
        });
        return;
      }

      const nextHeight = clamp(rawHeight, MIN_MEM_DIA_HEIGHT, MAX_MEM_DIA_HEIGHT);
      setHeights((prev) =>
        prev[drag.paneId] === nextHeight ? prev : { ...prev, [drag.paneId]: nextHeight }
      );
      setStates((prev) => {
        if ((prev.get(drag.paneId) ?? 'open') === 'open') return prev;
        const next = new Map(prev);
        next.set(drag.paneId, 'open');
        return next;
      });
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      setResizingPaneId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingPaneId]);

  return { getHeight, getState, toggle, resetStates, resizingPaneId, startResize };
}

export type MemDiaPanes = ReturnType<typeof useMemDiaPanes>;
