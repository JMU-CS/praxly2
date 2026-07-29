import { KeyRound, MessageSquare, Pencil } from 'lucide-react';

import type { AccountProfile, AccountUsage } from '../../api/account';
import { Avatar, displayName } from './Avatar';
import { cardCls } from './styles';
import type { Section } from './types';

/** Landing pane: a greeting plus shortcut cards into the other sections. */
export function HomeSection({
  profile,
  usage,
  onNavigate,
}: {
  profile: AccountProfile | null;
  usage: AccountUsage | null;
  onNavigate: (s: Section) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-6 text-center">
        <Avatar profile={profile} size="lg" />
        <h1 className="mt-4 text-2xl text-slate-100">
          Welcome, {displayName(profile) || 'student'}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your info, security, and chat activity to make Praxly work better for you.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => onNavigate('personal')}
          className={`${cardCls} p-5 text-left hover:border-slate-600 transition-colors`}
        >
          <div className="flex items-center gap-2 text-slate-100 font-medium">
            <Pencil size={16} className="text-indigo-400" /> Personal info
          </div>
          <p className="mt-2 text-sm text-slate-400 break-all">
            {profile?.email ?? 'No email set'} · @{profile?.username}
          </p>
        </button>
        <button
          onClick={() => onNavigate('security')}
          className={`${cardCls} p-5 text-left hover:border-slate-600 transition-colors`}
        >
          <div className="flex items-center gap-2 text-slate-100 font-medium">
            <KeyRound size={16} className="text-indigo-400" /> Security
          </div>
          <p className="mt-2 text-sm text-slate-400">Change the password you use to sign in.</p>
        </button>
        <button
          onClick={() => onNavigate('data')}
          className={`${cardCls} p-5 text-left hover:border-slate-600 transition-colors sm:col-span-2`}
        >
          <div className="flex items-center gap-2 text-slate-100 font-medium">
            <MessageSquare size={16} className="text-indigo-400" /> Data &amp; activity
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {usage
              ? `${usage.sessions} chats · ${usage.messages} messages · last active ${
                  usage.lastActivity ? new Date(usage.lastActivity).toLocaleDateString() : 'never'
                }`
              : 'Review your AI usage and manage chat history.'}
          </p>
        </button>
      </div>
    </div>
  );
}
