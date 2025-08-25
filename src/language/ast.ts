import {Where} from './where.js';
import {Visitor} from './visitor.js';
import {Type, ArrayType, Visibility} from './type.js';

// ---------------------------------------------------------------------------

export class Formal {
  identifier: string;
  type: Type;

  constructor(identifier: string, type: Type) {
    this.identifier = identifier;
    this.type = type;
  }
}

// ---------------------------------------------------------------------------

export abstract class Node {
  where: Where;

  constructor(where: Where) {
    this.where = where;
  }

  abstract visit<P, R>(visitor: Visitor<P, R>, payload: P): R;
}

export abstract class Statement extends Node {
  hasSemicolon: boolean;
  comment: string | null;

  constructor(where: Where) {
    super(where);
    this.hasSemicolon = false;
    this.comment = null;
  }
}

export class Program extends Node {
  block: Block;

  constructor(block: Block, where: Where) {
    super(where);
    this.block = block;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitProgram(this, payload);
  }
}

export class Block extends Node {
  statements: Statement[];

  constructor(statements: Statement[], where: Where) {
    super(where);
    this.statements = statements;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitBlock(this, payload);
  }
}

export abstract class Expression extends Node {
  constructor(where: Where) {
    super(where);
  }
}

// ----------------------------------------------------------------------------
// Statements
// ----------------------------------------------------------------------------

export class Blank extends Statement {
  count: number;

  constructor(count: number, where: Where) {
    super(where);
    this.count = count;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitBlank(this, payload);
  }
}

export class Print extends Statement {
  operandNode: Node;
  trailer: string;

  constructor(operandNode: Node, trailer: string, where: Where) {
    super(where);
    this.operandNode = operandNode;
    this.trailer = trailer;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitPrint(this, payload);
  }
}

export class ExpressionStatement extends Statement {
  expressionNode: Node;

  constructor(expressionNode: Node) {
    super(expressionNode.where);
    this.expressionNode = expressionNode;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitExpressionStatement(this, payload);
  }
}

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

export class Assignment extends Statement {
  leftNode: Node;
  rightNode: Node;

  constructor(leftNode: Node, rightNode: Node, where: Where) {
    super(where);
    this.leftNode = leftNode;
    this.rightNode = rightNode;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitAssignment(this, payload);
  }
}

export class Declaration extends Statement {
  identifier: string;
  variableType: Type;
  rightNode: Node | null;

  constructor(identifier: string, variableType: Type, rightNode: Node | null, where: Where) {
    super(where);
    this.identifier = identifier;
    this.variableType = variableType;
    this.rightNode = rightNode;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitDeclaration(this, payload);
  }
}

export class Variable extends Expression {
  identifier: string;

  constructor(identifier: string, where: Where) {
    super(where);
    this.identifier = identifier;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitVariable(this, payload);
  }
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export class Null extends Expression {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitNull(this, payload);
  }
}

export abstract class Primitive<T> extends Expression {
  rawValue: T;

  constructor(rawValue: T, where: Where) {
    super(where);
    this.rawValue = rawValue;
  }
}

export class Integer extends Primitive<number> {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitInteger(this, payload);
  }
}

export class Float extends Primitive<number> {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitFloat(this, payload);
  }
}

export class Double extends Primitive<number> {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitDouble(this, payload);
  }
}

export class Character extends Primitive<string> {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitCharacter(this, payload);
  }
}

export class String extends Primitive<string> {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitString(this, payload);
  }
}

export class Boolean extends Primitive<boolean> {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitBoolean(this, payload);
  }
}

// ---------------------------------------------------------------------------
// Unary Operators
// ---------------------------------------------------------------------------

export abstract class UnaryOperator extends Expression {
  operandNode: Node;

  constructor(operandNode: Node, where: Where) {
    super(where);
    this.operandNode = operandNode;
  }
}

export class Association extends UnaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitAssociation(this, payload);
  }
}

export class LogicalNegate extends UnaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitLogicalNegate(this, payload);
  }
}

export class ArithmeticNegate extends UnaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitArithmeticNegate(this, payload);
  }
}

export class BitwiseNegate extends UnaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitBitwiseNegate(this, payload);
  }
}

export class PostIncrement extends UnaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitPostIncrement(this, payload);
  }
}

export class PostDecrement extends UnaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitPostDecrement(this, payload);
  }
}

// ---------------------------------------------------------------------------
// Binary Operators
// ---------------------------------------------------------------------------

export abstract class BinaryOperator extends Expression {
  leftNode: Node;
  rightNode: Node;

