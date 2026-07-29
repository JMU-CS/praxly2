import { useState } from 'react';

import { updateProfile, type AccountProfile } from '../../api/account';
import { cardCls, inputCls, primaryBtnCls } from './styles';
import type { Notify } from './types';

/** Email/name editor. Google-backed accounts get a read-only email. */
export function PersonalSection({
  profile,
  setProfile,
  notify,
}: {
  profile: AccountProfile | null;
  setProfile: (p: AccountProfile) => void;
  notify: Notify;
}) {
  const [email, setEmail] = useState(profile?.email ?? '');
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [saving, setSaving] = useState(false);

  // Google asserts the email on every sign-in; only Keycloak accounts own theirs.
  const emailEditable = profile?.provider !== 'google';

  const dirty =
    (emailEditable && email !== (profile?.email ?? '')) ||
    firstName !== (profile?.firstName ?? '') ||
    lastName !== (profile?.lastName ?? '');

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await updateProfile({ ...(emailEditable ? { email } : {}), firstName, lastName });
      setProfile({ ...profile, ...(emailEditable ? { email } : {}), firstName, lastName });
      notify('success', 'Profile updated. Changes to your email apply the next time you sign in.');
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${cardCls} divide-y divide-slate-800`}>
      <div className="p-6">
        <h2 className="text-lg text-slate-100">Personal info</h2>
        <p className="mt-1 text-sm text-slate-400">
          The email and name attached to your school account.
        </p>
      </div>
      <div className="space-y-4 p-6">
        <div>
          <label htmlFor="acct-username" className="mb-1 block text-xs font-medium text-slate-500">
            {emailEditable ? 'Username' : 'Signed in with'}
          </label>
          <input
            id="acct-username"
            value={emailEditable ? (profile?.username ?? '') : `Google · ${profile?.email ?? ''}`}
            disabled
            className={`${inputCls} text-slate-500 opacity-70`}
          />
        </div>
        <div>
          <label htmlFor="acct-email" className="mb-1 block text-xs font-medium text-slate-500">
            Email
          </label>
          <input
            id="acct-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!emailEditable}
            className={emailEditable ? inputCls : `${inputCls} text-slate-500 opacity-70`}
            placeholder="you@example.com"
          />
          {!emailEditable && (
            <p className="mt-1 text-xs text-slate-500">
              Your email comes from your Google Account and can't be changed here.
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="acct-first" className="mb-1 block text-xs font-medium text-slate-500">
              First name
            </label>
            <input
              id="acct-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="acct-last" className="mb-1 block text-xs font-medium text-slate-500">
              Last name
            </label>
            <input
              id="acct-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div className="pt-2">
          <button onClick={handleSave} disabled={!dirty || saving} className={primaryBtnCls}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
