import type { DragEvent, MouseEvent } from 'react';

import type { Program } from '../../language/ast';
import type { SupportedLang } from '../LanguageSelector';
import { MIN_PANEL_WIDTH } from './layoutConstants';
import { TranslationPaneItem } from './TranslationPaneItem';
import type { Panel } from './types';

interface DragHandlers {
  onPanelDragStart: (e: DragEvent<HTMLDivElement>, panelId: string) => void;
  onPanelDragOver: (e: DragEvent<HTMLDivElement>, panelId: string) => void;
  onPanelDrop: (e: DragEvent<HTMLDivElement>, panelId: string) => void;
  onPanelDragEnd: () => void;
}

interface TranslationPanelGridProps {
  panels: Panel[];
  rootPanels: Panel[];
  /** The column that stretches to fill the row's leftover width. */
  elasticPanelId: string | null;
  isMobile: boolean;
  ast: Program | null;
  draggedPanelId: string | null;
  dragOverPanelId: string | null;
  getTranslationCode: (lang: SupportedLang) => string;
  fontSize: number;
  panelHighlightedLines: Map<string, number[]>;
  showMemDia: boolean;
  memDiaResizingPaneId: string | null;
  getMemDiaHeight: (paneId: string) => number;
  getMemDiaState: (paneId: string) => 'open' | 'closed';
  onToggleMemDia: (paneId: string) => void;
  onMemDiaResizeMouseDown: (e: MouseEvent, paneId: string) => void;
  currentVariables: Record<string, any>;
  resizingIdx: number | 'editor' | 'output' | null;
  onResizeColumn: (e: MouseEvent, panelIndex: number) => void;
  onRemovePanel: (id: string) => void;
  onToggleStack: (id: string) => void;
  dragHandlers: DragHandlers;
}

/**
 * The row of translation panes. Each root panel is a column that may hold a
 * second panel stacked beneath it; the last column stretches to fill whatever
 * width the others leave over.
 */
export function TranslationPanelGrid({
  panels,
  rootPanels,
  elasticPanelId,
  isMobile,
  ast,
  draggedPanelId,
  dragOverPanelId,
  getTranslationCode,
  fontSize,
  panelHighlightedLines,
  showMemDia,
  memDiaResizingPaneId,
  getMemDiaHeight,
  getMemDiaState,
  onToggleMemDia,
  onMemDiaResizeMouseDown,
  currentVariables,
  resizingIdx,
  onResizeColumn,
  onRemovePanel,
  onToggleStack,
  dragHandlers,
}: TranslationPanelGridProps) {
  return (
    <>
      {rootPanels.map((rootPanel) => {
        const rootIdx = panels.indexOf(rootPanel);
        const stackedPanel = panels.find((p) => p.stackedUnder === rootPanel.id);
        // The last column fills the leftover width instead of taking a fixed
        // one, so there is nothing to its right to resize against. (On mobile
        // the row scrolls horizontally, so it stays fixed.)
        const isElastic = rootPanel.id === elasticPanelId && !isMobile;
        const onResize = isElastic ? undefined : (e: MouseEvent) => onResizeColumn(e, rootIdx);

        // "Stack below" is offered on a root panel when its column isn't full
        // and there is another free root it could move under.
        const hasFreeNeighbour = panels.some(
          (p) =>
            !p.stackedUnder &&
            p.id !== rootPanel.id &&
            !panels.some((child) => child.stackedUnder === p.id)
        );
        const canStack = !stackedPanel && hasFreeNeighbour;

        const sharedProps = {
          ast,
          draggedPanelId,
          dragOverPanelId,
          fontSize,
          showMemDia,
          resizingMemDiaPaneId: memDiaResizingPaneId,
          currentVariables,
          resizeActive: resizingIdx === rootIdx,
          onRemovePanel,
          onResize,
          onMemDiaResizeMouseDown,
          ...dragHandlers,
        };

        return (
          <div
            key={rootPanel.id}
            className={`flex flex-col border-r border-slate-800 last:border-0 ${
              isElastic ? 'flex-1' : 'shrink-0'
            }`}
            style={isElastic ? { minWidth: MIN_PANEL_WIDTH } : { width: rootPanel.width }}
          >
            <div
              className={`flex-1 min-h-0 overflow-hidden ${
                stackedPanel ? 'border-b border-slate-700' : ''
              }`}
            >
              <TranslationPaneItem
                {...sharedProps}
                panel={rootPanel}
                translationCode={getTranslationCode(rootPanel.lang)}
                highlightedLines={panelHighlightedLines.get(rootPanel.id) || []}
                memDiaHeight={getMemDiaHeight(rootPanel.id)}
                memDiaState={getMemDiaState(rootPanel.id)}
                onToggleMemDiaCollapse={() => onToggleMemDia(rootPanel.id)}
                onToggleStack={canStack ? () => onToggleStack(rootPanel.id) : undefined}
                isStacked={false}
              />
            </div>

            {/* Stacked child — same flex-1 height, shares the column's width */}
            {stackedPanel && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <TranslationPaneItem
                  {...sharedProps}
                  panel={stackedPanel}
                  translationCode={getTranslationCode(stackedPanel.lang)}
                  highlightedLines={panelHighlightedLines.get(stackedPanel.id) || []}
                  memDiaHeight={getMemDiaHeight(stackedPanel.id)}
                  memDiaState={getMemDiaState(stackedPanel.id)}
                  onToggleMemDiaCollapse={() => onToggleMemDia(stackedPanel.id)}
                  onToggleStack={() => onToggleStack(stackedPanel.id)}
                  isStacked={true}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
