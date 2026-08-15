---
name: add-tests
description: Write Vitest tests for Praxly2 language features, hooks, and stores — lexer, parser, interpreter, translator, round-trip, and debugger layers. Use when adding a language feature, fixing a parser/interpreter/emitter bug, adding a UI hook, or deciding which of the existing test files a new case belongs in.
---

# Testing Praxly2

Unit tests live in `tests/` and run under Vitest with **no DOM environment** —
they exercise the compiler pipeline and plain TypeScript modules directly.

```bash
npm run test:run      # single run
npm run test          # watch mode
npm run test-browser  # Selenium csv/ suite — separate, needs Chrome
```

## Hard rule

**Never edit `csv/praxly.test.csv`.** It is the original regression corpus, run
in a real browser by `npm run test-browser` and _not_ by `npm run test:run`.
After any parser, interpreter, or emitter change, run the browser suite too —
`test:run` passing is not sufficient evidence for those layers.

## Where a test goes

| File                                                                                                                                 | Holds                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/<lang>.test.ts`                                                                                                               | Everything specific to one language: lexer, parser, interpreter, and that language's emitter output. One per language (`python`, `java`, `javascript`, `csp`, `praxis`). |
| `tests/round-trip.test.ts`                                                                                                           | Cross-language fidelity: translates each `examples/demo.*` to every target, re-parses, re-runs, and compares output.                                                     |
| `tests/examples.test.ts`                                                                                                             | Guards that every `examples/demo.*` still parses, runs without error, and translates to all targets without throwing.                                                    |
| `tests/control-flow.test.ts`, `blank-lines.test.ts`, `comments.test.ts`, `blocks.test.ts`, `debugger.test.ts`, `placeholder.test.ts` | Cross-cutting behavior that isn't owned by one language.                                                                                                                 |
| `tests/bugfixes.test.ts`                                                                                                             | Regression cases for specific fixed bugs. Add a comment naming the original failure.                                                                                     |
| `tests/chatStore.test.ts`                                                                                                            | Non-compiler modules (zustand stores, plain utils).                                                                                                                      |

A new _language feature_ goes in `tests/<lang>.test.ts`. A new _AST node_ or
interpreter behavior usually needs a case in the relevant language file **and**
a demo update so `round-trip.test.ts` covers it in every target.

## The four APIs you will assert against

Get these right — they are the most common source of broken test scaffolding.

```typescript
// 1. Lexer → Token[]
const tokens = new CSPLexer('x <- 5').tokenize();

// 2. Parser → Program (Universal AST)
const program = new CSPParser(tokens).parse();

// 3. Interpreter → string[]   ← an ARRAY OF LINES, not a string, not { output }
const lines = new Interpreter().interpret(program, source);

// 4. Translator → string
const code = new Translator().translate(program, 'java');
```

`interpret()` takes the original source as its second argument (used for error
locations) and returns one entry per output line. `DISPLAY`/`print` without a
newline buffers into the current line, so two statements can land in a single
array entry — assert with `toEqual([...])` on the whole array when spacing
matters.

## Patterns

**Lexer** — assert on token presence, not position, so unrelated token changes
don't break the test:

```typescript
it('should tokenize assignment operator', () => {
  const tokens = new CSPLexer('x <- 5').tokenize();
  expect(tokens).toContainEqual(expect.objectContaining({ type: 'OPERATOR', value: '<-' }));
});

