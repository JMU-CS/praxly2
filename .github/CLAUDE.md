# Praxly2 — Claude Agent Onboarding

This is the fast-start guide for Claude agents. Read the full project guidelines in [copilot-instructions.md](copilot-instructions.md) and the detailed docs in [../docs/](../docs/).

## What this project is

An in-browser multi-language compiler and translator for CS education. Users write code in **Python, Java, CSP pseudocode, or Praxis pseudocode**. Every language shares one **Universal AST** — no language-specific AST nodes, ever. The AST can be interpreted directly or translated to any other supported language. No backend; everything runs client-side.

## Architecture in 30 seconds

```
Source text
  → Lexer          (src/language/<lang>/lexer.ts)
  → Parser         (src/language/<lang>/parser.ts)
  → Universal AST  (src/language/ast.ts)
  → Interpreter    (src/language/interpreter.ts)   ← executes directly
  → Translator     (src/language/translator.ts)    ← type inference pass
  → Emitter        (src/language/<lang>/emitter.ts) ← generates target code
```

The **Visitor pattern** (`src/language/visitor.ts`) is the spine. Every emitter extends `ASTVisitor` and implements `visitX()` methods. The `Translator.analyze()` pass builds `TranslationContext` (symbol table, inferred types, mutable collections) before dispatching to emitters.

## Critical invariants

1. **One Universal AST** — parsers produce only nodes defined in `ast.ts`. Never add language-specific node types.
2. **All AST nodes require `id: generateId()`** — the debugger and source maps depend on unique IDs.
3. **TypeScript strict mode** — `noUnusedLocals` and `noUnusedParameters` are on. Every new `visit*` method must be listed as `abstract` in `ASTVisitor`.
4. **No global state** — React components use local `useState`; logic lives in `useCodeParsing` and `useCodeDebugger` hooks.
5. **When adding a new `Statement` node type**: update `ast.ts`, `visitor.ts` (abstract method + dispatch case), all 4+ emitters, `interpreter.ts`, and `translator.ts` (recurse into body in `analyzeBlock`).

## Key files to read first

| File                                      | Why                                                              |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `src/language/ast.ts`                     | All AST node types                                               |
| `src/language/visitor.ts`                 | `ASTVisitor` base, `Precedence` constants, `TargetLanguage` type |
| `src/language/interpreter.ts`             | How AST is executed                                              |
| `src/language/translator.ts`              | Type inference + emitter dispatch                                |
| `src/components/LanguageSelector.tsx`     | `SupportedLang` type (UI-facing)                                 |
| `src/hooks/useCodeParsing.ts`             | Where lexers/parsers are wired to the UI                         |
| `src/utils/editorUtils.ts`                | CodeMirror language extensions                                   |
| `src/components/editor/AddPanelStrip.tsx` | `PANEL_LANGS` array                                              |

## Build & Test

```bash
npm run dev          # Vite dev server → http://localhost:5173/v2/
npm run build        # TypeScript check + production build
npm run test         # Vitest unit tests (tests/*.test.ts)
npx tsc --noEmit     # Type-check only
```

Tests live in `tests/` — one file per language: `python.test.ts`, `java.test.ts`, `csp.test.ts`, `praxis.test.ts`. Do **not** edit `csv/praxly.test.csv`; those are regression tests from the original test suite.

## Common tasks → skill files

- [Adding a new language](.github/skills/add-language.md)
- [Adding a UI feature](.github/skills/add-ui-feature.md)
- [Adding tests for a new feature](.github/skills/add-tests.md)

## Language-specific notes

**CSP pseudocode** (`src/language/csp/`)

- Assignment: `x <- value` or `x ← value` (both valid)
- Relational operators: `=`, `≠`/`<>`, `≤`/`<=`, `≥`/`>=`
- No `ELSE IF` — the spec only defines `IF...ELSE`
- `REPEAT UNTIL(cond)` is a **pre-condition** loop (while not cond); maps to `While(NOT(cond))` in the AST
- `REPEAT n TIMES` is a count-based loop; maps to `For` in the AST

**Praxis pseudocode** (`src/language/praxis/`)

- Assignment: `x = value`
- `repeat...until(cond)` is a **post-condition** loop (do-while not cond); maps to the `RepeatUntil` AST node
- Class members need `public`/`private` access modifiers consumed before each member in the parser
- Indentation-based block delimiters (`end` terminates blocks)

**Python** (`src/language/python/`)

- The lexer converts Python indentation to virtual `{`/`}` tokens so the parser treats it identically to a brace-delimited language

**Java** (`src/language/java/`)

- Type inference in `translator.ts` drives Java output; avoid `Object` fallbacks by using `inferBodyReturnType()` and `resolveFieldTypeFromValue()` in the Java emitter