  constructor(leftNode: Node, rightNode: Node, where: Where) {
    super(where);
    this.leftNode = leftNode;
    this.rightNode = rightNode;
  }
}

export class Add extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitAdd(this, payload);
  }
}

export class Subtract extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitSubtract(this, payload);
  }
}

export class Multiply extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitMultiply(this, payload);
  }
}

export class Divide extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitDivide(this, payload);
  }
}

export class Remainder extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitRemainder(this, payload);
  }
}

export class Power extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitPower(this, payload);
  }
}

export class LessThan extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitLessThan(this, payload);
  }
}

export class GreaterThan extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitGreaterThan(this, payload);
  }
}

export class LessThanOrEqual extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitLessThanOrEqual(this, payload);
  }
}

export class GreaterThanOrEqual extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitGreaterThanOrEqual(this, payload);
  }
}

export class Equal extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitEqual(this, payload);
  }
}

export class NotEqual extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitNotEqual(this, payload);
  }
}

export class LogicalAnd extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitLogicalAnd(this, payload);
  }
}

export class LogicalOr extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitLogicalOr(this, payload);
  }
}

export class BitwiseAnd extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitBitwiseAnd(this, payload);
  }
}

export class BitwiseOr extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitBitwiseOr(this, payload);
  }
}

export class Xor extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitXor(this, payload);
  }
}

export class LeftShift extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitLeftShift(this, payload);
  }
}

export class RightShift extends BinaryOperator {
  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitRightShift(this, payload);
  }
}

// ---------------------------------------------------------------------------
// Control Flow
// ---------------------------------------------------------------------------

export class If extends Statement {
  conditionNodes: Node[];
  thenBlocks: Block[];
  elseBlock: Block | null;

  constructor(conditionNodes: Node[], thenBlocks: Block[], elseBlock: Block | null, where: Where) {
    super(where);
    this.conditionNodes = conditionNodes;
    this.thenBlocks = thenBlocks;
    this.elseBlock = elseBlock;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitIf(this, payload);
  }
}

export class While extends Statement {
  conditionNode: Node;
  body: Block;

  constructor(conditionNode: Node, body: Block, where: Where) {
    super(where);
    this.conditionNode = conditionNode;
    this.body = body;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitWhile(this, payload);
  }
}

export class DoWhile extends Statement {
  body: Block;
  conditionNode: Node;

  constructor(body: Block, conditionNode: Node, where: Where) {
    super(where);
    this.body = body;
    this.conditionNode = conditionNode;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitDoWhile(this, payload);
  }
}

export class RepeatUntil extends Statement {
  body: Block;
  conditionNode: Node;

  constructor(body: Block, conditionNode: Node, where: Where) {
    super(where);
    this.body = body;
    this.conditionNode = conditionNode;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitRepeatUntil(this, payload);
  }
}

export class For extends Statement {
  initializationNode: Statement | Expression | null;
  conditionNode: Node;
  incrementBlock: Block;
  body: Block;

  constructor(initializationNode: Statement | Expression | null, conditionNode: Node, incrementBlock: Block, body: Block, where: Where) {
    super(where);
    this.initializationNode = initializationNode;
    this.conditionNode = conditionNode;
    this.incrementBlock = incrementBlock;
    this.body = body;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitFor(this, payload);
  }
}

export class ForEach extends Statement {
  identifier: string;
  iterableNode: Expression;
  body: Block;

  constructor(identifier: string, iterableNode: Expression, body: Block, where: Where) {
    super(where);
    this.identifier = identifier;
    this.iterableNode = iterableNode;
    this.body = body;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitForEach(this, payload);
  }
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export class FunctionDefinition extends Statement {
  identifier: string;
  formals: Formal[];
  returnType: Type;
  body: Block;

  constructor(identifier: string, formals: Formal[], returnType: Type, body: Block, where: Where) {
    super(where);
    this.identifier = identifier;
    this.formals = formals;
    this.returnType = returnType;
    this.body = body;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitFunctionDefinition(this, payload);
  }
}

export class FunctionCall extends Expression {
  identifier: string;
  actuals: Expression[];

  constructor(identifier: string, actuals: Expression[], where: Where) {
    super(where);
    this.identifier = identifier;
    this.actuals = actuals;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitFunctionCall(this, payload);
  }
}

export class Return extends Statement {
  operandNode: Expression | null;

  constructor(operandNode: Expression | null, where: Where) {
    super(where);
    this.operandNode = operandNode;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitReturn(this, payload);
  }
}

export class LineComment extends Statement {
  text: string;

