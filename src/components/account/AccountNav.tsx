import { GraduationCap, KeyRound, MessageSquare, Pencil, ShieldCheck, User } from 'lucide-react';
import type { Section } from './types';

export const NAV: Array<{ id: Section; label: string; icon: typeof User }> = [
  { id: 'home', label: 'Home', icon: User },
  { id: 'personal', label: 'Personal info', icon: Pencil },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'ai', label: 'AI model & API key', icon: KeyRound },
  { id: 'profile', label: 'Tutor profile', icon: GraduationCap },
  { id: 'data', label: 'Data & activity', icon: MessageSquare },
];

interface NavProps {
  section: Section;
  onSelect: (section: Section) => void;
}

/** Sidebar section switcher (desktop only — see AccountNavMobile). */
export function AccountNav({ section, onSelect }: NavProps) {
  return (
    <nav className="hidden w-52 shrink-0 md:block" aria-label="Account sections">
      <ul className="space-y-1">
        {NAV.map(({ id, label, icon: Icon }) => (
          <li key={id}>
            <button
              onClick={() => onSelect(id)}
              aria-current={section === id ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors ${
                section === id
                  ? 'bg-indigo-500/10 font-medium text-indigo-300'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Horizontally scrolling chip row that replaces the sidebar on narrow screens. */
export function AccountNavMobile({ section, onSelect }: NavProps) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto md:hidden">
      {NAV.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${
            section === id
              ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
              : 'border-slate-700 text-slate-300'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
