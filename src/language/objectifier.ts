import * as ast from './ast.js';
import {Visitor} from './visitor.js';

export class Objectifier extends Visitor<Object, Object> {

  // --------------------------------------------------------------------------
  // Primitives
  // --------------------------------------------------------------------------

  visitPrimitive<T>(node: ast.Primitive<T>, _payload: Object, label: string): Object {
    return {
      type: label,
      rawValue: node.rawValue,
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitInteger(node: ast.Integer, payload: Object): Object {
    return this.visitPrimitive<number>(node, payload, 'integer');
  }

  visitFloat(node: ast.Float, payload: Object): Object {
    return this.visitPrimitive<number>(node, payload, 'float');
  }

  visitBoolean(node: ast.Boolean, payload: Object): Object {
    return this.visitPrimitive<boolean>(node, payload, 'boolean');
  }

  visitString(node: ast.String, payload: Object): Object {
    return this.visitPrimitive<string>(node, payload, 'string');
  }

  // --------------------------------------------------------------------------
  // Unary Operators
  // --------------------------------------------------------------------------

  visitUnaryOperator(node: ast.UnaryOperator, payload: Object, label: string): Object {
    return {
      type: label,
      operandNode: node.operandNode.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitLogicalNegate(node: ast.LogicalNegate, payload: Object): Object {
    return this.visitUnaryOperator(node, payload, 'logical-negate');
  }

  visitArithmeticNegate(node: ast.ArithmeticNegate, payload: Object): Object {
    return this.visitUnaryOperator(node, payload, 'arithmetic-negate');
  }

  visitBitwiseNegate(node: ast.BitwiseNegate, payload: Object): Object {
    return this.visitUnaryOperator(node, payload, 'bitwise-negate');
  }

  // --------------------------------------------------------------------------
  // Binary Operators
  // --------------------------------------------------------------------------

  visitBinaryOperator(node: ast.BinaryOperator, payload: Object, label: string): Object {
    return {
      type: label,
      leftNode: node.leftNode.visit(this, payload),
      rightNode: node.rightNode.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitAdd(node: ast.Add, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'add');
  }

  visitSubtract(node: ast.Subtract, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'subtract');
  }

  visitMultiply(node: ast.Multiply, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'multiply');
  }

  visitDivide(node: ast.Divide, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'divide');
  }

  visitRemainder(node: ast.Remainder, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'remainder');
  }

  visitPower(node: ast.Power, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'power');
  }

  visitLessThan(node: ast.LessThan, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'less-than');
  }

  visitGreaterThan(node: ast.GreaterThan, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'greater-than');
  }

  visitLessThanOrEqual(node: ast.LessThanOrEqual, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'less-than-or-equal');
  }

  visitGreaterThanOrEqual(node: ast.GreaterThanOrEqual, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'greater-than-or-equal');
  }

  visitEqual(node: ast.Equal, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'equal');
  }

  visitNotEqual(node: ast.NotEqual, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'not-equal');
  }

  visitLogicalAnd(node: ast.LogicalAnd, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'logical-and');
  }

  visitLogicalOr(node: ast.LogicalOr, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'logical-or');
  }

  visitBitwiseAnd(node: ast.BitwiseAnd, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'bitwise-and');
  }

  visitBitwiseOr(node: ast.BitwiseOr, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'bitwise-or');
  }

  visitXor(node: ast.Xor, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'xor');
  }

  visitLeftShift(node: ast.LeftShift, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'left-shift');
  }

  visitRightShift(node: ast.RightShift, payload: Object): Object {
    return this.visitBinaryOperator(node, payload, 'right-shift');
  }

  // --------------------------------------------------------------------------
  // Variables
  // --------------------------------------------------------------------------

  visitAssignment(node: ast.Assignment, payload: Object): Object {
    return {
      type: 'assignment',
      leftNode: node.leftNode.visit(this, payload),
      rightNode: node.rightNode.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitDeclaration(node: ast.Declaration, payload: Object): Object {
    return {
      type: 'declaration',
      identifier: node.identifier,
      variableType: node.variableType,
      rightNode: node.rightNode?.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitVariable(node: ast.Variable, _payload: Object): Object {
    return {
      type: 'variable',
      identifier: node.identifier,
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitBlock(node: ast.Block, payload: Object): Object {
    return {
      type: 'block',
      statements: node.statements.map(statement => statement.visit(this, payload)),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitPrint(node: ast.Print, payload: Object): Object {
    return {
      type: 'print',
      operandNode: node.operandNode.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitIf(node: ast.If, payload: Object): Object {
    return {
      type: 'if',
      conditionNode: node.conditionNode.visit(this, payload),
      thenBlock: node.thenBlock.visit(this, payload),
      elseBlock: node.elseBlock?.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitWhile(node: ast.While, payload: Object): Object {
    return {
      type: 'while',
      conditionNode: node.conditionNode.visit(this, payload),
      body: node.body.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  // --------------------------------------------------------------------------
  // Functions
  // --------------------------------------------------------------------------

  visitFunctionDefinition(node: ast.FunctionDefinition, payload: Object): Object {
    return {
      type: 'function-definition',
      identifier: node.identifier,
      formals: node.formals.map(formal => ({
        identifier: formal.identifier,
      })),
      body: node.body.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitFunctionCall(node: ast.FunctionCall, payload: Object): Object {
    return {
      type: 'function-call',
      identifier: node.identifier,
      actuals: node.actuals.map(actual => actual.visit(this, payload)),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  // --------------------------------------------------------------------------
}
