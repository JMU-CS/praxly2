# Skill: Add Tests for a New Feature

Guide for writing Vitest unit tests for new language features. Tests live in `tests/` — one file per language.

## Rules

- **Do not edit `csv/praxly.test.csv`** — that is a regression suite from the original codebase; it is run separately via Selenium
- Add tests only to the relevant `tests/<lang>.test.ts` file
- Run tests with `npm test` (Vitest)

## Test file structure

```typescript
import { describe, it, expect } from 'vitest';
import { <Lang>Lexer } from '../src/language/<lang>/lexer';
import { <Lang>Parser } from '../src/language/<lang>/parser';
import { Interpreter } from '../src/language/interpreter';
import { Translator } from '../src/language/translator';
import { SymbolTable } from '../src/language/visitor';

describe('<Lang> Lexer', () => { ... });
describe('<Lang> Parser', () => { ... });
describe('<Lang> Interpreter', () => { ... });
describe('<Lang> Translator', () => { ... });
```

## Lexer tests

Test that tokens are emitted with the correct `type` and `value`. Use `toContainEqual` with `expect.objectContaining` to avoid coupling to token order.

```typescript
it('should tokenize assignment operator', () => {
  const tokens = new CSPLexer('x <- 5').tokenize();
  expect(tokens).toContainEqual(expect.objectContaining({ type: 'OPERATOR', value: '<-' }));
});

it('should skip comments', () => {
  const tokens = new CSPLexer('x <- 5 // comment\ny <- 10').tokenize();
  const identifiers = tokens.filter((t) => t.type === 'IDENTIFIER').map((t) => t.value);
  expect(identifiers).toContain('x');
  expect(identifiers).toContain('y');
  expect(identifiers).not.toContain('comment');
});
```

## Parser / AST tests

Test the shape of the generated AST. Use `toMatchObject` for partial matching of the relevant fields.

```typescript
it('should parse a while loop', () => {
  const tokens = new CSPLexer('REPEAT UNTIL(x > 5) { x <- x + 1 }').tokenize();
  const ast = new CSPParser(tokens).parse();
  expect(ast.body[0]).toMatchObject({
    type: 'While',
    condition: { type: 'UnaryExpression', operator: 'not' },
  });
});
```

## Interpreter tests

Capture stdout via the `Interpreter` and assert on `output`.

```typescript
it('should execute a basic for loop', () => {
  const code = `FOR i FROM 1 TO 3 { DISPLAY(i) }`;
  const tokens = new CSPLexer(code).tokenize();
  const ast = new CSPParser(tokens).parse();
  const interp = new Interpreter();
  const result = interp.interpret(ast);
  expect(result.output).toBe('1\n2\n3\n');
});
```

## Translation tests

Test that AST translates to correct target language code. Check for key snippets, not exact full-program equality (formatting may vary).

```typescript
it('should translate if/else to Java', () => {
  const code = `IF (x > 0) { DISPLAY("pos") } ELSE { DISPLAY("neg") }`;
  const tokens = new CSPLexer(code).tokenize();
  const ast = new CSPParser(tokens).parse();
  const translator = new Translator();
  const java = translator.translate(ast, 'java');
  expect(java).toContain('if (x > 0)');
  expect(java).toContain('else');
});
```

## Round-trip tests

Verify that code can be translated from one language to another and back without information loss. Parse the output of a translation and check key AST properties.

```typescript
it('should round-trip CSP → Python → CSP', () => {
  const src = `x <- 5\nDISPLAY(x)`;
  const tokens = new CSPLexer(src).tokenize();
  const ast = new CSPParser(tokens).parse();
  const translator = new Translator();
  const python = translator.translate(ast, 'python');
  expect(python).toContain('x = 5');
  expect(python).toContain('print');
});
```

## What to test for each feature type

### New statement node (e.g., `RepeatUntil`)

1. Lexer: correct tokens for the new syntax
2. Parser: AST node has correct `type`, `condition`, `body`
3. Interpreter: loop executes body, stops at correct condition
4. Each emitter target: translated output has correct semantics

### New expression type

1. Lexer: operators/keywords tokenize correctly
2. Parser: expression tree has correct shape (operator, left, right)
3. Interpreter: expression evaluates to expected value
4. At least one emitter: generates syntactically valid target code

### New built-in function (e.g., `LENGTH`, `APPEND`)

1. Parser: recognizes as `CallExpression` with correct callee name
2. Interpreter: returns the right value / mutates correctly
3. Java emitter: maps to the correct Java method call

### New class feature (constructor, method, field)

1. Parser: `ClassDeclaration` node has correct `body` members
2. Interpreter: `new Obj()` instantiates, method calls work
3. Java emitter: generates valid Java class syntax

## Tips

- Use `describe` blocks to group related tests; use `it` for individual cases
- Prefer small, focused tests over large integration tests
- When a feature has edge cases (empty body, nested loops, chained calls), add a test for each
- If a test is testing a specific bug fix, add a short comment explaining the original failure
