import * as ast from './ast.js';

export abstract class Visitor<P, R> {
  abstract visitInteger(node: ast.Integer, payload: P): R;
  abstract visitFloat(node: ast.Float, payload: P): R;
  abstract visitBoolean(node: ast.Boolean, payload: P): R;
  abstract visitString(node: ast.String, payload: P): R;

  abstract visitLogicalNegate(node: ast.LogicalNegate, payload: P): R;
  abstract visitArithmeticNegate(node: ast.ArithmeticNegate, payload: P): R;
  abstract visitBitwiseNegate(node: ast.BitwiseNegate, payload: P): R;

  abstract visitAdd(node: ast.Add, payload: P): R;
  abstract visitSubtract(node: ast.Subtract, payload: P): R;
  abstract visitMultiply(node: ast.Multiply, payload: P): R;
  abstract visitDivide(node: ast.Divide, payload: P): R;
  abstract visitRemainder(node: ast.Remainder, payload: P): R;
  abstract visitPower(node: ast.Power, payload: P): R;
  abstract visitLessThan(node: ast.LessThan, payload: P): R;
  abstract visitGreaterThan(node: ast.GreaterThan, payload: P): R;
  abstract visitLessThanOrEqual(node: ast.LessThanOrEqual, payload: P): R;
  abstract visitGreaterThanOrEqual(node: ast.GreaterThanOrEqual, payload: P): R;
  abstract visitEqual(node: ast.Equal, payload: P): R;
  abstract visitNotEqual(node: ast.NotEqual, payload: P): R;
  abstract visitLogicalAnd(node: ast.LogicalAnd, payload: P): R;
  abstract visitLogicalOr(node: ast.LogicalOr, payload: P): R;
  abstract visitBitwiseAnd(node: ast.BitwiseAnd, payload: P): R;
  abstract visitBitwiseOr(node: ast.BitwiseOr, payload: P): R;
  abstract visitXor(node: ast.Xor, payload: P): R;
  abstract visitLeftShift(node: ast.LeftShift, payload: P): R;
  abstract visitRightShift(node: ast.RightShift, payload: P): R;

  abstract visitAssignment(node: ast.Assignment, payload: P): R;
  abstract visitDeclaration(node: ast.Declaration, payload: P): R;
  abstract visitVariable(node: ast.Variable, payload: P): R;
  abstract visitBlock(node: ast.Block, payload: P): R;
  abstract visitPrint(node: ast.Print, payload: P): R;
  abstract visitIf(node: ast.If, payload: P): R;
  abstract visitWhile(node: ast.While, payload: P): R;

  abstract visitFunctionDefinition(node: ast.FunctionDefinition, payload: P): R;
  abstract visitFunctionCall(node: ast.FunctionCall, payload: P): R;
}
