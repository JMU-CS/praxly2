/**
 * Praxis slash-star placeholder: a hole for missing exam-question code. It
 * parses to a Placeholder expression node, evaluates to a default 0 so programs
 * with holes still run, is preserved verbatim in Praxis output, and lowers to
 * `0` in every other target (which don't support the placeholder syntax).
 */
import { describe, it, expect } from 'vitest';

import { PraxisLexer } from '../src/language/praxis/lexer';
import { PraxisParser } from '../src/language/praxis/parser';
import { Interpreter } from '../src/language/interpreter';
import { Translator } from '../src/language/translator';

const px = (src: string) => new PraxisParser(new PraxisLexer(src).tokenize(), src).parse();
const run = (src: string) => new Interpreter().interpret(px(src), src);
const to = (src: string, target: any) => new Translator().translate(px(src), target);

describe('Praxis placeholder', () => {
  it('parses /* ... */ as a Placeholder node carrying its text', () => {
    const ast: any = px('x <- /* fill me */');
    expect(ast.body[0].value.type).toBe('Placeholder');
    expect(ast.body[0].value.text).toBe('fill me');
  });

  it('evaluates to 0 so a program with holes still runs', () => {
    expect(run('int x <- /* missing */\nprint(x)')).toEqual(['0']);
    expect(run('if (/* cond */)\n    print("t")\nelse\n    print("f")\nend if')).toEqual(['f']);
  });

  it('is preserved verbatim in Praxis output', () => {
    expect(to('x <- /* missing value */\nprint(x)', 'praxis')).toContain('/* missing value */');
  });

  it('lowers to a default 0 in other targets', () => {
    expect(to('x <- /* hole */\nprint(x)', 'python')).toContain('x = 0');
    expect(to('int x <- /* hole */\nprint(x)', 'java')).toContain('int x = 0;');
    expect(to('x <- /* hole */\nprint(x)', 'csp')).toContain('x <- 0');
  });
});
