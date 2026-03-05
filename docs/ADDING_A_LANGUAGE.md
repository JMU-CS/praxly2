# Adding a New Language to Praxly

This guide walks you through adding a new language (e.g., JavaScript, TypeScript, Go, C++) to Praxly. It includes detailed step-by-step instructions, code examples, common pitfalls, and troubleshooting.

## Table of Contents

1. [Before You Start](#before-you-start)
2. [Step 1: Create the Directory](#step-1-create-the-directory)
3. [Step 2: Implement the Lexer](#step-2-implement-the-lexer)
4. [Step 3: Implement the Parser](#step-3-implement-the-parser)
5. [Step 4: Implement the Emitter](#step-4-implement-the-emitter)
6. [Step 5: Register in the Translator](#step-5-register-in-the-translator)
7. [Step 6: Integrate with the UI](#step-6-integrate-with-the-ui)
8. [Step 7: Testing](#step-7-testing)
9. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
10. [File Checklist](#file-checklist)

---

## Before You Start

### Prerequisites

- Understand the [Compilation Pipeline](./COMPILER_PIPELINE.md)
- Be familiar with the [Universal AST](../src/language/ast.ts)
- Have a good understanding of your target language's syntax

### Key Philosophy

Remember: **Your job is NOT to execute code or perform heavy computation**. Your job is to:

1. **Lexer:** Convert source string → Token array
2. **Parser:** Convert Token array → Universal AST
3. **Emitter:** Convert Universal AST → Source code in your language

The **Interpreter** and **Translator** are already implemented and language-agnostic. You're not writing those.

---

## Step 1: Create the Directory

Create a new folder for your language:

```bash
mkdir -p src/language/<newlang>
```

For example, for JavaScript, create:
```bash
mkdir -p src/language/javascript
```

This folder will contain:
- `lexer.ts` — Tokenization logic
- `parser.ts` — Grammar & AST building logic
- `emitter.ts` — Code generation logic

Optional (advanced):
- `lezer.ts` — If using Lezer grammar for syntax highlighting
- `<lang>.grammar` — Lezer grammar file (auto-compiles to `.grammar.js`)

---

## Step 2: Implement the Lexer

### What a Lexer Does

A lexer converts raw source code into a stream of **tokens**. Each token has:

```typescript
interface Token {
  type: TokenType;           // 'KEYWORD', 'IDENTIFIER', 'NUMBER', etc.
  value: string;             // The actual text (e.g., "if", "42", "+")
  start: number;             // Character position in source
}
```

### Example: JavaScript Lexer

Create [src/language/javascript/lexer.ts](../../src/language/javascript/lexer.ts):

```typescript
import type { Token } from '../lexer';

export class JavaScriptLexer {
  private pos = 0;
  private input: string;

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      // Skip whitespace
      if (/\s/.test(char)) {
        this.pos++;
        continue;
      }

      // Comments
      if (char === '/' && this.input[this.pos + 1] === '/') {
        // Skip line comment
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
          this.pos++;
        }
        continue;
      }

      if (char === '/' && this.input[this.pos + 1] === '*') {
        // Skip block comment
        this.pos += 2;
        while (this.pos < this.input.length) {
          if (this.input[this.pos] === '*' && this.input[this.pos + 1] === '/') {
            this.pos += 2;
            break;
          }
          this.pos++;
        }
        continue;
      }

      // Numbers (including floats and scientific notation)
      if (/\d/.test(char)) {
        const start = this.pos;
        let value = '';
        while (this.pos < this.input.length && (/\d/.test(this.input[this.pos]) || this.input[this.pos] === '.')) {
          value += this.input[this.pos++];
        }
        tokens.push({ type: 'NUMBER', value, start });
        continue;
      }

      // Strings (double quotes)
      if (char === '"') {
        const start = this.pos;
        this.pos++; // consume opening quote
        let value = '';
        while (this.pos < this.input.length && this.input[this.pos] !== '"') {
          if (this.input[this.pos] === '\\') {
            value += this.input[this.pos] + this.input[this.pos + 1];
            this.pos += 2;
          } else {
            value += this.input[this.pos++];
          }
        }
        this.pos++; // consume closing quote
        tokens.push({ type: 'STRING', value, start });
        continue;
      }

      // Strings (single quotes)
      if (char === "'") {
        const start = this.pos;
        this.pos++;
        let value = '';
        while (this.pos < this.input.length && this.input[this.pos] !== "'") {
          if (this.input[this.pos] === '\\') {
            value += this.input[this.pos] + this.input[this.pos + 1];
            this.pos += 2;
          } else {
            value += this.input[this.pos++];
          }
        }
        this.pos++;
        tokens.push({ type: 'STRING', value, start });
        continue;
      }

      // Identifiers and keywords
      if (/[a-zA-Z_$]/.test(char)) {
        const start = this.pos;
        let value = '';
        while (this.pos < this.input.length && /[a-zA-Z0-9_$]/.test(this.input[this.pos])) {
          value += this.input[this.pos++];
        }

        const keywords = [
          'function', 'return', 'if', 'else', 'while', 'for', 'do',
          'var', 'let', 'const', 'class', 'new', 'this', 'true', 'false',
          'null', 'undefined', 'switch', 'case', 'default', 'break', 'continue',
          'try', 'catch', 'finally', 'throw'
        ];

        if (value === 'true' || value === 'false') {
          tokens.push({ type: 'BOOLEAN', value, start });
        } else if (keywords.includes(value)) {
          tokens.push({ type: 'KEYWORD', value, start });
        } else {
          tokens.push({ type: 'IDENTIFIER', value, start });
        }
        continue;
      }

      // Multi-character operators
      if (['+', '-', '*', '/', '=', '>', '<', '!', '&', '|', '%', '^'].includes(char)) {
        const start = this.pos;
        const next = this.input[this.pos + 1];

        // Two-character operators
        if (char === '=' && next === '=') {
          tokens.push({ type: 'OPERATOR', value: '==', start });
          this.pos += 2;
          continue;
        }
        if (char === '!' && next === '=') {
          tokens.push({ type: 'OPERATOR', value: '!=', start });
          this.pos += 2;
          continue;
        }
        if (char === '>' && next === '=') {
          tokens.push({ type: 'OPERATOR', value: '>=', start });
          this.pos += 2;
          continue;
        }
        if (char === '<' && next === '=') {
          tokens.push({ type: 'OPERATOR', value: '<=', start });
          this.pos += 2;
          continue;
        }
        if (char === '&' && next === '&') {
          tokens.push({ type: 'OPERATOR', value: '&&', start });
          this.pos += 2;
          continue;
        }
        if (char === '|' && next === '|') {
          tokens.push({ type: 'OPERATOR', value: '||', start });
          this.pos += 2;
          continue;
        }
        if (char === '+' && next === '+') {
          tokens.push({ type: 'OPERATOR', value: '++', start });
          this.pos += 2;
          continue;
        }
        if (char === '-' && next === '-') {
          tokens.push({ type: 'OPERATOR', value: '--', start });
          this.pos += 2;
          continue;
        }
        if (char === '=' && next === '>') {
          tokens.push({ type: 'OPERATOR', value: '=>', start });  // Arrow function
          this.pos += 2;
          continue;
        }

        // Single-character operators
        tokens.push({ type: 'OPERATOR', value: char, start });
        this.pos++;
        continue;
      }

      // Punctuation
      if (['(', ')', '{', '}', '[', ']', ';', ',', '.', ':', '?'].includes(char)) {
        tokens.push({ type: 'PUNCTUATION', value: char, start: this.pos });
        this.pos++;
        continue;
      }

      // Unknown character
      throw new Error(`Unexpected character: '${char}' at position ${this.pos}`);
    }

    tokens.push({ type: 'EOF', value: '', start: this.pos });
    return tokens;
  }
}
```

### Key Points for Your Lexer

1. **Handle all operators relevant to your language** — Java has `>>>`, Python doesn't. C++ has `::`. Be thorough.

2. **Match multi-character operators before single-character** — Check for `==` before checking for `=`.

3. **Handle comments** — Don't emit tokens for comments; skip them entirely.

4. **Match strings correctly** — Handle escape sequences (`\"`, `\\`, etc.).

5. **End with EOF token** — The parser expects a final `EOF` token.

6. **Track start position** — Used for error messages and AST location info.

7. **Throw meaningful errors** — Help developers debug lexing issues.

---

## Step 3: Implement the Parser

### What a Parser Does

A parser takes tokens and builds the Universal AST. It uses **Recursive Descent** parsing.

### Parser Structure

All parsers follow this pattern:

```typescript
export class JavaScriptParser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  // ========== ENTRY POINT ==========
  parse(): Program {
    const body: Statement[] = [];
    while (!this.isAtEnd()) {
      body.push(this.declaration());  // or topLevelDeclaration()
    }
    return { id: generateId(), type: 'Program', body };
  }

  // ========== TOP-LEVEL PARSING ==========
  private declaration(): Statement {
    if (this.check('KEYWORD', 'class')) return this.classDeclaration();
    if (this.check('KEYWORD', 'function')) return this.functionDeclaration();
    if (this.check('KEYWORD', 'var') || this.check('KEYWORD', 'let') || this.check('KEYWORD', 'const')) {
      return this.variableDeclaration();
    }
    return this.statement();
  }

  // ========== STATEMENT PARSING ==========
  private statement(): Statement {
    if (this.match('KEYWORD', 'if')) return this.ifStatement();
    if (this.match('KEYWORD', 'while')) return this.whileStatement();
    if (this.match('KEYWORD', 'for')) return this.forStatement();
    if (this.match('KEYWORD', 'return')) return this.returnStatement();
    if (this.match('KEYWORD', 'break')) return this.breakStatement();
    if (this.match('KEYWORD', 'continue')) return this.continueStatement();
    if (this.match('PUNCTUATION', '{')) return this.block();
    return this.expressionStatement();
  }

  // ========== HELPER METHODS ==========
  private check(type: TokenType, ...values: string[]): boolean {
    if (this.isAtEnd()) return false;
    if (this.peek().type !== type) return false;
    if (values.length === 0) return true;
    return values.includes(this.peek().value);
  }

  private match(type: TokenType, ...values: string[]): boolean {
    if (this.check(type, ...values)) {
      this.advance();
      return true;
    }
    return false;
  }

  private consume(type: TokenType, value?: string): Token {
    if (!this.check(type, value)) {
      throw new Error(
        `Expected ${type} ${value ? `'${value}'` : ''}, got ${this.peek().type} '${this.peek().value}'`
      );
    }
    return this.advance();
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }
}
```

### Example: Expression Parsing (Operator Precedence)

The key to handling operator precedence is to define methods in a hierarchy:

```typescript
private expression(): Expression {
  return this.assignment();
}

private assignment(): Expression {
  let expr = this.logicalOr();

  if (this.match('OPERATOR', '=')) {
    const value = this.assignment();  // Right-associative
    if (expr.type === 'Identifier') {
      return { id: generateId(), type: 'Assignment', name: expr.name, value };
    }
    throw new Error('Invalid assignment target');
  }

  return expr;
}

private logicalOr(): Expression {
  let expr = this.logicalAnd();

  while (this.match('OPERATOR', '||')) {
    const operator = this.previous().value;
    const right = this.logicalAnd();
    expr = { id: generateId(), type: 'BinaryExpression', left: expr, operator: 'or', right };
  }

  return expr;
}

private logicalAnd(): Expression {
  let expr = this.equality();

  while (this.match('OPERATOR', '&&')) {
    const operator = this.previous().value;
    const right = this.equality();
    expr = { id: generateId(), type: 'BinaryExpression', left: expr, operator: 'and', right };
  }

  return expr;
}

private equality(): Expression {
  let expr = this.comparison();

  while (this.match('OPERATOR', '==', '!=')) {
    const operator = this.previous().value;
    const right = this.comparison();
    expr = { id: generateId(), type: 'BinaryExpression', left: expr, operator, right };
  }

  return expr;
}

private comparison(): Expression {
  let expr = this.term();

  while (this.match('OPERATOR', '>', '>=', '<', '<=')) {
    const operator = this.previous().value;
    const right = this.term();
    expr = { id: generateId(), type: 'BinaryExpression', left: expr, operator, right };
  }

  return expr;
}

private term(): Expression {
  let expr = this.factor();

  while (this.match('OPERATOR', '+', '-')) {
    const operator = this.previous().value;
    const right = this.factor();
    expr = { id: generateId(), type: 'BinaryExpression', left: expr, operator, right };
  }

  return expr;
}

private factor(): Expression {
  let expr = this.unary();

  while (this.match('OPERATOR', '*', '/', '%')) {
    const operator = this.previous().value;
    const right = this.unary();
    expr = { id: generateId(), type: 'BinaryExpression', left: expr, operator, right };
  }

  return expr;
}

private unary(): Expression {
  if (this.match('OPERATOR', '!', '-', '+')) {
    const operator = this.previous().value;
    const argument = this.unary();
    return { id: generateId(), type: 'UnaryExpression', operator, argument };
  }

  return this.postfix();
}

private postfix(): Expression {
  let expr = this.primary();

  while (true) {
    if (this.match('PUNCTUATION', '(')) {
      // Function call
      const args: Expression[] = [];
      if (!this.check('PUNCTUATION', ')')) {
        do {
          args.push(this.expression());
        } while (this.match('PUNCTUATION', ','));
      }
      this.consume('PUNCTUATION', ')');
      expr = { id: generateId(), type: 'CallExpression', callee: expr, arguments: args };
    } else if (this.match('PUNCTUATION', '[')) {
      // Array indexing
      const index = this.expression();
      this.consume('PUNCTUATION', ']');
      expr = { id: generateId(), type: 'IndexExpression', object: expr, index };
    } else if (this.match('PUNCTUATION', '.')) {
      // Member access
      const property = this.consume('IDENTIFIER').value;
      expr = {
        id: generateId(),
        type: 'MemberExpression',
        object: expr,
        property: { id: generateId(), type: 'Identifier', name: property }
      };
    } else {
      break;
    }
  }

  return expr;
}

private primary(): Expression {
  if (this.match('BOOLEAN')) {
    return { id: generateId(), type: 'Literal', value: this.previous().value === 'true', raw: this.previous().value };
  }

  if (this.match('NUMBER')) {
    const raw = this.previous().value;
    return { id: generateId(), type: 'Literal', value: parseFloat(raw), raw };
  }

  if (this.match('STRING')) {
    const raw = this.previous().value;
    return { id: generateId(), type: 'Literal', value: raw, raw };
  }

  if (this.match('IDENTIFIER')) {
    return { id: generateId(), type: 'Identifier', name: this.previous().value };
  }

  if (this.match('KEYWORD', 'this')) {
    return { id: generateId(), type: 'ThisExpression' };
  }

  if (this.match('KEYWORD', 'new')) {
    const className = this.consume('IDENTIFIER').value;
    this.consume('PUNCTUATION', '(');
    const args: Expression[] = [];
    if (!this.check('PUNCTUATION', ')')) {
      do {
        args.push(this.expression());
      } while (this.match('PUNCTUATION', ','));
    }
    this.consume('PUNCTUATION', ')');
    return { id: generateId(), type: 'NewExpression', className, arguments: args };
  }

  if (this.match('PUNCTUATION', '(')) {
    const expr = this.expression();
    this.consume('PUNCTUATION', ')');
    return expr;
  }

  throw new Error(`Unexpected token: ${this.peek().type} '${this.peek().value}'`);
}
```

### Important Parsing Concepts

**Recursive Descent:** Each grammar rule is a method that calls other methods based on the grammar. Precedence is determined by **call stack depth**.

**Example:** `2 + 3 * 4` should parse as `2 + (3 * 4)`, not `(2 + 3) * 4`.

In our hierarchy:
- `assignment()` → `logicalOr()` → ... → `term()` → `factor()`

When parsing `2 + 3 * 4`:
1. `assignment()` calls `logicalOr()` ... `term()`
2. `term()` parses `2` via `factor()`
3. Sees `+` (lower precedence), so returns `2` to its caller
4. Back in `term()`, it returns to `assignment()`
5. `assignment()` creates `BinaryExpression { left: 2, operator: '+', right: ... }`
6. For the right side, it calls `logicalOr()` → ... → `term()` → `factor()`
7. `factor()` parses `3`, sees `*`, and continues to parse `3 * 4`
8. Result: `2 + (3 * 4)` ✓

### Building AST Nodes

Always use `generateId()` from `ast.ts` for node IDs:

```typescript
import { type Program, generateId } from '../ast';

const node = {
  id: generateId(),  // ← Required for every AST node
  type: 'Assignment',
  name: 'x',
  value: { ... }
};
```

---

## Step 4: Implement the Emitter

### What an Emitter Does

An emitter takes the universal AST and generates source code in your target language. It extends `ASTVisitor` and implements a `visit*` method for each AST node type.

### Emitter Structure

Create [src/language/javascript/emitter.ts](../../src/language/javascript/emitter.ts):

```typescript
import { ASTVisitor } from '../visitor';
import type { Program, ClassDeclaration, FieldDeclaration, Constructor, MethodDeclaration, Block, Expression } from '../ast';

export class JavaScriptEmitter extends ASTVisitor {
  visitProgram(program: Program): void {
    // Separate classes from other statements
    const classes = program.body.filter(s => s.type === 'ClassDeclaration');
    const nonClasses = program.body.filter(s => s.type !== 'ClassDeclaration');

    // Emit classes first
    classes.forEach(classDecl => {
      this.visitClassDeclaration(classDecl as ClassDeclaration);
      this.emit('');
    });

    // Then functions and statements
    const functions = nonClasses.filter(s => s.type === 'FunctionDeclaration');
    const mainBody = nonClasses.filter(s => s.type !== 'FunctionDeclaration');

    functions.forEach(func => {
      this.visitStatement(func);
      this.emit('');
    });

    mainBody.forEach(stmt => this.visitStatement(stmt));
  }

  visitClassDeclaration(classDecl: ClassDeclaration): void {
    const baseClass = classDecl.superClass ? ` extends ${classDecl.superClass.name}` : '';
    this.emit(`class ${classDecl.name}${baseClass} {`);
    this.indent();

    classDecl.body.forEach(member => {
      if (member.type === 'FieldDeclaration') {
        this.visitFieldDeclaration(member as FieldDeclaration);
      } else if (member.type === 'Constructor') {
        this.visitConstructor(member as Constructor);
      } else if (member.type === 'MethodDeclaration') {
        this.visitMethodDeclaration(member as MethodDeclaration);
      }
      this.emit('');
    });

    this.dedent();
    this.emit('}');
  }

  visitFieldDeclaration(field: FieldDeclaration): void {
    let line = field.name;
    if (field.initializer) {
      line += ` = ${this.generateExpression(field.initializer, 0)}`;
    }
    this.emit(line + ';', field.id);
  }

  visitConstructor(ctor: Constructor): void {
    const classNameFromContext = ''; // You'd need to track this
    // In a real implementation, track the current class name
    const params = ctor.params.map(p => p.name).join(', ');
    this.emit(`constructor(${params}) {`);
    this.indent();
    this.visitBlock(ctor.body);
    this.dedent();
    this.emit('}');
  }

  visitMethodDeclaration(method: MethodDeclaration): void {
    const params = method.params.map(p => p.name).join(', ');
    this.emit(`${method.name}(${params}) {`);
    this.indent();
    this.visitBlock(method.body);
    this.dedent();
    this.emit('}');
  }

  visitBlock(block: Block): void {
    block.body.forEach(stmt => this.visitStatement(stmt));
  }

  visitPrint(stmt: any): void {
    const args = stmt.expressions.map((e: any) => this.generateExpression(e, 0));
    this.emit(`console.log(${args.join(', ')});`, stmt.id);
  }

  visitAssignment(stmt: any): void {
    const value = this.generateExpression(stmt.value, 0);
    this.emit(`let ${stmt.name} = ${value};`, stmt.id);  // 'let' for JavaScript
  }

  visitFunctionDeclaration(func: any): void {
    const params = func.params.map((p: any) => p.name).join(', ');
    this.emit(`function ${func.name}(${params}) {`);
    this.indent();
    this.visitBlock(func.body);
    this.dedent();
    this.emit('}');
  }

  visitReturn(stmt: any): void {
    if (stmt.argument) {
      const value = this.generateExpression(stmt.argument, 0);
      this.emit(`return ${value};`, stmt.id);
    } else {
      this.emit('return;', stmt.id);
    }
  }

  visitIf(stmt: any): void {
    const condition = this.generateExpression(stmt.condition, 0);
    this.emit(`if (${condition}) {`);
    this.indent();
    this.visitBlock(stmt.thenBranch);
    this.dedent();

    if (stmt.elseBranch) {
      this.emit('} else {');
      this.indent();
      this.visitBlock(stmt.elseBranch);
      this.dedent();
    }
    this.emit('}');
  }

  visitWhile(stmt: any): void {
    const condition = this.generateExpression(stmt.condition, 0);
    this.emit(`while (${condition}) {`);
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit('}');
  }

  visitFor(stmt: any): void {
    const init = stmt.init ? this.generateExpression(stmt.init, 0) : '';
    const condition = stmt.condition ? this.generateExpression(stmt.condition, 0) : '';
    const update = stmt.update ? this.generateExpression(stmt.update, 0) : '';
    this.emit(`for (${init}; ${condition}; ${update}) {`);
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit('}');
  }

  visitBreak(stmt: any): void {
    this.emit('break;', stmt.id);
  }

  visitContinue(stmt: any): void {
    this.emit('continue;', stmt.id);
  }

  protected generateExpression(expr: Expression, minPrecedence: number): string {
    // Implement expression generation based on expression type
    switch (expr.type) {
      case 'Literal':
        if (typeof expr.value === 'string') return `"${expr.value}"`;
        return String(expr.value);

      case 'Identifier':
        return (expr as any).name;

      case 'BinaryExpression': {
        const be = expr as any;
        const left = this.generateExpression(be.left, 0);
        const right = this.generateExpression(be.right, 0);
        return `${left} ${be.operator} ${right}`;
      }

      case 'UnaryExpression': {
        const ue = expr as any;
        const arg = this.generateExpression(ue.argument, 0);
        return `${ue.operator}${arg}`;
      }

      case 'CallExpression': {
        const ce = expr as any;
        const callee = this.generateExpression(ce.callee, 0);
        const args = ce.arguments.map((a: any) => this.generateExpression(a, 0)).join(', ');
        return `${callee}(${args})`;
      }

      case 'ArrayLiteral': {
        const al = expr as any;
        const elements = al.elements.map((e: any) => this.generateExpression(e, 0)).join(', ');
        return `[${elements}]`;
      }

      case 'IndexExpression': {
        const ie = expr as any;
        const obj = this.generateExpression(ie.object, 0);
        const idx = this.generateExpression(ie.index, 0);
        return `${obj}[${idx}]`;
      }

      case 'MemberExpression': {
        const me = expr as any;
        const obj = this.generateExpression(me.object, 0);
        const prop = me.property.name;
        return `${obj}.${prop}`;
      }

      case 'NewExpression': {
        const ne = expr as any;
        const args = ne.arguments.map((a: any) => this.generateExpression(a, 0)).join(', ');
        return `new ${ne.className}(${args})`;
      }

      case 'ThisExpression':
        return 'this';

      default:
        return '/* unsupported expression */';
    }
  }
}
```

### Key Points for Emitters

1. **Implement visit methods for all statement types** — `visitAssignment()`, `visitIf()`, `visitWhile()`, `visitFor()`, `visitFunctionDeclaration()`, `visitClassDeclaration()`, etc.

2. **Implement visit methods for all expression types** — Or use a general `generateExpression()` method that switches on expression type.

3. **Use `this.emit()`** — This handles indentation automatically.

4. **Use `this.indent()` and `this.dedent()`** — To manage indentation levels.

5. **Call `getSourceMap()` and `getGeneratedCode()`** — To return results to the caller.

6. **Handle operator precedence** — Different languages may have different precedence, but in most cases you can output expressions as-is since you're copying from a universal AST.

---

## Step 5: Register in the Translator

The `Translator` class orchestrates code generation. You must register your emitter there.

Open [src/language/translator.ts](../../src/language/translator.ts):

### Step 5.1: Add to TargetLanguage type

Find the `TargetLanguage` type (around line 7):

```typescript
// BEFORE
export type TargetLanguage = 'java' | 'python' | 'csp' | 'praxis';

// AFTER
export type TargetLanguage = 'java' | 'python' | 'csp' | 'praxis' | 'javascript';
```

### Step 5.2: Import your emitter

At the top of the file (after other imports):

```typescript
import { JavaScriptEmitter } from './javascript/emitter';
```

### Step 5.3: Register in the switch statement

Find the `translateWithMap()` method (around line 20):

```typescript
translateWithMap(program: Program, targetLang: TargetLanguage): TranslationResult {
  const context = this.analyze(program);

  let emitter: ASTVisitor;
  switch (targetLang) {
    case 'java': emitter = new JavaEmitter(context); break;
    case 'csp': emitter = new CSPEmitter(context); break;
    case 'python': emitter = new PythonEmitter(context); break;
    case 'praxis': emitter = new PraxisEmitter(context); break;
    // ADD THIS:
    case 'javascript': emitter = new JavaScriptEmitter(context); break;
    default: throw new Error(`Unsupported target language: ${targetLang}`);
  }

  emitter.visitProgram(program);
  return {
    code: emitter.getGeneratedCode(),
    sourceMap: emitter.getSourceMap()
  };
}
```

---

## Step 6: Integrate with the UI

### Step 6.1: Update the hook

Open [src/hooks/useCodeParsing.ts](../../src/hooks/useCodeParsing.ts):

Add your language to the `parseCode()` function:

```typescript
const parseCode = useCallback((lang: SupportedLang, input: string): Program | null => {
  if (lang === 'ast') return null;
  try {
    let tokens;
    let parser;
    switch (lang) {
      case 'java':
        tokens = new JavaLexer(input).tokenize();
        parser = new JavaParser(tokens);
        return parser.parse();
      case 'csp':
        tokens = new CSPLexer(input).tokenize();
        parser = new CSPParser(tokens);
        return parser.parse();
      case 'praxis':
        tokens = new PraxisLexer(input).tokenize();
        parser = new PraxisParser(tokens);
        return parser.parse();
      // ADD THIS:
      case 'javascript':
        tokens = new JavaScriptLexer(input).tokenize();
        parser = new JavaScriptParser(tokens);
        return parser.parse();
      case 'python':
      default:
        tokens = new PythonLexer(input).tokenize();
        parser = new PythonParser(tokens);
        return parser.parse();
    }
  } catch (e: any) {
    throw new Error(e.message);
  }
}, []);
```

Also add the imports at the top:

```typescript
import { JavaScriptLexer } from '../language/javascript/lexer';
import { JavaScriptParser } from '../language/javascript/parser';
```

### Step 6.2: Update EditorPage.tsx

Open [src/pages/EditorPage.tsx](../../src/pages/EditorPage.tsx):

Find the `SupportedLang` type (around line 30):

```typescript
// BEFORE
export type SupportedLang = 'python' | 'java' | 'csp' | 'praxis' | 'ast';

// AFTER
export type SupportedLang = 'python' | 'java' | 'csp' | 'praxis' | 'javascript' | 'ast';
```

Then find the language dropdown UI and add your language. Search for where language options are rendered:

```tsx
// In the UI rendering section (around line 200-300)
<select value={sourceLang} onChange={(e) => setSourceLang(e.target.value as SupportedLang)}>
  <option value="python">Python</option>
  <option value="java">Java</option>
  <option value="csp">CSP</option>
  <option value="praxis">Praxis</option>
  {/* ADD THIS: */}
  <option value="javascript">JavaScript</option>
</select>
```

Also find the "Add Panel" menu and add your language there:

```tsx
// Look for the menu that allows adding translation panels
{showAddMenu && (
  <div className="menu">
    <button onClick={() => { addPanel('python'); }}>Python</button>
    <button onClick={() => { addPanel('java'); }}>Java</button>
    <button onClick={() => { addPanel('csp'); }}>CSP</button>
    <button onClick={() => { addPanel('praxis'); }}>Praxis</button>
    {/* ADD THIS: */}
    <button onClick={() => { addPanel('javascript'); }}>JavaScript</button>
  </div>
)}
```

### Step 6.3: (Optional) Add CodeMirror Syntax Highlighting

For better syntax highlighting, install a CodeMirror extension for your language:

```bash
npm install @codemirror/lang-javascript
```

Then update [src/utils/editorUtils.ts](../../src/utils/editorUtils.ts):

```typescript
import { javascript } from '@codemirror/lang-javascript';

export function getCodeMirrorExtensions(lang: SupportedLang) {
  switch (lang) {
    case 'python':
      return [python()];
    case 'java':
      return [java()];
    case 'csp':
      return [];  // No extension available
    case 'praxis':
      return [];  // Custom grammar
    // ADD THIS:
    case 'javascript':
      return [javascript()];
    case 'ast':
      return [];
  }
}
```

---

## Step 7: Testing

### Unit Test Your Lexer

Create [tests/javascript.test.ts](../../tests/javascript.test.ts):

```typescript
import { describe, it, expect } from 'vitest';
import { JavaScriptLexer } from '../src/language/javascript/lexer';
import { JavaScriptParser } from '../src/language/javascript/parser';
import { Interpreter } from '../src/language/interpreter';
import { Translator } from '../src/language/translator';

describe('JavaScript Lexer', () => {
  it('should tokenize basic code', () => {
    const lexer = new JavaScriptLexer('let x = 10;');
    const tokens = lexer.tokenize();
    expect(tokens).toHaveLength(6);  // let, x, =, 10, ;, EOF
    expect(tokens[0].type).toBe('KEYWORD');
    expect(tokens[0].value).toBe('let');
  });

  it('should handle comments', () => {
    const lexer = new JavaScriptLexer('let x = 10; // comment');
    const tokens = lexer.tokenize();
    // Comment should be skipped; tokens should only have let, x, =, 10, ;, EOF
    expect(tokens.some(t => t.value === 'comment')).toBe(false);
  });

  it('should handle multi-char operators', () => {
    const lexer = new JavaScriptLexer('x === y');
    const tokens = lexer.tokenize();
    // Should have ===, not = = =
    expect(tokens[1].value).toBe('===');
  });

  // ... more tests
});

describe('JavaScript Parser', () => {
  it('should parse a function declaration', () => {
    const lexer = new JavaScriptLexer('function add(a, b) { return a + b; }');
    const tokens = lexer.tokenize();
    const parser = new JavaScriptParser(tokens);
    const ast = parser.parse();
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0].type).toBe('FunctionDeclaration');
  });

  // ... more tests
});

describe('JavaScript Integration', () => {
  it('should interpret JavaScript code', () => {
    const code = `
      let x = 10;
      let y = 20;
      print(x + y);
    `;
    const lexer = new JavaScriptLexer(code);
    const tokens = lexer.tokenize();
    const parser = new JavaScriptParser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const output = interpreter.interpret(ast);
    expect(output).toContain('30');
  });

  it('should translate JavaScript to Python', () => {
    const code = `let x = 10; print(x);`;
    const lexer = new JavaScriptLexer(code);
    const tokens = lexer.tokenize();
    const parser = new JavaScriptParser(tokens);
    const ast = parser.parse();
    const translator = new Translator();
    const pythonCode = translator.translate(ast, 'python');
    expect(pythonCode).toContain('x = 10');
    expect(pythonCode).toContain('print');
  });
});
```

Run tests:

```bash
npm test
```

---

## Common Pitfalls & Solutions

### Pitfall 1: Tokens Not Being Generated

**Symptom:** Parser throws "Unexpected token" errors.

**Diagnosis:**
- Check that your lexer is returning all expected token types.
- Use `console.log(tokens)` to inspect the token stream.

**Solution:**
```typescript
const lexer = new JavaScriptLexer('let x = 10;');
const tokens = lexer.tokenize();
console.log(tokens);  // ← Add this temporarily for debugging
```

### Pitfall 2: Wrong Operator Precedence

**Symptom:** `2 + 3 * 4` parses as `(2 + 3) * 4` instead of `2 + (3 * 4)`.

**Diagnosis:**
- Your expression parsing methods are in the wrong order.
- Lower precedence operators should appear higher in the call stack.

**Solution:**
- Verify your method hierarchy: `assignment()` → `logicalOr()` → ... → `factor()`.
- Higher precedence operators should be closer to `primary()`.

### Pitfall 3: Missing Node Type

**Symptom:** Parser builds AST but translator fails with "visit method not implemented".

**Diagnosis:**
- Your parser generated AST nodes that the emitter doesn't know how to handle.

**Solution:**
- Check what AST node types your parser generates.
- Ensure your emitter has a `visit*` method for each node type.
- Use a base fallback:

```typescript
visitStatement(stmt: Statement): void {
  switch (stmt.type) {
    // ... handle all cases
    default:
      throw new Error(`Unsupported statement type: ${stmt.type}`);
  }
}
```

### Pitfall 4: Parser Infinite Loop

**Symptom:** Parser hangs/freezes.

**Diagnosis:**
- A parsing method is not advancing through tokens.
- Usually happens in a `while` loop that doesn't consume tokens.

**Solution:**
```typescript
// BAD: Infinite loop
while (this.check('KEYWORD', 'let')) {
  // Forgot to call this.advance()!
  let val = this.expression();
}

// GOOD:
while (this.match('KEYWORD', 'let')) {  // ← match() calls advance()
  let val = this.expression();
}
```

### Pitfall 5: Indentation Issues

**Symptom:** Emitted code is formatted incorrectly.

**Diagnosis:**
- You forgot to call `this.indent()` or `this.dedent()`.

**Solution:**
```typescript
visitIf(stmt: If): void {
  this.emit(`if (${condition}) {`);
  this.indent();  // ← Don't forget this!
  this.visitBlock(stmt.thenBranch);
  this.dedent();  // ← And this!
  this.emit('}');
}
```

### Pitfall 6: String Escaping

**Symptom:** Strings with quotes cause parse errors.

**Diagnosis:**
- Your lexer doesn't handle escape sequences.

**Solution:**
```typescript
// In lexer, when parsing strings:
if (char === '"') {
  let value = '';
  while (pos < input.length && input[pos] !== '"') {
    if (input[pos] === '\\') {
      // Handle escape sequence
      value += input[pos] + input[pos + 1];
      pos += 2;
    } else {
      value += input[pos++];
    }
  }
}
```

### Pitfall 7: Class Name Not Available in Emitter

**Symptom:** Generating a constructor with the wrong class name.

**Diagnosis:**
- Emitter needs to know which class it's currently emitting.

**Solution:**
```typescript
export class JavaScriptEmitter extends ASTVisitor {
  private currentClassName: string | null = null;

  visitClassDeclaration(classDecl: ClassDeclaration): void {
    this.currentClassName = classDecl.name;
    this.emit(`class ${classDecl.name} {`);
    // ... emit members
    this.currentClassName = null;
  }

  visitConstructor(ctor: Constructor): void {
    const name = this.currentClassName!;
    this.emit(`constructor(...) { ... }`);
  }
}
```

### Pitfall 8: Not Generating IDs for AST Nodes

**Symptom:** Subtle bugs in debugger or highlighting.

**Diagnosis:**
- AST nodes without unique IDs cause issues with source mapping.

**Solution:**
```typescript
// Always generate IDs
import { generateId } from '../ast';

const node = {
  id: generateId(),  // ← Required
  type: 'BinaryExpression',
  left: ...,
  operator: '+',
  right: ...
};
```

---

## File Checklist

Before considering your language "complete," ensure:

- [ ] **Lexer** (`src/language/<lang>/lexer.ts`)
  - [ ] Handles all operators
  - [ ] Handles all keywords
  - [ ] Skips comments correctly
  - [ ] Handles strings with escape sequences
  - [ ] Returns EOF token at end
  - [ ] Throws meaningful errors

- [ ] **Parser** (`src/language/<lang>/parser.ts`)
  - [ ] Has correct operator precedence
  - [ ] Generates all required AST node types
  - [ ] Handles all statement types
  - [ ] Handles all expression types
  - [ ] All AST nodes have unique IDs via `generateId()`

- [ ] **Emitter** (`src/language/<lang>/emitter.ts`)
  - [ ] Handles all statement types
  - [ ] Handles all expression types
  - [ ] Uses proper indentation
  - [ ] Generates executable code

- [ ] **Integration**
  - [ ] Added to `TargetLanguage` type in `translator.ts`
  - [ ] Imported and registered in `translator.ts` switch
  - [ ] Added to `useCodeParsing()` hook with lexer/parser imports
  - [ ] Added to `SupportedLang` type in `EditorPage.tsx`
  - [ ] Added to language dropdown in UI
  - [ ] Added to "Add Panel" menu
  - [ ] (Optional) Added CodeMirror extension in `editorUtils.ts`

- [ ] **Testing**
  - [ ] Unit tests for lexer
  - [ ] Unit tests for parser
  - [ ] Integration tests (lex → parse → interpret)
  - [ ] Translation tests (lex → parse → translate to other languages)

---

## Conclusion

Adding a language to Praxly involves:

1. **Understanding the grammar** of your language
2. **Lexing** (tokenization)
3. **Parsing** (AST generation using recursive descent)
4. **Emitting** (code generation using the Visitor pattern)
5. **Integration** (hooking into the UI and translator)

The hard part is the Lexer and Parser. The Emitter is usually straightforward. Take your time getting the grammar right, and everything else follows naturally.

Good luck! 🚀
