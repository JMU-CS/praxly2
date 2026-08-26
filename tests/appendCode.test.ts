import { describe, expect, it } from 'vitest';

import { appendCode } from '../src/utils/appendCode';

/**
 * "Open in editor" on an AI code block adds to the program instead of
 * replacing it, so the join has to read like something a person typed.
 */
describe('appendCode', () => {
  it('separates the snippet from the existing code with one blank line', () => {
    expect(appendCode('x ← 1', 'print x')).toBe('x ← 1\n\nprint x\n');
  });

  it('gives the same result however the existing code ends', () => {
    const expected = 'x ← 1\n\nprint x\n';
    expect(appendCode('x ← 1\n', 'print x')).toBe(expected);
    expect(appendCode('x ← 1\n\n\n', 'print x')).toBe(expected);
    expect(appendCode('x ← 1   \n\t\n', 'print x')).toBe(expected);
  });

  it('appends onto its own result the same way, so repeats stay tidy', () => {
    const once = appendCode('a', 'b');
    expect(appendCode(once, 'c')).toBe('a\n\nb\n\nc\n');
  });

  it('keeps the snippet whole, blank lines and indentation included', () => {
    const snippet = 'if x > 0\n    print x\n\n    print "done"\nend if';
    expect(appendCode('y ← 2', snippet)).toBe(`y ← 2\n\n${snippet}\n`);
  });

  it('drops the snippet’s blank edges but keeps its indentation', () => {
    // A plain trim() would unindent the first line only, quietly breaking the
    // nesting of a snippet the AI wrote as part of a larger block.
    expect(appendCode('a', '\n\n  b  \n\n')).toBe('a\n\n  b\n');
    expect(appendCode('a', '\n    if x\n        print x\n')).toBe(
      'a\n\n    if x\n        print x\n'
    );
  });

  it('is just the snippet when there is nothing to append to', () => {
    expect(appendCode('', 'print 1')).toBe('print 1\n');
    expect(appendCode('   \n\n', 'print 1')).toBe('print 1\n');
  });

  it('leaves the editor untouched for an empty snippet', () => {
    expect(appendCode('x ← 1\n', '   \n ')).toBe('x ← 1\n');
  });
});
