import { Link } from 'react-router';
import {
  Play,
  Trash2,
  Home,
  BookOpen,
  FileCode,
  Bug,
  FastForward,
  Square,
  Share2,
  Check,
  Settings,
  Type,
  RotateCcw,
} from 'lucide-react';
import type { ExampleProgram } from '../../utils/sampleCodes';
import { EXAMPLE_CATEGORIES } from '../../utils/sampleCodes';
import { TEXT_SIZE_MAX, TEXT_SIZE_MIN } from '../../hooks/useTextSize';
import { PolicyLinks } from '../PolicyLinks';

/** Editor font size in px (13–19, 1px steps). */
export type TextSize = number;

interface EditorHeaderProps {
  embedCopied: boolean;
  showExamplesMenu: boolean;
  showSettingsMenu: boolean;
  isDebugging: boolean;
  isDebugComplete: boolean;
  examples: ExampleProgram[];
  demoAvailable: boolean;
  textSize: TextSize;
  onClear: () => void;
  onShare: () => void;
  onLoadExample: (exampleId: string) => void;
  onLoadDemo: () => void;
  onToggleExamplesMenu: () => void;
  onToggleSettingsMenu: () => void;
  onDebugStart: () => void;
  onRun: () => void;
  onDebugStep: () => void;
  onDebugStop: () => void;
  onTextSizeChange: (size: TextSize) => void;
  onReset: () => void;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900';

/** Shared look for the secondary controls (Demo, Examples, Settings, Share). */
const secondaryBtn =
  'flex items-center gap-2 px-3 py-[5px] text-xs font-semibold tracking-wide text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors';

export function EditorHeader({
  embedCopied,
  showExamplesMenu,
  showSettingsMenu,
  isDebugging,
  isDebugComplete,
  examples,
  demoAvailable,
  textSize,
  onClear,
  onShare,
  onLoadExample,
  onLoadDemo,
  onToggleExamplesMenu,
  onToggleSettingsMenu,
  onDebugStart,
  onRun,
  onDebugStep,
  onDebugStop,
  onTextSizeChange,
  onReset,
}: EditorHeaderProps) {
  return (
    <header
      className="bg-slate-900 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between px-3 lg:px-4 py-2 lg:py-0 lg:h-14 shrink-0 shadow-sm z-[200] gap-2"
      role="banner"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          to="https://praxly.cs.jmu.edu/"
          aria-label="Go to Praxly home"
          title="Go to the Praxly home page"
          className={`p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors ${focusRing}`}
        >
          <Home size={20} aria-hidden="true" />
        </Link>
        <div className="h-6 w-px bg-slate-800 mx-1" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <img
            src="/v2/fallen-leaf_1f342.ico"
            style={{ width: '32px', height: '32px' }}
            alt="Praxly leaf logo"
          />
          <span className="font-bold text-base sm:text-lg text-slate-100 tracking-tight">
            Praxly <span className="text-indigo-400">2.0</span>
          </span>
        </div>
      </div>

      <nav
        className="flex items-center flex-wrap justify-end gap-2 sm:gap-3"
        aria-label="Editor controls"
      >
        <button
          onClick={onLoadDemo}
          disabled={!demoAvailable}
          aria-label="Load demo program for the current source language"
          title="Load a demo program"
          className={`${secondaryBtn} disabled:opacity-40 disabled:cursor-not-allowed ${focusRing}`}
        >
          <FileCode size={14} aria-hidden="true" /> Demo
        </button>

        {/* Examples menu */}
        <div className="relative examples-dropdown">
          <button
            onClick={onToggleExamplesMenu}
            aria-expanded={showExamplesMenu}
            aria-haspopup="listbox"
            aria-controls="examples-listbox"
            title="Browse example programs"
            className={`${secondaryBtn} ${focusRing}`}
          >
            <BookOpen size={14} aria-hidden="true" /> Examples
          </button>

          {showExamplesMenu && (
            <div
              id="examples-listbox"
              role="listbox"
              aria-label="Example programs"
              className="absolute top-full right-0 mt-2 w-80 max-h-[80vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-[220]"
            >
              <div className="px-4 py-3 border-b border-slate-800 text-xs font-bold uppercase tracking-widest text-slate-400">
                Load Example Program
              </div>
              <div className="p-2 space-y-1">
                {examples.map((example) => (
                  <button
                    key={example.id}
                    role="option"
                    aria-selected={false}
                    onClick={() => onLoadExample(example.id)}
                    className={`w-full px-3 py-2 rounded-md text-left hover:bg-slate-800 transition-colors ${focusRing}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-100">{example.title}</span>
                      <span className="text-xs font-bold uppercase tracking-wide text-indigo-300">
                        {example.lang}
                      </span>
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {EXAMPLE_CATEGORIES[example.category]} - {example.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Clear is hidden for now; the handler and its confirmation stay wired
            up so the button can come back by deleting this `false &&`. */}
        {false && (
          <button
            onClick={onClear}
            aria-label="Clear code"
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors ${focusRing}`}
          >
            <Trash2 size={14} aria-hidden="true" /> Clear
          </button>
        )}

        {/* Settings menu */}
        <div className="relative settings-dropdown">
          <button
            onClick={onToggleSettingsMenu}
            aria-expanded={showSettingsMenu}
            aria-haspopup="dialog"
            aria-controls="settings-dialog"
            title="Change editor settings"
            className={`${secondaryBtn} ${focusRing}`}
          >
            <Settings size={14} aria-hidden="true" /> Settings
          </button>

          {showSettingsMenu && (
            <div
              id="settings-dialog"
              role="dialog"
              aria-label="Editor settings"
              className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-[220]"
            >
              {/* Text Size slider */}
              <div className="px-4 py-3 border-b border-slate-800 text-xs font-bold uppercase tracking-widest text-slate-400">
                Display
              </div>
              <div className="px-4 pt-3 pb-4">
                <label
                  htmlFor="text-size-slider"
                  className="flex items-center gap-2 text-sm text-slate-200 mb-3"
                >
                  <Type size={13} aria-hidden="true" />
                  Text Size
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted select-none" aria-hidden="true">
                    A
                  </span>
                  <input
                    id="text-size-slider"
                    type="range"
                    min={TEXT_SIZE_MIN}
                    max={TEXT_SIZE_MAX}
                    step={1}
                    value={textSize}
                    onChange={(e) => onTextSizeChange(Number(e.target.value))}
                    aria-valuetext={`${textSize}px`}
                    className={`flex-1 h-1 rounded-full accent-indigo-500 cursor-pointer ${focusRing}`}
                  />
                  <span className="text-sm font-mono text-muted select-none" aria-hidden="true">
                    A
                  </span>
                </div>
              </div>

              {/* Escape hatch for a browser left holding state a new deployment
                  can't read. Destructive, so it reads red and confirms first. */}
              <div className="px-4 py-3 border-t border-b border-slate-800 text-xs font-bold uppercase tracking-widest text-slate-400">
                Troubleshooting
              </div>
              <div className="px-4 pt-3 pb-4">
                <button
                  onClick={onReset}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-colors ${focusRing}`}
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  Reset Praxly
                </button>
                <p className="mt-2 text-xs text-muted">
                  Clears saved code, settings, and chats in this browser, then reloads.
                </p>
              </div>

              {/* The one place these links reach someone who never signs in and
                  never opens the AI panel — and the natural neighbor for Reset,
                  which is the other control about what Praxly has stored. */}
              <div className="border-t border-slate-800 px-4 py-3">
                <PolicyLinks />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onShare}
          aria-label={embedCopied ? 'Link copied to clipboard' : 'Share embed link'}
          title="Create link for sharing"
          className={`${secondaryBtn} ${focusRing} ${
            embedCopied ? 'bg-green-600/20 text-green-400 hover:bg-green-600/20' : ''
          }`}
        >
          {embedCopied ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Share2 size={14} aria-hidden="true" />
          )}
          {embedCopied ? 'Copied!' : 'Share'}
        </button>

        {/* Debug / Run controls */}
        {!isDebugging ? (
          <>
            <button
              onClick={onDebugStart}
              aria-label="Start debugger (Shift+F5)"
              title="Run one step at a time"
              className={`flex items-center gap-2 px-4 py-1.5 text-sm font-bold text-slate-200 bg-slate-700 hover:bg-slate-600 rounded-md transition-all ${focusRing}`}
            >
              <Bug size={16} aria-hidden="true" /> Debug
            </button>
            <button
              onClick={onRun}
              aria-label="Run code (F5)"
              title="Run the entire program"
              className={`flex items-center gap-2 px-4 py-1.5 text-sm font-bold text-white bg-green-700 hover:bg-green-600 rounded-md shadow-lg shadow-green-900/20 transition-all ${focusRing}`}
            >
              <Play size={16} fill="currentColor" aria-hidden="true" /> Run
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onDebugStep}
              disabled={isDebugComplete}
              aria-label="Step through code (F10)"
              aria-disabled={isDebugComplete}
              className={`flex items-center gap-2 px-4 py-1.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-all disabled:bg-slate-600 disabled:cursor-not-allowed disabled:hover:bg-slate-600 disabled:opacity-50 ${focusRing}`}
            >
              <FastForward size={16} fill="currentColor" aria-hidden="true" /> Step
            </button>
            <button
              onClick={onDebugStop}
              aria-label="Stop debugger (Shift+F5)"
              className={`flex items-center gap-2 px-4 py-1.5 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-md transition-all ${focusRing}`}
            >
              <Square size={16} fill="currentColor" aria-hidden="true" /> Stop
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
