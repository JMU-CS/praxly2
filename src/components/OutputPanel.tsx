import React, { useState, useRef, useEffect, useId } from 'react';
import { Terminal, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ResizeHandle } from './ResizeHandle';

export type OutputPanelState = 'open' | 'closed';

interface OutputPanelProps {
  output: string[];
  error?: string | null;
  variables?: Record<string, any>;
  showVariables?: boolean;
  height?: number;
  resizeActive?: boolean;
  onResize?: (e: React.MouseEvent) => void;
  waitingForInput?: boolean;
  inputPrompt?: string;
  onSubmitInput?: (input: string) => void;
  panelState?: OutputPanelState;
  onToggle?: () => void;
  onOpen?: () => void;
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
  waitingForInput = false,
  inputPrompt = '',
  onSubmitInput,
  panelState = 'open',
  onToggle,
  onOpen,
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

  if (panelState === 'closed') {
    return (
      <div
        className="border-t border-slate-800 flex items-center h-7 px-2 bg-slate-900 shrink-0 cursor-pointer hover:bg-slate-800 transition-colors z-[60] relative"
        onClick={onOpen}
        role="button"
        aria-label="Open Console Output panel"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}
      >
        <Terminal size={12} className="text-indigo-400 mr-2 shrink-0" aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Console Output
        </span>
        <ChevronUp size={12} className="text-slate-500 ml-auto" aria-hidden="true" />
      </div>
    );
  }

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
        <div className="h-8 flex items-center px-2 bg-slate-900 border-b border-slate-800 shrink-0 gap-2">
          {onToggle && (
            <button
              onClick={onToggle}
              aria-label="Close output panel"
              aria-expanded={true}
              aria-controls={contentId}
              className={`p-1 text-slate-500 hover:text-slate-300 transition-colors rounded ${focusRing}`}
              title="Close panel"
            >
              <ChevronDown size={14} aria-hidden="true" />
            </button>
          )}

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
        </div>

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
      </div>

      {showVariables && (
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
