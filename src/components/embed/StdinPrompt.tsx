import { useId } from 'react';

/**
 * Input row shown while a program is parked on an `input()` call. The field is
 * uncontrolled — it is cleared by hand after each submit so a fast typist can
 * keep going without waiting for a re-render.
 */
export function StdinPrompt({
  prompt,
  onSubmit,
}: {
  prompt: string;
  onSubmit: (input: string) => void;
}) {
  const inputId = useId();

  const submitFrom = (input: HTMLInputElement) => {
    onSubmit(input.value);
    input.value = '';
  };

  return (
    <div className="border-t border-slate-800 bg-slate-950 mt-4 pt-4 flex flex-col gap-2 shrink-0">
      <label htmlFor={inputId} className="text-slate-400 text-xs font-mono">
        {prompt || 'Program input:'}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          placeholder="Enter input and press Enter…"
          aria-label={prompt || 'Program input'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitFrom(e.target as HTMLInputElement);
          }}
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs font-mono placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          data-testid="stdin-input"
          autoFocus
        />
        <button
          onClick={(e) => submitFrom(e.currentTarget.previousElementSibling as HTMLInputElement)}
          aria-label="Submit program input"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded transition-colors shrink-0"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
