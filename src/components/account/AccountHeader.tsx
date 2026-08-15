import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

/**
 * Sticky top bar: branding on the left, the way out on the right.
 *
 * The account page is only ever reached as a detour from the editor (the person
 * icon in the AI panel), so leaving is the one thing every visitor eventually
 * does. It gets a labelled chip rather than a bare arrow — an icon alone asks
 * the user to already know where it goes. Signing out lives at the foot of the
 * nav instead, so the prominent control up here is the harmless one.
 */

/** Mirrors the editor header's Debug button, so both chrome bars match. */
const backBtnCls =
  'flex items-center gap-2 rounded-md bg-slate-700 px-4 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-600 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900';

export function AccountHeader() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5 sm:px-6">
      <div className="flex items-center gap-3">
        <img src="/v2/fallen-leaf_1f342.ico" alt="" className="h-6 w-6" aria-hidden="true" />
        {/* The page's only title, so it is the h1 — the styling is unchanged. */}
        <h1 className="text-lg text-slate-300">
          Praxly <span className="font-medium text-muted">Account</span>
        </h1>
      </div>
      <Link to="/v2/editor" title="Return to the Praxly editor" className={backBtnCls}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back to editor
      </Link>
    </header>
  );
}
