# Component Reference

Detailed API documentation for key classes in the Praxly compiler.

## Table of Contents

1. [Lexer Classes](#lexer-classes)
2. [Parser Classes](#parser-classes)
3. [Interpreter](#interpreter)
4. [Translator & Emitters](#translator--emitters)
5. [AST Nodes](#ast-nodes)
6. [Utilities](#utilities)

## Lexer Classes

All lexers inherit from a common pattern defined in [src/language/lexer.ts](../src/language/lexer.ts).

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
  | 'CHAR'
  | 'BOOLEAN'
  | 'OPERATOR'
  | 'PUNCTUATION'
  | 'PLACEHOLDER'
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

**Location:** [src/language/python/lexer.ts](../src/language/python/lexer.ts)

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

**Location:** [src/language/java/lexer.ts](../src/language/java/lexer.ts)

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

**Location:** [src/language/python/parser.ts](../src/language/python/parser.ts)

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

Statement parsing — the real Python `ifStatement`. Note that `elif` has no
Universal AST node: it desugars into an `If` nested inside the `elseBranch`
block, which is the pattern to follow whenever a language's surface syntax has
no direct AST equivalent.

```typescript
private ifStatement(): If {
  this.consume('KEYWORD', 'if');
  const condition = this.expression();   // no parens — Python doesn't use them
  const thenBranch = this.block();

  let elseBranch: Block | undefined = undefined;

  while (this.match('PUNCTUATION', ';')) {}   // skip virtual line terminators
  if (this.match('KEYWORD', 'elif')) {
    const elifIf = this.ifStatementElif();
    elseBranch = { id: generateId(), type: 'Block', body: [elifIf] };
  } else if (this.match('KEYWORD', 'else')) {
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

## Interpreter

**Location:** [src/language/interpreter.ts](../src/language/interpreter.ts)

### Main Interpreter Class

```typescript
export class Interpreter {
  constructor();

  // Execute a complete program. Returns one entry per output line —
  // NOT a single joined string. `sourceCode` is used for error locations.
  interpret(program: Program, sourceCode?: string): string[];

  // Debug: step through the program, yielding state after each step.
  *stepThroughWithState(
    program: Program,
    sourceCode?: string
  ): Generator<DebugStepEvent, string[], void>;

  // Call stack at the current point, global scope first.
  getStackFrames(): StackFrame[];

  // Cumulative output so far (used by the Debugger between steps).
  getOutput(): string[];

  // Execute a block of statements in a scope
  executeBlock(statements: Statement[], env: Environment): void;

  // Evaluate an expression to a value
  evaluate(expr: Expression, env: Environment, expectedType?: string): any;

  // stdin for input(): queue answers ahead of time, or feed them as prompted
  setInputQueue(inputs: string[]): void;
  addInput(input: string): void;
}
```

**Debug types:**

```typescript
export interface StackFrame {
  name: string;
  variables: Record<string, any>;
}

export interface DebugStepEvent {
  nodeId: string;
  nodeType: string;
  loc: { start: number; end: number } | null;
  /** Flat "visible right now" view: globals shadowed by the current frame's locals. */
  variables: Record<string, any>;
  /** Global scope first, innermost call last. */
  callStack: StackFrame[];
  prompt?: string;
}
```

**Control-flow signalling.** `return`, `break`, and `continue` are implemented as
thrown exceptions (`ReturnException`, `BreakException`, `ContinueException`), and
a program that calls `input()` with no queued answer throws `InputPrompt` to
suspend execution. If you add a `try`/`catch` inside the interpreter, re-throw
these rather than swallowing them.

### Environment Class

Variable scoping with nested environments:

```typescript
export class Environment {
  constructor(parent?: Environment);

  // Define a variable in the current scope. `type` and `declarationOrigin`
  // carry the declared type and source offset for error messages.
  define(name: string, value: any, type?: string, declarationOrigin?: number): void;

  // Assign to an existing variable (searches parent scopes)
  assign(name: string, value: any): void;

  // Retrieve a variable's value (searches parent scopes)
  get(name: string): any;

  // Declared type of a variable, if one was recorded
  getType(name: string): string | undefined;

  // Every variable visible from here, parents included
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

## Translator & Emitters

### Translator Class

**Location:** [src/language/translator.ts](../src/language/translator.ts)

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
export type TargetLanguage = 'java' | 'python' | 'csp' | 'praxis' | 'javascript' | 'blocks';
```

`'blocks'` is handled _before_ the emitter switch in `translateWithMap()` — it
is produced by `programToBlocksJson()` (`src/language/blocks/fromAst.ts`) rather
than by an `ASTVisitor`, and returns an empty source map.

**TranslationResult:**

```typescript
export interface TranslationResult {
  code: string; // Generated source code
  sourceMap: Map<string, number>; // AST Node ID → Line number
}
```

### ASTVisitor Base Class

**Location:** [src/language/visitor.ts](../src/language/visitor.ts)

```typescript
export abstract class ASTVisitor {
  protected output: string[] = [];
  protected indentLevel = 0;
  protected context: TranslationContext;
  protected breakStr = 'break;';
  protected continueStr = 'continue;';
  protected sourceMap: SourceMap = new Map();
  /** Line-comment delimiter for this target (Python overrides to `#`). */
  protected commentPrefix = '//';

  constructor(context: TranslationContext);

  // ===== CONCRETE: inherited by every emitter =====

  /** Appends a line at the current indent. Pass `nodeId` to record it in the source map. */
  protected emit(line: string, nodeId?: string): void;
  protected indent(): void;
  protected dedent(): void;
  /** Re-adds `commentPrefix` to preserved comment lines. */
  protected emitComments(lines?: string[]): void;
  /** Escapes a runtime string back into source-literal form so it re-parses. */
  protected escapeString(value: string, quote?: '"' | "'"): string;
  protected inferType(expr: Expression): string;

  /** Dispatcher: emits leading comments, routes to the right visit*, appends trailing comment. */
  visitStatement(stmt: Statement): void;
  /** Concrete, not abstract — every target emits a preserved blank line identically. */
  visitBlankLine(stmt: BlankLine): void;

  getGeneratedCode(): string;
  getSourceMap(): SourceMap;

  // ===== ABSTRACT: 21 visit methods + expression generation =====
  abstract visitProgram(program: Program): void;
  abstract visitBlock(block: Block): void;
  abstract visitClassDeclaration(classDecl: ClassDeclaration): void;
  abstract visitMethodDeclaration(method: MethodDeclaration): void;
  abstract visitFieldDeclaration(field: FieldDeclaration): void;
  abstract visitConstructor(ctor: Constructor): void;
  abstract visitPrint(stmt: any): void;
  abstract visitAssignment(stmt: any): void;
  abstract visitIf(stmt: any): void;
  abstract visitWhile(stmt: any): void;
  abstract visitDoWhile(stmt: any): void;
  abstract visitRepeatUntil(stmt: any): void;
  abstract visitSwitch(stmt: any): void;
  abstract visitBreak(stmt: any): void;
  abstract visitContinue(stmt: any): void;
  abstract visitFor(stmt: any): void;
  abstract visitForEach(stmt: any): void;
  abstract visitFunctionDeclaration(stmt: any): void;
  abstract visitReturn(stmt: any): void;
  abstract visitExpressionStatement(stmt: any): void;
  abstract visitTry(stmt: any): void;

  abstract generateExpression(expr: Expression, parentPrecedence: number): string;
}
```

Adding a `visit*` method means adding it as `abstract` here, adding a `case` to
the private `dispatchStatement()` switch, and implementing it in all five
emitters — `tsc` will list the ones you miss.

**Precedence constants** (`Member: 18` down to `Sequence: 1`) live in the same
file; pass them as `parentPrecedence` so `generateExpression` knows when to
parenthesise.

### Example: Python Emitter

**Location:** [src/language/python/emitter.ts](../src/language/python/emitter.ts)

```typescript
export class PythonEmitter extends ASTVisitor {
  constructor(context: TranslationContext);

  // All 21 abstract visit* methods, plus:
  generateExpression(expr: Expression, parentPrecedence: number): string;
}
```

Python overrides `commentPrefix` to `'#'`, and its `breakStr`/`continueStr` drop
the trailing semicolon. Any target whose comment or jump syntax differs from
C-style should do the same rather than special-casing at each emit site.

### SymbolTable Class

**Location:** [src/language/visitor.ts](../src/language/visitor.ts)

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

## AST Nodes

All AST nodes are defined in [src/language/ast.ts](../src/language/ast.ts).

### Base ASTNode Interface

```typescript
export interface ASTNode {
  id: string; // Unique identifier (generated via generateId())
  type: NodeType; // The specific node type
  loc?: { start: number; end: number }; // Character positions in source
  // Source comments carried through translation (delimiter stripped; the
  // emitter re-adds the target's `//` or `#`). Populated on statements only.
  leadingComments?: string[]; // own-line comments directly above this statement
  trailingComment?: string; // inline comment after this statement, same line
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
  target: Expression; // Identifier, IndexExpression, or MemberExpression
  value: Expression;
  varType?: string; // Declared type, where the source language has one
  declaredWithoutInitializer?: boolean; // e.g. Java's `int x;`
}
```

The target is always an `Expression` — there is no separate `name` field, and
member/index assignment is expressed by the target's node type rather than by a
flag.

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
}
```

`DoWhile` and `RepeatUntil` are separate node types rather than flags on
`While`; CSP's `REPEAT UNTIL` parses to a `While` with a negated condition.

**For** — C-style for loop

```typescript
interface For extends ASTNode {
  type: 'For';
  init?: Statement; // a Statement, not an Expression
  condition?: Expression;
  update?: Statement;
  body: Block;
}
```

`ForEach` is the separate node for `for … in` / `FOR EACH` iteration.

**FunctionDeclaration** — Function definition

```typescript
interface FunctionDeclaration extends ASTNode {
  type: 'FunctionDeclaration';
  name: string;
  params: Parameter[];
  body: Block;
  // Declared return type where the source language has one (Praxis/Java);
  // absent for Python/JS/CSP, whose emitters infer it from the body.
  returnType?: string;
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
  value?: Expression; // named `value`, not `argument`
}
```

**Print** — Output statement

```typescript
interface Print extends ASTNode {
  type: 'Print';
  expressions: Expression[];
  separator?: string; // inserted between expressions
  appendLineFeed?: boolean; // false for CSP's DISPLAY, which appends a space
}
```

### Expression Nodes

**Literal** — Constant value

```typescript
interface Literal extends ASTNode {
  type: 'Literal';
  value: any; // boolean, number, string, null, etc.
  // Required. Preserves the original source text (e.g. `1.0` vs `1`, or an
  // f/r/b string prefix) so emitters can round-trip formatting that
  // stringifying `value` would lose — and so `1.0` infers as double, not int.
  raw: string;
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
  callee: Identifier | MemberExpression; // narrower than Expression
  arguments: Expression[];
}
```

**MemberExpression** — Object property access

```typescript
interface MemberExpression extends ASTNode {
  type: 'MemberExpression';
  object: Expression;
  property: Identifier;
  isMethod: boolean; // required — distinguishes `a.b()` from `a.b`
}
```

**IndexExpression** — `a[i]` element access, distinct from `MemberExpression`.

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

## Utilities

### generateId()

**Location:** [src/language/ast.ts](../src/language/ast.ts)

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

**Location:** [src/hooks/useCodeParsing.ts](../src/hooks/useCodeParsing.ts)

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

**Location:** [src/hooks/useCodeDebugger.ts](../src/hooks/useCodeDebugger.ts)

Wraps a `Debugger` instance in React state. `stepDebugger` returns the
highlighting and output for one step; the hook also mirrors them into state.

```typescript
export const useCodeDebugger = (
  getTranslation: (ast: Program | null, target: SupportedLang) => { code: string; sourceMap: SourceMap }
) => ({
  isDebugging, setIsDebugging,
  isDebugComplete, setIsDebugComplete,
  debuggerInstance,
  highlightedSourceLines, setHighlightedSourceLines,
  highlightedTranslationLines, setHighlightedTranslationLines,
  currentVariables, setCurrentVariables,
  currentCallStack,
  waitingForInput, inputPrompt,

  initDebugger: (ast: Program | null, lang: SupportedLang, sourceCode?: string) => boolean | undefined,
  stepDebugger: (ast: Program | null, sourceCode: string, target: SupportedLang) => DebugStepResult | null,
  stopDebugger: () => void,
  provideInput: (input: string) => void,
});
```

### useProgramRunner Hook

**Location:** [src/hooks/useProgramRunner.ts](../src/hooks/useProgramRunner.ts)

Drives a plain (non-debug) run. It runs on `Debugger` rather than `Interpreter`
directly so a program calling `input()` can pause and resume instead of being
re-executed from the top. Shared by the editor and the embed player.

```typescript
export function useProgramRunner(callbacks: {
  onOutput: (lines: string[]) => void;
  onError: (message: string) => void;
}): {
  waitingForInput: boolean;
  inputPrompt: string;
  run: (program: Program, lang: SupportedLang, sourceCode: string) => void;
  submitInput: (input: string) => void;
  reset: () => void;
};
```

For the full hook inventory, see [README.md](./README.md#directory-structure)
and the `add-ui-feature` skill.

## Type Definitions Summary

**TargetLanguage** — what the translator can emit:

```typescript
type TargetLanguage = 'java' | 'python' | 'csp' | 'praxis' | 'javascript' | 'blocks';
```

**SupportedLang** — what the UI can show. Adds `'ast'` (a read-only view, not an
emitter target) on top of the text languages plus `'blocks'`:

```typescript
type SupportedLang = 'python' | 'java' | 'csp' | 'praxis' | 'javascript' | 'blocks' | 'ast';
```

Defined in [src/components/LanguageSelector.tsx](../src/components/LanguageSelector.tsx)
alongside `LANG_LABELS`. Despite the filename, that module exports no component.

**TranslationContext:**

```typescript
interface TranslationContext {
  symbolTable: SymbolTable;
  functionReturnTypes: Map<string, string>;
  functionParamTypes: Map<string, string[]>;
  mutableCollections?: Set<string>;
  collectionElementTypes?: Map<string, string>;
  inferredVariableTypes?: Map<string, string>;
}
```

**SourceMap:**

```typescript
type SourceMap = Map<string, number>; // AST Node ID → Line Number
```
