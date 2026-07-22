/**
 * Abstract Syntax Tree (AST) type definitions.
 * Defines all node types used throughout the language pipeline including programs,
 * statements, expressions, and declarations.
 *
 * NodeType is ordered largest to smallest program unit, and every interface below is
 * declared in that same order: Program/Block, then declarations (class/function),
 * then statements, then expressions.
 */

export type NodeType =
  | 'Program'
  | 'Block'
  | 'ClassDeclaration'
  | 'FieldDeclaration'
  | 'Constructor'
  | 'MethodDeclaration'
  | 'FunctionDeclaration'
  | 'Parameter'
  | 'If'
  | 'While'
  | 'DoWhile'
  | 'RepeatUntil'
  | 'For'
  | 'ForEach'
  | 'Switch'
  | 'SwitchCase'
  | 'Try'
  | 'ExceptionHandler'
  | 'Return'
  | 'Break'
  | 'Continue'
  | 'BlankLine'
  | 'Assignment'
  | 'Print'
  | 'ExpressionStatement'
  | 'ConditionalExpression'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'UpdateExpression'
  | 'CompoundAssignment'
  | 'CallExpression'
  | 'NewExpression'
  | 'MemberExpression'
  | 'IndexExpression'
  | 'ArrayLiteral'
  | 'ArrayCreation'
  | 'Identifier'
  | 'ThisExpression'
  | 'Placeholder'
  | 'Literal';

export interface ASTNode {
  id: string;
  type: NodeType;
  loc?: { start: number; end: number };
  // Source comments carried through translation (delimiter stripped; the emitter
  // re-adds the target language's `//` or `#`). Populated on statements only.
  leadingComments?: string[]; // own-line comment lines directly above this statement
  trailingComment?: string; // inline comment after this statement's code, same line
}

export interface Program extends ASTNode {
  type: 'Program';
  body: Statement[];
}

export interface Block extends ASTNode {
  type: 'Block';
  body: Statement[];
}

export type Statement =
  | ClassDeclaration
  | FieldDeclaration
  | Constructor
  | MethodDeclaration
  | FunctionDeclaration
  | If
  | While
  | DoWhile
  | RepeatUntil
  | For
  | ForEach
  | Switch
  | Try
  | Return
  | Break
  | Continue
  | BlankLine
  | Assignment
  | Print
  | ExpressionStatement;

// Parameter, SwitchCase, and ExceptionHandler are deliberately excluded from Statement:
// they never appear directly in a Block's body, only as sub-nodes of their parent
// (Parameter in param lists, SwitchCase in Switch.cases, ExceptionHandler in Try.handlers).

export interface ClassDeclaration extends ASTNode {
  type: 'ClassDeclaration';
  name: string;
  superClass?: Identifier;
  body: (FieldDeclaration | Constructor | MethodDeclaration)[];
}

export type AccessModifier = 'public' | 'private' | 'protected';

export interface FieldDeclaration extends ASTNode {
  type: 'FieldDeclaration';
  name: string;
  fieldType: string;
  isStatic: boolean;
  access: AccessModifier;
  initializer?: Expression;
  // Emission-only flag, same meaning as Assignment.declaredWithoutInitializer.
  declaredWithoutInitializer?: boolean;
}

export interface Constructor extends ASTNode {
  type: 'Constructor';
  access: AccessModifier;
  params: Parameter[];
  body: Block;
}

export interface MethodDeclaration extends ASTNode {
  type: 'MethodDeclaration';
  name: string;
  access: AccessModifier;
  isStatic: boolean;
  returnType: string;
  params: Parameter[];
  body: Block;
}

export interface FunctionDeclaration extends ASTNode {
  type: 'FunctionDeclaration';
  name: string;
  params: Parameter[];
  body: Block;
  // Declared return type where the source language has one (Praxis/Java);
  // absent for Python/JS/CSP sources, whose emitters infer it from the body.
  returnType?: string;
}

// Not a Statement — only appears in Constructor/MethodDeclaration/FunctionDeclaration param lists.
export interface Parameter extends ASTNode {
  type: 'Parameter';
  name: string;
  paramType: string;
}

export interface If extends ASTNode {
  type: 'If';
  condition: Expression;
  thenBranch: Block;
  elseBranch?: Block;
}

export interface While extends ASTNode {
  type: 'While';
  condition: Expression;
  body: Block;
}

export interface DoWhile extends ASTNode {
  type: 'DoWhile';
  body: Block;
  condition: Expression;
}

/**
 * Post-condition loop: body executes first, then condition is checked.
 * Loop repeats until condition becomes true. Equivalent to do { body } while(!condition).
 * Used by Praxis's `repeat...until` construct.
 */
