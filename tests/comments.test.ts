/**
 * Comment translation: comments captured by each lexer are attached to
 * statements and re-emitted in the target language's delimiter, so a source
 * program's comments survive translation (file-top, leading, and trailing).
 */
import { describe, it, expect } from 'vitest';

import { Lexer as PythonLexer } from '../src/language/python/lexer';
import { Parser as PythonParser } from '../src/language/python/parser';
import { PraxisLexer } from '../src/language/praxis/lexer';
import { PraxisParser } from '../src/language/praxis/parser';
import { JavaLexer } from '../src/language/java/lexer';
import { JavaParser } from '../src/language/java/parser';
import { Interpreter } from '../src/language/interpreter';
import { Translator } from '../src/language/translator';

const py = (src: string) => new PythonParser(new PythonLexer(src).tokenize()).parse();
const px = (src: string) => new PraxisParser(new PraxisLexer(src).tokenize()).parse();
const jv = (src: string) => new JavaParser(new JavaLexer(src).tokenize()).parse();
const to = (parse: () => any, target: any) => new Translator().translate(parse(), target);

describe('comment translation', () => {
  it('translates a file-top comment block, a leading comment, and a trailing comment (python -> java)', () => {
    const src = `# banner one
# banner two
x = 5   # keeps x
# describe y
y = x + 1`;
    const java = to(() => py(src), 'java');
    // File-top comments attach to the first statement as leading comments.
    expect(java).toContain('// banner one\n    // banner two\n    double x = 5;');
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

  it('attaches leading and trailing comments to a top-level function declaration', () => {
    const src = `# a top-level function
def greet(name):   # says hi
    print(name)`;
    const java = to(() => py(src), 'java');
    expect(java).toContain('// a top-level function\n  public static void greet');
    expect(java).toMatch(
      /greet\(Object name\) \{\s+System\.out\.println\(name\);\s+\}\s+\/\/ says hi/
    );
  });

  it('attaches leading and trailing comments to a top-level class declaration', () => {
    const src = `# a class comment
class Dog:   # a good boy
    def __init__(self):
        self.name = "Rex"`;
    const java = to(() => py(src), 'java');
    expect(java).toContain('// a class comment\npublic class Dog');
    expect(java).toMatch(/^\}\s+\/\/ a good boy/m);
  });

  it('does not spawn an empty synthetic Main class from a blank line between top-level classes', () => {
    // Regression: once ClassDeclaration carries a `loc`, insertBlankLines starts
    // inserting BlankLine nodes at the top level too — those must not count as
    // "real" main-body content when the Java emitter decides whether to wrap a
    // synthetic `public class Main { public static void main(...) {} }`.
    const src = `public class Main {
  public static void main(String[] args) {
    System.out.println("hi");
  }
}

public class Helper {
}
`;
    const program = jv(src);
    const java = new Translator().translate(program, 'java');
    const reparsed = jv(java);
    expect(java.match(/public class Main/g)).toHaveLength(1);
    expect(new Interpreter().interpret(reparsed, java)).toEqual(['hi']);
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
