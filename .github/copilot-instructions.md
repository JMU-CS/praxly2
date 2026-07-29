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

CSP and Praxis additionally have Lezer grammar files (`.grammar` → auto-compiled `.grammar.js`) and `lezer.ts` for CodeMirror syntax highlighting. Java, Python, and JavaScript use hand-written lexers only. Blocks (`src/language/blocks/`) is the exception to the 3-file pattern — its "source text" is Blockly workspace JSON, so it has `fromAst.ts`/`toAst.ts` (AST ⇄ Blockly conversion), `blockDefs.ts`, `blocklyDialogs.ts`, and `serialization.ts` instead of lexer/parser/emitter, and `Translator.translateWithMap()` special-cases it before the emitter switch.

When adding a new language, use the [`add-language` skill](../.claude/skills/add-language/SKILL.md) and [docs/ADDING_A_LANGUAGE.md](../docs/ADDING_A_LANGUAGE.md).

## Frontend architecture

Three routes, each a thin composition layer over hooks:

| Page                    | Route         | Owns                                                                      |
| ----------------------- | ------------- | ------------------------------------------------------------------------- |
| `pages/EditorPage.tsx`  | `/v2/editor`  | Wires hooks to panes; holds only source text, language, and panel toggles |
| `pages/EmbedPage.tsx`   | `/v2/embed`   | Layout switch between the simple and `?to=` translation layouts           |
| `pages/AccountPage.tsx` | `/v2/account` | Nav + section switch                                                      |

All other paths redirect to `/v2/editor`; there is no separate landing route.

**Behaviour lives in `src/hooks/`, not in the pages.** The important ones:
`useCodeParsing` (text → AST → translation), `useCodeDebugger` (step-through),
`useProgramRunner` (plain run that pauses on `input()` and resumes — shared by
the editor and the embed player), `useEditorExecution` / `useEmbedExecution`
(per-page orchestration), `useEditorLayout` (pane widths and every resize drag),
`useTranslationPanels` (which panels are open, columns, drag-and-drop),
`useEditorSession` (localStorage persistence).

**Pure transforms live in `src/utils/`** so they are unit-testable without a DOM:
`panelLayout.ts` (column/stacking rules), `languageSwitch.ts` (can this program
survive a language change?), `aiPanelContext.ts`, `debugHandlers.ts`.

Panes live under `src/components/{editor,embed,account,ai}/`. For anything
UI-side, use the [`add-ui-feature` skill](../.claude/skills/add-ui-feature/SKILL.md).

## Language specs & demos

- [`specs/`](../specs/) is the **authority** for each language's supported syntax, semantics,
  and standard library — one file per language (`praxis.md`, `csp.md`, `java.md`,
  `javascript.md`, `python.md`) plus `stdlib.md` (shared built-ins mapped across all five
  languages). Read the relevant spec before changing a language's behavior, and update it in the
  same change. Do not restate language rules in this file.
- [`examples/`](../examples/) holds one runnable demo per language (`demo.<lang>`); each
  exercises every AST node its parser can produce and is round-tripped to every target by
  `tests/round-trip.test.ts` (see `examples/README.md`). Demos are surfaced in the UI through
  `src/utils/demoPrograms.ts`.

## Build & Test

```bash
npm run dev          # Vite dev server (http://localhost:5173/v2/)
npm run build        # TypeScript check + Vite production build
npm run test:run     # Vitest unit tests, single run (`npm run test` = watch mode)
npm run test-browser # Selenium csv/ regression suite (requires Chrome)
npx tsc --noEmit     # Type-check only
```

- **Base URL**: `/v2/` (configured in `vite.config.js`)
- `npm run test-browser` is **not** part of `test:run`. Run it after any parser,
  interpreter, or emitter change — it drives the real UI in Chrome.

## Conventions

- **TypeScript strict mode** — `noUnusedLocals`, `noUnusedParameters`, and `verbatimModuleSyntax` enabled; type-only imports must use `import type`.
- **React 19 + Vite 8 + react-router 8** — functional components, hooks only, no class components. Router imports come from `react-router` (not the deprecated `react-router-dom`).
- **State management** — no global store for editor state; page state lives in hooks under `src/hooks/`. Zustand (`src/store/appStore.ts`) is used only for chat sessions, AI preferences, BYOK settings, and the editor bridge.
- **Styling** — Tailwind CSS utility classes. Dark theme (slate-950 background). No CSS modules or styled-components; `style={{}}` only for computed geometry.
- **Recursive descent parsing** — all parsers implement grammar rules as methods with operator precedence encoded in the call hierarchy (lowest precedence = highest in call tree).
- **Error recovery** — parsers use `synchronize()` to skip to the next valid statement after errors.
- **Source mapping** — every AST node has a unique `id` from `generateId()`. Emitters track `nodeId → lineNumber` in `SourceMap` for debugger line highlighting.
- **Python lexer** — converts indentation to virtual `{}`/`;` tokens before parsing, so the parser treats it like a brace-delimited language.
- **Formatting** — Prettier (`npm run prettier:write`); enforced on staged files by lint-staged.

## Testing

- **Unit tests** (`tests/`): One file per language, plus `round-trip.test.ts`, `examples.test.ts`, and cross-cutting files (`control-flow`, `comments`, `blank-lines`, `blocks`, `debugger`, `bugfixes`, `placeholder`, `chatStore`). There is **no DOM environment** — test the compiler pipeline and pure modules directly.
- **API shapes worth memorising**: `tokenize(): Token[]`, `parse(): Program`, `interpret(program, source): string[]` (an array of lines, not a string), `translate(program, target): string`.
- **CSV test matrix** (`csv/praxly.test.csv`): Columns are `Test Name | Program Code | User Input | Expected Output | Expected Error`. Selenium runs each row in a headless browser. **Do not edit this file** — those snippets are the original regression suite.
- Details and patterns: the [`add-tests` skill](../.claude/skills/add-tests/SKILL.md).

## Skills

Task-specific guides live in [`.claude/skills/`](../.claude/skills/) as Claude
skills (`SKILL.md` + frontmatter), listed in [skills/README.md](skills/README.md):
`add-language`, `add-tests`, `add-ui-feature`, `verify`.

## Troubleshooting

See [docs/COMMON_ISSUES.md](../docs/COMMON_ISSUES.md) for diagnosing lexer, parser, interpreter, and emitter problems.

## Component & API Reference

See [docs/COMPONENT_REFERENCE.md](../docs/COMPONENT_REFERENCE.md) for Lexer/Parser/Interpreter/Emitter API contracts and AST node definitions.
