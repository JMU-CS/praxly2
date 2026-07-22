/**
 * Blank-line preservation: the insertBlankLines pass adds BlankLine no-op nodes
 * so a source program's blank lines survive translation (for side-by-side
 * comparison). Runs of blanks are preserved verbatim; a blank before a comment
 * block is kept ahead of the re-emitted comment; a blank between a comment and
 * its statement is dropped so the comment stays adjacent (minimal fidelity).
 * BlankLine round-trips through Blocks as a praxly_blank spacer.
 */
import { describe, it, expect } from 'vitest';

import { Lexer as PythonLexer } from '../src/language/python/lexer';
import { Parser as PythonParser } from '../src/language/python/parser';
import { PraxisLexer } from '../src/language/praxis/lexer';
import { PraxisParser } from '../src/language/praxis/parser';
import { CSPLexer } from '../src/language/csp/lexer';
import { CSPParser } from '../src/language/csp/parser';
import { JavaLexer } from '../src/language/java/lexer';
import { JavaParser } from '../src/language/java/parser';
import { JavaScriptLexer } from '../src/language/javascript/lexer';
import { JavaScriptParser } from '../src/language/javascript/parser';
import { Translator } from '../src/language/translator';
import { programToBlocksJson } from '../src/language/blocks/fromAst';
import { blocksToProgram } from '../src/language/blocks/toAst';
import type { Program } from '../src/language/ast';

const py = (src: string) => new PythonParser(new PythonLexer(src).tokenize()).parse();
const to = (parse: () => Program, target: any) => new Translator().translate(parse(), target);
const bodyTypes = (p: Program) => p.body.map((s) => s.type);

describe('blank-line preservation', () => {
  it('preserves a blank line between two statements (python -> python)', () => {
    expect(to(() => py('x = 1\n\ny = 2'), 'python')).toBe('x = 1\n\ny = 2');
  });

  it('preserves a run of blank lines verbatim (preserve-count)', () => {
    expect(to(() => py('x = 1\n\n\n\ny = 2'), 'python')).toBe('x = 1\n\n\n\ny = 2');
  });

  it('keeps a blank line before a leading-comment block', () => {
    expect(to(() => py('x = 1\n\n# section\ny = 2'), 'python')).toBe('x = 1\n\n# section\ny = 2');
  });

  it('drops a blank between a comment and its statement (comment stays adjacent)', () => {
    // The blank after `# note` is dropped; the comment stays glued to y = 2.
    expect(to(() => py('x = 1\n# note\n\ny = 2'), 'python')).toBe('x = 1\n# note\ny = 2');
  });

  it('rewrites the comment delimiter but keeps the surrounding blanks (python -> javascript)', () => {
    expect(to(() => py('x = 1\n\n# note\ny = 2'), 'javascript')).toContain('\n\n// note\n');
  });

  it('preserves blank lines inside a block body', () => {
    const out = to(() => py('def f():\n    a = 1\n\n    b = 2'), 'python');
    expect(out).toContain('a = 1\n\n  b = 2');
  });

  it('inserts a BlankLine node for every text front-end', () => {
    // Java statements must live inside Main.main; extract that method's block
    // instead of the top-level program body (which is just [ClassDeclaration]).
    const javaMainBody = (p: Program) =>
      ((p.body[0] as any).body.find((m: any) => m.name === 'main').body as any).body.map(
        (s: any) => s.type
      );
    const cases: Array<[string, () => Program, (p: Program) => string[]]> = [
      ['python', () => py('x = 1\n\ny = 2'), bodyTypes],
      [
        'javascript',
        () =>
          new JavaScriptParser(new JavaScriptLexer('let x = 1;\n\nlet y = 2;').tokenize()).parse(),
        bodyTypes,
      ],
      [
        'java',
        () =>
          new JavaParser(
            new JavaLexer(
              'public class Main {\n  public static void main(String[] args) {\n    int x = 1;\n\n    int y = 2;\n  }\n}'
            ).tokenize()
          ).parse(),
        javaMainBody,
      ],
      ['csp', () => new CSPParser(new CSPLexer('x <- 1\n\ny <- 2').tokenize()).parse(), bodyTypes],
      [
        'praxis',
        () => new PraxisParser(new PraxisLexer('int x <- 1\n\nint y <- 2').tokenize()).parse(),
        bodyTypes,
      ],
    ];
    for (const [lang, parse, extract] of cases) {
      expect(extract(parse()), `${lang} should insert a BlankLine`).toEqual([
        'Assignment',
        'BlankLine',
        'Assignment',
      ]);
    }
  });

  it('does not alter emitted program behavior (blanks strip to the same code)', () => {
    const withB = to(() => py('x = 1\n\n\nprint(x)'), 'java');
    const withoutB = to(() => py('x = 1\nprint(x)'), 'java');
    const strip = (s: string) =>
      s
        .split('\n')
        .filter((l) => l.trim() !== '')
        .join('\n');
    expect(strip(withB)).toBe(strip(withoutB));
  });

  it('round-trips a blank line through Blocks (BlankLine -> praxly_blank -> BlankLine)', () => {
    const json = programToBlocksJson(py('x = 1\n\ny = 2'));
    expect(json).toContain('praxly_blank');
    expect(bodyTypes(blocksToProgram(json))).toEqual(['Assignment', 'BlankLine', 'Assignment']);
  });
});
