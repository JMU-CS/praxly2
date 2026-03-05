# Praxly2 Documentation

Welcome to the Praxly 2.0 codebase. Praxly is an **in-browser compiler and programming language translator** that allows users to:

- Write code in **Python, Java, Praxis, or CSP (pseudocode)** 
- **Instantly translate** code to other supported languages
- **View the Abstract Syntax Tree (AST)** to understand how code is parsed
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
- [Component Overview](#component-overview) - What each part does and where files are
- **[How the Compilation Pipeline Works](./COMPILER_PIPELINE.md)** - Detailed walkthrough of lexing, parsing, interpretation, and translation
- **[Adding a New Language](./ADDING_A_LANGUAGE.md)** - Step-by-step guide with common pitfalls
- **[Common Issues and Solutions](./COMMON_ISSUES.md)** - Troubleshooting and debugging tips
- **[Component Reference](./COMPONENT_REFERENCE.md)** - Detailed documentation of key classes

---

## Core Architecture

Praxly implements a **three-phase compiler pipeline**:

```
Source Code (Python/Java/CSP/Praxis)
           ↓
        LEXER ──→ Tokens
           ↓
        PARSER ──→ Universal AST
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
   - The same AST can be *executed* (running your program)
   - Or *translated* to another language (code generation)

## Design Philosophy

### The Universal AST — The Heart of Praxly

The **single most important concept** in this codebase is the **Universal AST**. This is defined in [src/language/ast.ts](../src/language/ast.ts).

**The key insight:** Regardless of whether you write Python, Java, CSP, or Praxis, your code is parsed into the **exact same AST structure**.

```
Python: x = 10 + 5    ──┐
Java: int x = 10 + 5; ──┼──→ Same Universal AST
CSP: SET x TO 10 + 5  ──┘
```

This design has profound implications:

- **Single Interpreter** — We need only one Interpreter class that walks any AST
- **Single Translator** — We need Emitters that can regenerate any language from the same AST
- **Easy to Add Languages** — New languages only need a Lexer and Parser; Interpreter and Translators are reused

### What This Means in Practice

- The Interpreter doesn't know what language the AST came from
- Emitters (code generators) just need to know how to write their target language
- A bug fix in the interpreter benefits ALL languages
- Type inference for translation happens once, at the AST level

---

## Component Overview

### Directory Structure

```
src/
├── App.tsx                      # Root React app with routing
├── main.tsx                     # Entry point
├── index.css                    # Global styles + Tailwind imports
├─────────────────────────────────────────────────────────────
├── components/                  # Reusable React UI components
│   ├── CodeEditorPanel.tsx      # Left-side editor (CodeMirror)
│   ├── HighlightableCodeMirror.tsx
│   ├── JSONTree.tsx             # Recursive AST viewer
│   ├── LanguageSelector.tsx     # Dropdown for language selection
│   ├── OutputPanel.tsx          # Shows console output + execution results
│   ├── ResizeHandle.tsx         # Draggable column dividers
│   └── TranslationPanel.tsx     # Right panels for translated code
│─────────────────────────────────────────────────────────────
├── hooks/                       # React custom hooks
│   ├── useCodeParsing.ts        # Handles parsing + translation
│   └── useCodeDebugger.ts       # Manages debug state + stepping
│─────────────────────────────────────────────────────────────
├── pages/                       # Route page components
│   ├── EditorPage.tsx           # Main editor IDE (the heart of the UI)
│   ├── LandingPage.tsx          # Info/landing page
│   └── EmbedPage.tsx            # Shareable code embed view
│─────────────────────────────────────────────────────────────
├── language/                    # CORE COMPILER LOGIC
│   ├── ast.ts                   # ⭐ Universal AST node interfaces
│   ├── lexer.ts                 # Base Token types
│   ├── interpreter.ts           # AST interpreter (execution engine)
│   ├── translator.ts            # Main translation orchestrator
│   ├── visitor.ts               # Abstract ASTVisitor base class
│   ├── debugger.ts              # Debugging support
│   │
│   ├── python/                  # Python language support
│   │   ├── lexer.ts            # Tokenizes Python (handles indentation!)
│   │   ├── parser.ts           # Parses tokens → AST (recursive descent)
│   │   └── emitter.ts          # Converts AST → Python code
│   │
│   ├── java/                    # Java language support
│   │   ├── lexer.ts            # Tokenizes Java
│   │   ├── parser.ts           # Parses tokens → AST
│   │   └── emitter.ts          # Converts AST → Java code
│   │
│   ├── csp/                     # CSP (pseudocode) support
│   │   ├── lexer.ts            # Tokenizes CSP
│   │   ├── parser.ts           # Parses tokens → AST
│   │   ├── emitter.ts          # Converts AST → CSP code
│   │   ├── lezer.ts            # Lezer grammar support (for syntax highlighting)
│   │   ├── csp.grammar          # Lezer grammar definition
│   │   └── csp.grammar.js       # Compiled grammar (auto-generated)
│   │
│   └── praxis/                  # Praxis language support
│       ├── lexer.ts            # Tokenizes Praxis
│       ├── parser.ts           # Parses tokens → AST
│       ├── emitter.ts          # Converts AST → Praxis code
│       ├── lezer.ts            # Lezer grammar support
│       ├── praxis.grammar       # Lezer grammar definition
│       └── praxis.grammar.js    # Compiled grammar (auto-generated)
│─────────────────────────────────────────────────────────────
└── utils/                       # Utilities and helpers
    ├── codemirrorConfig.ts      # CodeMirror extensions
    ├── debuggerUtils.ts         # Debugging helper functions
    ├── editorUtils.ts           # Editor-specific utilities
    ├── embedCodec.ts            # URL embedding/sharing logic
    └── sampleCodes.ts           # Default sample code for each language
```

---

## The Compilation Pipeline at a Glance

For more details, see [COMPILER_PIPELINE.md](./COMPILER_PIPELINE.md).

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
  name: 'x'
  value: BinaryExpression {
    left: Literal { value: 10 }
    operator: '+'
    right: Literal { value: 5 }
  }
}
```

Parsers use **Recursive Descent**, which means:
- Each grammar rule is a method
- Methods call each other based on grammar rules
- Solves operator precedence through the call stack

### Phase 3A: Interpretation (Running Code)

The `Interpreter` class walks the AST and executes it:

```typescript
// Execute the Assignment node
this.values['x'] = this.evaluate(rightHandSide)
// Now x = 15, and this.output = ['x is 15'] (if we printed it)
```

The interpreter maintains an `Environment` for variable scoping.

### Phase 3B: Translation (Code Generation)

The `Translator` walks the AST and regenerates code in a target language:

```typescript
// Python AST → Java code emitter
emitter.visitProgram(ast)  // Walk the tree
emitter.getGeneratedCode() // "int x = 10 + 5;"
```

Each language has an **Emitter** (e.g., `PythonEmitter`, `JavaEmitter`) that extends `ASTVisitor` and implements methods for each AST node type.

---

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

For each supported language (Python, Java, CSP, Praxis), there are three files:

- **lexer.ts** — Converts source → tokens
- **parser.ts** — Converts tokens → AST
- **emitter.ts** — Converts AST → target language source code

---

## How to Add a New Language

**See [ADDING_A_LANGUAGE.md](./ADDING_A_LANGUAGE.md) for a complete, step-by-step guide with code examples and common pitfalls.**

Quick summary:

1. Create `src/language/<newlang>/` directory
2. Implement `lexer.ts` (tokenize source code)
3. Implement `parser.ts` (build Universal AST)
4. Implement `emitter.ts` (generate code from AST)
5. Update `src/language/translator.ts` to register your language
6. Update `src/pages/EditorPage.tsx` to expose it in the UI
7. Update hooks to integrate parsing/translation

---

## Troubleshooting

**See [COMMON_ISSUES.md](./COMMON_ISSUES.md) for detailed solutions to:**

- Parse errors and how to debug them
- Type mismatches in translation
- Scoping and variable issues
- OOP (classes/methods) problems
- Missing or incorrect emitter methods

---

## Further Reading

- [COMPILER_PIPELINE.md](./COMPILER_PIPELINE.md) — Detailed walkthrough of how code flows through the system
- [ADDING_A_LANGUAGE.md](./ADDING_A_LANGUAGE.md) — Complete guide to adding language #5
- [COMMON_ISSUES.md](./COMMON_ISSUES.md) — Solutions to common problems
- [COMPONENT_REFERENCE.md](./COMPONENT_REFERENCE.md) — Detailed API reference for key classes
