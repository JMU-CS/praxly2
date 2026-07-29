import type { StackFrame } from '../../language/debugger';
import { VariableFrames } from '../VariableFrames';
import { StdinPrompt } from './StdinPrompt';

interface EmbedOutputProps {
  output: string[];
  error: string | null;
  isDebugging: boolean;
  callStack: StackFrame[];
  waitingForInput: boolean;
  inputPrompt: string;
  onSubmitInput: (input: string) => void;
}

/** Console body: error banner, debug variables, output lines, stdin prompt. */
export function EmbedOutput({
  output,
  error,
  isDebugging,
  callStack,
  waitingForInput,
  inputPrompt,
  onSubmitInput,
}: EmbedOutputProps) {
  return (
    <div
      className="flex-1 overflow-auto p-4 font-mono text-xs bg-slate-950 leading-6 flex flex-col"
      aria-live="polite"
    >
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="text-red-400 mb-3 p-3 bg-red-950/30 rounded border border-red-900/50">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}
        {isDebugging && callStack.length > 0 && (
          <div className="mb-3 p-3 bg-slate-800/50 rounded border border-slate-700">
            <div className="font-bold text-indigo-400 mb-2">
              Variables
              {callStack.length > 1 && (
                <span className="ml-2 font-semibold text-indigo-300">
                  — in {callStack[callStack.length - 1].name}()
                </span>
              )}
            </div>
            <VariableFrames frames={callStack} />
          </div>
        )}
        {output.length === 0 && !error ? (
          <div className="text-slate-500 italic">
            {isDebugging ? 'No output yet — keep stepping…' : 'Run code to see output...'}
          </div>
        ) : (
          output.map((line, idx) => (
            <div key={idx} className="flex gap-4 border-b border-slate-900/40 last:border-0 py-0.5">
              <span
                className="text-slate-500 select-none w-6 text-right flex-shrink-0"
                aria-hidden="true"
              >
                {idx + 1}
              </span>
              <span className="text-slate-300 break-all">{line}</span>
            </div>
          ))
        )}
      </div>
      {waitingForInput && <StdinPrompt prompt={inputPrompt} onSubmit={onSubmitInput} />}
    </div>
  );
}