  constructor(text: string, where: Where) {
    super(where);
    this.text = text;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitLineComment(this, payload);
  }
}

// ---------------------------------------------------------------------------
// Range
// ---------------------------------------------------------------------------

export class RangeLiteral extends Expression {
  loNode: Expression;
  hiNode: Expression;

  constructor(loNode: Expression, hiNode: Expression, where: Where) {
    super(where);
    this.loNode = loNode;
    this.hiNode = hiNode;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitRangeLiteral(this, payload);
  }
}

// ---------------------------------------------------------------------------
// Arrays
// ---------------------------------------------------------------------------

export class ArrayLiteral extends Expression {
  elementNodes: Expression[];

  constructor(elementNodes: Expression[], where: Where) {
    super(where);
    this.elementNodes = elementNodes;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitArrayLiteral(this, payload);
  }
}

export class ArrayDeclaration extends Declaration {
  constructor(identifier: string, variableType: ArrayType, rightNode: Expression, where: Where) {
    super(identifier, variableType, rightNode, where);
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitArrayDeclaration(this, payload);
  }
}

export class ArraySubscript extends Statement {
  arrayNode: Expression;
  indexNode: Expression;

  constructor(arrayNode: Expression, indexNode: Expression, where: Where) {
    super(where);
    this.arrayNode = arrayNode;
    this.indexNode = indexNode;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitArraySubscript(this, payload);
  }
}

export class Member extends Statement {
  receiverNode: Expression;
  identifier: string;

  constructor(receiverNode: Expression, identifier: string, where: Where) {
    super(where);
    this.receiverNode = receiverNode;
    this.identifier = identifier;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitMember(this, payload);
  }
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export class ClassDefinition extends Statement {
  identifier: string;
  superclass: string | null;
  instanceVariableDeclarations: InstanceVariableDeclaration[];
  constructorDefinitions: ConstructorDefinition[];
  methodDefinitions: MethodDefinition[];

  constructor(identifier: string, superclass: string | null, instanceVariableDeclarations: InstanceVariableDeclaration[], constructorDefinitions: ConstructorDefinition[], methodDefinitions: MethodDefinition[], where: Where) {
    super(where);
    this.identifier = identifier;
    this.superclass = superclass;
    this.instanceVariableDeclarations = instanceVariableDeclarations;
    this.constructorDefinitions = constructorDefinitions;
    this.methodDefinitions = methodDefinitions;

    for (let constructorDefinition of this.constructorDefinitions) {
      constructorDefinition.classDefinition = this;
    }
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitClassDefinition(this, payload);
  }
}

export class InstanceVariableDeclaration extends Statement {
  identifier: string;
  variableType: Type;
  visibility: Visibility | null;
  valueNode: Expression | null;

  constructor(identifier: string, variableType: Type, visibility: Visibility | null, valueNode: Expression | null, where: Where) {
    super(where);
    this.identifier = identifier;
    this.variableType = variableType;
    this.visibility = visibility;
    this.valueNode = valueNode;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitInstanceVariableDeclaration(this, payload);
  }
}

export class ConstructorDefinition extends Statement {
  formals: Formal[];
  body: Block;
  visibility: Visibility | null;
  classDefinition!: ClassDefinition;

  constructor(formals: Formal[], body: Block, visibility: Visibility | null, where: Where) {
    super(where);
    this.formals = formals;
    this.body = body;
    this.visibility = visibility;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitConstructorDefinition(this, payload);
  }
}

export class MethodDefinition extends Statement {
  identifier: string;
  formals: Formal[];
  returnType: Type;
  body: Block;
  visibility: Visibility | null;

  constructor(identifier: string, formals: Formal[], returnType: Type, body: Block, visibility: Visibility | null, where: Where) {
    super(where);
    this.identifier = identifier;
    this.formals = formals;
    this.returnType = returnType;
    this.body = body;
    this.visibility = visibility;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitMethodDefinition(this, payload);
  }
}

export class Instantiation extends Expression {
  identifier: string;
  actuals: Expression[];

  constructor(identifier: string, actuals: Expression[], where: Where) {
    super(where);
    this.identifier = identifier;
    this.actuals = actuals;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitInstantiation(this, payload);
  }
}

export class MethodCall extends Expression {
  receiverNode: Expression;
  identifier: string;
  actuals: Expression[];

  constructor(receiverNode: Expression, identifier: string, actuals: Expression[], where: Where) {
    super(where);
    this.receiverNode = receiverNode;
    this.identifier = identifier;
    this.actuals = actuals;
  }

  visit<P, R>(visitor: Visitor<P, R>, payload: P): R {
    return visitor.visitMethodCall(this, payload);
  }
}

// ---------------------------------------------------------------------------
