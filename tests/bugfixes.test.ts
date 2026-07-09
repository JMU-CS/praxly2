/**
 * Regression tests for five subset-language bugs found while building the
 * examples/ feature demos. Each `it` fails on the pre-fix behavior.
 */
import { describe, it, expect } from 'vitest';

import { JavaLexer } from '../src/language/java/lexer';
import { JavaParser } from '../src/language/java/parser';
import { Lexer as PythonLexer } from '../src/language/python/lexer';
import { Parser as PythonParser } from '../src/language/python/parser';
import { PraxisLexer } from '../src/language/praxis/lexer';
import { PraxisParser } from '../src/language/praxis/parser';
import { Interpreter } from '../src/language/interpreter';
import { Translator } from '../src/language/translator';

const runJava = (src: string): string[] =>
  new Interpreter().interpret(new JavaParser(new JavaLexer(src).tokenize()).parse(), src);
const runPython = (src: string): string[] =>
  new Interpreter().interpret(new PythonParser(new PythonLexer(src).tokenize()).parse(), src);
const runPraxis = (src: string): string[] =>
  new Interpreter().interpret(new PraxisParser(new PraxisLexer(src).tokenize(), src).parse(), src);

describe('bugs found while building the example demos', () => {
  // Bug 1: the Java parser built CompoundAssignment without `left`/`right`,
  // which the interpreter reads -> "Cannot read properties of undefined".
  it('Java compound assignment executes', () => {
    const out = runJava('int acc = 10; acc += 5; acc *= 2; System.out.println(acc);');
    expect(out.join('\n')).not.toMatch(/runtime error/i);
    expect(out).toContain('30');
  });

  // Bug 2: `continue` was missing from the Java lexer keyword list, so it
  // parsed as an identifier -> "Undefined variable 'continue'".
  it('Java `continue` parses as a keyword rather than an undefined identifier', () => {
    const out = runJava(
      'for (int t = 0; t < 3; t++) { if (t == 1) { continue; } System.out.println(t); }'
    );
    expect(out.join('\n')).not.toMatch(/undefined variable/i);
  });

  // Bug 3: a trailing `#` comment on a block-header line left `trimmed` not
  // ending in ':', so a spurious virtual ';' detached the block body.
  it('Python keeps the block body when the header line has a trailing comment', () => {
    const out = runPython(
      'def greet(name):  # a trailing comment\n    return "hi " + name\nprint(greet("sam"))'
    );
    expect(out).toContain('hi sam');
  });

  // Bug 4: JavaInstance.getField didn't walk the superclass chain, so a
  // subclass instance couldn't read a field declared on its parent.
  it('a subclass instance can read a field inherited from its superclass', () => {
    const out = runPraxis(
      [
        'class Animal',
        '  string name <- "animal"',
        '  string describe()',
        '    return this.name',
        '  end describe',
        'end class',
        'class Dog extends Animal',
        '  string bark()',
        '    return "woof"',
        '  end bark',
        'end class',
        'Dog d <- new Dog()',
        'print(d.describe())',
      ].join('\n')
    );
    expect(out.join('\n')).not.toMatch(/undefined field/i);
    expect(out).toContain('animal');
  });

  // Bug 5: the Python emitter had no mapping for the `^` exponent operator, so
  // it emitted a literal `^`, which is not valid Python.
  it('Praxis exponent (^) translates to Python ** and runs', () => {
    const src = 'print(2 ^ 10)';
    const program = new PraxisParser(new PraxisLexer(src).tokenize(), src).parse();
    const py = new Translator().translate(program, 'python');
    expect(py).toContain('**');
    expect(py).not.toContain('^');
    expect(runPython(py)).toContain('1024');
  });
});
