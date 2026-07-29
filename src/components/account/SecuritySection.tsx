import { useState } from 'react';

import { changePassword, type AccountProfile } from '../../api/account';
import { cardCls, inputCls, primaryBtnCls } from './styles';
import type { Notify } from './types';

/** Password change form for Keycloak accounts; a pointer to Google for the rest. */
export function SecuritySection({
  profile,
  notify,
}: {
  profile: AccountProfile | null;
  notify: Notify;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = current.length > 0 && next.length >= 8 && next === confirm && !saving;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      notify('success', 'Password changed.');
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  // Google owns the credentials for these accounts — there is no password here
  // to change, and pretending otherwise would just fail at the backend.
  if (profile?.provider === 'google') {
    return (
      <div className={`${cardCls} divide-y divide-slate-800`}>
        <div className="p-6">
          <h2 className="text-lg text-slate-100">Security</h2>
          <p className="mt-1 text-sm text-slate-400">
            You sign in to Praxly with Google, so your password is managed by Google.
          </p>
        </div>
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
      </div>
    );
  }

  return (
    <div className={`${cardCls} divide-y divide-slate-800`}>
      <div className="p-6">
        <h2 className="text-lg text-slate-100">Security</h2>
        <p className="mt-1 text-sm text-slate-400">
          Change the password for your school account. It must be at least 8 characters.
        </p>
      </div>
      <div className="space-y-4 p-6 max-w-md">
        <div>
          <label htmlFor="pw-current" className="mb-1 block text-xs font-medium text-slate-500">
            Current password
          </label>
          <input
            id="pw-current"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={inputCls}
            autoComplete="current-password"
          />
        </div>
        <div>
          <label htmlFor="pw-new" className="mb-1 block text-xs font-medium text-slate-500">
            New password
          </label>
          <input
            id="pw-new"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label htmlFor="pw-confirm" className="mb-1 block text-xs font-medium text-slate-500">
            Confirm new password
          </label>
          <input
            id="pw-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
          />
          {confirm.length > 0 && next !== confirm && (
            <p className="mt-1 text-xs text-red-400">Passwords don't match.</p>
          )}
        </div>
        <div className="pt-2">
          <button onClick={handleSubmit} disabled={!canSubmit} className={primaryBtnCls}>
            {saving ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </div>
    </div>
  );
}
