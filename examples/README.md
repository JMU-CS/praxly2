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
