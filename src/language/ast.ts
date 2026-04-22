/**
 * Abstract Syntax Tree (AST) type definitions.
 * Defines all node types used throughout the language pipeline including programs, statements, expressions, and declarations.
 */

export type NodeType =
  | 'Program'
  | 'Block'
  | 'Assignment'
  | 'Print'
  | 'If'
  | 'While'
  | 'DoWhile'
  | 'For'
  | 'Switch'
  | 'SwitchCase'
  | 'FunctionDeclaration'
  | 'Return'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'UpdateExpression'
  | 'Identifier'
  | 'Literal'
  | 'ArrayLiteral'
  | 'CallExpression'
  | 'ExpressionStatement'
  | 'ClassDeclaration'
  | 'FieldDeclaration'
  | 'Constructor'
  | 'MethodDeclaration'
  | 'NewExpression'
  | 'MemberExpression'
  | 'ThisExpression'
  | 'Parameter'
  | 'IndexExpression'
  | 'Break'
  | 'Continue'
  | 'Try'
  | 'ExceptionHandler'
  | 'ConditionalExpression'
  | 'CompoundAssignment'
  | 'ListComprehension';

export interface ASTNode {
  id: string;
  type: NodeType;
  loc?: { start: number; end: number };
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
  | Assignment
  | Print
  | If
  | While
  | DoWhile
  | For
  | Switch
  | FunctionDeclaration
  | Return
  | ExpressionStatement
  | ClassDeclaration
  | FieldDeclaration
  | Constructor
  | MethodDeclaration
  | Break
  | Continue
  | Try;

export interface Break extends ASTNode {
  type: 'Break';
}

export interface Continue extends ASTNode {
  type: 'Continue';
}

export interface ExpressionStatement extends ASTNode {
  type: 'ExpressionStatement';
  expression: Expression;
}

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

export interface Print extends ASTNode {
  type: 'Print';
  expressions: Expression[];
  separator?: string;
  appendLineFeed?: boolean;
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
  elseBranch?: Block;
}

export interface DoWhile extends ASTNode {
  type: 'DoWhile';
  body: Block;
  condition: Expression;
}

export interface Try extends ASTNode {
  type: 'Try';
  body: Block;
  handlers: ExceptionHandler[];
  finallyBlock?: Block;
}

export interface ExceptionHandler extends ASTNode {
  type: 'ExceptionHandler';
  exceptionType?: string;
  varName?: string;
  body: Block;
}

export interface Switch extends ASTNode {
  type: 'Switch';
  discriminant: Expression;
  cases: SwitchCase[];
}

export interface SwitchCase extends ASTNode {
  type: 'SwitchCase';
  test?: Expression;
  consequent: Statement[];
}

export interface For extends ASTNode {
  type: 'For';
  variable: string;
  variables?: string[];
  iterable: Expression;
  init?: Statement;
  condition?: Expression;
  update?: Statement;
  body: Block;
  elseBranch?: Block;
}

export interface FunctionDeclaration extends ASTNode {
  type: 'FunctionDeclaration';
  name: string;
  params: Parameter[];
  body: Block;
}

export interface Return extends ASTNode {
  type: 'Return';
  value?: Expression;
}

export type Expression =
  | BinaryExpression
  | UnaryExpression
  | UpdateExpression
  | Identifier
  | Literal
  | ArrayLiteral
  | CallExpression
  | NewExpression
  | MemberExpression
  | ThisExpression
  | IndexExpression
  | ConditionalExpression
  | CompoundAssignment
  | ListComprehension;

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

export interface CallExpression extends ASTNode {
  type: 'CallExpression';
  callee: Identifier | MemberExpression;
  arguments: Expression[];
}

export interface Identifier extends ASTNode {
  type: 'Identifier';
  name: string;
}

export interface Literal extends ASTNode {
  type: 'Literal';
  value: any;
  raw: string;
}

export interface ArrayLiteral extends ASTNode {
  type: 'ArrayLiteral';
  elements: Expression[];
}

export interface IndexExpression extends ASTNode {
  type: 'IndexExpression';
  object: Expression;
  index: Expression;
  indexEnd?: Expression;
  indexStep?: Expression;
}

// OOP-related nodes
export type AccessModifier = 'public' | 'private' | 'protected';

export interface ClassDeclaration extends ASTNode {
  type: 'ClassDeclaration';
  name: string;
  superClass?: Identifier;
  body: (FieldDeclaration | Constructor | MethodDeclaration)[];
}

export interface FieldDeclaration extends ASTNode {
  type: 'FieldDeclaration';
  name: string;
  fieldType: string;
  isStatic: boolean;
  access: AccessModifier;
  initializer?: Expression;
  declaredWithoutInitializer?: boolean;
}

export interface Constructor extends ASTNode {
  type: 'Constructor';
  access: AccessModifier;
  params: Parameter[];
  body: Block;
}

export interface Parameter extends ASTNode {
  type: 'Parameter';
  name: string;
  paramType: string;
  defaultValue?: Expression;
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

export interface ThisExpression extends ASTNode {
  type: 'ThisExpression';
}

export interface ConditionalExpression extends ASTNode {
  type: 'ConditionalExpression';
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface CompoundAssignment extends ASTNode {
  type: 'CompoundAssignment';
  operator: string;
  name: string;
  left: Expression;
  right: Expression;
}

export interface ListComprehension extends ASTNode {
  type: 'ListComprehension';
  element: Expression;
  variable: string;
  iterable: Expression;
}

/**
 * Runs generate id.
 */
export const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * Runs generate variable name.
 */
export function* generateVariableName() {
  let id = 0;
  while (true) {
    yield id++;
  }
}
