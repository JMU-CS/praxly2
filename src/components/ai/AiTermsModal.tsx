import { useEffect, useRef } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PolicyLinks } from '../PolicyLinks';

interface AiTermsModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * One-time consent shown before the AI Assistant is used, disclosing that
 * interactions are logged for usage analysis. Accepting is required to
 * continue; declining closes the panel.
 */
export function AiTermsModal({ onAccept, onDecline }: AiTermsModalProps) {
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    acceptRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDecline();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onDecline]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI Assistant terms"
      className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/70 p-4"
    >
      <div className="w-96 max-w-full rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.7)]">
        <div className="flex items-center gap-2 text-slate-100">
          <ShieldCheck size={18} className="text-indigo-300" />
          <h2 className="text-sm font-semibold">Before you use the AI Assistant</h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          To help improve Praxly, your interactions with the AI Assistant — the messages you send,
          the responses you receive, and how you use the tool — will be recorded and analyzed. Do
          not share sensitive or personal information in your chats.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          By continuing, you agree to this usage tracking.
        </p>
        <PolicyLinks className="mt-3" />
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onDecline}
            className="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Not now
          </button>
          <button
            ref={acceptRef}
            onClick={onAccept}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            I agree
          </button>
        </div>
      </div>
    </div>
  );
}
