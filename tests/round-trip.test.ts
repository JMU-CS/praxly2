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
const DONE_TARGETS = new Set<TargetLanguage>(['python', 'javascript', 'java', 'praxis', 'csp']);

// (source->target) pairs that are genuinely inexpressible in the target and are
// therefore not required to match. Each entry needs a documented reason.
const EXPECTED_UNSUPPORTED: Record<string, string> = {
  // CSP has no classes/OOP, and every non-CSP demo defines classes, so an
  // equivalent CSP program cannot be produced. (csp->* and csp->csp work.)
  'python->csp': 'CSP has no classes/OOP',
  'java->csp': 'CSP has no classes/OOP',
  'javascript->csp': 'CSP has no classes/OOP',
  'praxis->csp': 'CSP has no classes/OOP',
};

// (source->target) pairs deferred to a later phase (skipped for now).
const DEFERRED: Record<string, string> = {};

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

// The full demos can't round-trip to CSP (no OOP — see EXPECTED_UNSUPPORTED),
// but the features CSP *does* support should still translate faithfully from
// every language. Each probe below is a self-contained program restricted to
// CSP's expressible subset — arithmetic/MOD, string concat, comparison/logic,
// list literals + indexing (exercising the 1-based<->0-based conversion),
// if/else, while, for, and functions — round-tripped to CSP with exact match.
const CSP_SUBSET_PROBES: Partial<Record<TargetLanguage, string>> = {
  python: `s = "hi " + "csp"
print(s)
a = 20
b = 6
print(a + b)
print(a * b)
print(a % b)
print(a > b and b > 0)
print(a == 20 or b == 0)
print(not (a == b))
xs = [10, 20, 30]
print(xs[0])
xs[1] = 99
print(xs[1])
print(len(xs))
for i in range(3):
    print(xs[i])
total = 0
n = 1
while n <= 3:
    total = total + n
    n = n + 1
print(total)
if a >= 100:
    print("big")
else:
    if a >= 10:
        print("med")
    else:
        print("small")
def add(x, y):
    return x + y
print(add(4, 5))`,
  java: `String s = "hi " + "csp";
System.out.println(s);
int a = 20;
int b = 6;
System.out.println(a + b);
System.out.println(a * b);
System.out.println(a % b);
System.out.println(a > b && b > 0);
System.out.println(a == 20 || b == 0);
System.out.println(!(a == b));
int[] xs = {10, 20, 30};
System.out.println(xs[0]);
xs[1] = 99;
System.out.println(xs[1]);
for (int i = 0; i < 3; i++) {
    System.out.println(xs[i]);
}
int total = 0;
int n = 1;
while (n <= 3) {
    total = total + n;
    n = n + 1;
}
System.out.println(total);
if (a >= 100) {
    System.out.println("big");
} else if (a >= 10) {
    System.out.println("med");
} else {
    System.out.println("small");
}`,
  javascript: `let s = "hi " + "csp";
console.log(s);
let a = 20;
let b = 6;
console.log(a + b);
console.log(a * b);
console.log(a % b);
console.log(a > b && b > 0);
console.log(a === 20 || b === 0);
console.log(!(a === b));
let xs = [10, 20, 30];
console.log(xs[0]);
xs[1] = 99;
console.log(xs[1]);
for (let i = 0; i < 3; i = i + 1) {
    console.log(xs[i]);
}
let total = 0;
let n = 1;
while (n <= 3) {
    total = total + n;
    n = n + 1;
}
console.log(total);
if (a >= 100) {
    console.log("big");
} else if (a >= 10) {
    console.log("med");
} else {
    console.log("small");
}`,
  praxis: `string s <- "hi " + "csp"
print(s)
int a <- 20
int b <- 6
print(a + b)
print(a * b)
print(a mod b)
print(a > b and b > 0)
print(a == 20 or b == 0)
print(not (a == b))
int[] xs <- {10, 20, 30}
print(xs[0])
xs[1] <- 99
print(xs[1])
for (int i <- 0; i < 3; i <- i + 1)
    print(xs[i])
end for
int total <- 0
int n <- 1
while (n <= 3)
    total <- total + n
    n <- n + 1
end while
print(total)
if (a >= 100)
    print("big")
else
    if (a >= 10)
        print("med")
    else
        print("small")
    end if
end if`,
};

describe('round-trip: CSP-supported subset translates from each language', () => {
  for (const source of Object.keys(CSP_SUBSET_PROBES) as TargetLanguage[]) {
    it(`${source} -> csp (supported subset)`, () => {
      const code = CSP_SUBSET_PROBES[source]!;
      const expected = run(byName(source).parse(code), code);
      const translated = new Translator().translate(byName(source).parse(code), 'csp');
      const actual = run(byName('csp').parse(translated), translated);
      expect(actual).toEqual(expected);
    });
  }
});
