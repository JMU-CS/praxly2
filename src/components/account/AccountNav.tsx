import { GraduationCap, KeyRound, MessageSquare, Pencil, ShieldCheck, User } from 'lucide-react';
import type { Section } from './types';

export interface NavItem {
  id: Section;
  label: string;
  icon: typeof User;
  /** Short line describing the pane — used for the home page tiles. */
  blurb: string;
  /**
   * Panes that are switched off for everyone. Account details are owned by the
   * identity provider (the school's Keycloak realm, or Google), so editing them
   * here would be writing to the wrong system of record.
   */
  disabled?: boolean;
  /** Why it's off — shown on the tile and as the nav item's tooltip. */
  disabledNote?: string;
}

export const NAV: NavItem[] = [
  { id: 'home', label: 'Home', icon: User, blurb: 'Everything in your account at a glance.' },
  {
    id: 'personal',
    label: 'Personal info',
    icon: Pencil,
    blurb: 'The email and name attached to your account.',
    disabled: true,
    disabledNote: 'Managed by the account you sign in with.',
  },
  {
    id: 'security',
    label: 'Security',
    icon: ShieldCheck,
    blurb: 'The password you use to sign in.',
    disabled: true,
    disabledNote: 'Managed by the account you sign in with.',
  },
  {
    id: 'ai',
    label: 'AI model & API key',
    icon: KeyRound,
    blurb: 'Choose which model powers the AI Assistant.',
  },
  {
    id: 'profile',
    label: 'Tutor profile',
    icon: GraduationCap,
    blurb: 'Tune how the AI pitches its answers to you.',
  },
  {
    id: 'data',
    label: 'Data & activity',
    icon: MessageSquare,
    blurb: 'Review your AI usage and manage chat history.',
  },
];

/** The panes a user can actually open — everything except Home. */
export const TILE_ITEMS = NAV.filter((item) => item.id !== 'home');

interface NavProps {
  section: Section;
  onSelect: (section: Section) => void;
}

/** Sidebar section switcher (desktop only — see AccountNavMobile). */
export function AccountNav({ section, onSelect }: NavProps) {
  return (
    <nav className="hidden w-52 shrink-0 md:block" aria-label="Account sections">
      <ul className="space-y-1">
        {NAV.map(({ id, label, icon: Icon, disabled, disabledNote }) => (
          <li key={id}>
            <button
              onClick={() => onSelect(id)}
              disabled={disabled}
              title={disabled ? disabledNote : undefined}
              aria-current={section === id ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors ${
                disabled
                  ? 'cursor-not-allowed text-muted'
                  : section === id
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
      {NAV.map(({ id, label, disabled, disabledNote }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          disabled={disabled}
          title={disabled ? disabledNote : undefined}
          className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${
            disabled
              ? 'cursor-not-allowed border-slate-800 text-muted'
              : section === id
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
