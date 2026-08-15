import { Link } from 'react-router';

import { SignInButtons } from '../auth/SignInButtons';
import { cardCls, textBtnCls } from './styles';

/** Stands in for the whole page when nobody is signed in. */
export function SignedOutCard() {
  return (
    /* <main> rather than <div>: this card *is* the page when signed out, so
       without a landmark none of its content sits inside one. */
    <main className="min-h-dvh bg-slate-950 flex items-center justify-center p-6">
      <div className={`${cardCls} max-w-sm w-full p-8 text-center`}>
        <h1 className="text-xl font-semibold text-slate-100">Praxly Account</h1>
        <p className="mt-2 text-sm text-slate-400">Sign in to manage your account.</p>
        <div className="mt-6 flex justify-center">
          <SignInButtons />
        </div>
        <Link to="/v2/editor" className={`${textBtnCls} mt-2 inline-block`}>
          Back to editor
        </Link>
      </div>
    </main>
  );
}
