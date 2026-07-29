import { useAiPrefsStore, type AiLevel, type AiRole } from '../../store/appStore';
import { cardCls } from './styles';

const ROLE_OPTIONS: Array<{ value: AiRole; label: string; hint: string }> = [
  { value: 'student', label: 'Student', hint: 'Guides you toward answers with hints' },
  { value: 'teacher', label: 'Teacher', hint: 'Direct answers plus teaching tips' },
];

const LEVEL_OPTIONS: Array<{ value: AiLevel; label: string; hint: string }> = [
  { value: 'novice', label: 'Novice', hint: 'New to programming — explain everything' },
  { value: 'intermediate', label: 'Intermediate', hint: 'Knows the basics' },
  { value: 'advanced', label: 'Advanced', hint: 'Comfortable — skip the fundamentals' },
];

/** Who the student is and how much they know — tunes the AI's replies. */
export function ProfileSection() {
  const { role, level, setRole, setLevel } = useAiPrefsStore();

  const optionBtn = (selected: boolean) =>
    `w-full text-left rounded-lg border px-3 py-2 transition-colors ${
      selected
        ? 'border-indigo-500 bg-indigo-500/10'
        : 'border-slate-700 bg-slate-800 hover:border-slate-500'
    }`;

  return (
    <div className={`${cardCls} divide-y divide-slate-800`}>
      <div className="p-6">
        <h2 className="text-lg text-slate-100">Tutor profile</h2>
        <p className="mt-1 text-sm text-slate-400">
          The AI adjusts how it responds based on who you are and how much programming you already
          know.
        </p>
      </div>
      <div className="space-y-6 p-6 max-w-md">
        <div>
          <span className="mb-2 block text-xs font-medium text-slate-500">I am a…</span>
          <div className="space-y-1.5">
            {ROLE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setRole(o.value)}
                className={optionBtn(role === o.value)}
              >
                <span className="block text-sm text-slate-200">{o.label}</span>
                <span className="block text-[11px] text-slate-500">{o.hint}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-2 block text-xs font-medium text-slate-500">Experience level</span>
          <div className="space-y-1.5">
            {LEVEL_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setLevel(o.value)}
                className={optionBtn(level === o.value)}
              >
                <span className="block text-sm text-slate-200">{o.label}</span>
                <span className="block text-[11px] text-slate-500">{o.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
