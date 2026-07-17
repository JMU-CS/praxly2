/**
 * Praxis slash-star placeholder: a hole for missing exam-question code. It
 * parses to a Placeholder expression node. Interpreting it is a runtime error —
 * assigning it to a variable stores an uninitialized sentinel (reading the
 * variable later is the error), and using it directly (a condition, an
 * operand, ...) errors immediately. It is preserved verbatim in Praxis output,
 * and still lowers to `0` when translated to every other target (which don't
 * support the placeholder syntax) — translation is a text-emission concern,
 * not interpretation, so the emitted default is unchanged.
 */
import { describe, it, expect } from 'vitest';

import { PraxisLexer } from '../src/language/praxis/lexer';
import { PraxisParser } from '../src/language/praxis/parser';
import { Interpreter } from '../src/language/interpreter';
import { Translator } from '../src/language/translator';

const px = (src: string) => new PraxisParser(new PraxisLexer(src).tokenize()).parse();
const run = (src: string) => new Interpreter().interpret(px(src), src);
const to = (src: string, target: any) => new Translator().translate(px(src), target);

describe('Praxis placeholder', () => {
  it('parses /* ... */ as a Placeholder node carrying its text', () => {
    const ast: any = px('x <- /* fill me */');
    expect(ast.body[0].value.type).toBe('Placeholder');
    expect(ast.body[0].value.text).toBe('fill me');
  });

  it('assigning a placeholder is uninitialized; reading it later is an error', () => {
    const out = run('int x <- /* missing */\nprint(x)');
    expect(out.join('\n')).toMatch(/uninitialized variable 'x'/i);
  });

  it('using a placeholder directly (e.g. as a condition) is an immediate error', () => {
    const out = run('if (/* cond */)\n    print("t")\nelse\n    print("f")\nend if');
    expect(out.join('\n')).toMatch(/uninitialized value/i);
  });

  it('is preserved verbatim in Praxis output', () => {
    expect(to('x <- /* missing value */\nprint(x)', 'praxis')).toContain('/* missing value */');
  });

  it('lowers to a default 0 in other targets', () => {
    expect(to('x <- /* hole */\nprint(x)', 'python')).toContain('x = 0');
    expect(to('int x <- /* hole */\nprint(x)', 'java')).toContain('int x = 0;');
    expect(to('x <- /* hole */\nprint(x)', 'csp')).toContain('x ← 0');
  });
});
