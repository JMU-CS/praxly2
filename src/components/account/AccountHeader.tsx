import { Link } from 'react-router';
import { ArrowLeft, LogOut } from 'lucide-react';

import { logout } from '../../api/auth';
import type { AccountProfile } from '../../api/account';
import { Avatar } from './Avatar';

/** Sticky top bar: back to the editor, branding, sign-out, avatar. */
export function AccountHeader({ profile }: { profile: AccountProfile | null }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5 sm:px-6">
      <div className="flex items-center gap-3">
        <Link
          to="/v2/editor"
          className="flex items-center gap-2 rounded-full p-2 text-slate-400 hover:bg-slate-800 transition-colors"
          aria-label="Back to editor"
          title="Back to editor"
        >
          <ArrowLeft size={18} />
        </Link>
        <img src="/v2/fallen-leaf_1f342.ico" alt="" className="h-6 w-6" aria-hidden="true" />
        {/* The page's only title, so it is the h1 — the styling is unchanged. */}
        <h1 className="text-lg text-slate-300">
          Praxly <span className="font-medium text-muted">Account</span>
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => logout()}
          className="flex items-center gap-2 rounded-full border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
        <Avatar profile={profile} size="sm" />
      </div>
    </header>
  );
}
