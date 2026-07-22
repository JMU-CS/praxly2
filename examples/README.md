# Praxly2 Feature Demos

`demo.csp`, `demo.java`, `demo.js`, `demo.praxis`, and `demo.py` are companion
programs — one per text language Praxly2 supports. Each one exercises **every
Universal-AST node its language's parser can produce**, and every construct in
it runs top to bottom with **no runtime error**.

`demo.blocks.json` is the sample for the visual [Blocks](../specs/blocks.md)
language. It is a Blockly **workspace document**, not text source, and — because
Blocks is a deliberate procedural subset — showcases the language rather than
covering every AST node. It is exercised by `tests/blocks.test.ts` (loaded
through real Blockly, converted to the AST, and interpreted), not by
`examples.test.ts`.

These files serve two purposes:

1. **Documentation** — a worked example of exactly which language features
   Praxly2 supports. Praxly2 implements only a _subset_ of real Python, Java,
   and JavaScript, so each file's header comment also lists the AST nodes its
   language cannot express (they are covered by the other demos).
2. **Translation fixtures** — because every language shares one Universal AST,
   these programs double as inputs for testing translation of each AST node
   into every other language, including nodes with no direct target equivalent
   (e.g. Praxis's `repeat…until`).

## Conventions

- **Ordering.** Within each file the snippets run from most basic to most
  complex: expressions, then statements, then functions, then classes.
- **Annotations.** Each snippet is headed by a comment naming the AST node(s)
  it exercises; inline `//` / `#` comments show the expected output.
- **Language-specific header.** Each file begins with a short comment listing
  the AST nodes that language cannot reach, plus any interpreter quirks that
  shaped the code (e.g. Java's `System.out.println` takes a single argument).

## Running

Open a file in Praxly2 (`npm run dev`) and run the code manually, or exercise
all five with the examples regression test:

```
npm run test:run -- tests/examples.test.ts
```

`tests/examples.test.ts` parses, interprets, and translates every demo as a
regression guard, so the files stay runnable as the codebase evolves.

## Language-Specific Notes

### CSP

CSP is a small procedural language, so it reaches fewer AST nodes than the
other demos.

AST nodes NOT reachable from CSP source (covered by the other demos):
- Classes (ClassDeclaration/Constructor/Method/Field), NewExpression,
- MemberExpression, ThisExpression .... CSP has no usable OOP.
- DoWhile / RepeatUntil node .......... `REPEAT UNTIL` maps to While(NOT c).
- Switch / Try / Break / Continue ..... no such keywords.
- ConditionalExpression (ternary) ..... not parsed.
- UpdateExpression (++/--) ............ not in CSP.
- CompoundAssignment (+=) ............. write `x ← x + 1`.

Interpreter notes:
- Assignment is `←` (ASCII `<-` also accepted); `=` means EQUALITY.
- Lists are 1-based (AP CSP).
- `REPEAT UNTIL(c)` is a PRE-condition loop (runs while NOT c).
- There is no counting FOR: use a counter + REPEAT UNTIL, or REPEAT n TIMES.
- There is no unary minus -> write `0 - x`. There is no `null`.
- DISPLAY prints its argument followed by a SPACE (no newline), per AP CSP,
  so all output below lands on a single space-separated line.

### Java

AST nodes NOT reachable from Java source (covered by the other demos):
- FunctionDeclaration ..... Java has only methods, never free functions.
- RepeatUntil ............. no repeat/until syntax.
- NewExpression ........... `new X(...)` is encoded as a CallExpression.
- ThisExpression .......... `this` is encoded as an Identifier.

Interpreter notes:
- System.out.println takes exactly ONE argument -> concatenate with '+'.
- A C-style for-loop update should be `i++` (an embedded plain assignment
  like `i = i + 1` is a no-op).
- Scanner reads System.in, which the auto-runner can't supply, so Scanner is
  exercised by the Java tests (with provided input) rather than here.

The executable code lives in Main.main (auto-invoked by the interpreter);
the helper classes it uses are declared afterwards.

### JavaScript

AST nodes NOT reachable from JavaScript source (covered by the other demos):
- RepeatUntil ......... no repeat/until syntax.

Interpreter notes:
- Output is console.log(...) (multiple args are space-joined).
- Standard JS: arrays use .push, conversions use parseInt/parseFloat/String,
  integer division uses Math.trunc, .length gives length.
- `let`/`const`/`var` all behave identically (no block scoping enforced).

### Praxis

Praxis maps most directly to the Universal AST, so it reaches the widest
set of nodes.

AST nodes NOT reachable from Praxis source (covered by the other demos):
- Switch / SwitchCase .. no switch/case keywords.
- ConditionalExpression  no ?: ternary operator.
- CompoundAssignment ... no +=/-=; write `x ← x + 1`.
- ForEach .............. no for-each; Praxis has only the C-style for loop.

Functions and classes are hoisted, so the driver calls them before their
declarations appear further down the file.

### Python

AST nodes NOT reachable from Python source (covered by the other demos):
- DoWhile / RepeatUntil ... no do-while / repeat syntax.
- Switch / SwitchCase ..... no match/switch parsing.
- UpdateExpression ........ no ++ / -- in Python.
- CompoundAssignment ...... += etc. desugar to Assignment + BinaryExpression.
- NewExpression ........... instantiation is a CallExpression, e.g. Dog("x").
- ThisExpression .......... `self` is an ordinary Identifier.
