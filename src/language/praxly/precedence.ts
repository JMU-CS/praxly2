import * as ast from '../ast.js';

enum Level {
  LogicalOr,
  LogicalAnd,
  BitwiseOr,
  Xor,
  BitwiseAnd,
  Equality,
  Relational,
  Shift,
  Additive,
  Multiplicative,
  Exponential,
  PrefixUnary,
  PostfixUnary,
  Apex,
}

export const precedence = new Map();

precedence.set(ast.LogicalOr, Level.LogicalOr);
precedence.set(ast.LogicalAnd, Level.LogicalAnd);

precedence.set(ast.BitwiseOr, Level.BitwiseOr);
precedence.set(ast.Xor, Level.Xor);
precedence.set(ast.BitwiseAnd, Level.BitwiseAnd);

precedence.set(ast.Equal, Level.Equality);
precedence.set(ast.NotEqual, Level.Equality);

precedence.set(ast.LessThan, Level.Relational);
precedence.set(ast.GreaterThan, Level.Relational);
precedence.set(ast.LessThanOrEqual, Level.Relational);
precedence.set(ast.GreaterThanOrEqual, Level.Relational);

precedence.set(ast.LeftShift, Level.Shift);
precedence.set(ast.RightShift, Level.Shift);

precedence.set(ast.Add, Level.Additive);
precedence.set(ast.Subtract, Level.Additive);

precedence.set(ast.Multiply, Level.Multiplicative);
precedence.set(ast.Divide, Level.Multiplicative);
precedence.set(ast.Remainder, Level.Multiplicative);

precedence.set(ast.Power, Level.Exponential);

precedence.set(ast.LogicalNegate, Level.PrefixUnary);
precedence.set(ast.ArithmeticNegate, Level.PrefixUnary);
precedence.set(ast.BitwiseNegate, Level.PrefixUnary);

precedence.set(ast.ArraySubscript, Level.PostfixUnary);
precedence.set(ast.ArrayLength, Level.PostfixUnary);

precedence.set(ast.Integer, Level.Apex);
precedence.set(ast.Float, Level.Apex);
precedence.set(ast.Boolean, Level.Apex);
precedence.set(ast.String, Level.Apex);

export enum Associativity {
  Left,
  Right,
  None,
}

export const associativity = new Map();
associativity.set(Level.BitwiseOr, Associativity.Left);
associativity.set(Level.Xor, Associativity.Left);
associativity.set(Level.BitwiseAnd, Associativity.Left);
associativity.set(Level.Equality, Associativity.Left);
associativity.set(Level.Relational, Associativity.Left);
associativity.set(Level.Shift, Associativity.Left);
associativity.set(Level.LogicalOr, Associativity.Left);
associativity.set(Level.LogicalAnd, Associativity.Left);
associativity.set(Level.Additive, Associativity.Left);
associativity.set(Level.Multiplicative, Associativity.Left);
associativity.set(Level.Exponential, Associativity.Right);
associativity.set(Level.PrefixUnary, Associativity.Right);
associativity.set(Level.PostfixUnary, Associativity.Left);
associativity.set(Level.Apex, Associativity.None);
