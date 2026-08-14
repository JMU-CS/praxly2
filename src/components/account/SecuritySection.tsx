import type { AccountProfile } from '../../api/account';
import { cardCls, primaryBtnCls } from './styles';

/**
 * Read-only security pane: a pointer to wherever the credentials actually live.
 *
 * Passwords belong to the identity provider, so there is no change-password
 * form here. Like Personal info, this pane is currently unreachable — its nav
 * entry and home tile are disabled (see AccountNav's NAV).
 */
export function SecuritySection({ profile }: { profile: AccountProfile | null }) {
  const isGoogle = profile?.provider === 'google';

  return (
    <div className={`${cardCls} divide-y divide-slate-800`}>
      <div className="p-6">
        <h2 className="text-lg text-slate-100">Security</h2>
        <p className="mt-1 text-sm text-slate-400">
          {isGoogle
            ? 'You sign in to Praxly with Google, so your password and security settings are managed by Google.'
            : 'You sign in with your Praxly school account, so your password is managed by your school. Contact your instructor or IT support if you need it reset.'}
        </p>
      </div>
      {isGoogle && (
        <div className="p-6">
          <a
            href="https://myaccount.google.com/security"
            target="_blank"
            rel="noreferrer"
            className={primaryBtnCls}
          >
            Manage security on Google
          </a>
        </div>
      )}
    </div>
  );
}
