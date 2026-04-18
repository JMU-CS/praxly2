# The Praxly Compilation Pipeline

This document provides a detailed, step-by-step walkthrough of how source code flows through the Praxly compiler system, with concrete examples.

## Table of Contents

1. [Overview](#overview)
2. [Phase 1: Lexical Analysis (Tokenization)](#phase-1-lexical-analysis)
3. [Phase 2: Syntactic Analysis (Parsing)](#phase-2-syntactic-analysis)
4. [Phase 3A: Interpretation (Execution)](#phase-3a-interpretation)
5. [Phase 3B: Translation (Code Generation)](#phase-3b-translation)
6. [Data Flow Example](#data-flow-example)

---

## Overview

The compilation pipeline consists of **three main phases** applied in sequence:

```
Source Code
    ↓
[PHASE 1] LEXING
    ↓
  TOKENS
    ↓
[PHASE 2] PARSING
    ↓
 UNIVERSAL AST
    ↓
    ├─→ [PHASE 3A] INTERPRETATION ──→ Output (console.log, return values)
    └─→ [PHASE 3B] TRANSLATION ──────→ Translated Code (any language)
```

The key insight is that **Phase 2 produces a Universal AST** that is completely language-agnostic. Phases 3A and 3B don't know or care which language produced the AST.

---

## Phase 1: Lexical Analysis

### What It Does

The **Lexer** converts raw source code (a string) into a stream of meaningful **Tokens**. It scans the source character-by-character and groups characters into semantic units.

### Example

**Input (Python code):**

```python
x = 10 + 5
print(x)
```

**Output (Token stream):**

```
Token { type: 'IDENTIFIER', value: 'x', start: 0 }
Token { type: 'OPERATOR', value: '=', start: 2 }
Token { type: 'NUMBER', value: '10', start: 4 }
Token { type: 'OPERATOR', value: '+', start: 7 }
Token { type: 'NUMBER', value: '5', start: 9 }
Token { type: 'PUNCTUATION', value: ';', start: 10 }  (virtual semicolon)
Token { type: 'KEYWORD', value: 'print', start: 11 }
Token { type: 'PUNCTUATION', value: '(', start: 16 }
Token { type: 'IDENTIFIER', value: 'x', start: 17 }
Token { type: 'PUNCTUATION', value: ')', start: 18 }
Token { type: 'PUNCTUATION', value: ';', start: 19 }  (virtual semicolon)
Token { type: 'EOF', value: '', start: 20 }
```

Notice the **virtual semicolons** — Python has no semicolons, but the lexer injects them (and virtual braces) to convert Python's indentation-based syntax into a form that the recursive descent parser can handle.

### How Lexers Work (token-by-token)

In [src/language/python/lexer.ts](../../src/language/python/lexer.ts), the lexer uses a position pointer and scans characters:

```typescript
// Simplified pseudocode of the lexer algorithm
while (pos < input.length) {
  char = input[pos];

  // Skip whitespace
  if (isWhitespace(char)) {
    pos++;
  }

  // Match numbers
  else if (isDigit(char)) {
    value = '';
    while (isDigit(input[pos]) || input[pos] == '.') {
      value += input[pos++];
    }
    tokens.push({ type: 'NUMBER', value, start: pos });
  }

  // Match identifiers and keywords
  else if (isLetter(char)) {
    value = '';
    while (isLetterOrDigit(input[pos])) {
      value += input[pos++];
    }
    if (KEYWORDS.includes(value)) {
      tokens.push({ type: 'KEYWORD', value, start: pos });
    } else {
      tokens.push({ type: 'IDENTIFIER', value, start: pos });
    }
  }

  // Match operators
  else if (['+', '-', '*', '/'].includes(char)) {
    tokens.push({ type: 'OPERATOR', value: char, start: pos });
    pos++;
  }

  // ... and so on
}
```

### Key Files

- [src/language/lexer.ts](../../src/language/lexer.ts) — Base `Token` interface
- [src/language/python/lexer.ts](../../src/language/python/lexer.ts) — Python lexer with indentation handling
- [src/language/java/lexer.ts](../../src/language/java/lexer.ts) — Java lexer
- [src/language/csp/lexer.ts](../../src/language/csp/lexer.ts) — CSP (pseudocode) lexer
- [src/language/praxis/lexer.ts](../../src/language/praxis/lexer.ts) — Praxis lexer

### Special Case: Python Indentation

Python uses **indentation to denote scopes**, while Java/C use braces. The Python lexer handles this by:

1. Tracking an `indentStack` (list of indentation levels)
2. When indentation **increases**, it pushes `{` (virtual opening brace)
3. When indentation **decreases**, it pops and pushes `}` (virtual closing braces)
4. After each line, it injects a virtual `;` (semicolon) — unless the line ends with `:` (which precedes a new block)

This transforms:

```python
if x > 5:
    print(x)
    x = x + 1
```

Into tokens that look like:

```
KEYWORD(if) IDENTIFIER(x) OPERATOR(>) NUMBER(5) COLON
PUNCTUATION({) KEYWORD(print) PUNCTUATION(() IDENTIFIER(x) PUNCTUATION()) PUNCTUATION(;)
IDENTIFIER(x) OPERATOR(=) ... PUNCTUATION(;)
PUNCTUATION(})
```

Now the parser can treat it identically to C-style syntax!

---

## Phase 2: Syntactic Analysis

### What It Does

The **Parser** consumes the token stream and verifies that it follows the language's grammar rules. It builds an **Abstract Syntax Tree (AST)** representing the program's structure.

### Structure of the Parser

Each parser uses **Recursive Descent**, which means:

- Each grammar rule is implemented as a method
- Methods call each other recursively
- **Operator precedence** is solved using the call stack (lower-precedence operations call higher-precedence operations)

Example method structure:

```typescript
// From src/language/python/parser.ts (simplified)
parse() → expression()
expression() → assignment()
assignment() → logicalOr()
logicalOr() → logicalAnd()
logicalAnd() → equality()
equality() → comparison()
comparison() → term()
term() → factor()
factor() → unary()
unary() → postfix()
postfix() → primary()  // ← base case: literals, identifiers, parenthesized expressions
```

This hierarchy ensures that `*` and `/` bind tighter than `+` and `-`, which bind tighter than `and`/`or`, etc.

### Example: Parsing an Expression

**Tokens:**

```
IDENTIFIER(x) OPERATOR(=) NUMBER(10) OPERATOR(+) NUMBER(5)
```

**Parser execution (simplified):**

1. `parse()` → finds an assignment
2. `assignment()`:
   - Left-hand side: `x` (identifier)
   - Operator: `=`
   - Right-hand side: call `logicalOr()` → `logicalAnd()` → ... → `term()`
3. `term()` (handles `+`, `-`):
   - Left: `factor()` → `primary()` → `10` (NUMBER token)
   - Operator: `+`
   - Right: `factor()` → `primary()` → `5` (NUMBER token)
   - Returns: `BinaryExpression { left: 10, operator: '+', right: 5 }`
4. `assignment()` returns:
   ```typescript
   Assignment {
     name: 'x'
     value: BinaryExpression {
       left: Literal { value: 10 }
       operator: '+'
       right: Literal { value: 5 }
     }
   }
   ```

### The Helper Methods

All parsers share common utility methods:

```typescript
// Check if current token matches expected type and value
check(type: TokenType, ...values: string[]): boolean

// Like check(), but consumes (advances) the token
match(type: TokenType, ...values: string[]): boolean

// Like match(), but throws if mismatched
consume(type: TokenType, value?: string): Token

// Get current token without consuming
peek(): Token

// Get previous token
previous(): Token

// Advance to next token
advance(): Token

// Are we at the end?
isAtEnd(): boolean
```

### The AST Nodes

The parser builds AST nodes defined in [src/language/ast.ts](../../src/language/ast.ts), such as:

```typescript
// Core node structure
interface ASTNode {
  id: string; // Unique identifier for this node
  type: NodeType; // The specific node type (e.g., 'Assignment')
  loc?: { start: number; end: number }; // Character positions in source
}

// Example: Assignment statement
interface Assignment extends ASTNode {
  type: 'Assignment';
  name: string; // Variable name
  target?: Expression; // For array/object assignment
  value: Expression; // The right-hand side
  varType?: string; // Type annotation (if any)
}

// Example: If statement
interface If extends ASTNode {
  type: 'If';
  condition: Expression;
  thenBranch: Block;
  elseBranch?: Block; // Optional else
}

// Example: Binary operations (arithmetic, logical, etc.)
interface BinaryExpression extends ASTNode {
  type: 'BinaryExpression';
  left: Expression;
  operator: string; // '+', '-', '>', '<', 'and', 'or', etc.
  right: Expression;
}
```

### Key Files

- [src/language/ast.ts](../../src/language/ast.ts) — AST node definitions
- [src/language/python/parser.ts](../../src/language/python/parser.ts) — Python parser (551 lines)
- [src/language/java/parser.ts](../../src/language/java/parser.ts) — Java parser (797 lines)
- [src/language/csp/parser.ts](../../src/language/csp/parser.ts) — CSP parser (445 lines)
- [src/language/praxis/parser.ts](../../src/language/praxis/parser.ts) — Praxis parser

---

## Phase 3A: Interpretation

### What It Does

The **Interpreter** walks the AST node-by-node and executes it. It maintains:

- An `Environment` (variable storage with nested scoping)
- A class registry (for OOP support)
- An output buffer (for `print()` statements)

### How the Interpreter Works

[src/language/interpreter.ts](../../src/language/interpreter.ts) implements a **tree-walking interpreter**:

```typescript
export class Interpreter {
  private globalEnv = new Environment();
  private classes = new Map<string, JavaClass>();
  private output: string[] = [];

  interpret(program: Program): string[] {
    // Phase 1: Register all classes and functions
    for (const stmt of program.body) {
      if (stmt.type === 'ClassDeclaration') {
        this.registerClass(stmt);
      } else if (stmt.type === 'FunctionDeclaration') {
        this.globalEnv.define(stmt.name, stmt);
      }
    }

    // Phase 2: Execute all non-class, non-function statements
    const statements = program.body.filter(
      (stmt) => stmt.type !== 'ClassDeclaration' && stmt.type !== 'FunctionDeclaration'
    );
    this.executeBlock(statements, this.globalEnv);

    // Phase 3: If there's a Main class with main() method, execute it
    if (this.classes.has('Main')) {
      const mainClass = this.classes.get('Main')!;
      const mainMethod = mainClass.getMethod('main');
      if (mainMethod) {
        const mainInstance = new JavaInstance(mainClass);
        mainInstance.callMethod('main', [], this, this.globalEnv);
      }
    }

    return this.output;
  }

  executeStatement(stmt: Statement, env: Environment) {
    switch (stmt.type) {
      case 'Assignment': {
        const value = this.evaluate((stmt as Assignment).value, env);
        env.assign((stmt as Assignment).name, value);
        break;
      }

      case 'Print': {
        const values = (stmt as Print).expressions.map((expr) => String(this.evaluate(expr, env)));
        this.output.push(values.join(' '));
        break;
      }

      case 'If': {
        const condition = this.evaluate((stmt as If).condition, env);
        if (this.isTruthy(condition)) {
          this.executeBlock((stmt as If).thenBranch.body, env);
        } else if ((stmt as If).elseBranch) {
          this.executeBlock((stmt as If).elseBranch.body, env);
        }
        break;
      }

      // ... more cases
    }
  }

  evaluate(expr: Expression, env: Environment): any {
    switch (expr.type) {
      case 'Literal':
        return (expr as Literal).value;

      case 'Identifier': {
        const name = (expr as Identifier).name;
        return env.get(name);
      }

      case 'BinaryExpression': {
        const left = this.evaluate((expr as BinaryExpression).left, env);
        const right = this.evaluate((expr as BinaryExpression).right, env);
        const op = (expr as BinaryExpression).operator;

        switch (op) {
          case '+':
            return left + right;
          case '-':
            return left - right;
          case '*':
            return left * right;
          case '/':
            return left / right;
          case '>':
            return left > right;
          case '<':
            return left < right;
          case '==':
            return left === right;
          case '!=':
            return left !== right;
          case 'and':
            return this.isTruthy(left) && this.isTruthy(right);
          case 'or':
            return this.isTruthy(left) || this.isTruthy(right);
          // ...
        }
      }

      // ... more cases
    }
  }
}
```

### The Environment: Variable Scoping

The `Environment` class manages variable storage with **lexical scoping**:

```typescript
export class Environment {
  public values: Record<string, any> = {};
  public parent?: Environment; // Link to outer scope

  constructor(parent?: Environment) {
    this.parent = parent;
  }

  define(name: string, value: any) {
    this.values[name] = value; // Create in current scope
  }

  assign(name: string, value: any) {
    if (name in this.values) {
      this.values[name] = value; // Update in current scope
    } else if (this.parent) {
      this.parent.assign(name, value); // Update in outer scope
    } else {
      throw new Error(`Undefined variable '${name}'`);
    }
  }

  get(name: string): any {
    if (name in this.values) return this.values[name];
    if (this.parent) return this.parent.get(name);
    throw new Error(`Undefined variable '${name}'`);
  }
}
```

**Example:** When executing a function call:

```typescript
// At global scope: myEnv = Environment (parent: null)
// Values: { x: 10 }

functionCall() {
  // Create new environment for function scope
  const functionEnv = new Environment(myEnv);  // parent: myEnv
  // Can access x through parent, but new variables are local
  functionEnv.define('y', 20);
  // functionEnv.values = { y: 20 }
  // functionEnv.parent.values = { x: 10 }
}
```

### OOP Support: Classes and Instances

For Object-Oriented features, the interpreter has lightweight implementations:

```typescript
class JavaClass {
  name: string;
  methods: Map<string, MethodDeclaration> = new Map();
  fields: Map<string, any> = new Map();
  superClass?: JavaClass;

  addMethod(method: MethodDeclaration) {
    this.methods.set(method.name, method);
  }
}

class JavaInstance {
  klass: JavaClass;
  fields: Map<string, any> = new Map();

  getField(name: string): any {
    if (this.fields.has(name)) return this.fields.get(name);
    if (this.klass.fields.has(name)) return this.klass.fields.get(name);
    throw new Error(`Undefined field '${name}'`);
  }

  setField(name: string, value: any) {
    this.fields.set(name, value);
  }

  callMethod(methodName: string, args: any[], interpreter: Interpreter, env: Environment): any {
    const method = this.klass.getMethod(methodName);
    const methodEnv = new Environment(env);

    methodEnv.define('this', this); // Bind 'this'
    methodEnv.define('self', this); // Python compatibility

    // Bind parameters
    method.params.forEach((param, i) => {
      methodEnv.define(param.name, args[i] || null);
    });

    interpreter.executeBlock(method.body.body, methodEnv);
    return null;
  }
}
```

### Key Files

- [src/language/interpreter.ts](../../src/language/interpreter.ts) — Main interpreter class

---

## Phase 3B: Translation

### What It Does

The **Translator** consumes the universal AST and generates equivalent source code in a target language. This is done using the **Visitor Pattern**.

### The Visitor Pattern

The `ASTVisitor` base class ([src/language/visitor.ts](../../src/language/visitor.ts)) defines abstract methods for each node type:

```typescript
export abstract class ASTVisitor {
  protected code: string = '';
  protected indentLevel: number = 0;

  // Abstract methods that subclasses must implement
  abstract visitProgram(program: Program): void;
  abstract visitAssignment(assignment: Assignment): void;
  abstract visitPrint(print: Print): void;
  abstract visitIf(ifStmt: If): void;
  abstract visitWhile(whileStmt: While): void;
  abstract visitFunctionDeclaration(func: FunctionDeclaration): void;
  // ... etc

  // Helper methods
  protected emit(line: string): void {
    this.code += ' '.repeat(this.indentLevel * 2) + line + '\n';
  }

  protected indent(): void {
    this.indentLevel++;
  }

  protected dedent(): void {
    this.indentLevel--;
  }

  getGeneratedCode(): string {
    return this.code;
  }
}
```

Each language has an **Emitter** that extends `ASTVisitor` and implements these methods:

### Example: Python Emitter

[src/language/python/emitter.ts](../../src/language/python/emitter.ts):

```typescript
export class PythonEmitter extends ASTVisitor {
  visitProgram(program: Program): void {
    // Emit classes first
    const classes = program.body.filter((s) => s.type === 'ClassDeclaration');
    classes.forEach((classDecl) => {
      this.visitClassDeclaration(classDecl as ClassDeclaration);
      this.emit('');
    });

    // Then functions and main code
    const nonClasses = program.body.filter((s) => s.type !== 'ClassDeclaration');
    const functions = nonClasses.filter((s) => s.type === 'FunctionDeclaration');
    functions.forEach((func) => {
      this.visitStatement(func);
      this.emit('');
    });

    const mainBody = nonClasses.filter((s) => s.type !== 'FunctionDeclaration');
    mainBody.forEach((stmt) => this.visitStatement(stmt));
  }

  visitAssignment(assignment: Assignment): void {
    const value = this.generateExpression(assignment.value, 0);
    this.emit(`${assignment.name} = ${value}`, assignment.id);
  }

  visitIf(ifStmt: If): void {
    const condition = this.generateExpression(ifStmt.condition, 0);
    this.emit(`if ${condition}:`);
    this.indent();
    this.visitBlock(ifStmt.thenBranch);
    this.dedent();

    if (ifStmt.elseBranch) {
      this.emit('else:');
      this.indent();
      this.visitBlock(ifStmt.elseBranch);
      this.dedent();
    }
  }

  visitPrint(print: Print): void {
    const args = print.expressions.map((e) => this.generateExpression(e, 0)).join(', ');
    this.emit(`print(${args})`, print.id);
  }

  // ... etc
}
```

### Example: Java Emitter

[src/language/java/emitter.ts](../../src/language/java/emitter.ts) works similarly but generates Java syntax:

```typescript
export class JavaEmitter extends ASTVisitor {
  visitAssignment(assignment: Assignment): void {
    const type = this.context.symbolTable.get(assignment.name) || 'int';
    const value = this.generateExpression(assignment.value, 0);

    // Java declarations need type information
    this.emit(`${type} ${assignment.name} = ${value};`, assignment.id);
  }

  visitIf(ifStmt: If): void {
    const condition = this.generateExpression(ifStmt.condition, 0);
    this.emit(`if (${condition}) {`);
    this.indent();
    this.visitBlock(ifStmt.thenBranch);
    this.dedent();

    if (ifStmt.elseBranch) {
      this.emit('} else {');
      this.indent();
      this.visitBlock(ifStmt.elseBranch);
      this.dedent();
    }
    this.emit('}');
  }

  // ... etc
}
```

### Type Inference for Translation

Before translation, the `Translator` runs an analysis pass ([src/language/translator.ts](../../src/language/translator.ts)) to infer types:

```typescript
private analyze(program: Program): TranslationContext {
  const context: TranslationContext = {
    symbolTable: new SymbolTable(),
    functionReturnTypes: new Map(),
    functionParamTypes: new Map()
  };

  const inferType = (expr: Expression): string => {
    switch (expr.type) {
      case 'Literal':
        if (typeof expr.value === 'boolean') return 'boolean';
        if (typeof expr.value === 'string') return 'String';
        if (typeof expr.value === 'number') {
          return expr.raw?.includes('.') ? 'double' : 'int';
        }
        return 'Object';

      case 'Identifier':
        return context.symbolTable.get(expr.name) || 'var';

      case 'BinaryExpression':
        if (['>', '<', '==', '!='].includes(expr.operator)) return 'boolean';
        const left = inferType(expr.left);
        return left === 'double' ? 'double' : 'int';

      case 'ArrayLiteral':
        if (expr.elements?.length > 0) {
          return inferType(expr.elements[0]) + '[]';
        }
        return 'Object[]';

      // ... more cases
    }
  };

  const analyzeBlock = (statements: Statement[]) => {
    statements.forEach(stmt => {
      if (stmt.type === 'Assignment') {
        const type = inferType(stmt.value);
        if (type !== 'var') {
          context.symbolTable.set(stmt.name, type);  // Remember types
        }
      }
      // ... recurse into blocks
    });
  };

  analyzeBlock(program.body);
  return context;
}
```

This is essential for translating from **dynamically-typed languages (Python) to statically-typed languages (Java)**. When generating Java code, we need to know what types to use.

### Key Files

- [src/language/translator.ts](../../src/language/translator.ts) — Main translator orchestrator
- [src/language/visitor.ts](../../src/language/visitor.ts) — Abstract ASTVisitor base class
- [src/language/python/emitter.ts](../../src/language/python/emitter.ts) — Python code generator (369 lines)
- [src/language/java/emitter.ts](../../src/language/java/emitter.ts) — Java code generator
- [src/language/csp/emitter.ts](../../src/language/csp/emitter.ts) — CSP code generator
- [src/language/praxis/emitter.ts](../../src/language/praxis/emitter.ts) — Praxis code generator

---

## Data Flow Example

Let's trace a complete example: **Execute Python code, then translate to Java**

### Input Code (Python)

```python
def greet(name):
    print("Hello, " + name)

greet("World")
```

### Step 1: Lexing

Python Lexer tokenizes:

```
KEYWORD(def) IDENTIFIER(greet) PUNCTUATION(() IDENTIFIER(name) PUNCTUATION()) PUNCTUATION(:) PUNCTUATION({)
KEYWORD(print) PUNCTUATION(() STRING(Hello, ) OPERATOR(+) IDENTIFIER(name) PUNCTUATION()) PUNCTUATION(;) PUNCTUATION(})
IDENTIFIER(greet) PUNCTUATION(() STRING(World) PUNCTUATION()) PUNCTUATION(;)
EOF
```

(Note: `{`, `}`, and `;` are virtual tokens injected by the Python lexer.)

### Step 2: Parsing

Parser builds AST:

```
Program {
  body: [
    FunctionDeclaration {
      name: 'greet'
      params: [Parameter { name: 'name' }]
      body: Block {
        body: [
          Print {
            expressions: [
              BinaryExpression {
                left: Literal { value: 'Hello, ' }
                operator: '+'
                right: Identifier { name: 'name' }
              }
            ]
          }
        ]
      }
    },
    ExpressionStatement {
      expression: CallExpression {
        callee: Identifier { name: 'greet' }
        arguments: [Literal { value: 'World' }]
      }
    }
  ]
}
```

### Step 3A: Interpretation

Interpreter executes:

```
1. Register function 'greet' in globalEnv
2. Execute CallExpression: greet("World")
   a. Create new environment with parent = globalEnv
   b. Bind parameter: name = "World"
   c. Execute function body:
      - Evaluate BinaryExpression: "Hello, " + "World" = "Hello, World"
      - Print "Hello, World"
   d. Return
3. Output: ["Hello, World"]
```

### Step 3B: Translation to Java

Translator:

1. Analyzes AST:
   - `name` is used as a String
   - Function `greet` takes a String parameter

2. Selects JavaEmitter and visits program:

```typescript
// JavaEmitter
visitFunctionDeclaration(func) {
  // function greet(name) → void greet(String name)
  emit("void greet(String name) {");  // infer String from usage
  indent();
  visitBlock(func.body);
  dedent();
  emit("}");
}

visitExpressionStatement(stmt) {
  // greet("World") → greet("World");
  const expr = generateExpression(stmt.expression, ...);
  emit(expr + ";");
}
```

3. Output:

```java
void greet(String name) {
    System.out.println("Hello, " + name);
}

greet("World");
```

---

## Connecting to the React UI

The pipeline is integrated into the React UI via hooks:

### [src/hooks/useCodeParsing.ts](../../src/hooks/useCodeParsing.ts)

```typescript
export const useCodeParsing = () => {
  const parseCode = useCallback((lang: SupportedLang, input: string): Program | null => {
    // Step 1 + 2: Lex + Parse
    let tokens, parser;
    switch (lang) {
      case 'java':
        tokens = new JavaLexer(input).tokenize();
        parser = new JavaParser(tokens);
        return parser.parse();
      case 'python':
      default:
        tokens = new PythonLexer(input).tokenize();
        parser = new PythonParser(tokens);
        return parser.parse();
    }
  }, []);

  const getTranslation = useCallback((ast: Program | null, target: SupportedLang) => {
    // Step 3B: Translate
    const translator = new Translator();
    return translator.translateWithMap(ast, target);
  }, []);

  return { parseCode, getTranslation };
};
```

### [src/pages/EditorPage.tsx](../../src/pages/EditorPage.tsx) snippet

```typescript
export default function EditorPage() {
  const [code, setCode] = useState(SAMPLE_CODE_PYTHON);
  const [ast, setAst] = useState<Program | null>(null);
  const [output, setOutput] = useState<string[]>([]);

  const { parseCode, getTranslation } = useCodeParsing();

  const { debuggerInstance, initDebugger } = useCodeDebugger(getTranslation);

  // On code change: parse, translate, and interpret
  useEffect(() => {
    try {
      const parsed = parseCode(sourceLang, code); // Lex + Parse
      setAst(parsed);

      const interpreter = new Interpreter();
      const result = interpreter.interpret(parsed); // Step 3A
      setOutput(result);

      // Update all open translation panels
      panels.forEach((panel) => {
        const { code } = getTranslation(parsed, panel.lang); // Step 3B
        // Display code in panel
      });
    } catch (e) {
      setError(e.message);
    }
  }, [code, sourceLang]);

  // Etc.
}
```

---

## Summary

The pipeline is a classic three-phase compilation system:

1. **Lexing** → Raw text → Tokens (language-specific)
2. **Parsing** → Tokens → Universal AST (language-specific parsers, single AST format)
3. **Interpretation & Translation** → AST → Execution or code in any target language (language-agnostic)

The universal AST is the key enabler — it decouples language-specific syntax from language-agnostic execution/translation logic.
