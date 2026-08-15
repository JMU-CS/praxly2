/**
 * Sizing for the editor's pane row: how wide the source and translation panes
 * are, how tall the console is, how wide the AI side panel is, and which
 * divider (if any) is currently being dragged.
 *
 * Widths are recomputed from a single budget — the viewport minus the icon rail
 * and the AI panel — so the row always fills exactly, with the last column
 * stretching to absorb any rounding remainder.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, MouseEvent, SetStateAction } from 'react';

import type { OutputPanelState } from '../components/OutputPanel';
import type { Panel } from '../components/editor/types';
import { loadEditorState } from './useEditorSession';
import {
  ADD_STRIP_WIDTH,
  MAX_AI_PANEL_WIDTH,
  MIN_AI_PANEL_WIDTH,
  MIN_OUTPUT_HEIGHT,
  MIN_PANEL_WIDTH,
  MIN_SOURCE_WIDTH,
  MOBILE_BREAKPOINT,
  clamp,
} from '../components/editor/layoutConstants';

/** Which divider a drag is moving: a panel by index, the source pane, or the console. */
export type ResizeTarget = number | 'editor' | 'output';

type ResizeDragSnapshot = {
  index: ResizeTarget;
  startX: number;
  startY: number;
  startEditorWidth: number;
  startPanelWidth: number;
  startOutputHeight: number;
  /** Widest the dragged pane may get before it squeezes the elastic
   *  last column under `MIN_PANEL_WIDTH`. Fixed for the whole drag —
   *  only the dragged pane's own width changes. */
  maxPaneWidth: number;
};

interface UseEditorLayoutArgs {
  panels: Panel[];
  setPanels: Dispatch<SetStateAction<Panel[]>>;
  rootPanels: Panel[];
  showAiSidePanel: boolean;
}

