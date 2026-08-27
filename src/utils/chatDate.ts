/**
 * The "when" line under a chat in the AI panel's history list.
 */

/**
 * `iso` as a short, human date — "Aug 26" this year, "Aug 26, 2025" before it.
 *
 * The history list can't show a message count for a chat whose transcript
 * hasn't been fetched, so it shows this instead: the backend's session list
 * carries `updatedAt` for every chat, fetched or not.
 *
 * Returns '' for a missing or unparseable timestamp — a blank line beats
 * "Invalid Date".
 */
export function formatChatDate(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}
