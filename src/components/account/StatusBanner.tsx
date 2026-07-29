import { Check, X } from 'lucide-react';

export type Status = { kind: 'success' | 'error'; text: string } | null;

/** Page-level success/error strip shown above whichever section is open. */
export function StatusBanner({ status, onDismiss }: { status: Status; onDismiss: () => void }) {
  if (!status) return null;
  return (
    <div
      role="status"
      className={`mb-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ${
        status.kind === 'success'
          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40'
          : 'bg-red-500/10 text-red-300 border border-red-500/40'
      }`}
    >
      <span className="flex items-center gap-2">
        {status.kind === 'success' ? <Check size={16} /> : <X size={16} />}
        {status.text}
      </span>
      <button onClick={onDismiss} className="p-1 opacity-60 hover:opacity-100" aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}
