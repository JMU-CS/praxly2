/**
 * Call-stack-aware variable table used while debugging (Editor and Embed pages).
 * Renders one section per stack frame — innermost call on top, globals last —
 * so students can watch locals appear when a function is entered and disappear
 * when it returns.
 */

import type { StackFrame } from '../language/debugger';

export const formatVariableValue = (value: any): string => {
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
  return String(value);
};

interface VariableFramesProps {
  frames: StackFrame[];
}

export function VariableFrames({ frames }: VariableFramesProps) {
  if (frames.length === 0) {
    return <div className="text-slate-500 italic">No variables</div>;
  }

  // Innermost call first (the top of the stack), global scope last.
  const ordered = [...frames].reverse();
  const inFunction = frames.length > 1;

  return (
    <div className="space-y-2">
      {ordered.map((frame, idx) => {
        const isCurrent = inFunction && idx === 0;
        const label = frame.name === 'global' ? 'Globals' : `${frame.name}()`;
        const entries = Object.entries(frame.variables);

        return (
          <section
            key={idx}
            aria-label={`Variables in ${label}`}
            className={`rounded border ${
              isCurrent ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-slate-800'
            }`}
          >
            <header
              className={`flex items-center justify-between px-2 py-1 border-b ${
                isCurrent ? 'border-indigo-500/40' : 'border-slate-800'
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-widest ${
                  isCurrent ? 'text-indigo-300' : 'text-slate-500'
                }`}
              >
                {label}
              </span>
              {isCurrent && (
                <span className="text-[9px] font-semibold uppercase tracking-wider text-indigo-400">
                  current
                </span>
              )}
            </header>
            <div className="px-2 py-1">
              {entries.length === 0 ? (
                <div className="text-slate-600 italic">no variables</div>
              ) : (
                entries.map(([name, value]) => (
                  <div key={name} className="flex justify-between gap-2 py-0.5">
                    <span className="text-slate-400">{name}</span>
                    <span className="text-slate-200 font-semibold break-all text-right">
                      {formatVariableValue(value)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
