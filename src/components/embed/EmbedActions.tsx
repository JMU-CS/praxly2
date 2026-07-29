import { Play, FastForward, Square } from 'lucide-react';

interface EmbedActionsProps {
  isDebugging: boolean;
  isDebugComplete: boolean;
  onRun: () => void;
  onDebugStart: () => void;
  onDebugStep: () => void;
  onDebugStop: () => void;
  onOpenInEditor: () => void;
}

/** Run/Debug controls — shown in both embed layouts, so they live here once. */
export function EmbedActions({
  isDebugging,
  isDebugComplete,
  onRun,
  onDebugStart,
  onDebugStep,
  onDebugStop,
  onOpenInEditor,
}: EmbedActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {!isDebugging ? (
        <>
          <button
            onClick={onRun}
            aria-label="Run code"
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-green-700 hover:bg-green-800 rounded transition-all"
          >
            <Play size={12} fill="currentColor" aria-hidden="true" /> Run
          </button>
          <button
            onClick={onDebugStart}
            aria-label="Start debugger"
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-200 bg-slate-700 hover:bg-slate-600 rounded transition-all"
          >
            Debug
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onDebugStep}
            disabled={isDebugComplete}
            aria-label="Step through code"
            aria-disabled={isDebugComplete}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-all disabled:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FastForward size={12} fill="currentColor" aria-hidden="true" /> Step
          </button>
          <button
            onClick={onDebugStop}
            aria-label="Stop debugger"
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded transition-all"
          >
            <Square size={12} fill="currentColor" aria-hidden="true" /> Stop
          </button>
        </>
      )}
      <button
        onClick={onOpenInEditor}
        aria-label="Open in full editor"
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-200 bg-slate-700 hover:bg-slate-600 rounded transition-all"
      >
        Open in Editor
      </button>
    </div>
  );
}
