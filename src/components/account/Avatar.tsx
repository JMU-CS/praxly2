import { UserRound } from 'lucide-react';

import type { AccountProfile } from '../../api/account';

/** The user's full name, falling back to their username. */
export function displayName(profile: AccountProfile | null): string {
  if (!profile) return '';
  const full = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  return full || profile.username;
}

/**
 * First letter of whatever we know them by, or null when we know nothing —
 * while the profile is still loading, or for an account with no name or email.
 */
function initialOf(profile: AccountProfile | null): string | null {
  const name = displayName(profile) || profile?.email || '';
  const first = name.trim().charAt(0);
  // Only letters and digits make a readable monogram; punctuation doesn't.
  return first && /[\p{L}\p{N}]/u.test(first) ? first.toUpperCase() : null;
}

/**
 * Profile picture stand-in (we never fetch a real one): a monogram when we know
 * the person's name, and a generic avatar when we don't — never a bare "?".
 */
export function Avatar({ profile, size }: { profile: AccountProfile | null; size: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'h-20 w-20 text-3xl' : 'h-9 w-9 text-sm';
  const initial = initialOf(profile);

  return (
    <div
      aria-hidden="true"
      className={`${cls} flex items-center justify-center overflow-hidden rounded-full bg-indigo-600 font-semibold text-white select-none`}
    >
      {initial ?? (
        <UserRound
          size={size === 'lg' ? 44 : 20}
          strokeWidth={1.75}
          className="text-indigo-100"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