export interface RepeatUntil extends ASTNode {
  type: 'RepeatUntil';
  body: Block;
  condition: Expression;
}

// C-style three-clause loop (e.g. Java/Praxis `for (init; condition; update)`).
// Each clause is optional — C-style syntax permits an empty clause (`for (;;)`).
// `init`/`update` are usually Assignment/ExpressionStatement nodes, but some
// front-ends pass an array of them for comma-separated clauses.
export interface For extends ASTNode {
  type: 'For';
  init?: Statement;
  condition?: Expression;
  update?: Statement;
  body: Block;
}

// Iterator loop over a sequence (e.g. Python `for x in y`, CSP `FOR EACH`,
// Java `for (x : xs)`). The iterable may be a plain collection, a `range(...)`
// call, or a Praxis `a..b` range expression — each emitter renders accordingly.
export interface ForEach extends ASTNode {
  type: 'ForEach';
  variable: string;
  iterable: Expression;
  body: Block;
}

export interface Switch extends ASTNode {
  type: 'Switch';
  discriminant: Expression;
  cases: SwitchCase[];
}

// Not a Statement — only appears in Switch.cases, never directly in a Block's body.
export interface SwitchCase extends ASTNode {
  type: 'SwitchCase';
  test?: Expression;
  consequent: Statement[];
}

export interface Try extends ASTNode {
  type: 'Try';
  body: Block;
  handlers: ExceptionHandler[];
  finallyBlock?: Block;
}

// Not a Statement — only appears in Try.handlers, never directly in a Block's body.
export interface ExceptionHandler extends ASTNode {
  type: 'ExceptionHandler';
  exceptionType?: string;
  varName?: string;
  body: Block;
}

export interface Return extends ASTNode {
  type: 'Return';
  value?: Expression;
}

export interface Break extends ASTNode {
  type: 'Break';
}

export interface Continue extends ASTNode {
  type: 'Continue';
}

// A source blank line, preserved across translation as a no-op statement so the
// translated output keeps the source's vertical spacing for side-by-side
// comparison. Inserted by the post-parse `insertBlankLines` pass (comments.ts),
// executes as a no-op, and emits one empty line. Carries no loc.
export interface BlankLine extends ASTNode {
  type: 'BlankLine';
}

// `target` is the lvalue being assigned to: an Identifier for a plain variable
// (`x = 5`), or a MemberExpression/IndexExpression for a member/index mutation
// (`obj.field = 5`, `arr[i] = 5`). `varType` marks a typed declaration (`int x = 5`);
// declaredWithoutInitializer marks a bare declaration (e.g. `int x;`) — it only affects
// emitted output, not interpretation or type inference. Use `lvalueName(node)` to read
// the plain-variable name (undefined for member/index targets).
export interface Assignment extends ASTNode {
  type: 'Assignment';
  target: Expression;
  value: Expression;
  varType?: string;
  declaredWithoutInitializer?: boolean;
}

// Mirrors Python's print(*args, sep=' ', end='\n'); the interpreter defaults separator to
// ' ' and appendLineFeed to true when unset. Currently only the Praxis parser populates
// these from natural-language phrasing — Python's own `sep=`/`end=` kwargs aren't parsed yet.
export interface Print extends ASTNode {
  type: 'Print';
  expressions: Expression[];
  separator?: string;
  appendLineFeed?: boolean;
}

export interface ExpressionStatement extends ASTNode {
  type: 'ExpressionStatement';
  expression: Expression;
}

export type Expression =
  | ConditionalExpression
  | BinaryExpression
  | UnaryExpression
  | UpdateExpression
  | CompoundAssignment
  | CallExpression
  | NewExpression
  | MemberExpression
  | IndexExpression
  | ArrayLiteral
  | ArrayCreation
  | Identifier
  | ThisExpression
  | Placeholder
  | Literal;

