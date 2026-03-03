# Praxly2 Documentation

Welcome to the Praxly 2.0 codebase. Praxly is an educational programming environment designed to bridge the gap between pseudocode and standard programming languages. It allows users to write code in one language (such as Python, Java, Praxis, or CSP) and instantly translate it into another, view the Abstract Syntax Tree (AST), and execute the code entirely within the browser.

This document serves as an architectural overview and onboarding guide for new developers joining the project.

## Architecture Overview

Praxly operates fundamentally as a front-end compiler and interpreter. The application does not rely on a backend server to execute or translate code; all operations are performed safely within the browser using TypeScript.

The core pipeline follows standard compiler design principles:

1. Lexical Analysis (Lexing): Source code (string) is converted into a stream of Tokens.

1. Parsing: The stream of Tokens is analyzed using Recursive Descent parsing and converted into a universal Abstract Syntax Tree (AST).

1. Execution (Interpretation): A tree-walking interpreter traverses the AST to execute the program and capture output.

1. Translation (Code Generation): The universal AST is traversed using the Visitor pattern to generate equivalent source code in a target language.

#### The Universal AST

The most critical concept in this project is the Universal AST (`src/language/ast.ts`). Regardless of whether the user writes Python, Java, CSP, or Praxis, the code is parsed into the exact same underlying AST structure. This design allows the Translator and Interpreter to be completely language-agnostic.

Directory Structure

The project is contained entirely within the `src/` directory.

```
src/
├── App.tsx                 # Root React component and Router setup
├── main.tsx                # Application entry point
├── index.css               # Global styles and Tailwind imports
├── components/             # Reusable React components
│   └── JSONTree.tsx        # Recursive component for visualizing the AST
├── pages/                  # Top-level route components
│   ├── LandingPage.tsx     # Landing page UI (/v2/)
│   └── EditorPage.tsx      # Main IDE and workspace UI (/v2/editor)
└── language/               # Core Compiler, Interpreter, and Translator logic
    ├── ast.ts              # Universal AST node interfaces and types
    ├── lexer.ts            # Base types for Tokens and Lexers
    ├── interpreter.ts      # Tree-walking interpreter for AST execution
    ├── translator.ts       # AST to target-language code generator
    ├── python/             # Python specific Lexer and Parser
    ├── java/               # Java specific Lexer and Parser
    ├── csp/                # CSP (Pseudocode) specific Lexer and Parser
    └── praxis/             # Praxis specific Lexer, Parser, and Lezer grammar
```

## Core Modules Explained

1. Lexers (src/language/*/lexer.ts)

    Each supported language has a dedicated Lexer class. The Lexer takes a raw string of source code and iterates through it character by character, grouping them into semantic Token objects (e.g., KEYWORD, IDENTIFIER, OPERATOR, PUNCTUATION).

    Note on Python: The Python lexer includes logic to handle whitespace/indentation by injecting virtual { and } tokens, allowing the parser to treat it identically to C-style block languages.

2. Parsers (`src/language/*/parser.ts`)

    Each language has a dedicated Parser class. The Parser consumes the array of Tokens produced by the Lexer and constructs the AST.

    The parsers use Recursive Descent, meaning there are specific methods for different grammatical constructs (e.g., `expression()`, `statement()`, `whileStatement()`).

    Operator precedence is handled via the call stack (e.g., `equality()` calls `comparison()`, which calls `term()`, which calls `factor()`).

3. The Interpreter (`src/language/interpreter.ts`)
    - The Interpreter class evaluates the universal AST.
    - Environment: It uses an Environment class to manage variable scoping, storing key-value pairs of variable names to their runtime values. Environments can be nested to support local scopes.
    - OOP Support: The interpreter includes lightweight mock implementations of Classes and Instances (JavaClass, JavaInstance) to support object-oriented execution across languages.

4. The Translator (`src/language/translator.ts`)
    - The Translator class converts the universal AST back into source code.
    - ASTVisitor: It uses an abstract ASTVisitor base class.
    - Emitters: For each supported language, there is a specific Emitter class (e.g., PythonEmitter, JavaEmitter) that extends ASTVisitor.
    - Static Analysis: Before translating, the translator runs a lightweight analysis pass (analyze()) to infer types, build a symbol table, and resolve function return types. This is strictly necessary when translating from a dynamically typed language (like Python) to a statically typed language (like Java).

5. The Editor UI (`src/pages/EditorPage.tsx`)
    - The EditorPage manages the primary application state and IDE layout:

    - CodeMirror: Uses @uiw/react-codemirror for text editing and syntax highlighting.

    - Dynamic Panels: The UI is split into resizable columns. The leftmost column is always the editable Source code. Additional read-only columns can be spawned to show real-time translations or the live AST visualization.

    - State Management: React useState and useEffect hooks trigger re-parsing and re-translating automatically whenever the source code changes.


## How to Run the Project

This project utilizes a standard modern React toolchain using Vite.

1. Install Dependencies: Navigate to the project root and run:
    ```
    npm install
    ```

2. Start the Development Server:
    ```
    npm run dev
    ```

3. Access the Application:

    Open your browser and navigate to the local URL provided in your terminal (typically http://localhost:5173/v2/).

## Onboarding Task: Adding a New Language

If you are tasked with adding a new language (e.g., JavaScript or C++) to Praxly, follow these sequential steps:

1. Create the Directory: Create a new folder at src/language/<new_lang>/.

1. Implement the Lexer: Create lexer.ts in your new directory. It must take a string and return an array of Token objects compatible with the types in src/language/lexer.ts.

1. Implement the Parser: Create parser.ts. It must consume your lexer's tokens and map them strictly to the node types defined in src/language/ast.ts.

1. Implement the Emitter: Open src/language/translator.ts.

1. Add your language to the TargetLanguage type at the top of the file.

1. Create a new class (e.g., CppEmitter) that extends ASTVisitor and implements code generation for all required AST node types.

1. Register your emitter inside the Translator.translate() switch statement.

1. Integrate with the UI:
    - Open `src/pages/EditorPage.tsx`.
    - Add your language to the SupportedLang type.
    - Import a CodeMirror language support package for syntax highlighting in the `getExtensions()` function.
    - Update the UI dropdowns (in the Source header and the "Add Panel" strip) to include your new language.
