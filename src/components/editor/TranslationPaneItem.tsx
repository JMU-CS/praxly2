import type { DragEvent, MouseEvent } from 'react';
import { FileJson, ArrowRightLeft, X } from 'lucide-react';

import type { Program } from '../../language/ast';
import { JSONTree } from '../JSONTree';
import { HighlightableCodeMirror } from '../HighlightableCodeMirror';
import { MemDia } from './MemDia';
import type { Panel } from './types';

interface TranslationPaneItemProps {
  panel: Panel;
  ast: Program | null;
  draggedPanelId: string | null;
  dragOverPanelId: string | null;
  translationCode: string;
  highlightedLines: number[];
  showMemDia: boolean;
  resizingMemDiaPaneId: string | null;
  memDiaHeight: number;
  currentVariables: Record<string, any>;
  resizeActive: boolean;
  onRemovePanel: (id: string) => void;
  onResize: (e: MouseEvent) => void;
  onMemDiaResizeMouseDown: (e: MouseEvent, paneId: string) => void;
  onPanelDragStart: (e: DragEvent<HTMLDivElement>, panelId: string) => void;
  onPanelDragOver: (e: DragEvent<HTMLDivElement>, panelId: string) => void;
  onPanelDrop: (e: DragEvent<HTMLDivElement>, panelId: string) => void;
  onPanelDragEnd: () => void;
}

export function TranslationPaneItem({
  panel,
  ast,
  draggedPanelId,
  dragOverPanelId,
  translationCode,
  highlightedLines,
  showMemDia,
  resizingMemDiaPaneId,
  memDiaHeight,
  currentVariables,
  resizeActive,
  onRemovePanel,
  onResize,
  onMemDiaResizeMouseDown,
  onPanelDragStart,
  onPanelDragOver,
  onPanelDrop,
  onPanelDragEnd,
}: TranslationPaneItemProps) {
  return (
    <div
      className={`flex shrink-0 border-r border-slate-800 last:border-0 relative transition-opacity ${
        draggedPanelId === panel.id ? 'opacity-60' : 'opacity-100'
      } ${
        dragOverPanelId === panel.id
          ? 'outline outline-2 outline-indigo-500 outline-offset-[-2px]'
          : ''
      }`}
      style={{ width: panel.width }}
      onDragOver={(e) => onPanelDragOver(e, panel.id)}
      onDrop={(e) => onPanelDrop(e, panel.id)}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          className="h-10 bg-slate-900/50 flex items-center justify-between px-4 border-b border-slate-800 shrink-0 cursor-grab active:cursor-grabbing"
          draggable
          onDragStart={(e) => onPanelDragStart(e, panel.id)}
          onDragEnd={onPanelDragEnd}
        >
          <div className="flex items-center gap-2">
            {panel.lang === 'ast' ? (
              <FileJson size={14} className="text-indigo-400" />
            ) : (
              <ArrowRightLeft size={14} className="text-indigo-400" />
            )}
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {panel.lang} View
            </span>
          </div>
          <button
            onClick={() => onRemovePanel(panel.id)}
            className="p-1 text-slate-600 hover:text-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 relative">
          <div className="flex-1 overflow-hidden">
            {panel.lang === 'ast' ? (
              <div className="text-xs font-mono h-full overflow-auto p-4 custom-scrollbar">
                {ast ? (
                  <JSONTree data={ast} />
                ) : (
                  <div className="text-slate-700 text-center mt-10 italic">
                    Valid code required...
                  </div>
                )}
              </div>
            ) : (
              <HighlightableCodeMirror
                value={translationCode}
                language={panel.lang}
                highlightedLines={highlightedLines}
                readOnly={true}
              />
            )}
          </div>

          {showMemDia && (
            <>
              <div
                className={`h-1 shrink-0 cursor-row-resize transition-colors ${
                  resizingMemDiaPaneId === panel.id
                    ? 'bg-emerald-500'
                    : 'bg-transparent hover:bg-emerald-500/40'
                }`}
                onMouseDown={(e) => onMemDiaResizeMouseDown(e, panel.id)}
              />
              <div className="shrink-0 border-t border-slate-800" style={{ height: memDiaHeight }}>
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

      <div
        className={`absolute top-0 right-0 w-1 h-full cursor-col-resize z-[20] transition-colors ${
          resizeActive ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/30'
        }`}
        onMouseDown={onResize}
      />
    </div>
  );
}
