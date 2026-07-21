import { Check, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useAiPrefsStore, type AiLevel, type AiRole } from '../../store/appStore';

/**
 * Tutor profile settings, shown inside the AI side panel. The tutor adapts
 * its answers to who is asking (student vs teacher) and their experience
 * level; both are sent to the backend with every request.
 */

const ROLE_OPTIONS: Array<{ value: AiRole; label: string; hint: string }> = [
  { value: 'student', label: 'Student', hint: 'Guides you toward answers with hints' },
  { value: 'teacher', label: 'Teacher', hint: 'Direct answers plus teaching tips' },
];

const LEVEL_OPTIONS: Array<{ value: AiLevel; label: string; hint: string }> = [
  { value: 'novice', label: 'Novice', hint: 'New to programming — explain everything' },
  { value: 'intermediate', label: 'Intermediate', hint: 'Knows the basics' },
  { value: 'advanced', label: 'Advanced', hint: 'Comfortable — skip the fundamentals' },
];

export function ProfileSettings({ onDone }: { onDone: () => void }) {
  const { role, level, setRole, setLevel } = useAiPrefsStore();
  const [saved, setSaved] = useState(false);

  const handleDone = () => {
    setSaved(true);
    setTimeout(onDone, 400);
  };

  const groupLabel = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2';
  const option = (selected: boolean) =>
    `w-full text-left rounded-md border px-3 py-2 transition-colors ${
      selected
        ? 'border-indigo-500 bg-indigo-500/10'
        : 'border-slate-700 bg-slate-800 hover:border-slate-500'
    }`;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-2 text-slate-200">
        <UserRound size={16} className="text-indigo-300" />
        <h3 className="text-sm font-semibold">Tutor profile</h3>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        The AI adjusts how it responds based on who you are and how much programming you already
        know.
      </p>

      <div>
        <span className={groupLabel}>I am a…</span>
        <div className="space-y-1.5">
          {ROLE_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setRole(o.value)}
              className={option(role === o.value)}
            >
              <span className="block text-sm text-slate-200">{o.label}</span>
              <span className="block text-[11px] text-slate-500">{o.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={groupLabel}>Experience level</span>
        <div className="space-y-1.5">
          {LEVEL_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setLevel(o.value)}
              className={option(level === o.value)}
            >
              <span className="block text-sm text-slate-200">{o.label}</span>
              <span className="block text-[11px] text-slate-500">{o.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleDone}
        className="flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors"
      >
        {saved ? <Check size={14} /> : null}
        {saved ? 'Saved' : 'Done'}
      </button>
    </div>
  );
}
