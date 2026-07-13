# Praxly2 — Project Guidelines

## Overview

Praxly2 is an in-browser multi-language compiler and translator for education. Users write code in **Python, Java, JavaScript, CSP pseudocode, Praxis pseudocode, or Blocks**, and the system parses it to a **Universal AST**, which can be interpreted directly or translated to any other supported language. There is no backend—everything runs client-side.

## Architecture

All languages share a 3-phase pipeline: **Lexer → Parser → Interpreter/Emitter**.

- **Universal AST** (`src/language/ast.ts`): Every language parses to the same AST node types. This is the core invariant—never introduce language-specific AST nodes.
- **Visitor pattern** (`src/language/visitor.ts`): `ASTVisitor` base class with `Precedence` constants. Each language emitter extends it.
- **Interpreter** (`src/language/interpreter.ts`): Executes any AST directly. Uses `Environment` class for lexically-scoped variables.
- **Translator** (`src/language/translator.ts`): Orchestrates type inference via `SymbolTable`/`TranslationContext`, then dispatches to language-specific emitters.
- **Debugger** (`src/language/debugger.ts`): Step-through execution with source mapping (AST node IDs → line numbers).

See [docs/COMPILER_PIPELINE.md](../docs/COMPILER_PIPELINE.md) for the full pipeline walkthrough with examples.

## Language Module Structure

Each language lives under `src/language/<lang>/` with exactly 3 files:

| File         | Class                              | Purpose                                               |
| ------------ | ---------------------------------- | ----------------------------------------------------- |
| `lexer.ts`   | `<Lang>Lexer`                      | `tokenize(): Token[]` — source string to token stream |
| `parser.ts`  | `<Lang>Parser`                     | `parse(): Program` — tokens to Universal AST          |
| `emitter.ts` | `<Lang>Emitter extends ASTVisitor` | Visitor that generates target language code           |

CSP and Praxis additionally have Lezer grammar files (`.grammar` → auto-compiled `.grammar.js`) and `lezer.ts` for CodeMirror syntax highlighting. Java, Python, and JavaScript use hand-written lexers only. Blocks (`src/language/blocks/`) is the exception to the 3-file pattern — its "source text" is Blockly workspace JSON, so it has `fromAst.ts`/`toAst.ts` (AST ⇄ Blockly conversion), `blockDefs.ts`, `blocklyDialogs.ts`, and `serialization.ts` instead of lexer/parser/emitter.

When adding a new language, follow [docs/ADDING_A_LANGUAGE.md](../docs/ADDING_A_LANGUAGE.md).

## Language specs & demos

- [`specs/`](../specs/) is the **authority** for each language's supported syntax, semantics,
  and standard library — one file per language (`praxis.md`, `csp.md`, `java.md`,
  `javascript.md`, `python.md`) plus `stdlib.md` (shared built-ins mapped across all five
  languages). Read the relevant spec before changing a language's behavior, and update it in the
  same change. Do not restate language rules in this file.
- [`examples/`](../examples/) holds one runnable demo per language (`demo.<lang>`); each
  exercises every AST node its parser can produce and is round-tripped to every target by
  `tests/round-trip.test.ts` (see `examples/README.md`).

## Build & Test

```bash
npm run dev          # Vite dev server (http://localhost:5173/v2/)
npm run build        # TypeScript check + Vite production build
npm run test:run     # Vitest unit tests, single run (`npm run test` = watch mode)
npm run test-browser # Selenium csv/ regression suite (requires Chrome)
```

- **Base URL**: `/v2/` (configured in `vite.config.js`)
- **Routes**: `/v2/editor` (main IDE), `/v2/embed` (embeddable), `/v2/account` (account page); all other paths redirect to `/v2/editor` — there is no separate landing route

## Conventions

- **TypeScript strict mode** — `noUnusedLocals`, `noUnusedParameters` enabled.
- **React 19 + Vite 6** — functional components, hooks only, no class components.
- **State management** — local `useState` per page, no global store. Logic is extracted into `useCodeParsing` and `useCodeDebugger` hooks.
- **Styling** — Tailwind CSS utility classes. Dark theme (slate-950 background). No CSS modules or styled-components.
- **Recursive descent parsing** — all parsers implement grammar rules as methods with operator precedence encoded in the call hierarchy (lowest precedence = highest in call tree).
- **Error recovery** — parsers use `synchronize()` to skip to the next valid statement after errors.
- **Source mapping** — every AST node has a unique `id`. Emitters track `nodeId → lineNumber` in `SourceMap` for debugger line highlighting.
- **Python lexer** — converts indentation to virtual `{}`/`;` tokens before parsing, so the parser treats it like a brace-delimited language.

## Testing

- **Unit tests** (`tests/`): One file per language. Test lexer tokenization, parser AST output, and round-trip translation using Vitest `describe`/`it`/`expect`.
- **CSV test matrix** (`csv/praxly.test.csv`): Columns are `Test Name | Program Code | User Input | Expected Output | Expected Error`. Selenium tests run each row in a headless browser.
- When adding language features, add new unit tests only to the corresponding test file. Do not edit the the CSV matrix; those code snippets are from the original test suite.

## Troubleshooting

See [docs/COMMON_ISSUES.md](../docs/COMMON_ISSUES.md) for diagnosing lexer, parser, interpreter, and emitter problems.

## Component & API Reference

See [docs/COMPONENT_REFERENCE.md](../docs/COMPONENT_REFERENCE.md) for Lexer/Parser/Interpreter/Emitter API contracts and AST node definitions.
