import type { DragEvent, MouseEvent } from 'react';
import {
  FileJson,
  ArrowRightLeft,
  X,
  ChevronDown,
  ChevronUp,
  PanelBottom,
  PanelRight,
} from 'lucide-react';

import type { Program } from '../../language/ast';
import { JSONTree } from '../JSONTree';
import { HighlightableCodeMirror } from '../HighlightableCodeMirror';
import { MemDia } from './MemDia';
import { BlocklyPaneLazy } from './BlocklyPaneLazy';
import type { Panel } from './types';

interface TranslationPaneItemProps {
  panel: Panel;
  ast: Program | null;
  draggedPanelId: string | null;
  dragOverPanelId: string | null;
  translationCode: string;
  /** Editor text size in px (Settings → text size) — sizes Blockly text. */
  fontSize: number;
  highlightedLines: number[];
  showMemDia: boolean;
  resizingMemDiaPaneId: string | null;
  memDiaHeight: number;
  currentVariables: Record<string, any>;
  resizeActive: boolean;
  memDiaState: 'open' | 'closed';
  onRemovePanel: (id: string) => void;
  /** Omitted for the column that stretches to fill the row — it has no
   *  fixed width to drag, and nothing to its right to trade space with. */
  onResize?: (e: MouseEvent) => void;
  onMemDiaResizeMouseDown: (e: MouseEvent, paneId: string) => void;
  onToggleMemDiaCollapse: () => void;
  onToggleStack?: () => void;
  isStacked?: boolean;
  onPanelDragStart: (e: DragEvent<HTMLDivElement>, panelId: string) => void;
  onPanelDragOver: (e: DragEvent<HTMLDivElement>, panelId: string) => void;
  onPanelDrop: (e: DragEvent<HTMLDivElement>, panelId: string) => void;
  onPanelDragEnd: () => void;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-800';

export function TranslationPaneItem({
  panel,
  ast,
  draggedPanelId,
  dragOverPanelId,
  translationCode,
  fontSize,
  highlightedLines,
  showMemDia,
  resizingMemDiaPaneId,
  memDiaHeight,
  currentVariables,
  resizeActive,
  memDiaState,
  onToggleStack,
  isStacked = false,
  onRemovePanel,
  onResize,
  onMemDiaResizeMouseDown,
  onToggleMemDiaCollapse,
  onPanelDragStart,
  onPanelDragOver,
  onPanelDrop,
  onPanelDragEnd,
}: TranslationPaneItemProps) {
  return (
    <div
      className={`flex h-full relative transition-opacity ${
        draggedPanelId === panel.id ? 'opacity-60' : 'opacity-100'
      } ${
        dragOverPanelId === panel.id
          ? 'outline outline-2 outline-indigo-500 outline-offset-[-2px]'
          : ''
      }`}
      onDragOver={(e) => onPanelDragOver(e, panel.id)}
      onDrop={(e) => onPanelDrop(e, panel.id)}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Pane header (draggable) */}
        <div
          className="h-10 bg-slate-900/50 flex items-center justify-between px-4 border-b border-slate-800 shrink-0 cursor-grab active:cursor-grabbing"
          draggable
          onDragStart={(e) => onPanelDragStart(e, panel.id)}
          onDragEnd={onPanelDragEnd}
        >
          <div className="flex items-center gap-2">
            {panel.lang === 'ast' ? (
              <FileJson size={14} className="text-indigo-400" aria-hidden="true" />
            ) : (
              <ArrowRightLeft size={14} className="text-indigo-400" aria-hidden="true" />
            )}
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {panel.lang} View
            </span>
          </div>
          <div className="flex items-center gap-1">
            {(onToggleStack || isStacked) && (
              <button
                onClick={onToggleStack}
                aria-label={isStacked ? 'Move panel to side' : 'Stack panel below'}
                title={isStacked ? 'Move to side' : 'Stack below left panel'}
                className={`p-1 transition-colors rounded ${focusRing} ${
                  isStacked
                    ? 'text-indigo-400 hover:text-slate-300'
                    : 'text-slate-400 hover:text-indigo-400'
                }`}
              >
                {isStacked ? (
                  <PanelRight size={13} aria-hidden="true" />
                ) : (
                  <PanelBottom size={13} aria-hidden="true" />
                )}
              </button>
            )}
            <button
              onClick={() => onRemovePanel(panel.id)}
              aria-label={`Remove ${panel.lang} panel`}
              className={`p-1 text-slate-400 hover:text-red-400 transition-colors rounded ${focusRing}`}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Code / AST content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 relative">
          <div className="flex-1 overflow-hidden">
            {panel.lang === 'ast' ? (
              <div className="text-xs font-mono h-full overflow-auto p-4 custom-scrollbar">
                {ast ? (
                  <JSONTree data={ast} />
                ) : (
                  <div className="text-slate-500 text-center mt-10 italic">
                    Valid code required...
                  </div>
                )}
              </div>
            ) : panel.lang === 'blocks' ? (
              <BlocklyPaneLazy value={translationCode} readOnly fontSize={fontSize} />
            ) : (
              <HighlightableCodeMirror
                value={translationCode}
                language={panel.lang}
                highlightedLines={highlightedLines}
                readOnly={true}
              />
            )}
          </div>

          {showMemDia && memDiaState === 'closed' && (
            <div
              className="border-t border-slate-700/60 flex items-center h-6 px-3 bg-slate-900 shrink-0 cursor-pointer hover:bg-slate-800 transition-colors"
              onClick={onToggleMemDiaCollapse}
              role="button"
              aria-label="Open MemDia panel"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/60">
                MemDia
              </span>
              <ChevronUp size={10} className="text-emerald-300/60 ml-auto" aria-hidden="true" />
            </div>
          )}

          {showMemDia && memDiaState === 'open' && (
            <>
              <div
                className={`h-1 shrink-0 cursor-row-resize transition-colors ${
                  resizingMemDiaPaneId === panel.id
                    ? 'bg-emerald-500'
                    : 'bg-transparent hover:bg-emerald-500/40'
                }`}
                onMouseDown={(e) => onMemDiaResizeMouseDown(e, panel.id)}
                aria-hidden="true"
              />
              <div className="h-8 flex items-center gap-2 px-3 bg-slate-900 border-t border-slate-700/60 shrink-0">
                <button
                  onClick={onToggleMemDiaCollapse}
                  aria-label="Close MemDia panel"
                  aria-expanded={true}
                  className={`p-0.5 text-slate-500 hover:text-emerald-300 transition-colors rounded ${focusRing}`}
                  title="Close MemDia"
                >
                  <ChevronDown size={12} aria-hidden="true" />
                </button>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                  MemDia
                </span>
              </div>
              <div className="shrink-0 overflow-hidden" style={{ height: memDiaHeight }}>
                <MemDia
                  paneTitle="Panel"
                  paneLang={panel.lang}
                  currentVariables={currentVariables}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Horizontal resize handle */}
      {onResize && (
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize z-[20] transition-colors ${
            resizeActive ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/30'
          }`}
          onMouseDown={onResize}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
