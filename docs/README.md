# Praxly2 Documentation

Welcome to the Praxly 2.0 codebase. Praxly is an **in-browser compiler and programming language translator** that allows users to:

- **Write code** in Python, Java, JavaScript, CSP pseudocode, Praxis pseudocode, or Blocks
- **Instantly translate** code to other supported languages
- **View the Abstract Syntax Tree** (AST) to understand how code is parsed
- **Execute code** safely entirely within the browser
- **Debug code** with variable inspection and step-through execution

All of this happens **without a backend server** — everything is compiled and executed in TypeScript in your browser.

## Quick Start

1. Install Dependencies:

   ```bash
   npm install
   ```

2. Start the Development Server:

   ```bash
   npm run dev
   ```

3. Open your browser to the URL provided (typically `http://localhost:5173/v2/`)

## Table of Contents

- [Core Architecture](#core-architecture) - High-level overview
- [Design Philosophy](#design-philosophy) - Key concepts and the Universal AST
- [Component Overview](#component-overview) - What each part does and where files are, including the full directory structure
- [The Compilation Pipeline at a Glance](#the-compilation-pipeline-at-a-glance) - Lexing, parsing, interpretation, and translation phases
- [Key Files Deep Dive](#key-files-deep-dive) - What `ast.ts`, `lexer.ts`, `interpreter.ts`, `translator.ts`, and `visitor.ts` do
- [How to Add a New Language](#how-to-add-a-new-language) - Quick summary of the steps
- [Troubleshooting](#troubleshooting) - Where to look when something breaks

## Core Architecture

Praxly implements a **three-phase compiler pipeline**:

```
Source Code (Python/Java/JavaScript/CSP/Praxis/Blocks)
           ↓
        LEXER → Tokens
           ↓
        PARSER → Universal AST
           ↓
    ┌─────┴─────────────────────┬─────────────────────┐
    ↓                           ↓                     ↓
 INTERPRETER             TRANSLATOR            AST VIEWER
  (Execute)            (Code Generation)     (Visualization)
    ↓                           ↓                     ↓
  Output             Translated Code (any language)  JSON
```

### The Three Pillars

1. **Lexical Analysis (Lexing)** — Source code → Tokens
   - Converts raw source code into a meaningful stream of tokens
   - Each token has a type (KEYWORD, IDENTIFIER, OPERATOR, etc.) and a value

2. **Syntactic Analysis (Parsing)** — Tokens → Abstract Syntax Tree (AST)
   - Verifies that tokens follow valid grammar rules
   - Builds a tree structure representing the program's structure

3. **Interpretation & Translation** — AST → Execution or Code
   - The same AST can be _executed_ (running your program)
   - Or _translated_ to another language (code generation)

## Design Philosophy

### The Universal AST — The Heart of Praxly

The **single most important concept** in this codebase is the **Universal AST**. This is defined in [src/language/ast.ts](../src/language/ast.ts).
See [AST_REFERENCE.md](AST_REFERENCE.md) for a reference of all the node types.

**The key insight:** Regardless of whether you write Python, Java, JavaScript, CSP, Praxis, or Blocks, your code is parsed into the **exact same AST structure**.

```
Python: x = 10 + 5    ──┐
Java:   int x = 10 + 5; ┼──→ Same Universal AST
CSP:    x ← 10 + 5    ──┘
```

(CSP assigns with `←`; `<-` and `⟵` are accepted too. `=` is CSP's _equality_
operator — see [`specs/csp.md`](../specs/csp.md).)

This design has profound implications:

- **Single Interpreter** — We need only one Interpreter class that walks any AST
- **Single Translator** — We need Emitters that can regenerate any language from the same AST
- **Easy to Add Languages** — New languages only need a Lexer and Parser; Interpreter and Translators are reused

### What This Means in Practice

- The Interpreter doesn't know what language the AST came from
- Emitters (code generators) just need to know how to write their target language
- A bug fix in the interpreter benefits ALL languages
- Type inference for translation happens once, at the AST level

## Component Overview

See [COMPONENT_REFERENCE.md](COMPONENT_REFERENCE.md) for a detailed API reference for key classes.

### Directory Structure

```
src/
├── App.tsx                      # Root React app with routing
├── main.tsx                     # Entry point
├── index.css                    # Global styles + Tailwind imports
├─────────────────────────────────────────────────────────────
├── components/                  # React UI components
│   ├── ConfirmModal.tsx         # Confirmation dialog
│   ├── HighlightableCodeMirror.tsx # Read-only pane w/ debug line highlighting
│   ├── JSONTree.tsx             # Recursive AST viewer
│   ├── LanguageLogo.tsx         # Per-language icon
│   ├── LanguageSelector.tsx     # SupportedLang + LANG_LABELS (types only)
│   ├── OutputPanel.tsx          # Console output, stdin prompt, debug variables
│   ├── ResizeHandle.tsx         # Draggable column dividers
│   ├── VariableFrames.tsx       # Per-call-frame variable rendering
│   ├── ai/                      # AI chat assistant components
│   ├── account/                 # Account page sections (one file per pane)
│   ├── embed/                   # Embed player panes
│   └── editor/                  # Editor-specific sub-components
│       ├── AddPanelStrip.tsx    # Left rail; PANEL_LANGS lives here
│       ├── AiSidePanel.tsx      # AI assistant side panel
│       ├── AskAiButton.tsx      # Floating highlight-to-chat button
│       ├── BlocklyPane.tsx      # Blocks (Blockly) workspace panel
│       ├── BlocklyPaneLazy.tsx  # Lazy-loaded wrapper for BlocklyPane
│       ├── EditorDialogs.tsx    # The three "discard your code?" confirmations
│       ├── EditorHeader.tsx     # Toolbar, run/debug buttons
│       ├── MemDia.tsx           # Memory diagram visualization
│       ├── SourcePane.tsx       # Source editor pane; SOURCE_OPTIONS lives here
│       ├── TranslationPaneItem.tsx  # A single translation pane
│       ├── TranslationPanelGrid.tsx # Columns, stacking, elastic last column
│       ├── layoutConstants.ts   # Pixel budgets for every pane
│       └── types.ts             # The Panel type
│─────────────────────────────────────────────────────────────
├── hooks/                       # All page behaviour lives here
│   ├── useCodeParsing.ts        # Source text → AST → translation + source map
│   ├── useCodeDebugger.ts       # Step-through debug state machine
│   ├── useProgramRunner.ts      # Plain run that pauses on input() and resumes
│   ├── useEditorExecution.ts    # Editor: parse-on-type, run, debug, console
│   ├── useEmbedExecution.ts     # Embed: the same, without panels
│   ├── useEditorLayout.ts       # Pane widths/heights + every resize drag
│   ├── useTranslationPanels.ts  # Open panels, columns, drag-and-drop
│   ├── useMemDiaPanes.ts        # Per-pane memory diagram height/state
│   ├── useEditorSession.ts      # localStorage persistence
│   ├── useAccountData.ts        # Account profile/usage/chats + status banner
│   └── …                        # menus, shortcuts, AI selection, embed links,
│                                # text size, click-outside, CodeMirror ref
│─────────────────────────────────────────────────────────────
├── pages/                       # Route pages — composition only
│   ├── EditorPage.tsx           # Main editor IDE
│   ├── EmbedPage.tsx            # Shareable code embed view
│   └── AccountPage.tsx          # Account page
│─────────────────────────────────────────────────────────────
├── language/                    # CORE COMPILER LOGIC
│   ├── ast.ts                   # Universal AST node interfaces
│   ├── lexer.ts                 # Base Token types
│   ├── interpreter.ts           # AST interpreter (execution engine)
│   ├── translator.ts            # Main translation orchestrator
│   ├── visitor.ts               # Abstract ASTVisitor base class + Precedence
│   ├── debugger.ts              # Step-through wrapper over the interpreter
│   ├── comments.ts              # Attaches source comments to AST nodes
│   │
│   ├── python/                  # Python language support
│   │   ├── lexer.ts             # Tokenizes Python (handles indentation!)
│   │   ├── parser.ts            # Parses tokens → AST (recursive descent)
│   │   └── emitter.ts           # Converts AST → Python code
│   │
│   ├── java/                    # Java language support
│   │   ├── lexer.ts             # Tokenizes Java
│   │   ├── parser.ts            # Parses tokens → AST
│   │   └── emitter.ts           # Converts AST → Java code
│   │
│   ├── javascript/              # JavaScript language support
│   │   ├── lexer.ts             # Tokenizes JavaScript
│   │   ├── parser.ts            # Parses tokens → AST
│   │   └── emitter.ts           # Converts AST → JavaScript code
│   │
│   ├── csp/                     # CSP (pseudocode) support
│   │   ├── lexer.ts             # Tokenizes CSP
│   │   ├── parser.ts            # Parses tokens → AST
│   │   ├── emitter.ts           # Converts AST → CSP code
│   │   ├── lezer.ts             # Lezer grammar support (for syntax highlighting)
│   │   ├── csp.grammar          # Lezer grammar definition
│   │   └── csp.grammar.js       # Compiled grammar (auto-generated)
│   │
│   ├── praxis/                  # Praxis language support
│   │   ├── lexer.ts             # Tokenizes Praxis
│   │   ├── parser.ts            # Parses tokens → AST
│   │   ├── emitter.ts           # Converts AST → Praxis code
│   │   ├── lezer.ts             # Lezer grammar support
│   │   ├── praxis.grammar       # Lezer grammar definition
│   │   └── praxis.grammar.js    # Compiled grammar (auto-generated)
│   │
│   └── blocks/                  # Blocks (Blockly) support — no lexer/parser;
│       │                        # "source text" is Blockly workspace JSON
│       ├── fromAst.ts           # Universal AST → Blockly workspace
│       ├── toAst.ts             # Blockly workspace → Universal AST
│       ├── blockDefs.ts         # Custom Blockly block definitions
│       ├── blocklyDialogs.ts    # Blockly dialog UI
│       └── serialization.ts     # Workspace JSON serialization
│─────────────────────────────────────────────────────────────
├── store/appStore.ts            # Zustand: chat, AI prefs, BYOK, editor bridge
│                                # (NOT editor state — that lives in hooks/)
├── api/                         # Backend clients: auth, account, chat, llm
│─────────────────────────────────────────────────────────────
└── utils/                       # Helpers; the first four are pure and
    │                            # unit-testable with no DOM
    ├── aiPanelContext.ts        # Builds the AI panel's code context
    ├── codemirrorConfig.ts      # CodeMirror state fields + highlight dispatch
    ├── debuggerUtils.ts         # Source range → line numbers
    ├── debugHandlers.ts         # Source map → per-panel line highlighting
    ├── demoPrograms.ts          # Per-language demos, re-exported from examples/
    ├── editorUtils.ts           # CodeMirror language extension per SupportedLang
    ├── embedCodec.ts            # URL embedding/sharing logic
    ├── id.ts                    # ID generation helpers
    ├── languageSwitch.ts        # Can this program survive a language change?
    ├── panelLayout.ts           # Translation panel column/stacking rules
    └── sampleCodes.ts           # EXAMPLE_PROGRAMS catalog for the Examples menu
```

Outside `src/`: [`specs/`](../specs/) holds the authoritative language
definitions, [`examples/`](../examples/) the per-language demo programs,
[`tests/`](../tests/) the Vitest suites, and [`csv/`](../csv/) the Selenium
regression matrix.

## The Compilation Pipeline at a Glance

For more details, see [COMPILER_PIPELINE.md](COMPILER_PIPELINE.md).

### Phase 1: Lexing

**Input:** Raw source code string (e.g., `"x = 10 + 5"`)
**Output:** Array of Token objects

```typescript
Token { type: 'IDENTIFIER', value: 'x', start: 0 }
Token { type: 'OPERATOR', value: '=', start: 2 }
Token { type: 'NUMBER', value: '10', start: 4 }
Token { type: 'OPERATOR', value: '+', start: 7 }
Token { type: 'NUMBER', value: '5', start: 9 }
Token { type: 'EOF', value: '', start: 10 }
```

**Key challenge with Python:** Indentation matters! The Python lexer injects virtual `{` and `}` tokens to represent scope blocks, allowing the parser to treat Python like C-style languages.

### Phase 2: Parsing

**Input:** Array of tokens
**Output:** Abstract Syntax Tree (AST)

The parser verifies tokens follow valid grammar and builds a tree:

```
Assignment {
  target: Identifier { name: 'x' }
  value: BinaryExpression {
    left: Literal { value: 10, raw: '10' }
    operator: '+'
    right: Literal { value: 5, raw: '5' }
  }
}
```

`target` is an expression, not a name — that is what lets `arr[i] = x` and
`obj.field = x` reuse the same node with an `IndexExpression`/`MemberExpression`
target.

Parsers use **Recursive Descent**, which means:

- Each grammar rule is a method
- Methods call each other based on grammar rules
- Solves operator precedence through the call stack

### Phase 3A: Interpretation (Running Code)

The `Interpreter` class walks the AST and executes it:

```typescript
// Execute the Assignment node
env.define('x', this.evaluate(stmt.value, env));
// Now x = 15, and getOutput() === ['x is 15'] (if we printed it)
```

The interpreter maintains an `Environment` for variable scoping — a chain of
`values` records, each linked to its parent, so `get()` walks outward until it
finds the name. `interpret()` returns the collected output as `string[]`, one
entry per line.

### Phase 3B: Translation (Code Generation)

The `Translator` walks the AST and regenerates code in a target language:

```typescript
// Python AST → Java code emitter
emitter.visitProgram(ast); // Walk the tree
emitter.getGeneratedCode(); // "int x = 10 + 5;"
```

Each language has an **Emitter** (e.g., `PythonEmitter`, `JavaEmitter`) that extends `ASTVisitor` and implements methods for each AST node type.

## Key Files Deep Dive

### [src/language/ast.ts](../src/language/ast.ts) — The Universal AST Definition

This file defines **every node type** the AST can have. Examples:

- `Program` — The root, contains a list of statements
- `Assignment` — Variable assignment (e.g., `x = 5`)
- `If` — Conditional (e.g., `if (x > 5) { ... }`)
- `While` — Loop (e.g., `while (true) { ... }`)
- `FunctionDeclaration` — Function definition
- `ClassDeclaration` — Class definition
- `BinaryExpression` — Two operands with an operator (e.g., `a + b`)
- `CallExpression` — Function call (e.g., `print(x)`)

**Important:** New node types must be added here first before any parser can generate them.

### [src/language/lexer.ts](../src/language/lexer.ts) — Base Token Types

Defines base types that all lexers must follow:

```typescript
type TokenType = 'KEYWORD' | 'IDENTIFIER' | 'NUMBER' | 'STRING' |
                 'OPERATOR' | 'PUNCTUATION' | 'EOF' | ...

interface Token {
  type: TokenType;
  value: string;    // The actual text (e.g., "if", "123", "+")
  start: number;    // Character position in source
}
```

### [src/language/interpreter.ts](../src/language/interpreter.ts) — Code Execution

Walks the AST and executes it. Key classes:

- `Environment` — Manages variable scopes in nested environments
- `JavaClass` / `JavaInstance` — Lightweight OOP support
- `Interpreter` — Walks the AST and executes statements/expressions

### [src/language/translator.ts](../src/language/translator.ts) — Code Generation

Orchestrates translation to any target language. It:

1. Analyzes the AST to infer types (needed for dynamic → static translations)
2. Selects the appropriate Emitter (e.g., `PythonEmitter` for Python)
3. Calls `emitter.visitProgram(ast)` to generate code

### [src/language/visitor.ts](../src/language/visitor.ts) — The Visitor Pattern

Defines the abstract `ASTVisitor` base class. All Emitters extend this and implement methods like:

- `visitProgram()`
- `visitAssignment()`
- `visitIf()`
- `visitFunctionDeclaration()`
- etc.

### Language-Specific Files

For each text-based supported language (Python, Java, JavaScript, CSP, Praxis), there are three files:

- **lexer.ts** — Converts source → tokens
- **parser.ts** — Converts tokens → AST
- **emitter.ts** — Converts AST → target language source code

Blocks is the exception: its "source text" is Blockly workspace JSON, so it has `fromAst.ts`/`toAst.ts` (AST ⇄ Blockly conversion) instead of a lexer/parser.

## How to Add a New Language

See [ADDING_A_LANGUAGE.md](ADDING_A_LANGUAGE.md) for a complete, step-by-step guide with code examples and common pitfalls.

Quick summary:

1. Create `src/language/<newlang>/` directory
2. Implement `lexer.ts` (tokenize source code)
3. Implement `parser.ts` (build Universal AST)
4. Implement `emitter.ts` (generate code from AST)
5. Update `src/language/visitor.ts` (`TargetLanguage` union) and `src/language/translator.ts` to register your language
6. Update `src/hooks/useCodeParsing.ts` to route parsing for the new language
7. Expose it in the UI: `SupportedLang` **and** `LANG_LABELS` in
   `src/components/LanguageSelector.tsx`, `SOURCE_OPTIONS` in
   `src/components/editor/SourcePane.tsx`, `PANEL_LANGS` in
   `src/components/editor/AddPanelStrip.tsx`, and a `case` in
   `getCodeMirrorExtensions()` in `src/utils/editorUtils.ts`
8. Add `examples/demo.<ext>` + `src/utils/demoPrograms.ts`, and `tests/<newlang>.test.ts`

The [`add-language` skill](../.claude/skills/add-language/SKILL.md) has the same
list with the symptom you'll see if you miss each step.

## Troubleshooting

See [COMMON_ISSUES.md](COMMON_ISSUES.md) for detailed solutions to:

- Parse errors and how to debug them
- Type mismatches in translation
- Scoping and variable issues
- OOP (classes/methods) problems
- Missing or incorrect emitter methods
