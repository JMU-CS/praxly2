import { Link } from 'react-router-dom';
import {
  Play,
  Trash2,
  Home,
  Bug,
  FastForward,
  Square,
  Share2,
  Check,
  Settings,
} from 'lucide-react';

interface EditorHeaderProps {
  embedCopied: boolean;
  showSettingsMenu: boolean;
  showAiSidePanel: boolean;
  showMemDia: boolean;
  isDebugging: boolean;
  isDebugComplete: boolean;
  onClear: () => void;
  onShare: () => void;
  onToggleSettingsMenu: () => void;
  onToggleAiPanel: () => void;
  onToggleMemDia: () => void;
  onDebugStart: () => void;
  onRun: () => void;
  onDebugStep: () => void;
  onDebugStop: () => void;
}

export function EditorHeader({
  embedCopied,
  showSettingsMenu,
  showAiSidePanel,
  showMemDia,
  isDebugging,
  isDebugComplete,
  onClear,
  onShare,
  onToggleSettingsMenu,
  onToggleAiPanel,
  onToggleMemDia,
  onDebugStart,
  onRun,
  onDebugStep,
  onDebugStop,
}: EditorHeaderProps) {
  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 shadow-sm z-[200]">
      <div className="flex items-center gap-3">
        <Link
          to="/v2/"
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <Home size={20} />
        </Link>
        <div className="h-6 w-px bg-slate-800 mx-1" />
        <div className="flex items-center gap-2">
          <img
            src="/v2/fallen-leaf_1f342.ico"
            style={{ width: '32px', height: '32px' }}
            alt="Logo"
          />
          <h1 className="font-bold text-lg text-slate-100 tracking-tight">
            Praxly <span className="text-indigo-400">2.0</span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onClear}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <Trash2 size={14} /> Clear
        </button>
        <button
          onClick={onShare}
          className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
            embedCopied
              ? 'bg-green-600/20 text-green-400'
              : 'text-slate-200 bg-slate-700 hover:bg-slate-600'
          }`}
        >
          {embedCopied ? <Check size={14} /> : <Share2 size={14} />}
          {embedCopied ? 'Copied!' : 'Share'}
        </button>

        <div className="relative settings-dropdown">
          <button
            onClick={onToggleSettingsMenu}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
          >
            <Settings size={14} /> Settings
          </button>

          {showSettingsMenu && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-[220]">
              <div className="px-4 py-3 border-b border-slate-800 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Editor Panels
              </div>
              <div className="p-2">
                <button
                  onClick={onToggleAiPanel}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left hover:bg-slate-800 transition-colors"
                >
                  <span className="text-sm text-slate-200">AI Side Panel</span>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wide ${
                      showAiSidePanel ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {showAiSidePanel ? 'On' : 'Off'}
                  </span>
                </button>

                <button
                  onClick={onToggleMemDia}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left hover:bg-slate-800 transition-colors"
                >
                  <span className="text-sm text-slate-200">Memory Diagram (MemDia)</span>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wide ${
                      showMemDia ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {showMemDia ? 'On' : 'Off'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {!isDebugging ? (
          <>
            <button
              onClick={onDebugStart}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-bold text-slate-200 bg-slate-700 hover:bg-slate-600 rounded-md transition-all"
            >
              <Bug size={16} /> Debug
            </button>
            <button
              onClick={onRun}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-md shadow-lg shadow-green-900/20 transition-all hover:translate-y-[-1px] active:translate-y-[1px]"
            >
              <Play size={16} fill="currentColor" /> Run Code
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onDebugStep}
              disabled={isDebugComplete}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-all disabled:bg-slate-600 disabled:cursor-not-allowed disabled:hover:bg-slate-600 disabled:opacity-50"
            >
              <FastForward size={16} fill="currentColor" /> Step
            </button>
            <button
              onClick={onDebugStop}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-md transition-all"
            >
              <Square size={16} fill="currentColor" /> Stop
            </button>
          </>
        )}
      </div>
    </header>
  );
}
