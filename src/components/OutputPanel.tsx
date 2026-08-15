import React, { useState, useRef, useEffect, useId } from 'react';
import { Terminal, AlertCircle } from 'lucide-react';
import { ResizeHandle } from './ResizeHandle';
import { VariableFrames, formatVariableValue } from './VariableFrames';
import type { StackFrame } from '../language/debugger';

export type OutputPanelState = 'open' | 'closed';

interface OutputPanelProps {
  output: string[];
  error?: string | null;
  /** False until the user's first Run/Debug — suppresses the placeholder after that. */
  hasRun?: boolean;
  variables?: Record<string, any>;
  /** Debugger call stack (global scope first). When given, variables are shown per frame. */
  callStack?: StackFrame[];
  showVariables?: boolean;
  height?: number;
  resizeActive?: boolean;
  onResize?: (e: React.MouseEvent) => void;
  waitingForInput?: boolean;
  inputPrompt?: string;
  onSubmitInput?: (input: string) => void;
  panelState?: OutputPanelState;
  /** Clicking anywhere on the header bar opens/closes the panel. */
  onToggle?: () => void;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900';

export const OutputPanel: React.FC<OutputPanelProps> = ({
  output,
  error,
  hasRun = false,
  variables = {},
  callStack = [],
  showVariables = false,
  height,
  resizeActive = false,
  onResize,
  waitingForInput = false,
  inputPrompt = '',
  onSubmitInput,
  panelState = 'open',
  onToggle,
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const contentId = useId();

  useEffect(() => {
    if (waitingForInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [waitingForInput]);

  const handleInputSubmit = () => {
    if (onSubmitInput) {
      onSubmitInput(inputValue);
      setInputValue('');
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputSubmit();
    }
  };

  // The whole header bar is the toggle, in both states — there is no separate button.
  const headerBarProps = onToggle
    ? {
        onClick: onToggle,
        role: 'button',
        tabIndex: 0,
        'aria-expanded': panelState === 'open',
        'aria-controls': contentId,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        },
        className: `cursor-pointer hover:bg-slate-800 transition-colors ${focusRing}`,
      }
    : { className: '' };

  if (panelState === 'closed') {
    const { className: toggleClass, ...rest } = headerBarProps;
    return (
      <div
        className={`border-t border-slate-800 flex items-center h-7 px-2 bg-slate-900 shrink-0 z-[60] relative ${toggleClass}`}
        {...rest}
      >
        <Terminal size={12} className="text-indigo-400 mr-2 shrink-0" aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-widest text-muted">
          Console Output
        </span>
      </div>
    );
  }

  const { className: headerToggleClass, ...headerRest } = headerBarProps;

  return (
    <section
      className="border-t border-slate-800 flex flex-col sm:flex-row gap-0 bg-slate-900 shrink-0 z-[60] relative"
      style={height ? { height } : undefined}
      data-testid="output-panel"
      aria-label="Console output"
    >
      {onResize && (
        <ResizeHandle direction="vertical" isActive={resizeActive} onMouseDown={onResize} />
      )}

      <div className="flex-1 flex flex-col border-r border-slate-800 overflow-hidden">
        <div
          className={`h-8 flex items-center px-2 bg-slate-900 border-b border-slate-800 shrink-0 gap-2 ${headerToggleClass}`}
          {...headerRest}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Terminal size={14} className="text-indigo-400 shrink-0" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 shrink-0">
              Console Output
            </span>
            {error && (
              <div
                role="alert"
                className="ml-2 flex items-center gap-1 text-red-400 text-xs font-bold animate-pulse min-w-0"
              >
                <AlertCircle size={12} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{error}</span>
              </div>
            )}
          </div>
        </div>

        <div id={contentId} className="flex-1 flex flex-col overflow-hidden">
          <div
            className="flex-1 overflow-auto p-4 font-mono leading-5 bg-slate-950"
            style={{ fontSize: 'var(--praxly-font-size, 14px)' }}
            aria-live="polite"
            aria-label="Program output"
            aria-atomic="false"
          >
            {!hasRun && output.length === 0 && !error ? (
              <div className="text-slate-400 italic">Run code to see execution results...</div>
            ) : (
              output.map((line, idx) => {
                const isEchoedInput = line.startsWith('> ');
                const displayLine = isEchoedInput ? line.slice(2) : line;
                return (
                  <div key={idx} className="border-b border-slate-900/40 last:border-0 py-0">
                    <span
                      className={`${isEchoedInput ? 'text-cyan-400' : 'text-slate-300'} break-all`}
                    >
                      {displayLine}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {waitingForInput && (
            <div className="border-t border-slate-800 bg-slate-950 p-4 flex flex-col gap-2 shrink-0">
              <label
                htmlFor={inputId}
                className="font-mono text-slate-400"
                style={{ fontSize: 'var(--praxly-font-size, 14px)' }}
              >
                {inputPrompt || 'Program input:'}
              </label>
              <div className="flex gap-2">
                <input
                  id={inputId}
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Enter input and press Enter…"
                  aria-label={inputPrompt || 'Program input'}
                  style={{ fontSize: 'var(--praxly-font-size, 14px)' }}
                  className={`flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 font-mono placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 ${focusRing}`}
                  data-testid="stdin-input"
                />
                <button
                  onClick={handleInputSubmit}
                  aria-label="Submit program input"
                  style={{ fontSize: 'var(--praxly-font-size, 14px)' }}
                  className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded transition-colors ${focusRing}`}
                >
                  Submit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showVariables && (
        <section
          className="flex flex-col border-t sm:border-t-0 sm:border-l border-slate-800 w-full sm:w-64 shrink-0 max-h-40 sm:max-h-none"
          aria-label="Debug variables"
        >
          <div className="h-8 flex items-center gap-2 px-4 bg-slate-900 border-b border-slate-800 shrink-0 min-w-0">
            <span className="text-xs font-bold uppercase tracking-widest text-muted shrink-0">
              Variables
            </span>
            {callStack.length > 1 && (
              <span
                className="text-xs font-semibold text-indigo-400 truncate"
                title={`Currently inside ${callStack[callStack.length - 1].name}()`}
              >
                in {callStack[callStack.length - 1].name}()
              </span>
            )}
          </div>
          <div
            className="flex-1 overflow-auto p-2 font-mono leading-5 bg-slate-950"
            style={{ fontSize: 'var(--praxly-font-size, 14px)' }}
          >
            {callStack.length > 0 ? (
              <VariableFrames frames={callStack} />
            ) : Object.keys(variables).length === 0 ? (
              <div className="text-muted italic">No variables</div>
            ) : (
              Object.entries(variables).map(([name, value]) => {
                if (typeof value === 'function' || name.startsWith('_')) return null;
                return (
                  <div key={name} className="flex justify-between gap-2 py-1">
                    <span className="text-slate-400">{name}:</span>
                    <span className="text-slate-300 font-semibold">
                      {formatVariableValue(value)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}
    </section>
  );
};