it('should skip comments', () => {
  const tokens = new CSPLexer('x <- 5 // comment\ny <- 10').tokenize();
  const identifiers = tokens.filter((t) => t.type === 'IDENTIFIER').map((t) => t.value);
  expect(identifiers).toEqual(['x', 'y']);
});
```

**Parser** — `toMatchObject` on the shape, so you assert the fields you care
about and ignore `id` (which is regenerated every parse):

```typescript
it('parses REPEAT UNTIL as a negated While', () => {
  const program = new CSPParser(
    new CSPLexer('REPEAT UNTIL(x > 5) { x <- x + 1 }').tokenize()
  ).parse();
  expect(program.body[0]).toMatchObject({
    type: 'While',
    condition: { type: 'UnaryExpression', operator: 'not' },
  });
});
```

**Interpreter** — assert the line array. Note that CSP's `DISPLAY` appends a
space rather than a newline, so three iterations land in **one** array entry:

```typescript
it('runs REPEAT n TIMES', () => {
  const source = 'i <- 0\nREPEAT 3 TIMES\n{\n  i <- i + 1\n  DISPLAY(i)\n}';
  const program = new CSPParser(new CSPLexer(source).tokenize()).parse();
  expect(new Interpreter().interpret(program, source)).toEqual(['1 2 3 ']);
});
```

Write the source in the syntax the language actually has — check `specs/<lang>.md`
first. A construct the parser doesn't recognize usually yields an **empty
program**, so the test "passes" against `[]` while proving nothing. If an
interpreter assertion comes back empty, suspect the syntax before the
interpreter.

**Translator** — check for the meaningful snippet, never whole-program equality
(formatting is not a stable contract):

```typescript
it('translates if/else to Java', () => {
  const source = 'IF (x > 0) { DISPLAY("pos") } ELSE { DISPLAY("neg") }';
  const program = new CSPParser(new CSPLexer(source).tokenize()).parse();
  const java = new Translator().translate(program, 'java');
  expect(java).toContain('if (x > 0)');
  expect(java).toContain('else');
});
```

**Round-trip** — the strongest assertion available, because every language runs
on the same interpreter: translate, re-parse, re-run, compare output. Prefer
this over eyeballing emitted text when you change an emitter.

```typescript
it('CSP → Python preserves behavior', () => {
  const source = 'x <- 5\nDISPLAY(x)';
  const program = new CSPParser(new CSPLexer(source).tokenize()).parse();
  const python = new Translator().translate(program, 'python');
  const reparsed = new PythonParser(new PythonLexer(python).tokenize()).parse();
  expect(new Interpreter().interpret(reparsed, python)).toEqual(
    new Interpreter().interpret(program, source)
  );
});
```

**Debugger** — drive `Debugger` directly; `step()` returns a `DebugStep` with
`variables`, `callStack`, cumulative `output`, and `isComplete`. See the `parse`
helper at the top of `tests/debugger.test.ts` for the established shape.

**Hooks and components** — there is no DOM environment configured, so test the
extracted logic rather than rendering. The refactor deliberately put page
behavior in hooks and pure helpers for this reason; the pure ones are directly
testable with no setup:

- `src/utils/panelLayout.ts` — `toggleStack`, `reorderPanel`, `swapStacked`, `inSameColumn`
- `src/utils/languageSwitch.ts` — `planLanguageSwitch` returns a
  `'empty' | 'translated' | 'untranslatable'` plan
- `src/utils/aiPanelContext.ts` — `buildAiPanelContext`
- `src/utils/debugHandlers.ts` — `computeMultiplePanelHighlighting`

`tests/chatStore.test.ts` shows the pattern for a module that needs
`localStorage`: stub it on `globalThis` before importing the store. If you ever
do need to render a component, add `environment: 'jsdom'` and `@testing-library/react`
first — neither is currently a dependency.

## What to cover, by change type

**New statement node** — lexer tokens; parser node shape; interpreter execution
(including the loop/branch boundary); each emitter's output; then add it to the
language's `examples/demo.*` so round-trip covers all five targets.

**New expression type** — tokenization; expression-tree shape including
precedence against neighbouring operators; evaluated value; one emitter's
output, with parenthesization checked.

**New built-in** — parser recognizes it as a `CallExpression`; interpreter
returns the right value (and mutates in place where the spec says so); each
emitter maps it to the target's equivalent. Cross-language differences belong in
`specs/stdlib.md`.

**Bug fix** — add the failing input to `tests/bugfixes.test.ts` with a one-line
comment naming what used to break.

## Conventions

- `describe` per layer (`'CSP Lexer'`, `'CSP Parser'`, …), `it` per case.
- Small and focused beats one big integration test — a failure should name the
  layer that broke.
- Cover the edge cases the parser actually branches on: empty body, nested
  loops, chained calls, trailing `else if`.
- Never assert on `id` values; they are freshly generated per parse.
