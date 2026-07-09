/**
 * Comment translation: comments captured by each lexer are attached to
 * statements and re-emitted in the target language's delimiter, so a source
 * program's comments survive translation (header block, leading, and trailing).
 */
import { describe, it, expect } from 'vitest';

import { Lexer as PythonLexer } from '../src/language/python/lexer';
import { Parser as PythonParser } from '../src/language/python/parser';
import { PraxisLexer } from '../src/language/praxis/lexer';
import { PraxisParser } from '../src/language/praxis/parser';
import { Translator } from '../src/language/translator';

const py = (src: string) => new PythonParser(new PythonLexer(src).tokenize()).parse();
const px = (src: string) => new PraxisParser(new PraxisLexer(src).tokenize(), src).parse();
const to = (parse: () => any, target: any) => new Translator().translate(parse(), target);

describe('comment translation', () => {
  it('translates a header block, a leading comment, and a trailing comment (python -> java)', () => {
    const src = `# banner one
# banner two
x = 5   # keeps x
# describe y
y = x + 1`;
    const java = to(() => py(src), 'java');
    // Header is pinned to the top with the target delimiter.
    expect(java.startsWith('// banner one\n// banner two\n')).toBe(true);
    // Leading comment sits on its own line above its statement.
    expect(java).toContain('// describe y');
    // Trailing comment stays inline on the statement's line.
    expect(java).toMatch(/double x = 5;\s+\/\/ keeps x/);
  });

  it('rewrites the delimiter per target (java // <-> python #)', () => {
    expect(to(() => py('# note\nx = 1'), 'javascript')).toContain('// note');
    expect(to(() => py('# note\nx = 1'), 'praxis')).toContain('// note');
  });

  it('preserves a generic trailing comment on a Praxis print', () => {
    const out = to(() => px('print("hi")   // greet the user'), 'python');
    expect(out).toContain('# greet the user');
  });

  it('does not duplicate a Praxis print separator/newline metadata comment', () => {
    // `// no separator` is consumed as Print.separator; it must not also appear
    // as an ordinary translated comment.
    const out = to(() => px('print("a", "b")   // no separator'), 'python');
    expect(out).toContain('sep=""');
    expect(out).not.toContain('no separator');
  });

  it('comments do not alter emitted program behavior', () => {
    // Same program with and without comments yields identical code sans comments.
    const withC = to(() => py('# c\nx = 1  # t\nprint(x)'), 'java');
    const withoutC = to(() => py('x = 1\nprint(x)'), 'java');
    const strip = (s: string) =>
      s
        .split('\n')
        .map((l) => l.replace(/\s*\/\/.*$/, ''))
        .filter((l) => l.trim() !== '')
        .join('\n');
    expect(strip(withC)).toBe(strip(withoutC));
  });
});
