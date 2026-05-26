import React, { useState, useRef, useEffect, useId } from 'react';
import { Terminal, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { ResizeHandle } from './ResizeHandle';

interface OutputPanelProps {
  output: string[];
  error?: string | null;
  variables?: Record<string, any>;
  showVariables?: boolean;
  height?: number;
  resizeActive?: boolean;
  onResize?: (e: React.MouseEvent) => void;
  onClose?: () => void;
  waitingForInput?: boolean;
  inputPrompt?: string;
  onSubmitInput?: (input: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900';

const formatVariableValue = (value: any): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return value.toString();
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') return `"${value}"`;
  if (Array.isArray(value)) {
    return `[${value.map((v) => formatVariableValue(v)).join(', ')}]`;
  }
  if (typeof value === 'object' && value.klass?.name) {
    return `${value.klass.name} instance`;
  }
  if (typeof value === 'object' && value.klass) {
    return `JavaClass(${(value as any).name || 'unknown'})`;
  }
  return String(value);
};

export const OutputPanel: React.FC<OutputPanelProps> = ({
  output,
  error,
  variables = {},
  showVariables = false,
  height,
  resizeActive = false,
  onResize,
  onClose,
  waitingForInput = false,
  inputPrompt = '',
  onSubmitInput,
  isCollapsed = false,
  onToggleCollapse,
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

  const containerStyle = isCollapsed ? { height: 32 } : height ? { height } : undefined;

  return (
    <section
      className="border-t border-slate-800 flex flex-col sm:flex-row gap-0 bg-slate-900 shrink-0 z-[60] relative"
      style={containerStyle}
      data-testid="output-panel"
      aria-label="Console output"
    >
      {/* Resize handle — hidden when collapsed */}
      {onResize && !isCollapsed && (
        <ResizeHandle direction="vertical" isActive={resizeActive} onMouseDown={onResize} />
      )}

      {/* Main output column */}
      <div className="flex-1 flex flex-col border-r border-slate-800 overflow-hidden">
        {/* Header bar */}
        <div className="h-8 flex items-center px-2 bg-slate-900 border-b border-slate-800 shrink-0 gap-2">
          {/* LEFT: collapse caret */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? 'Expand output panel' : 'Collapse output panel'}
              aria-expanded={!isCollapsed}
              aria-controls={contentId}
              className={`p-1 text-slate-500 hover:text-slate-300 transition-colors rounded ${focusRing}`}
            >
              {isCollapsed ? (
                <ChevronUp size={14} aria-hidden="true" />
              ) : (
                <ChevronDown size={14} aria-hidden="true" />
              )}
            </button>
          )}

          {/* Title + error */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Terminal size={14} className="text-indigo-400 shrink-0" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">
              Console Output
            </span>
            {error && (
              <div
                role="alert"
                className="ml-2 flex items-center gap-1 text-red-400 text-[10px] font-bold animate-pulse min-w-0"
              >
                <AlertCircle size={12} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{error}</span>
              </div>
            )}
          </div>

          {/* RIGHT: close button */}
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close output panel"
              className={`p-1 text-slate-400 hover:text-slate-200 transition-colors rounded ${focusRing}`}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Collapsible body */}
        {!isCollapsed && (
          <div id={contentId} className="flex-1 flex flex-col overflow-hidden">
            <div
              className="flex-1 overflow-auto p-4 font-mono leading-5 bg-slate-950"
              style={{ fontSize: 'var(--praxly-font-size, 14px)' }}
              aria-live="polite"
              aria-label="Program output"
              aria-atomic="false"
            >
              {output.length === 0 && !error ? (
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
        )}
      </div>

      {/* Variables sidebar */}
      {showVariables && !isCollapsed && (
        <section
          className="flex flex-col border-t sm:border-t-0 sm:border-l border-slate-800 w-full sm:w-64 shrink-0 max-h-40 sm:max-h-none"
          aria-label="Debug variables"
        >
          <div className="h-8 flex items-center px-4 bg-slate-900 border-b border-slate-800 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Variables
            </span>
          </div>
          <div
            className="flex-1 overflow-auto p-4 font-mono leading-5 bg-slate-950"
            style={{ fontSize: 'var(--praxly-font-size, 12px)' }}
          >
            {Object.keys(variables).length === 0 ? (
              <div className="text-slate-500 italic">No variables</div>
            ) : (
              Object.entries(variables).map(([name, value]) => {
                if (typeof value === 'function' || name.startsWith('_')) return null;
                const valueStr = formatVariableValue(value);
                return (
                  <div key={name} className="flex justify-between gap-2 py-1">
                    <span className="text-slate-400">{name}:</span>
                    <span className="text-slate-300 font-semibold">{valueStr}</span>
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
