/**
 * Joining a snippet onto the end of the editor's source — the "Open in editor"
 * button on an AI chat code block (see useOpenCodeBridge).
 */

/**
 * `existing` with `snippet` appended, separated by one blank line.
 *
 * Trailing whitespace on the existing source is dropped so the separator is
 * exactly one blank line however the user left their last line, and the result
 * ends with a newline so the next append lands the same way. A blank `existing`
 * yields just the snippet — appending to nothing is the snippet itself.
 *
 * The snippet loses its blank leading and trailing lines but not its
 * indentation: a plain `trim()` would unindent the first line only, which
 * silently breaks the snippet's own nesting.
 */
export function appendCode(existing: string, snippet: string): string {
  const body = snippet.replace(/^(?:[^\S\n]*\n)+/, '').replace(/\s+$/, '');
  if (!body) return existing;

  const head = existing.replace(/\s+$/, '');
  return head ? `${head}\n\n${body}\n` : `${body}\n`;
}
