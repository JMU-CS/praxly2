# Component Reference

Detailed API documentation for key classes in the Praxly compiler.

## Table of Contents

1. [Lexer Classes](#lexer-classes)
2. [Parser Classes](#parser-classes)
3. [Interpreter](#interpreter)
4. [Translator & Emitters](#translator--emitters)
5. [AST Nodes](#ast-nodes)
6. [Utilities](#utilities)

---

## Lexer Classes

All lexers inherit from a common pattern defined in [src/language/lexer.ts](../../src/language/lexer.ts).

### Base Token Interface

```typescript
interface Token {
  type: TokenType;
  value: string;
  start: number;
}

type TokenType =
  | 'KEYWORD'
  | 'IDENTIFIER'
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'OPERATOR'
  | 'PUNCTUATION'
  | 'NEWLINE'
  | 'INDENT'
  | 'DEDENT'
  | 'EOF';
```

### Universal Lexer Contract

Every language lexer must:

1. Take a string in the constructor
2. Implement `tokenize(): Token[]`
3. Return a token stream ending with `EOF`

### Example: Python Lexer

**Location:** [src/language/python/lexer.ts](../../src/language/python/lexer.ts)

```typescript
export class Lexer {
  constructor(input: string);
  tokenize(): Token[];
}
```

**Unique Behavior:**

- Injects virtual `{` and `}` tokens to represent indentation
- Injects virtual `;` tokens at end of logical lines
- Handles indentation via `indentStack`

**Usage:**

```typescript
const lexer = new Lexer(pythonCode);
const tokens = lexer.tokenize();
```

### Example: Java Lexer

**Location:** [src/language/java/lexer.ts](../../src/language/java/lexer.ts)

```typescript
export class JavaLexer {
  constructor(input: string);
  tokenize(): Token[];
}
```

**Unique Behavior:**

- Does NOT inject virtual tokens
- Handles multi-character operators: `<<`, `>>`, `>>>`, `<<=`, etc.
- Recognizes Java keywords and their contextual types

---

## Parser Classes

All parsers follow the Recursive Descent pattern. See [COMPILER_PIPELINE.md](./COMPILER_PIPELINE.md) for detailed explanation.

### Universal Parser Contract

Every language parser must:

1. Take tokens array in the constructor
2. Implement `parse(): Program`
3. Return a valid Program AST node

### Common Parser Methods

These methods are used in all recursive descent parsers:

```typescript
private check(type: TokenType, ...values: string[]): boolean
```

Returns true if current token matches type and (optionally) one of the values.

```typescript
private match(type: TokenType, ...values: string[]): boolean
```

Like `check()`, but also advances to next token if it matches.

```typescript
private consume(type: TokenType, value?: string): Token
```

Assert that current token matches, advance, and return it. Throws if no match.

```typescript
private peek(): Token
```

Return current token without consuming.

```typescript
private previous(): Token
```

Return the token we just consumed.

```typescript
private advance(): Token
```

Move to next token and return the previous one.

```typescript
private isAtEnd(): boolean
```

Return true if at EOF.

### Example: Python Parser

**Location:** [src/language/python/parser.ts](../../src/language/python/parser.ts)

```typescript
export class Parser {
  constructor(tokens: Token[]);
  parse(): Program;

  // Top-level parsing
  private topLevelDeclaration(): Statement;
  private classDeclaration(): ClassDeclaration;
  private functionDeclaration(): FunctionDeclaration;

  // Statements
  private statement(): Statement;
  private ifStatement(): If;
  private whileStatement(): While;
  // ... etc

  // Expressions (operator precedence)
  private expression(): Expression;
  private assignment(): Expression;
  private logicalOr(): Expression;
  private logicalAnd(): Expression;
  private equality(): Expression;
  private comparison(): Expression;
  private term(): Expression; // +, -
  private factor(): Expression; // *, /
  private unary(): Expression; // !, -
  private postfix(): Expression; // (), [], .
  private primary(): Expression; // Literals, identifiers

  // Blocks
  private block(): Block;
}
```

**Key Method Patterns:**

Statement parsing:

```typescript
private ifStatement(): If {
  this.consume('KEYWORD', 'if');
  this.consume('PUNCTUATION', '(');
  const condition = this.expression();
  this.consume('PUNCTUATION', ')');
  const thenBranch = this.block();
  let elseBranch: Block | undefined;
  if (this.match('KEYWORD', 'else')) {
    elseBranch = this.block();
  }
  return { id: generateId(), type: 'If', condition, thenBranch, elseBranch };
}
```

Expression parsing with precedence:

```typescript
private term(): Expression {
  let expr = this.factor();

  while (this.match('OPERATOR', '+', '-')) {
    const operator = this.previous().value;
    const right = this.factor();
    expr = {
      id: generateId(),
      type: 'BinaryExpression',
      left: expr,
      operator,
      right
    };
  }

  return expr;
}
```

---

## Interpreter

**Location:** [src/language/interpreter.ts](../../src/language/interpreter.ts)

### Main Interpreter Class

```typescript
export class Interpreter {
  constructor()

  // Execute a complete program
  interpret(program: Program): string[]

  // Debug: step through program with state inspection
  *stepThroughWithState(program: Program): Generator<...>

  // Execute a block of statements
  executeBlock(statements: Statement[], env: Environment): void

  // Execute a single statement
  executeStatement(stmt: Statement, env: Environment): void

  // Evaluate an expression to a value
  evaluate(expr: Expression, env: Environment): any

  // Register a class for OOP support
  private registerClass(classDecl: ClassDeclaration): void
}
```

### Environment Class

Variable scoping with nested environments:

```typescript
export class Environment {
  public values: Record<string, any> = {};
  public parent?: Environment;

  constructor(parent?: Environment);

  // Define a variable in current scope
  define(name: string, value: any): void;

  // Assign to variable (searches parent scopes)
  assign(name: string, value: any): void;

  // Retrieve variable value (searches parent scopes)
  get(name: string): any;

  // Get all variables in all scopes
  getAllVariables(): Record<string, any>;
}
```

**Usage Example:**

```typescript
const globalEnv = new Environment();
globalEnv.define('x', 10);

// Create a new scope for a function
const functionEnv = new Environment(globalEnv);
functionEnv.define('y', 20);

globalEnv.get('x'); // 10
functionEnv.get('x'); // 10 (found in parent)
functionEnv.get('y'); // 20
globalEnv.get('y'); // Error: y not in global scope
```

### OOP Support Classes

```typescript
class JavaClass {
  name: string;
  methods: Map<string, MethodDeclaration>;
  fields: Map<string, any>;
  superClass?: JavaClass;

  addMethod(method: MethodDeclaration): void;
  setConstructor(ctor: Constructor): void;
  getMethod(name: string): MethodDeclaration | undefined;
}

class JavaInstance {
  klass: JavaClass;
  fields: Map<string, any>;

  constructor(klass: JavaClass);
  getField(name: string): any;
  setField(name: string, value: any): void;
  callMethod(methodName: string, args: any[], interpreter: Interpreter, env: Environment): any;
}
```

---

## Translator & Emitters

### Translator Class

**Location:** [src/language/translator.ts](../../src/language/translator.ts)

```typescript
export class Translator {
  // Generate code in target language
  translate(program: Program, targetLang: TargetLanguage): string;

  // Same as above, but also return source map
  translateWithMap(program: Program, targetLang: TargetLanguage): TranslationResult;

  // Analyze AST for type inference and symbol table
  private analyze(program: Program): TranslationContext;
}
```

**TargetLanguage Type:**

```typescript
export type TargetLanguage = 'java' | 'python' | 'csp' | 'praxis';
```

**TranslationResult:**

```typescript
export interface TranslationResult {
  code: string; // Generated source code
  sourceMap: Map<string, number>; // AST Node ID → Line number
}
```

### ASTVisitor Base Class

**Location:** [src/language/visitor.ts](../../src/language/visitor.ts)

```typescript
export abstract class ASTVisitor {
  protected code: string = '';
  protected indentLevel: number = 0;
  protected context: TranslationContext;

  constructor(context: TranslationContext);

  // ===== ABSTRACT METHODS: Subclasses must implement =====
  abstract visitProgram(program: Program): void;
  abstract visitStatement(statement: Statement): void;
  abstract visitExpression(expression: Expression): void;
  // ... etc for each node type

  // ===== CONCRETE METHODS: Subclasses inherit =====

  protected emit(line: string, nodeId?: string): void;
  protected indent(): void;
  protected dedent(): void;

  getGeneratedCode(): string;
  getSourceMap(): SourceMap;

  protected abstract generateExpression(expr: Expression, minPrecedence: number): string;
}
```

### Example: Python Emitter

**Location:** [src/language/python/emitter.ts](../../src/language/python/emitter.ts)

```typescript
export class PythonEmitter extends ASTVisitor {
  constructor(context: TranslationContext);

  visitProgram(program: Program): void;
  visitClassDeclaration(classDecl: ClassDeclaration): void;
  visitFieldDeclaration(field: FieldDeclaration): void;
  visitConstructor(ctor: Constructor): void;
  visitMethodDeclaration(method: MethodDeclaration): void;
  visitBlock(block: Block): void;
  visitPrint(stmt: Print): void;
  visitAssignment(stmt: Assignment): void;
  visitFunctionDeclaration(func: FunctionDeclaration): void;
  visitReturn(stmt: Return): void;
  visitIf(stmt: If): void;
  visitWhile(stmt: While): void;
  visitFor(stmt: For): void;
  visitBreak(stmt: Break): void;
  visitContinue(stmt: Continue): void;

  protected generateExpression(expr: Expression, minPrecedence: number): string;
}
```

### SymbolTable Class

**Location:** [src/language/visitor.ts](../../src/language/visitor.ts)

Manages type information across nested scopes:

```typescript
export class SymbolTable {
  enterScope(): void; // Push a new scope
  exitScope(): void; // Pop current scope
  set(name: string, type: string): void; // Define variable type in current scope
  get(name: string): string | undefined; // Lookup type (searches parent scopes)
  hasInCurrentScope(name: string): boolean;
}
```

**Usage:**

```typescript
const table = new SymbolTable();
table.set('x', 'int');
table.get('x'); // 'int'

table.enterScope();
table.set('y', 'String');
table.get('x'); // 'int' (found in parent)
table.get('y'); // 'String'

table.exitScope();
table.get('y'); // undefined (no longer in scope)
```

---

## AST Nodes

All AST nodes are defined in [src/language/ast.ts](../../src/language/ast.ts).

### Base ASTNode Interface

```typescript
export interface ASTNode {
  id: string; // Unique identifier (generated via generateId())
  type: NodeType; // The specific node type
  loc?: { start: number; end: number }; // Character positions in source
}
```

### Statement Nodes

**Program** — Root node

```typescript
interface Program extends ASTNode {
  type: 'Program';
  body: Statement[];
}
```

**Block** — Sequence of statements in a scope

```typescript
interface Block extends ASTNode {
  type: 'Block';
  body: Statement[];
}
```

**Assignment** — Variable assignment

```typescript
interface Assignment extends ASTNode {
  type: 'Assignment';
  name: string;
  target?: Expression; // For array/map assignments
  value: Expression;
  varType?: string; // Type annotation
  isMemberAssignment?: boolean;
  memberExpr?: Expression;
}
```

**If** — Conditional statement

```typescript
interface If extends ASTNode {
  type: 'If';
  condition: Expression;
  thenBranch: Block;
  elseBranch?: Block;
}
```

**While** — While loop

```typescript
interface While extends ASTNode {
  type: 'While';
  condition: Expression;
  body: Block;
  elseBranch?: Block; // Python-style else on loop
}
```

**For** — For loop

```typescript
interface For extends ASTNode {
  type: 'For';
  init?: Expression;
  condition: Expression;
  update?: Expression;
  body: Block;
}
```

**FunctionDeclaration** — Function definition

```typescript
interface FunctionDeclaration extends ASTNode {
  type: 'FunctionDeclaration';
  name: string;
  params: Parameter[];
  body: Block;
}
```

**ClassDeclaration** — Class definition

```typescript
interface ClassDeclaration extends ASTNode {
  type: 'ClassDeclaration';
  name: string;
  superClass?: Identifier;
  body: (FieldDeclaration | Constructor | MethodDeclaration)[];
}
```

**Return** — Return statement

```typescript
interface Return extends ASTNode {
  type: 'Return';
  argument?: Expression;
}
```

**Print** — Output statement

```typescript
interface Print extends ASTNode {
  type: 'Print';
  expressions: Expression[];
}
```

### Expression Nodes

**Literal** — Constant value

```typescript
interface Literal extends ASTNode {
  type: 'Literal';
  value: any; // boolean, number, string, null, etc.
  raw?: string; // Optional: original text from source
}
```

**Identifier** — Variable reference

```typescript
interface Identifier extends ASTNode {
  type: 'Identifier';
  name: string;
}
```

**BinaryExpression** — Two operands with an operator

```typescript
interface BinaryExpression extends ASTNode {
  type: 'BinaryExpression';
  left: Expression;
  operator: string; // '+', '-', '*', '/', '>', '<', '==', 'and', 'or', etc.
  right: Expression;
}
```

**UnaryExpression** — One operand with an operator

```typescript
interface UnaryExpression extends ASTNode {
  type: 'UnaryExpression';
  operator: string; // '!', '-', '+', 'not', etc.
  argument: Expression;
}
```

**CallExpression** — Function call

```typescript
interface CallExpression extends ASTNode {
  type: 'CallExpression';
  callee: Expression; // Function to call
  arguments: Expression[];
}
```

**MemberExpression** — Object property access

```typescript
interface MemberExpression extends ASTNode {
  type: 'MemberExpression';
  object: Expression;
  property: Identifier;
}
```

**ArrayLiteral** — Array construction

```typescript
interface ArrayLiteral extends ASTNode {
  type: 'ArrayLiteral';
  elements: Expression[];
}
```

**NewExpression** — Object instantiation

```typescript
interface NewExpression extends ASTNode {
  type: 'NewExpression';
  className: string;
  arguments: Expression[];
}
```

---

## Utilities

### generateId()

**Location:** [src/language/ast.ts](../../src/language/ast.ts)

```typescript
export function generateId(): string;
```

Generates a unique identifier for AST nodes.

**Usage:**

```typescript
const node = {
  id: generateId(),
  type: 'Identifier',
  name: 'x',
};
```

### useCodeParsing Hook

**Location:** [src/hooks/useCodeParsing.ts](../../src/hooks/useCodeParsing.ts)

```typescript
export const useCodeParsing = () => {
  const parseCode = (lang: SupportedLang, input: string): Program | null => { ... }
  const getTranslation = (ast: Program | null, target: SupportedLang): { code: string; sourceMap: SourceMap } => { ... }

  return { parseCode, getTranslation };
}
```

**Usage in React:**

```typescript
const { parseCode, getTranslation } = useCodeParsing();

// Parse code
const ast = parseCode('python', sourceCode);

// Translate AST
const { code, sourceMap } = getTranslation(ast, 'java');
```

### useCodeDebugger Hook

**Location:** [src/hooks/useCodeDebugger.ts](../../src/hooks/useCodeDebugger.ts)

```typescript
export const useCodeDebugger = (getTranslation: (ast: Program | null, lang: SupportedLang) => { ... }) => {
  const initDebugger = (ast: Program | null): void => { ... }
  const stopDebugger = (): void => { ... }

  return {
    isDebugging: boolean,
    setIsDebugging: (b: boolean) => void,
    isDebugComplete: boolean,
    setIsDebugComplete: (b: boolean) => void,
    debuggerInstance: DebuggerInstance | null,
    highlightedSourceLines: number[],
    currentVariables: Record<string, any>,
    initDebugger,
    stopDebugger
  };
}
```

---

## Type Definitions Summary

**TargetLanguage:**

```typescript
type TargetLanguage = 'java' | 'python' | 'csp' | 'praxis';
```

**SupportedLang:**

```typescript
type SupportedLang = 'python' | 'java' | 'csp' | 'praxis' | 'javascript' | 'ast';
```

**TranslationContext:**

```typescript
interface TranslationContext {
  symbolTable: SymbolTable;
  functionReturnTypes: Map<string, string>;
  functionParamTypes: Map<string, string[]>;
}
```

**SourceMap:**

```typescript
type SourceMap = Map<string, number>; // AST Node ID → Line Number
```
