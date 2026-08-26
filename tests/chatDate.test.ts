import { describe, expect, it } from 'vitest';

import { formatChatDate } from '../src/utils/chatDate';

/**
 * The date under a chat in history. Assertions stay locale-agnostic — the
 * format follows the browser's locale, only the year's presence is ours to
 * decide. Mid-month timestamps keep a timezone shift from crossing months.
 */
describe('formatChatDate', () => {
  const now = new Date('2026-08-15T12:00:00Z');

  it('leaves the year off a chat from this year', () => {
    const text = formatChatDate('2026-03-14T12:00:00Z', now);
    expect(text).not.toContain('2026');
    expect(text).toMatch(/\d/);
  });

  it('names the year for an older chat, so it cannot be misread as recent', () => {
    expect(formatChatDate('2025-03-14T12:00:00Z', now)).toContain('2025');
  });

  it('is blank rather than "Invalid Date" for a timestamp it cannot read', () => {
    expect(formatChatDate(undefined, now)).toBe('');
    expect(formatChatDate('', now)).toBe('');
    expect(formatChatDate('not a date', now)).toBe('');
  });
});
