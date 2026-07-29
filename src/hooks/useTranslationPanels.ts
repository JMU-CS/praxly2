/**
 * Owns the list of open translation panels: which languages are showing, how
 * they are arranged into columns, and the drag-and-drop that rearranges them.
 *
 * Panel *widths* are set by `useEditorLayout`, which re-splits the row whenever
 * the column count changes — so a newly opened panel's starting width is only
 * ever visible for a frame.
 */

import { useCallback, useMemo, useState } from 'react';
import type { DragEvent } from 'react';

import type { Program } from '../language/ast';
import type { SupportedLang } from '../components/LanguageSelector';
import type { Panel } from '../components/editor/types';
import { defaultPanelWidth } from '../components/editor/layoutConstants';
import { restorePanels } from './useEditorSession';
import { randomId } from '../utils/id';
import {
  inSameColumn,
  removePanelById,
  reorderPanel,
  swapStacked,
  toggleStack,
} from '../utils/panelLayout';
import type { SourceMap } from './useCodeParsing';

type GetTranslation = (
  ast: Program | null,
  lang: SupportedLang
) => { code: string; sourceMap: SourceMap };

export function useTranslationPanels(getTranslation: GetTranslation) {
  const [panels, setPanels] = useState<Panel[]>(restorePanels);
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  const [dragOverPanelId, setDragOverPanelId] = useState<string | null>(null);

  const rootPanels = useMemo(() => panels.filter((panel) => !panel.stackedUnder), [panels]);

  // The rightmost column stretches to fill whatever the panes to its left
  // leave over, so dragging any divider can never expose a bare strip of the
  // row's background. Its stored `width` goes unused while it holds this spot.
  const elasticPanelId = rootPanels.length > 0 ? rootPanels[rootPanels.length - 1].id : null;

  /** `ast` seeds the panel's source map so debug highlighting works right away. */
  const addPanel = useCallback(
    (lang: SupportedLang, ast: Program | null) => {
      setPanels((prev) => {
        if (prev.some((panel) => panel.lang === lang)) return prev;

        const { sourceMap } = getTranslation(ast, lang);
        return [...prev, { id: randomId(), lang, width: defaultPanelWidth(), sourceMap }];
      });
    },
    [getTranslation]
  );

  const removePanel = useCallback((id: string) => {
    setPanels((prev) => removePanelById(prev, id));
  }, []);

  /** Opens or closes a translation panel without closing the add menu. */
  const togglePanel = useCallback(
    (lang: SupportedLang, ast: Program | null) => {
      const existing = panels.find((panel) => panel.lang === lang);
      if (existing) removePanel(existing.id);
      else addPanel(lang, ast);
    },
    [panels, addPanel, removePanel]
  );

  const togglePanelStack = useCallback((id: string) => {
    setPanels((prev) => toggleStack(prev, id));
  }, []);

  /** Drops any panel showing `lang` — the source pane already covers it. */
  const dropPanelsForLang = useCallback((lang: SupportedLang) => {
    setPanels((prev) => prev.filter((panel) => panel.lang !== lang));
  }, []);

  const dragHandlers = useMemo(
    () => ({
      onPanelDragStart: (e: DragEvent<HTMLDivElement>, panelId: string) => {
        setDraggedPanelId(panelId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', panelId);
      },
      onPanelDragOver: (e: DragEvent<HTMLDivElement>, panelId: string) => {
        if (!draggedPanelId || draggedPanelId === panelId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverPanelId((prev) => (prev === panelId ? prev : panelId));
      },
      onPanelDrop: (e: DragEvent<HTMLDivElement>, panelId: string) => {
        e.preventDefault();
        const sourceId = draggedPanelId || e.dataTransfer.getData('text/plain');

        if (sourceId && sourceId !== panelId) {
          setPanels((prev) =>
            inSameColumn(prev, sourceId, panelId)
              ? swapStacked(prev, sourceId, panelId)
              : reorderPanel(prev, sourceId, panelId)
          );
        }

        setDragOverPanelId(null);
        setDraggedPanelId(null);
      },
      onPanelDragEnd: () => {
        setDraggedPanelId(null);
        setDragOverPanelId(null);
      },
    }),
    [draggedPanelId]
  );

  return {
    panels,
    setPanels,
    rootPanels,
    elasticPanelId,
    draggedPanelId,
    dragOverPanelId,
    addPanel,
    removePanel,
    togglePanel,
    togglePanelStack,
    dropPanelsForLang,
    dragHandlers,
  };
}

export type TranslationPanels = ReturnType<typeof useTranslationPanels>;
