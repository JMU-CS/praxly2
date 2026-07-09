/**
 * Regression guard for the feature-demo programs in examples/.
 *
 * Each demo/ file is meant to exercise every Universal-AST node its source
 * language can produce AND to run in Praxly2 with no runtime error. This test
 * keeps that guarantee honest: it lexes + parses + interprets every demo and
 * asserts the interpreter produced output with no error line, then checks that
 * translating each demo to every target language does not throw.
 *
 * If you add a language feature to a demo (or change a parser/interpreter),
 * this test tells you immediately if a demo stopped running.
 */
import { describe, it, expect } from 'vitest';

// Vite `?raw` imports load each demo file's contents as a string (typed via
// vite/client), so this test needs no Node fs/path access.
import pythonSrc from '../examples/demo.py?raw';
import javaSrc from '../examples/demo.java?raw';
import javascriptSrc from '../examples/demo.js?raw';
import cspSrc from '../examples/demo.csp?raw';
import praxisSrc from '../examples/demo.praxis?raw';

import { Lexer as PythonLexer } from '../src/language/python/lexer';
import { Parser as PythonParser } from '../src/language/python/parser';
import { JavaLexer } from '../src/language/java/lexer';
import { JavaParser } from '../src/language/java/parser';
import { JavaScriptLexer } from '../src/language/javascript/lexer';
import { JavaScriptParser } from '../src/language/javascript/parser';
import { CSPLexer } from '../src/language/csp/lexer';
import { CSPParser } from '../src/language/csp/parser';
import { PraxisLexer } from '../src/language/praxis/lexer';
import { PraxisParser } from '../src/language/praxis/parser';
import { Interpreter } from '../src/language/interpreter';
import { Translator } from '../src/language/translator';
import type { Program } from '../src/language/ast';
import type { TargetLanguage } from '../src/language/visitor';

interface Demo {
  name: string;
  src: string;
  parse: (src: string) => Program;
}

// Only the Praxis parser consumes the raw source (for print `//` metadata);
// every other parser takes just the token stream.
const DEMOS: Demo[] = [
  {
    name: 'python',
    src: pythonSrc,
    parse: (src) => new PythonParser(new PythonLexer(src).tokenize()).parse(),
  },
  {
    name: 'java',
    src: javaSrc,
    parse: (src) => new JavaParser(new JavaLexer(src).tokenize()).parse(),
  },
  {
    name: 'javascript',
    src: javascriptSrc,
    parse: (src) => new JavaScriptParser(new JavaScriptLexer(src).tokenize()).parse(),
  },
  {
    name: 'csp',
    src: cspSrc,
    parse: (src) => new CSPParser(new CSPLexer(src).tokenize()).parse(),
  },
  {
    name: 'praxis',
    src: praxisSrc,
    parse: (src) => new PraxisParser(new PraxisLexer(src).tokenize()).parse(),
  },
];

const TARGETS: TargetLanguage[] = ['python', 'java', 'javascript', 'csp', 'praxis'];

// The two markers the interpreter emits when execution throws (interpreter.ts).
const errorLines = (output: string[]): string[] =>
  output.filter(
    (line) => line.includes('Runtime Error:') || line.startsWith('runtime error occurred')
  );

describe('example demos remain runnable', () => {
  for (const demo of DEMOS) {
    describe(demo.name, () => {
      const src = demo.src;

      it('parses into a non-empty program', () => {
        const program = demo.parse(src);
        expect(program.body.length).toBeGreaterThan(0);
      });

      it('interprets with no runtime error', () => {
        const program = demo.parse(src);
        const output = new Interpreter().interpret(program, src);
        expect(output.length).toBeGreaterThan(0);
        expect(errorLines(output)).toEqual([]);
      });

      for (const target of TARGETS) {
        it(`translates to ${target} without throwing`, () => {
          const program = demo.parse(src);
          expect(() => new Translator().translate(program, target)).not.toThrow();
        });
      }
    });
  }
});
