import type { AccountProfile } from '../../api/account';
import { cardCls } from './styles';

/**
 * Read-only view of the identity behind the session.
 *
 * Nothing here is editable: the school's Keycloak realm (or Google) is the
 * system of record for these fields, so the pane shows what they are and says
 * where to go to change them.
 */
export function PersonalSection({ profile }: { profile: AccountProfile | null }) {
  const isGoogle = profile?.provider === 'google';

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Signed in with', value: isGoogle ? 'Google' : 'Praxly school account' },
    { label: isGoogle ? 'Google account' : 'Username', value: profile?.username ?? '—' },
    { label: 'Email', value: profile?.email ?? '—' },
    {
      label: 'Name',
      value: [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || '—',
    },
  ];

  return (
    <div className={`${cardCls} divide-y divide-slate-800`}>
      <div className="p-6">
        <h2 className="text-lg text-slate-100">Personal info</h2>
        <p className="mt-1 text-sm text-slate-400">
          The email and name attached to your account. These come from the account you sign in with
          and can't be changed here.
        </p>
      </div>
      <dl className="divide-y divide-slate-800">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center">
            <dt className="text-xs font-medium text-muted sm:w-40 sm:shrink-0">{label}</dt>
            <dd className="text-sm break-all text-slate-200">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