export function useEditorLayout({
  panels,
  setPanels,
  rootPanels,
  showAiSidePanel,
}: UseEditorLayoutArgs) {
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const [editorWidth, setEditorWidth] = useState(
    Math.max(MIN_SOURCE_WIDTH, Math.floor(window.innerWidth * 0.45))
  );
  const [outputHeight, setOutputHeight] = useState(
    Math.max(176, Math.floor(window.innerHeight * 0.24))
  );
  // Restored from the saved session so a reload keeps the console as the user left it.
  const [outputState, setOutputState] = useState<OutputPanelState>(() =>
    loadEditorState()?.showOutput === false ? 'closed' : 'open'
  );
  const [aiPanelWidth, setAiPanelWidth] = useState(320);
  const [isResizingAiPanel, setIsResizingAiPanel] = useState(false);
  const [resizingIdx, setResizingIdx] = useState<ResizeTarget | null>(null);

  const resizeDragRef = useRef<ResizeDragSnapshot | null>(null);
  const aiResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const isMobile = viewportWidth < MOBILE_BREAKPOINT;
  const rootPanelCount = rootPanels.length;

  /** Room the source + translation panes share, after the fixed chrome. */
  const getContentAvailableWidth = useCallback(
    () =>
      Math.max(
        MIN_SOURCE_WIDTH,
        viewportWidth - ADD_STRIP_WIDTH - (showAiSidePanel ? aiPanelWidth : 0)
      ),
    [aiPanelWidth, showAiSidePanel, viewportWidth]
  );

  const getMaxSourceWidth = useCallback(() => {
    const reservedWidth =
      ADD_STRIP_WIDTH +
      (showAiSidePanel ? aiPanelWidth : 0) +
      (panels.length > 0 ? MIN_PANEL_WIDTH : 0);

    return Math.max(MIN_SOURCE_WIDTH, viewportWidth - reservedWidth);
  }, [aiPanelWidth, panels.length, showAiSidePanel, viewportWidth]);

  const maxAiPanelWidth = useCallback(
    () =>
      Math.min(
        MAX_AI_PANEL_WIDTH,
        Math.max(MIN_AI_PANEL_WIDTH, viewportWidth - MIN_SOURCE_WIDTH - ADD_STRIP_WIDTH - 40)
      ),
    [viewportWidth]
  );

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keep every stored size inside its bounds as the viewport (or the AI panel)
  // changes what there is to share.
  useEffect(() => {
    const maxSourceWidth = getMaxSourceWidth();
    const maxOutputHeight = Math.max(MIN_OUTPUT_HEIGHT, window.innerHeight - 120);
    const maxAiWidth = maxAiPanelWidth();

    setEditorWidth((prev) => clamp(prev, MIN_SOURCE_WIDTH, maxSourceWidth));
    setOutputHeight((prev) => clamp(prev, MIN_OUTPUT_HEIGHT, maxOutputHeight));
    setAiPanelWidth((prev) => clamp(prev, MIN_AI_PANEL_WIDTH, maxAiWidth));
    setPanels((prev) => {
      let changed = false;
      const next = prev.map((panel) => {
        const clampedWidth = Math.max(MIN_PANEL_WIDTH, panel.width);
        if (clampedWidth !== panel.width) {
          changed = true;
          return { ...panel, width: clampedWidth };
        }
        return panel;
      });

      return changed ? next : prev;
    });
  }, [getMaxSourceWidth, maxAiPanelWidth, setPanels, viewportWidth]);

  // Re-split the row evenly when the number of side-by-side panes changes, or
  // when the space they share does. Keyed on the pane *count*, not on `panels`
  // itself: that array gets rebuilt on every keystroke (source maps are
  // refreshed per AST), and depending on it here undid each resize drag the
  // frame after it happened.
  useEffect(() => {
    const availableWidth = getContentAvailableWidth();

    if (rootPanelCount === 0) {
      setEditorWidth((prev) => (prev === availableWidth ? prev : availableWidth));
      return;
    }

    const totalPaneCount = rootPanelCount + 1;
    const targetPanelWidth = Math.max(MIN_PANEL_WIDTH, Math.floor(availableWidth / totalPaneCount));
    // The source pane absorbs the rounding remainder so the row fills exactly.
    const targetSourceWidth = Math.max(
      MIN_SOURCE_WIDTH,
      availableWidth - targetPanelWidth * rootPanelCount
    );

    setEditorWidth((prev) => (prev === targetSourceWidth ? prev : targetSourceWidth));

    setPanels((prev) => {
      let changed = false;
      const next = prev.map((panel) => {
        if (panel.width === targetPanelWidth) return panel;
        changed = true;
        // Stacked panels are sized too: they render at their column's width, so
        // an un-synced one would jump if it later swapped places with its root.
        return { ...panel, width: targetPanelWidth };
      });

      return changed ? next : prev;
    });
  }, [getContentAvailableWidth, rootPanelCount, setPanels]);

  const startPaneResize = (e: MouseEvent, index: ResizeTarget) => {
    e.preventDefault();

    if (index === 'editor' && panels.length === 0) return;
    if (typeof index === 'number' && !panels[index]) return;

    // Everything the dragged pane can't claim: the other fixed-width columns,
    // the source pane (when a panel is being dragged), and the minimum the
    // elastic last column has to keep.
    const draggedId = typeof index === 'number' ? panels[index].id : null;
    const otherFixedWidth = rootPanels
      .slice(0, -1)
      .filter((panel) => panel.id !== draggedId)
      .reduce((sum, panel) => sum + panel.width, 0);

    resizeDragRef.current = {
      index,
      startX: e.clientX,
      startY: e.clientY,
      startEditorWidth: editorWidth,
      startPanelWidth: typeof index === 'number' ? panels[index].width : 0,
      startOutputHeight: outputHeight,
      maxPaneWidth:
        getContentAvailableWidth() -
        otherFixedWidth -
        MIN_PANEL_WIDTH -
        (index === 'editor' ? 0 : editorWidth),
    };

    setResizingIdx(index);
  };

  useEffect(() => {
    if (resizingIdx === null) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const drag = resizeDragRef.current;
      if (!drag) return;

      if (resizingIdx === 'output') {
        const deltaY = e.clientY - drag.startY;
        const maxOutputHeight = Math.max(MIN_OUTPUT_HEIGHT, window.innerHeight - 120);
        const rawHeight = drag.startOutputHeight - deltaY;
        // Dragged well past its minimum, the console collapses rather than
        // sticking at the smallest open size.
        if (rawHeight < MIN_OUTPUT_HEIGHT - 40) {
          setOutputState('closed');
        } else {
          setOutputHeight(clamp(rawHeight, MIN_OUTPUT_HEIGHT, maxOutputHeight));
          setOutputState('open');
        }
      } else if (resizingIdx === 'editor') {
        const deltaX = e.clientX - drag.startX;
        setEditorWidth(
          clamp(
            drag.startEditorWidth + deltaX,
            MIN_SOURCE_WIDTH,
            Math.max(MIN_SOURCE_WIDTH, drag.maxPaneWidth)
          )
        );
      } else {
        const panelIndex = resizingIdx;
        setPanels((prev) => {
          if (!prev[panelIndex]) return prev;

          const deltaX = e.clientX - drag.startX;
          const newWidth = clamp(
            drag.startPanelWidth + deltaX,
            MIN_PANEL_WIDTH,
            Math.max(MIN_PANEL_WIDTH, drag.maxPaneWidth)
          );
          if (prev[panelIndex].width === newWidth) return prev;

          const next = [...prev];
          next[panelIndex] = { ...prev[panelIndex], width: newWidth };
          return next;
        });
      }
    };

    const handleMouseUp = () => {
      setResizingIdx(null);
      resizeDragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingIdx, setPanels]);

  // Shared by both AI-panel resize handles (the panel's left edge and the
  // left edge of the add-panel strip): they move in lockstep because the
  // strip has a fixed width, so one drag math works for both.
  const startAiResize = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      aiResizeRef.current = { startX: e.clientX, startWidth: aiPanelWidth };
      setIsResizingAiPanel(true);
    },
    [aiPanelWidth]
  );

  useEffect(() => {
    if (!isResizingAiPanel) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const drag = aiResizeRef.current;
      if (!drag) return;

      // The panel grows leftward, so a leftward drag (negative delta) widens it.
      const deltaX = e.clientX - drag.startX;
      setAiPanelWidth(clamp(drag.startWidth - deltaX, MIN_AI_PANEL_WIDTH, maxAiPanelWidth()));
    };

    const handleMouseUp = () => {
      aiResizeRef.current = null;
      setIsResizingAiPanel(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingAiPanel, maxAiPanelWidth]);

  const toggleOutputState = useCallback(() => {
    setOutputState((prev) => (prev === 'open' ? 'closed' : 'open'));
  }, []);

  return {
    isMobile,
    /** With no translation panels open the source pane takes the whole row. */
    sourcePaneWidth: panels.length === 0 ? getContentAvailableWidth() : editorWidth,
    outputHeight,
    outputState,
    toggleOutputState,
    aiPanelWidth,
    isResizingAiPanel,
    startAiResize,
    resizingIdx,
    startPaneResize,
  };
}