export interface ConditionalExpression extends ASTNode {
  type: 'ConditionalExpression';
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface BinaryExpression extends ASTNode {
  type: 'BinaryExpression';
  left: Expression;
  operator: string;
  right: Expression;
}

export interface UnaryExpression extends ASTNode {
  type: 'UnaryExpression';
  operator: string;
  argument: Expression;
}

export interface UpdateExpression extends ASTNode {
  type: 'UpdateExpression';
  operator: '++' | '--';
  argument: Expression;
  prefix: boolean;
}

// An Expression, not a Statement, so it can appear anywhere a value is expected —
// notably a C-style For loop's `update` clause (e.g. `i += 1`), not just as a standalone line.
export interface CompoundAssignment extends ASTNode {
  type: 'CompoundAssignment';
  operator: string;
  name: string;
  left: Expression;
  right: Expression;
}

export interface CallExpression extends ASTNode {
  type: 'CallExpression';
  callee: Identifier | MemberExpression;
  arguments: Expression[];
}

export interface NewExpression extends ASTNode {
  type: 'NewExpression';
  className: string;
  arguments: Expression[];
}

export interface MemberExpression extends ASTNode {
  type: 'MemberExpression';
  object: Expression;
  property: Identifier;
  isMethod: boolean;
}

export interface IndexExpression extends ASTNode {
  type: 'IndexExpression';
  object: Expression;
  index: Expression;
}

export interface ArrayLiteral extends ASTNode {
  type: 'ArrayLiteral';
  elements: Expression[];
}

// Fixed-size array creation with default-initialized elements (e.g. Java/Praxis
// `new int[10]`), as opposed to an ArrayLiteral's explicit element list. The
// interpreter fills `size` type-appropriate defaults (0 / false / null).
export interface ArrayCreation extends ASTNode {
  type: 'ArrayCreation';
  elementType: string;
  size: Expression;
}

export interface Identifier extends ASTNode {
  type: 'Identifier';
  name: string;
}

export interface ThisExpression extends ASTNode {
  type: 'ThisExpression';
}

// A Praxis `/* ... */` placeholder for missing exam-question code. Standing
// alone as a statement it's a no-op (a missing statement); used directly as
// part of an expression (a condition, an operand, an assigned value's later
// read) it's a runtime error — see interpreter.ts. Emitters lower it to a
// type-appropriate default (`0`) when translating to another language.
export interface Placeholder extends ASTNode {
  type: 'Placeholder';
  text: string;
}

export interface Literal extends ASTNode {
  type: 'Literal';
  value: any;
  // raw preserves the original source text (e.g. `1.0` vs `1`, or an f/r/b string prefix)
  // so emitters can round-trip formatting that converting back to a string would lose.
  raw: string;
}

export const generateId = () => Math.random().toString(36).substring(2, 11);

/**
 * True when the class is Java's mandatory `Main` wrapper: a class named Main
 * with a static main method. Targets with free functions unwrap it — main's
 * body becomes the top-level program.
 */
export const isJavaMainClass = (classDecl: ClassDeclaration): boolean =>
  classDecl.name === 'Main' &&
  classDecl.body.some((m) => m.type === 'MethodDeclaration' && m.name === 'main' && m.isStatic);

/** The static main method of a Java `Main` wrapper class, if present. */
export const javaMainMethod = (classDecl: ClassDeclaration): MethodDeclaration | undefined =>
  classDecl.body.find(
    (m): m is MethodDeclaration => m.type === 'MethodDeclaration' && m.name === 'main'
  );

/**
 * The members of the `Main` wrapper other than main itself, converted to
 * top-level statements: static fields become variable declarations and static
 * helper methods become free functions. Targets that unwrap Main must emit
 * these ahead of main's body — otherwise helpers the program calls would be
 * silently dropped from the translation. The original node ids are preserved
 * so debugger source maps keep lining up.
 */
export const mainClassHelperStatements = (classDecl: ClassDeclaration): Statement[] => {
  const statements: Statement[] = [];
  for (const member of classDecl.body) {
    if (member.type === 'FieldDeclaration' && member.isStatic) {
      const nullLiteral: Literal = { id: generateId(), type: 'Literal', value: null, raw: 'null' };
      const assignment: Assignment = {
        id: member.id,
        type: 'Assignment',
        target: makeIdentifier(member.name),
        value: member.initializer ?? nullLiteral,
        varType: member.fieldType,
        declaredWithoutInitializer: !member.initializer,
        loc: member.loc,
      };
      statements.push(assignment);
    } else if (member.type === 'MethodDeclaration' && member.isStatic && member.name !== 'main') {
      const fn: FunctionDeclaration = {
        id: member.id,
        type: 'FunctionDeclaration',
        name: member.name,
        params: member.params,
        body: member.body,
        returnType: member.returnType,
        loc: member.loc,
      };
      statements.push(fn);
    }
  }
  return statements;
};

// Builds a fresh Identifier node — used by parsers/converters to construct an
// Assignment `target` from a bare variable name.
export const makeIdentifier = (name: string): Identifier => ({
  id: generateId(),
  type: 'Identifier',
  name,
});

// The plain-variable name of an assignment target, or undefined when the target
// is a member/index expression (which never names a declarable variable).
export const lvalueName = (node: Assignment): string | undefined =>
  node.target.type === 'Identifier' ? node.target.name : undefined;

export function* generateVariableName() {
  let id = 0;
  while (true) {
    yield id++;
  }
}
