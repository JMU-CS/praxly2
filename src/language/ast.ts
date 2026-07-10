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
  | 'Switch'
  | 'SwitchCase'
  | 'Try'
  | 'ExceptionHandler'
  | 'Return'
  | 'Break'
  | 'Continue'
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
  // File-top comment block, pinned to the program so it stays at the top even
  // when an emitter hoists/reorders the first statement.
  headerComments?: string[];
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
  | Switch
  | Try
  | Return
  | Break
  | Continue
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

// One node models two loop shapes: foreach (variable(s)/iterable, e.g. Python `for x in y`,
// CSP `FOR EACH`) and C-style three-clause (init/condition/update, e.g. Java/Praxis `for(;;)`).
// The interpreter branches on whether init/condition/update are all present.
export interface For extends ASTNode {
  type: 'For';
  variable: string;
  variables?: string[];
  iterable: Expression;
  init?: Statement;
  condition?: Expression;
  update?: Statement;
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

// For a member assignment (e.g. `obj.field = 5`), isMemberAssignment is true and memberExpr
// holds the MemberExpression/IndexExpression target; name/varType are for plain variable
// assignment. declaredWithoutInitializer marks a bare declaration (e.g. `int x;`) — it only
// affects emitted output, not interpretation or type inference.
export interface Assignment extends ASTNode {
  type: 'Assignment';
  name: string;
  target?: Expression;
  value: Expression;
  varType?: string;
  declaredWithoutInitializer?: boolean;
  isMemberAssignment?: boolean;
  memberExpr?: Expression;
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

export interface Identifier extends ASTNode {
  type: 'Identifier';
  name: string;
}

export interface ThisExpression extends ASTNode {
  type: 'ThisExpression';
}

// A Praxis `/* ... */` placeholder for missing exam-question code. It evaluates
// to a default value (0) so a program with holes still compiles and runs.
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

export function* generateVariableName() {
  let id = 0;
  while (true) {
    yield id++;
  }
}
