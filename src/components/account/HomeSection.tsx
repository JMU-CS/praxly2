import { Lock } from 'lucide-react';

import type { AccountProfile, AccountUsage } from '../../api/account';
import { TILE_ITEMS } from './AccountNav';
import { Avatar, displayName } from './Avatar';
import { cardCls } from './styles';
import type { Section } from './types';

/**
 * Landing pane: a greeting plus one tile per account page, so everything the
 * account manager can do is visible without opening the nav. Tiles come from
 * the same NAV list the sidebar uses, so a new pane shows up in both at once.
 */
export function HomeSection({
  profile,
  usage,
  onNavigate,
}: {
  profile: AccountProfile | null;
  usage: AccountUsage | null;
  onNavigate: (s: Section) => void;
}) {
  // A couple of tiles can say something concrete instead of the generic blurb.
  const detailFor = (id: Section): string | null => {
    if (id === 'personal') return profile?.email ?? null;
    if (id === 'data' && usage) {
      const last = usage.lastActivity ? new Date(usage.lastActivity).toLocaleDateString() : 'never';
      return `${usage.sessions} chats · ${usage.messages} messages · last active ${last}`;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-6 text-center">
        <Avatar profile={profile} size="lg" />
        <h1 className="mt-4 text-2xl text-slate-100">
          Welcome, {displayName(profile) || 'student'}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your AI settings and chat activity to make Praxly work better for you.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TILE_ITEMS.map(({ id, label, icon: Icon, blurb, disabled, disabledNote }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            disabled={disabled}
            title={disabled ? disabledNote : undefined}
            className={`${cardCls} p-5 text-left transition-colors ${
              disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-slate-600'
            }`}
          >
            <div
              className={`flex items-center gap-2 font-medium ${
                disabled ? 'text-slate-400' : 'text-slate-100'
              }`}
            >
              <Icon size={16} className={disabled ? 'text-slate-500' : 'text-indigo-400'} />
              {label}
              {disabled && <Lock size={12} className="text-slate-500" aria-hidden="true" />}
            </div>
            <p className="mt-2 text-sm break-all text-slate-400">
              {disabled ? disabledNote : (detailFor(id) ?? blurb)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
