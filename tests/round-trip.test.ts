/**
 * Round-trip translation guard.
 *
 * For every (source, target) pair, translate the source demo's AST into the
 * target language, re-parse and interpret that translated code, and assert its
 * output matches the output of interpreting the source directly. Because every
 * language runs on the same interpreter, equal ASTs-of-record produce identical
 * output — so a mismatch means the emitter produced code that either doesn't
 * re-parse or changed the program's meaning.
 *
 * Targets are enabled one at a time via DONE_TARGETS as their emitters are made
 * faithful; pending targets are skipped so the suite stays green between steps.
 */
import { describe, it, expect } from 'vitest';

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

interface Lang {
  name: TargetLanguage;
  src: string;
  parse: (src: string) => Program;
}

const LANGS: Lang[] = [
  {
    name: 'python',
    src: pythonSrc,
    parse: (s) => new PythonParser(new PythonLexer(s).tokenize()).parse(),
  },
  { name: 'java', src: javaSrc, parse: (s) => new JavaParser(new JavaLexer(s).tokenize()).parse() },
  {
    name: 'javascript',
    src: javascriptSrc,
    parse: (s) => new JavaScriptParser(new JavaScriptLexer(s).tokenize()).parse(),
  },
  { name: 'csp', src: cspSrc, parse: (s) => new CSPParser(new CSPLexer(s).tokenize()).parse() },
  {
    name: 'praxis',
    src: praxisSrc,
    parse: (s) => new PraxisParser(new PraxisLexer(s).tokenize(), s).parse(),
  },
];

const byName = (name: TargetLanguage): Lang => LANGS.find((l) => l.name === name)!;

// Targets whose emitter has been verified faithful. Expand one at a time.
const DONE_TARGETS = new Set<TargetLanguage>(['python', 'javascript', 'java']);

// (source->target) pairs that are genuinely inexpressible in the target and are
// therefore not required to match. Each entry needs a documented reason.
const EXPECTED_UNSUPPORTED: Record<string, string> = {};

// (source->target) pairs deferred to a later phase (skipped for now).
const DEFERRED: Record<string, string> = {
  // CSP list indexing is 0-based in the interpreter but AP CSP is 1-based;
  // reworking that (and the demo) is scheduled for the CSP phase, so every
  // csp-> pair is deferred until then.
  'csp->python': 'CSP 1-based index rework pending CSP phase',
  'csp->java': 'CSP 1-based index rework pending CSP phase',
  'csp->javascript': 'CSP 1-based index rework pending CSP phase',
  'csp->praxis': 'CSP 1-based index rework pending CSP phase',
};

const run = (program: Program, source: string): string[] =>
  new Interpreter().interpret(program, source);

describe('round-trip: translated output matches source output', () => {
  for (const target of LANGS.map((l) => l.name)) {
    describe(`-> ${target}`, () => {
      for (const source of LANGS) {
        const key = `${source.name}->${target}`;
        const reason = EXPECTED_UNSUPPORTED[key] ?? DEFERRED[key];
        const enabled = DONE_TARGETS.has(target) && !reason;
        const label = reason ? `${key} (skipped: ${reason})` : key;
        (enabled ? it : it.skip)(label, () => {
          const expected = run(source.parse(source.src), source.src);
          const translated = new Translator().translate(source.parse(source.src), target);
          const actual = run(byName(target).parse(translated), translated);
          expect(actual).toEqual(expected);
        });
      }
    });
  }
});
