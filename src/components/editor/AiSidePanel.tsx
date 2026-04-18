import { X } from 'lucide-react';
import type { MouseEvent } from 'react';

interface AiSidePanelProps {
  width: number;
  isResizing: boolean;
  onStartResize: (e: MouseEvent) => void;
  onClose: () => void;
}

export function AiSidePanel({ width, isResizing, onStartResize, onClose }: AiSidePanelProps) {
  return (
    <div
      className="shrink-0 flex flex-col bg-slate-900 border-l border-slate-800 relative z-[140]"
      style={{ width }}
    >
      <div
        className={`absolute top-0 left-0 w-1 h-full cursor-col-resize z-[200] transition-colors ${
          isResizing ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/40'
        }`}
        onMouseDown={onStartResize}
      />
      <div className="h-10 px-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/80 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
          AI Side Panel
        </span>
        <button
          onClick={onClose}
          className="p-1 text-slate-500 hover:text-slate-200 transition-colors"
          title="Close AI panel"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-xs font-semibold text-slate-300 mb-1">Assistant Status</p>
          <p className="text-xs text-slate-500">
            Placeholder panel for summer AI integrations (chat, hints, and code guidance).
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-xs font-semibold text-slate-300 mb-1">Suggested Integrations</p>
          <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
            <li>Context-aware tutoring prompts</li>
            <li>Step-by-step debugging suggestions</li>
            <li>Translation quality explanations</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
