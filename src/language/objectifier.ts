import * as ast from './ast.js';
import {Visitor} from './visitor.js';

export class Objectifier extends Visitor<Object, Object> {

  // --------------------------------------------------------------------------
  // Primitives
  // --------------------------------------------------------------------------

  visitNull(node: ast.Null, _payload: Object): Object {
    return {
      type: 'null',
      where: {start: node.where.start, end: node.where.end},
    };
  }

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

  visitDouble(node: ast.Double, payload: Object): Object {
    return this.visitPrimitive<number>(node, payload, 'double');
  }

  visitBoolean(node: ast.Boolean, payload: Object): Object {
    return this.visitPrimitive<boolean>(node, payload, 'boolean');
  }

  visitCharacter(node: ast.Character, payload: Object): Object {
    return this.visitPrimitive<string>(node, payload, 'character');
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

  visitAssociation(node: ast.Association, payload: Object): Object {
    return this.visitUnaryOperator(node, payload, 'association');
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

  visitPostIncrement(node: ast.PostIncrement, payload: Object): Object {
    return this.visitUnaryOperator(node, payload, 'post-increment');
  }

  visitPostDecrement(node: ast.PostDecrement, payload: Object): Object {
    return this.visitUnaryOperator(node, payload, 'post-decrement');
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

  visitExpressionStatement(node: ast.ExpressionStatement, payload: Object): Object {
    return {
      type: 'expression-statement',
      expression: node.expressionNode.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitBlank(node: ast.Blank, _payload: Object): Object {
    return {
      type: 'blank',
      count: node.count,
      where: {start: node.where.start, end: node.where.end},
    };
  }

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
      type: 'scalar-declaration',
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
      conditionNodes: node.conditionNodes.map(conditionNode => conditionNode.visit(this, payload)),
      thenBlocks: node.thenBlocks.map(thenBlock => thenBlock.visit(this, payload)),
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

  visitDoWhile(node: ast.DoWhile, payload: Object): Object {
    return {
      type: 'do-while',
      body: node.body.visit(this, payload),
      conditionNode: node.conditionNode.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitRepeatUntil(node: ast.RepeatUntil, payload: Object): Object {
    return {
      type: 'repeat-until',
      body: node.body.visit(this, payload),
      conditionNode: node.conditionNode.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitFor(node: ast.For, payload: Object): Object {
    return {
      type: 'for',
      initializationNode: node.initializationNode?.visit(this, payload),
      conditionNode: node.conditionNode.visit(this, payload),
      incrementBlock: node.incrementBlock.visit(this, payload),
      body: node.body.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitForEach(node: ast.ForEach, payload: Object): Object {
    return {
      type: 'for-each',
      identifier: node.identifier,
      iterableNode: node.iterableNode.visit(this, payload),
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
        type: formal.type,
      })),
      returnType: node.returnType,
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

  visitReturn(node: ast.Return, payload: Object): Object {
    return {
      type: 'return',
      operandNode: node.operandNode?.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitLineComment(node: ast.LineComment, _payload: Object): Object {
    return {
      type: 'line-comment',
      text: node.text,
      where: {start: node.where.start, end: node.where.end},
    };
  }

  // --------------------------------------------------------------------------
  // Range
  // --------------------------------------------------------------------------

  visitRangeLiteral(node: ast.RangeLiteral, payload: Object): Object {
    return {
      type: 'range-literal',
      loNode: node.loNode.visit(this, payload),
      hiNode: node.hiNode.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  // --------------------------------------------------------------------------
  // Arrays
  // --------------------------------------------------------------------------

  visitArrayLiteral(node: ast.ArrayLiteral, payload: Object): Object {
    return {
      type: 'array-literal',
      elementNodes: node.elementNodes.map(elementNode => elementNode.visit(this, payload)),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitArrayDeclaration(node: ast.ArrayDeclaration, payload: Object): Object {
    return {
      type: 'array-declaration',
      identifier: node.identifier,
      variableType: node.variableType,
      rightNode: node.rightNode!.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitArraySubscript(node: ast.ArraySubscript, payload: Object): Object {
    return {
      type: 'array-subscript',
      arrayNode: node.arrayNode.visit(this, payload),
      indexNode: node.indexNode.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitMember(node: ast.Member, payload: Object): Object {
    return {
      type: 'member',
      receiverNode: node.receiverNode.visit(this, payload),
      identifier: node.identifier,
      where: {start: node.where.start, end: node.where.end},
    };
  }

  // --------------------------------------------------------------------------
  // Classes
  // --------------------------------------------------------------------------

  visitClassDefinition(node: ast.ClassDefinition, payload: Object): Object {
    return {
      type: 'class-definition',
      identifier: node.identifier,
      instanceVariableDeclarations: node.instanceVariableDeclarations.map(declaration => declaration.visit(this, payload)),
      methodDefinitions: node.methodDefinitions.map(definition => definition.visit(this, payload)),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitInstanceVariableDeclaration(node: ast.InstanceVariableDeclaration, _payload: Object): Object {
    return {
      type: 'instance-variable-declaration',
      identifier: node.identifier,
      variableType: node.variableType,
      visibility: node.visibility,
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitMethodDefinition(node: ast.MethodDefinition, payload: Object): Object {
    return {
      type: 'method-definition',
      identifier: node.identifier,
      formals: node.formals.map(formal => ({
        identifier: formal.identifier,
        type: formal.type,
      })),
      returnType: node.returnType,
      body: node.body.visit(this, payload),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitInstantiation(node: ast.Instantiation, _payload: Object): Object {
    return {
      type: 'instantiation',
      identifier: node.identifier,
      where: {start: node.where.start, end: node.where.end},
    };
  }

  visitMethodCall(node: ast.MethodCall, payload: Object): Object {
    return {
      type: 'method-call',
      receiverNode: node.receiverNode.visit(this, payload),
      identifier: node.identifier,
      actuals: node.actuals.map(actual => actual.visit(this, payload)),
      where: {start: node.where.start, end: node.where.end},
    };
  }

  // --------------------------------------------------------------------------
}
