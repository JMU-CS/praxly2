import type { AccountProfile } from '../../api/account';

/** The user's full name, falling back to their username. */
export function displayName(profile: AccountProfile | null): string {
  if (!profile) return '';
  const full = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  return full || profile.username;
}

function initialOf(profile: AccountProfile | null): string {
  const name = displayName(profile) || profile?.email || '?';
  return name.charAt(0).toUpperCase();
}

/** Monogram stand-in for a profile picture (we never fetch one). */
export function Avatar({ profile, size }: { profile: AccountProfile | null; size: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'h-20 w-20 text-3xl' : 'h-9 w-9 text-sm';
  return (
    <div
      aria-hidden="true"
      className={`${cls} flex items-center justify-center rounded-full bg-indigo-600 font-semibold text-white select-none`}
    >
      {initialOf(profile)}
    </div>
  );
}
