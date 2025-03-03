import * as ast from './ast.js';
import {Visitor} from './visitor.js';
import {WhereError} from './exception.js';
import {Where} from './where.js';
import type {NodeClass, SymbolMap} from './symbol-map.js';

export class Type {
  text: string;

  constructor(text: string) {
    this.text = text;
  }

  equals(that: Type): boolean {
    return this.text === that.text;
  }

  covers(that: Type): boolean {
    return this.text === that.text;
  }

  toString(): string {
    return this.text;
  }

  serializeValue(value: any): string {
    return value.toString();
  }

  static Integer = new Type('int');
  static Float = new Type('float');
  static Double = new Type('double');
  static Void = new Type('void');
  static Boolean = new Type('boolean');
  static String = new Type('String');
}

const typeMap: {[index: string]: Type} = {
  'int': Type.Integer,
  'float': Type.Float,
  'double': Type.Double,
  'void': Type.Void,
  'boolean': Type.Boolean,
  'String': Type.String,
};

export class ArrayType extends Type {
  elementType: Type;

  constructor(elementType: Type) {
    super(`${elementType.text}[]`);
    this.elementType = elementType;
  }

  serializeValue(value: any): string {
    return `{${(value as Fruit[]).map(element => element.type.serializeValue(element.value)).join(', ')}}`;
  }
}

export class ObjectType extends Type {
}

export class UnionType extends Type {
  options: Type[];

  constructor(options: Type[]) {
    super(`(${options.map(option => option.text).join(' | ')})`);
    this.options = options;
  }

  covers(that: Type): boolean {
    // TODO: cover other union type
    return this.options.some(option => option.covers(that));
  }
}

const NumberType = new UnionType([Type.Double, Type.Float, Type.Integer]);

export class Fruit {
  type: Type;
  value: any;

  constructor(type: Type, value: any = null) {
    this.type = type;
    this.value = value;
  }

  toString(): string {
    return this.value.toString();
  }
}

class FormalEntry {
  identifier: string;
  type: Type;

  constructor(identifier: string, type: Type) {
    this.identifier = identifier;
    this.type = type;
  }
}

abstract class FunctionEntry {
  formals: FormalEntry[];
  returnType: Type;

  constructor(formals: FormalEntry[], returnType: Type) {
    this.formals = formals;
    this.returnType = returnType;
  }

  abstract call(evaluator: Evaluator, runtime: Runtime, where: Where): Fruit;
}

class FunctionFruit extends FunctionEntry {
  body: ast.Block;
  where: Where;

  constructor(formals: FormalEntry[], returnType: Type, body: ast.Block, where: Where) {
    super(formals, returnType);
    this.body = body;
    this.where = where;
  }

  call(evaluator: Evaluator, runtime: Runtime, _where: Where): Fruit {
    return this.body.visit(evaluator, runtime);
  }
}

class MinimumFunctionEntry extends FunctionEntry {
  constructor() {
    super([
      new FormalEntry('a', NumberType),
      new FormalEntry('b', NumberType),
    ], NumberType);
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Fruit {
    const a = runtime.variableBindings.get('a')!;
    const b = runtime.variableBindings.get('b')!;
    if (a.type.covers(Type.Double) && b.type.covers(Type.Double)) {
      const newValue = Math.min(a.value as number, b.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Double, newValue), where);
    } else if (a.type.covers(Type.Float) && b.type.covers(Type.Float)) {
      const newValue = Math.min(a.value as number, b.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Float, newValue), where);
    } else if (a.type.covers(Type.Integer) && b.type.covers(Type.Integer)) {
      const newValue = Math.min(a.value as number, b.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Integer, newValue), where);
    } else {
      throw new WhereError("The arguments to `min` must be of the same type.", where);
    }
  }
}

class MaximumFunctionEntry extends FunctionEntry {
  constructor() {
    super([
      new FormalEntry('a', NumberType),
      new FormalEntry('b', NumberType),
    ], NumberType);
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Fruit {
    const a = runtime.variableBindings.get('a')!;
    const b = runtime.variableBindings.get('b')!;
    if (a.type.covers(Type.Double) && b.type.covers(Type.Double)) {
      const newValue = Math.max(a.value as number, b.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Double, newValue), where);
    } else if (a.type.covers(Type.Float) && b.type.covers(Type.Float)) {
      const newValue = Math.max(a.value as number, b.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Float, newValue), where);
    } else if (a.type.covers(Type.Integer) && b.type.covers(Type.Integer)) {
      const newValue = Math.max(a.value as number, b.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Integer, newValue), where);
    } else {
      throw new WhereError("The arguments to `max` must be of the same type.", where);
    }
  }
}

class AbsoluteValueFunctionEntry extends FunctionEntry {
  constructor() {
    super([
      new FormalEntry('x', NumberType),
    ], NumberType);
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Fruit {
    const x = runtime.variableBindings.get('x')!;
    if (x.type.covers(Type.Double)) {
      const newValue = Math.abs(x.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Double, newValue), where);
    } else if (x.type.covers(Type.Float)) {
      const newValue = Math.abs(x.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Float, newValue), where);
    } else if (x.type.covers(Type.Integer)) {
      const newValue = Math.abs(x.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Integer, newValue), where);
    } else {
      throw new WhereError("The argument to `abs` must be a number.", where);
    }
  }
}

class LogFunctionEntry extends FunctionEntry {
  constructor() {
    super([
      new FormalEntry('x', NumberType),
    ], NumberType);
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Fruit {
    const x = runtime.variableBindings.get('x')!;
    if (x.type.covers(Type.Double)) {
      const newValue = Math.log(x.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Double, newValue), where);
    } else if (x.type.covers(Type.Float)) {
      const newValue = Math.log(x.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Float, newValue), where);
    } else if (x.type.covers(Type.Integer)) {
      const newValue = Math.log(x.value as number);
      // TODO: what should the return type be?
      throw new ReturnSomethingException(new Fruit(Type.Double, newValue), where);
    } else {
      throw new WhereError("The argument to `log` must be a number.", where);
    }
  }
}

class SquareRootFunctionEntry extends FunctionEntry {
  constructor() {
    super([
      new FormalEntry('x', NumberType),
    ], NumberType);
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Fruit {
    const x = runtime.variableBindings.get('x')!;
    if (x.type.covers(Type.Double)) {
      const newValue = Math.sqrt(x.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Double, newValue), where);
    } else if (x.type.covers(Type.Float)) {
      const newValue = Math.sqrt(x.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Float, newValue), where);
    } else if (x.type.covers(Type.Integer)) {
      const newValue = Math.sqrt(x.value as number);
      // TODO: what should the return type be?
      throw new ReturnSomethingException(new Fruit(Type.Double, newValue), where);
    } else {
      throw new WhereError("The argument to `sqrt` must be a number.", where);
    }
  }
}

class IntCastFunctionEntry extends FunctionEntry {
  constructor() {
    super([
      new FormalEntry('x', new UnionType([Type.Double, Type.Float, Type.Integer, Type.String])),
    ], Type.Integer);
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Fruit {
    const variable = runtime.variableBindings.get('x')!;
    let newValue: any;
    if (variable.type.covers(Type.Double) || variable.type.covers(Type.Float)) {
      newValue = Math.trunc(variable.value as number);
    } else if (variable.type.covers(Type.Integer)) {
      newValue = variable.value as number;
    } else {
      newValue = Number(variable.value);
      if (Number.isNaN(newValue)) {
        throw new WhereError(`The value \`"${variable.value}"\` cannot be converted to an integer.`, where);
      }
    }
    throw new ReturnSomethingException(new Fruit(Type.Integer, newValue), where);
  }
}

class FloatCastFunctionEntry extends FunctionEntry {
  constructor() {
    super([
      new FormalEntry('x', new UnionType([Type.Double, Type.Float, Type.Integer, Type.String])),
    ], Type.Float);
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Fruit {
    const variable = runtime.variableBindings.get('x')!;
    let newValue: any;
    if (variable.type.covers(Type.Double) || variable.type.covers(Type.Float) || variable.type.covers(Type.Integer)) {
      newValue = variable.value as number;
    } else {
      newValue = Number(variable.value);
      if (Number.isNaN(newValue)) {
        throw new WhereError(`The value \`"${variable.value}"\` cannot be converted to a float.`, where);
      }
    }
    throw new ReturnSomethingException(new Fruit(Type.Float, newValue), where);
  }
}

class DoubleCastFunctionEntry extends FunctionEntry {
  constructor() {
    super([
      new FormalEntry('x', new UnionType([Type.Double, Type.Float, Type.Integer, Type.String])),
    ], Type.Double);
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Fruit {
    const variable = runtime.variableBindings.get('x')!;
    let newValue: any;
    if (variable.type.covers(Type.Double) || variable.type.covers(Type.Float) || variable.type.covers(Type.Integer)) {
      newValue = variable.value as number;
    } else {
      newValue = Number(variable.value);
      if (Number.isNaN(newValue)) {
        throw new WhereError(`The value \`"${variable.value}"\` cannot be converted to a double.`, where);
      }
    }
    throw new ReturnSomethingException(new Fruit(Type.Double, newValue), where);
  }
}

abstract class MethodEntry {
  formals: FormalEntry[];
  returnType: Type;
  visibility: ast.Visibility;

  constructor(formals: FormalEntry[], returnType: Type, visibility: ast.Visibility) {
    this.formals = formals;
    this.returnType = returnType;
    this.visibility = visibility;
  }

  abstract call(evaluator: Evaluator, runtime: Runtime, where: Where): Fruit;
}

class MethodFruit extends MethodEntry {
  body: ast.Block;
  where: Where;

  constructor(formals: FormalEntry[], returnType: Type, visibility: ast.Visibility, body: ast.Block, where: Where) {
    super(formals, returnType, visibility);
    this.body = body;
    this.where = where;
  }

  call(evaluator: Evaluator, runtime: Runtime, _where: Where): Fruit {
    return this.body.visit(evaluator, runtime);
  }
}

class VariableEntry {
  type: Type;
  value: string | number | boolean | null;

  constructor(type: Type, value: any) {
    this.type = type;
    this.value = value;
  }

  foo() {
  }
}

class InstanceVariableEntry {
  type: Type;
  visibility: ast.Visibility;

  constructor(type: Type, visibility: ast.Visibility) {
    this.type = type;
    this.visibility = visibility;
  }
}

class ClassEntry {
  superclass: string | null;
  instanceVariableEntries: Map<string, InstanceVariableEntry>;
  instanceMethodEntries: Map<string, FunctionEntry>;
  where: Where;

  constructor(superclass: string | null, where: Where) {
    this.superclass = superclass;
    this.instanceVariableEntries = new Map();
    this.instanceMethodEntries = new Map();
    this.where = where;
  }
}

export class Runtime {
  variableBindings: Map<string, VariableEntry>;
  functionBindings: Map<string, FunctionEntry>;
  classBindings: Map<string, ClassEntry>;
  expectedType: Type | null;
  classFruit: ClassEntry | null;
  static stdout: string = '';

  constructor(variableBindings: Map<string, VariableEntry>, functionBindings: Map<string, FunctionEntry>, classBindings: Map<string, ClassEntry>, expectedType: Type | null, classFruit: ClassEntry | null) {
    this.variableBindings = variableBindings;
    this.functionBindings = functionBindings;
    this.classBindings = classBindings;
    this.expectedType = expectedType;
    this.classFruit = classFruit;
  }

  static new() {
    const runtime = new Runtime(new Map(), new Map(), new Map(), null, null);
    runtime.setFunction('int', new IntCastFunctionEntry());
    runtime.setFunction('float', new FloatCastFunctionEntry());
    runtime.setFunction('double', new DoubleCastFunctionEntry());
    runtime.setFunction('min', new MinimumFunctionEntry());
    runtime.setFunction('max', new MaximumFunctionEntry());
    runtime.setFunction('abs', new AbsoluteValueFunctionEntry());
    runtime.setFunction('log', new LogFunctionEntry());
    runtime.setFunction('sqrt', new SquareRootFunctionEntry());
    return runtime;
  }

  shallowClone() {
    return new Runtime(this.variableBindings, this.functionBindings, this.classBindings, this.expectedType, this.classFruit);
  }

  declareVariable(identifier: string, type: Type) {
    this.variableBindings.set(identifier, new VariableEntry(type, null));
  }

  setVariable(identifier: string, entry: VariableEntry) {
    this.variableBindings.set(identifier, entry);
  }

  getVariable(identifier: string): VariableEntry | undefined {
    return this.variableBindings.get(identifier);
  }

  setFunction(identifier: string, lambda: FunctionEntry) {
    this.functionBindings.set(identifier, lambda);
  }

  getFunction(identifier: string): FunctionEntry | undefined {
    return this.functionBindings.get(identifier);
  }
}

class ReturnSomethingException extends Error {
  fruit: Fruit;
  returnWhere: Where;

  constructor(fruit: Fruit, returnWhere: Where) {
    super();
    this.fruit = fruit;
    this.returnWhere = returnWhere;
  }
}

class ReturnNothingException extends Error {
  returnWhere: Where;

  constructor(returnWhere: Where) {
    super();
    this.returnWhere = returnWhere;
  }
}

export class Evaluator extends Visitor<Runtime, Fruit> {
  symbolMap: SymbolMap;

  constructor(symbolMap: SymbolMap) {
    super();
    this.symbolMap = symbolMap;
  }

  symbol(nodeClass: NodeClass): string {
    return this.symbolMap.get(nodeClass)!;
  }

  // --------------------------------------------------------------------------
  // Primitives
  // --------------------------------------------------------------------------

  visitInteger(node: ast.Integer, _runtime: Runtime): Fruit {
    return new Fruit(Type.Integer, node.rawValue);
  }

  visitFloat(node: ast.Float, _runtime: Runtime): Fruit {
    return new Fruit(Type.Float, node.rawValue);
  }

  visitDouble(node: ast.Double, _runtime: Runtime): Fruit {
    return new Fruit(Type.Double, node.rawValue);
  }

  visitBoolean(node: ast.Boolean, _runtime: Runtime): Fruit {
    return new Fruit(Type.Boolean, node.rawValue);
  }

  visitString(node: ast.String, _runtime: Runtime): Fruit {
    return new Fruit(Type.String, node.rawValue);
  }

  // --------------------------------------------------------------------------
  // Unary Operators
  // --------------------------------------------------------------------------

  visitLogicalNegate(node: ast.LogicalNegate, runtime: Runtime): Fruit {
    const operandFruit = node.operandNode.visit(this, runtime);
    if (operandFruit.type === Type.Boolean) {
      return new Fruit(Type.Boolean, !operandFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.LogicalNegate)} can only be applied to a boolean.`, node.where);
    }
  }

  visitArithmeticNegate(node: ast.ArithmeticNegate, runtime: Runtime): Fruit {
    const operandFruit = node.operandNode.visit(this, runtime);
    if (operandFruit.type.covers(Type.Integer)) {
      return new Fruit(Type.Integer, -operandFruit.value);
    } else if (operandFruit.type.covers(Type.Integer)) {
      return new Fruit(Type.Float, operandFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.ArithmeticNegate)} can only be applied to numbers.`, node.where);
    }
  }

  visitBitwiseNegate(node: ast.BitwiseNegate, runtime: Runtime): Fruit {
    const operandFruit = node.operandNode.visit(this, runtime);
    if (operandFruit.type.covers(Type.Integer)) {
      return new Fruit(Type.Integer, ~operandFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.BitwiseNegate)} can only be applied to integers.`, node.where);
    }
  }

  // --------------------------------------------------------------------------
  // Binary Operators
  // --------------------------------------------------------------------------

  visitAdd(node: ast.Add, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit.type.covers(Type.Integer) && rightFruit.type.covers(Type.Integer)) {
      return new Fruit(Type.Integer, leftFruit.value + rightFruit.value);
    } else if ((leftFruit.type.covers(Type.Integer) || leftFruit.type.covers(Type.Float)) &&
               (rightFruit.type.covers(Type.Integer) || rightFruit.type.covers(Type.Float))) {
      return new Fruit(Type.Float, leftFruit.value + rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.Add)} can only be applied to numbers.`, node.where);
    }
  }

  visitSubtract(node: ast.Subtract, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit.type.covers(Type.Integer) && rightFruit.type.covers(Type.Integer)) {
      return new Fruit(Type.Integer, leftFruit.value - rightFruit.value);
    } else if ((leftFruit.type.covers(Type.Integer) || leftFruit.type.covers(Type.Float)) &&
               (rightFruit.type.covers(Type.Integer) || rightFruit.type.covers(Type.Float))) {
      return new Fruit(Type.Float, leftFruit.value - rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.Subtract)} can only be applied to numbers.`, node.where);
    }
  }

  visitMultiply(node: ast.Multiply, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit.type.covers(Type.Integer) && rightFruit.type.covers(Type.Integer)) {
      return new Fruit(Type.Integer, leftFruit.value * rightFruit.value);
    } else if ((leftFruit.type.covers(Type.Integer) || leftFruit.type.covers(Type.Float)) &&
               (rightFruit.type.covers(Type.Integer) || rightFruit.type.covers(Type.Float))) {
      return new Fruit(Type.Float, leftFruit.value * rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.Multiply)} can only be applied to numbers.`, node.where);
    }
  }

  visitDivide(node: ast.Divide, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit.type.covers(Type.Integer) && rightFruit.type.covers(Type.Integer)) {
      return new Fruit(Type.Integer, Math.trunc(leftFruit.value / rightFruit.value));
    } else if ((leftFruit.type.covers(Type.Integer) || leftFruit.type.covers(Type.Float)) &&
               (rightFruit.type.covers(Type.Integer) || rightFruit.type.covers(Type.Float))) {
      return new Fruit(Type.Float, leftFruit.value / rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.Divide)} can only be applied to numbers.`, node.where);
    }
  }

  visitRemainder(node: ast.Remainder, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit.type.covers(Type.Integer) && rightFruit.type.covers(Type.Integer)) {
      // Do remainder rather than modulus. They differ in how they handle
      // negative numbers.
      return new Fruit(Type.Integer, leftFruit.value - rightFruit.value * (Math.floor(leftFruit.value / rightFruit.value)));
    } else {
      throw new WhereError(`${this.symbol(ast.Remainder)} can only be applied to integers.`, node.where);
    }
  }

  visitPower(node: ast.Power, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit.type.covers(Type.Integer) && rightFruit.type.covers(Type.Integer)) {
      return new Fruit(Type.Integer, leftFruit.value ** rightFruit.value);
    } else if ((leftFruit.type.covers(Type.Integer) || leftFruit.type.covers(Type.Float)) &&
               (rightFruit.type.covers(Type.Integer) || rightFruit.type.covers(Type.Float))) {
      return new Fruit(Type.Float, leftFruit.value ** rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.Power)} can only be applied to numbers.`, node.where);
    }
  }

  visitLessThan(node: ast.LessThan, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if ((leftFruit.type.covers(Type.Integer) || leftFruit.type.covers(Type.Float)) &&
        (rightFruit.type.covers(Type.Integer) || rightFruit.type.covers(Type.Float))) {
      return new Fruit(Type.Boolean, leftFruit.value < rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.LessThan)} can only be applied to numbers.`, node.where);
    }
  }

  visitGreaterThan(node: ast.GreaterThan, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if ((leftFruit.type.covers(Type.Integer) || leftFruit.type.covers(Type.Float)) &&
        (rightFruit.type.covers(Type.Integer) || rightFruit.type.covers(Type.Float))) {
      return new Fruit(Type.Boolean, leftFruit.value > rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.GreaterThan)} can only be applied to numbers.`, node.where);
    }
  }

  visitLessThanOrEqual(node: ast.LessThanOrEqual, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if ((leftFruit.type.covers(Type.Integer) || leftFruit.type.covers(Type.Float)) &&
        (rightFruit.type.covers(Type.Integer) || rightFruit.type.covers(Type.Float))) {
      return new Fruit(Type.Boolean, leftFruit.value <= rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.LessThanOrEqual)} can only be applied to numbers.`, node.where);
    }
  }

  visitGreaterThanOrEqual(node: ast.GreaterThanOrEqual, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if ((leftFruit.type.covers(Type.Integer) || leftFruit.type.covers(Type.Float)) &&
        (rightFruit.type.covers(Type.Integer) || rightFruit.type.covers(Type.Float))) {
      return new Fruit(Type.Boolean, leftFruit.value >= rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.GreaterThanOrEqual)} can only be applied to numbers.`, node.where);
    }
  }

  visitEqual(node: ast.Equal, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit.constructor.name !== rightFruit.constructor.name) {
      throw new WhereError(`${this.symbol(ast.Equal)} can only be applied to values of the same type.`, node.where);
    } else if ((leftFruit.type.covers(Type.Integer) || leftFruit.type.covers(Type.Float) || leftFruit.type.covers(Type.String) || leftFruit.type.covers(Type.Boolean)) &&
               (rightFruit.type.covers(Type.Integer) || rightFruit.type.covers(Type.Float) || rightFruit.type.covers(Type.String) || rightFruit.type.covers(Type.Boolean))) {
      return new Fruit(Type.Boolean, leftFruit.value === rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.Equal)} can only be applied to values of the same type.`, node.where);
    }
  }

  visitNotEqual(node: ast.NotEqual, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit.constructor.name !== rightFruit.constructor.name) {
      throw new WhereError(`${this.symbol(ast.NotEqual)} can only be applied to values of the same type.`, node.where);
    } else if ((leftFruit.type.covers(Type.Integer) || leftFruit.type.covers(Type.Float) || leftFruit.type.covers(Type.String) || leftFruit.type.covers(Type.Boolean)) &&
               (rightFruit.type.covers(Type.Integer) || rightFruit.type.covers(Type.Float) || rightFruit.type.covers(Type.String) || rightFruit.type.covers(Type.Boolean))) {
      return new Fruit(Type.Boolean, leftFruit.value !== rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.NotEqual)} can only be applied to values of the same type.`, node.where);
    }
  }

  visitLogicalAnd(node: ast.LogicalAnd, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    if (leftFruit.type.covers(Type.Boolean)) {
      if (!leftFruit.value) {
        return new Fruit(Type.Boolean, false);
      } else {
        const rightFruit = node.rightNode.visit(this, runtime);
        if (rightFruit.type.covers(Type.Boolean)) {
          return rightFruit;
        }
      }
    }
    throw new WhereError(`\`${this.symbol(ast.LogicalAnd)}\` can only be applied to booleans.`, node.where);
  }

  visitLogicalOr(node: ast.LogicalOr, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    if (leftFruit.type.covers(Type.Boolean)) {
      if (leftFruit.value) {
        return new Fruit(Type.Boolean, true);
      } else {
        const rightFruit = node.rightNode.visit(this, runtime);
        if (rightFruit.type.covers(Type.Boolean)) {
          return rightFruit;
        }
      }
    }
    throw new WhereError(`\`${this.symbol(ast.LogicalOr)}\` can only be applied to booleans.`, node.where);
  }

  visitBitwiseAnd(node: ast.BitwiseAnd, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit.type.covers(Type.Integer) && rightFruit.type.covers(Type.Integer)) {
      return new Fruit(Type.Integer, leftFruit.value & rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.BitwiseAnd)} can only be applied to integers.`, node.where);
    }
  }

  visitBitwiseOr(node: ast.BitwiseOr, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit.type.covers(Type.Integer) && rightFruit.type.covers(Type.Integer)) {
      return new Fruit(Type.Integer, leftFruit.value | rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.BitwiseOr)} can only be applied to integers.`, node.where);
    }
  }

  visitXor(node: ast.Xor, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit.type.covers(Type.Integer) && rightFruit.type.covers(Type.Integer)) {
      return new Fruit(Type.Integer, leftFruit.value ^ rightFruit.value);
    } else if (leftFruit.type.covers(Type.Boolean) && rightFruit.type.covers(Type.Boolean)) {
      return new Fruit(Type.Boolean, leftFruit.value !== rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.Xor)} can only be applied to integers or booleans.`, node.where);
    }
  }

  visitLeftShift(node: ast.LeftShift, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit.type.covers(Type.Integer) && rightFruit.type.covers(Type.Integer)) {
      return new Fruit(Type.Integer, leftFruit.value << rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.LeftShift)} can only be applied to integers.`, node.where);
    }
  }

  visitRightShift(node: ast.RightShift, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit.type.covers(Type.Integer) && rightFruit.type.covers(Type.Integer)) {
      return new Fruit(Type.Integer, leftFruit.value >> rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.RightShift)} can only be applied to integers.`, node.where);
    }
  }

  // --------------------------------------------------------------------------
  // Variables
  // --------------------------------------------------------------------------

  assignVariable(label: string, where: Where, identifier: string, fruit: Fruit, runtime: Runtime) {
    const oldFruit = runtime.getVariable(identifier);
    if (oldFruit) {
      if (oldFruit.type.covers(fruit.type)) {
        runtime.setVariable(identifier, new VariableEntry(fruit.type, fruit.value));
      } else {
        throw new WhereError(`${label} \`${identifier}\` has type \`${oldFruit.type}\`. A value of type \`${fruit.type}\` cannot be assigned to it.`, where);
      }
    } else {
      throw new WhereError(`${label} \`${identifier}\` is undeclared.`, where);
    }
  }

  visitBlank(_node: ast.Blank, _runtime: Runtime): Fruit {
    return new Fruit(Type.Void);
  }

  visitAssignment(node: ast.Assignment, runtime: Runtime): Fruit {
    const rightFruit = node.rightNode.visit(this, runtime);

    // Don't evaluate left-hand side because that does an rvalue lookup.
    if (node.leftNode instanceof ast.Variable) {
      const identifier = node.leftNode.identifier;
      this.assignVariable('Variable', node.where, identifier, rightFruit, runtime);
    } else if (node.leftNode instanceof ast.ArraySubscript) {
      const receiverFruit = node.leftNode.arrayNode.visit(this, runtime);
      if (!(receiverFruit.type instanceof ArrayType)) {
        throw new WhereError(`The index operator cannot be applied to a value of type \`${receiverFruit.type}\`.`, node.leftNode.where);
      }

      const indexFruit = node.leftNode.indexNode.visit(this, runtime);
      if (!(indexFruit.type.covers(Type.Integer))) {
        throw new WhereError(`An index must be an integer.`, node.leftNode.indexNode.where);
      }

      if (0 <= indexFruit.value && indexFruit.value < receiverFruit.value.length) {
        receiverFruit.value[indexFruit.value] = rightFruit;
      } else {
        throw new WhereError(`This array has ${receiverFruit.value.length} element${receiverFruit.value.length === 1 ? '' : 's'}. Index ${indexFruit.value} is out of bounds.`, node.leftNode.indexNode.where);
      }
    } else if (node.leftNode instanceof ast.Member) {
      const receiverFruit = node.leftNode.receiverNode.visit(this, runtime);
      if (!(receiverFruit.type instanceof ObjectType)) {
        throw new WhereError(`A value of type \`${receiverFruit.type}\` has no properties.`, node.leftNode.where);
      }
      if (receiverFruit.value.has(node.leftNode.identifier)) {
        // TODO: do types match?
        // TODO: is it public?
        receiverFruit.value.set(node.leftNode.identifier, rightFruit);
      } else {
        throw new WhereError(`A value of type \`${receiverFruit.type}\` does not have a \`${node.leftNode.identifier}\` property.`, node.where);
      }
    }

    return new Fruit(Type.Void);
  }

  resolveType(node: ast.Node, typeName: string, runtime: Runtime): Type {
    const type = typeMap[typeName];
    if (type) {
      return type;
    } else if (typeName.endsWith('[]')) {
      const elementTypeName = typeName.substring(0, typeName.length - 2);
      const elementType = this.resolveType(node, elementTypeName, runtime);
      const type = new ArrayType(elementType);
      typeMap[typeName] = type;
      return type;
    } else {
      throw new WhereError(`The type \`${typeName}\` is unknown.`, node.where);
    }
  }

  visitDeclaration(node: ast.Declaration, runtime: Runtime): Fruit {
    let oldFruit = runtime.getVariable(node.identifier);
    if (oldFruit) {
      throw new WhereError(`Variable \`${node.identifier}\` is already declared.`, node.where);
    }

    const type = this.resolveType(node, node.variableType, runtime);
    runtime.declareVariable(node.identifier, type);

    if (node.rightNode) {
      const rightFruit = node.rightNode.visit(this, runtime);
      this.assignVariable('Variable', node.where, node.identifier, rightFruit, runtime);
    }

    return new Fruit(Type.Void);
  }

  visitVariable(node: ast.Variable, runtime: Runtime): Fruit {
    const entry = runtime.getVariable(node.identifier);
    if (entry) {
      if (entry.value === null) {
        throw new WhereError(`Variable ${node.identifier} is uninitialized.`, node.where);
      } else {
        return new Fruit(entry.type, entry.value);
      }
    } else {
      throw new WhereError(`Variable ${node.identifier} is undeclared.`, node.where);
    }
  }

  visitBlock(node: ast.Block, runtime: Runtime): Fruit {
    for (let statement of node.statements) {
      statement.visit(this, runtime);
    }
    return new Fruit(Type.Void);
  }

  visitPrint(node: ast.Print, runtime: Runtime): Fruit {
    const fruit = node.operandNode.visit(this, runtime);
    if (fruit.type.covers(Type.Integer) ||
        fruit.type.covers(Type.Float) ||
        fruit.type.covers(Type.Double) ||
        fruit.type.covers(Type.String) ||
        fruit.type.covers(Type.Boolean) ||
        fruit.type instanceof ArrayType ||
        fruit.type instanceof ObjectType) {
      Runtime.stdout += fruit.type.serializeValue(fruit.value) + "\n";
    } else {
      throw new WhereError('Only values may be printed.', node.where);
    }
    return new Fruit(Type.Void);
  }

  visitIf(node: ast.If, runtime: Runtime): Fruit {
    const fruit = node.conditionNode.visit(this, runtime);
    if (fruit.type.covers(Type.Boolean)) {
      if (fruit.value) {
        node.thenBlock.visit(this, runtime);
      } else if (node.elseBlock) {
        node.elseBlock.visit(this, runtime);
      }
    } else {
      throw new WhereError('A condition must yield a boolean value.', node.conditionNode.where);
    }
    return new Fruit(Type.Void);
  }

  visitWhile(node: ast.While, runtime: Runtime): Fruit {
    let isTerminated = false;
    while (!isTerminated) {
      const fruit = node.conditionNode.visit(this, runtime);
      if (fruit.type.covers(Type.Boolean)) {
        if (fruit.value) {
          node.body.visit(this, runtime);
        } else {
          isTerminated = true;
        }
      } else {
        throw new WhereError('A condition must yield a boolean value.', node.conditionNode.where);
      }
    }
    return new Fruit(Type.Void);
  }

  visitDoWhile(node: ast.DoWhile, runtime: Runtime): Fruit {
    let isTerminated = false;
    while (!isTerminated) {
      node.body.visit(this, runtime);
      const fruit = node.conditionNode.visit(this, runtime);
      if (fruit.type.covers(Type.Boolean)) {
        if (!fruit.value) {
          isTerminated = true;
        }
      } else {
        throw new WhereError('A condition must yield a boolean value.', node.conditionNode.where);
      }
    }
    return new Fruit(Type.Void);
  }

  visitRepeatUntil(node: ast.RepeatUntil, runtime: Runtime): Fruit {
    let isTerminated = false;
    while (!isTerminated) {
      node.body.visit(this, runtime);
      const fruit = node.conditionNode.visit(this, runtime);
      if (fruit.type.covers(Type.Boolean)) {
        if (fruit.value) {
          isTerminated = true;
        }
      } else {
        throw new WhereError('A condition must yield a boolean value.', node.conditionNode.where);
      }
    }
    return new Fruit(Type.Void);
  }

  visitFor(node: ast.For, _runtime: Runtime): Fruit {
    let isTerminated = false;
    const newRuntime = Runtime.new();
    node.initializationNode?.visit(this, newRuntime);
    while (!isTerminated) {
      const fruit = node.conditionNode.visit(this, newRuntime);
      if (fruit.type.covers(Type.Boolean)) {
        if (fruit.value) {
          node.body.visit(this, newRuntime);
          node.incrementBlock.visit(this, newRuntime);
        } else {
          isTerminated = true;
        }
      } else {
        throw new WhereError('A condition must yield a boolean value.', node.conditionNode.where);
      }
    }
    return new Fruit(Type.Void);
  }

  // --------------------------------------------------------------------------
  // Functions
  // --------------------------------------------------------------------------

  visitFunctionDefinition(node: ast.FunctionDefinition, runtime: Runtime): Fruit {
    const formalEntries = node.formals.map(formal => {
      const type = this.resolveType(node, formal.type, runtime);
      return new FormalEntry(formal.identifier, type);
    });
    const returnType = this.resolveType(node, node.returnType, runtime);
    runtime.functionBindings.set(node.identifier, new FunctionFruit(formalEntries, returnType, node.body, node.where));
    return new Fruit(Type.Void);
  }

  visitFunctionCall(node: ast.FunctionCall, runtime: Runtime): Fruit {
    const lambda = runtime.functionBindings.get(node.identifier);
    if (lambda) {
      if (node.actuals.length !== lambda.formals.length) {
        throw new WhereError(`Function \`${node.identifier}\` expects ${lambda.formals.length} parameter${lambda.formals.length === 1 ? '' : 's'}. ${node.actuals.length} ${node.actuals.length === 1 ? 'was' : 'were'} given.`, node.where);
      }

      const newRuntime = Runtime.new();
      for (let [i, formal] of lambda.formals.entries()) {
        newRuntime.declareVariable(formal.identifier, formal.type);
        const fruit = node.actuals[i].visit(this, runtime);
        this.assignVariable('Parameter', node.actuals[i].where, formal.identifier, fruit, newRuntime);
      }

      let fruit;
      try {
        lambda.call(this, newRuntime, node.where);
        if (lambda instanceof FunctionFruit) {
          if (!lambda.returnType.covers(Type.Void)) {
            throw new WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${lambda.returnType}\`. It didn't return anything.`, lambda.where);
          }
        }
        fruit = new Fruit(Type.Void);
      } catch (e) {
        if (e instanceof ReturnSomethingException) {
          if (lambda.returnType.covers(Type.Void)) {
            throw new WhereError(`Function \`${node.identifier}\` is declared to return nothing. It returned something.`, e.returnWhere);
          } else if (!lambda.returnType.covers(e.fruit.type)) {
            throw new WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${lambda.returnType}\`. It returned a value of type \`${e.fruit.type}\`.`, e.returnWhere);
          } else {
            fruit = e.fruit;
          }
        } else if (e instanceof ReturnNothingException) {
          if (!(lambda.returnType.covers(Type.Void))) {
            throw new WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${lambda.returnType}\`. It returned nothing.`, e.returnWhere);
          } else {
            fruit = new Fruit(Type.Void);
          }
        } else {
          throw e;
        }
      }

      return fruit;
    } else {
      throw new WhereError(`Function \`${node.identifier}\` is not defined.`, node.where);
    }
  }

  visitReturn(node: ast.Return, runtime: Runtime): Fruit {
    if (node.operandNode) {
      const fruit = node.operandNode.visit(this, runtime);
      throw new ReturnSomethingException(fruit, node.where);
    } else {
      throw new ReturnNothingException(node.where);
    }
  }

  visitLineComment(_node: ast.LineComment, _runtime: Runtime): Fruit {
    return new Fruit(Type.Void);
  }

  // --------------------------------------------------------------------------
  // Arrays
  // --------------------------------------------------------------------------

  visitArrayLiteral(node: ast.ArrayLiteral, runtime: Runtime): Fruit {
    if (!runtime.expectedType) {
      throw new WhereError("An array literal is in an unexpected place. It must be part of an array declaration.", node.where);
    }

    const elementType = (runtime.expectedType as ArrayType).elementType;

    const newRuntime = runtime.shallowClone();
    newRuntime.expectedType = elementType;
    const elementFruits = node.elementNodes.map(elementNode => elementNode.visit(this, newRuntime));

    const badIndex = elementFruits.findIndex(elementFruit => !elementFruit.type.covers(elementType));
    if (badIndex >= 0) {
      throw new WhereError(`An array element has the wrong type. It must have type \`${elementType}\`.`, node.elementNodes[badIndex].where);
    }

    return new Fruit(new ArrayType(elementType), elementFruits);
  }

  visitArrayDeclaration(node: ast.ArrayDeclaration, runtime: Runtime): Fruit {
    // The array literal needs to know what type its elements should have. We
    // pass the element type through the runtime.
    const newRuntime = runtime.shallowClone();
    newRuntime.expectedType = this.resolveType(node, node.variableType, runtime);
    return this.visitDeclaration(node, newRuntime);
  }

  visitArraySubscript(node: ast.ArraySubscript, runtime: Runtime): Fruit {
    const receiverFruit = node.arrayNode.visit(this, runtime);
    if (!(receiverFruit.type instanceof ArrayType)) {
      throw new WhereError(`The index operator cannot be applied to a value of type \`${receiverFruit.type}\`.`, node.where);
    }

    const indexFruit = node.indexNode.visit(this, runtime);
    if (!(indexFruit.type.covers(Type.Integer))) {
      throw new WhereError(`An index must be an integer.`, node.indexNode.where);
    }

    if (0 <= indexFruit.value && indexFruit.value < receiverFruit.value.length) {
      return receiverFruit.value[indexFruit.value];
    } else {
      throw new WhereError(`This array has ${receiverFruit.value.length} element${receiverFruit.value.length === 1 ? '' : 's'}. Index ${indexFruit.value} is out of bounds.`, node.indexNode.where);
    }
  }

  visitMember(node: ast.Member, runtime: Runtime): Fruit {
    const receiverFruit = node.receiverNode.visit(this, runtime);
    if (receiverFruit.type instanceof ArrayType && node.identifier === 'length') {
      return new Fruit(Type.Integer, receiverFruit.value.length);
    } else if (receiverFruit.type instanceof ObjectType) {
      const memberFruit = receiverFruit.value.get(node.identifier);
      if (memberFruit) {
        if (memberFruit.value === null) {
          throw new WhereError(`Property \`${node.identifier}\` has not been initialized.`, node.where);
        } else {
          return memberFruit;
        }
      }
    }
    throw new WhereError(`A value of type \`${receiverFruit.type}\` does not have a \`${node.identifier}\` property.`, node.where);
  }

  // --------------------------------------------------------------------------
  // Classes
  // --------------------------------------------------------------------------

  visitClassDefinition(node: ast.ClassDefinition, runtime: Runtime): Fruit {
    const classFruit = new ClassEntry(node.superclass, node.where);
    const newRuntime = runtime.shallowClone();
    newRuntime.classFruit = classFruit;

    node.instanceVariableDeclarations.forEach(declaration => declaration.visit(this, newRuntime));
    node.methodDefinitions.forEach(definition => definition.visit(this, newRuntime));

    runtime.classBindings.set(node.identifier, classFruit);

    return new Fruit(Type.Void);
  }

  visitInstanceVariableDeclaration(node: ast.InstanceVariableDeclaration, runtime: Runtime): Fruit {
    const classFruit = runtime.classFruit!;

    if (classFruit.instanceVariableEntries.has(node.identifier)) {
      throw new WhereError(`Variable ${node.identifier} has already been declared.`, node.where);
    }    

    const visibility = node.visibility ?? ast.Visibility.Public;
    const type = this.resolveType(node, node.variableType, runtime);
    classFruit.instanceVariableEntries.set(node.identifier, new InstanceVariableEntry(type, visibility));

    return new Fruit(Type.Void);
  }

  visitMethodDefinition(node: ast.MethodDefinition, runtime: Runtime): Fruit {
    const classFruit = runtime.classFruit!;

    if (classFruit.instanceMethodEntries.has(node.identifier)) {
      throw new WhereError(`Method ${node.identifier} has already been defined.`, node.where);
    }    

    const formalEntries = node.formals.map(formal => {
      const type = this.resolveType(node, formal.type, runtime);
      return new FormalEntry(formal.identifier, type);
    });
    const returnType = this.resolveType(node, node.returnType, runtime);

    const visibility = node.visibility ?? ast.Visibility.Public;
    classFruit.instanceMethodEntries.set(node.identifier, new MethodFruit(formalEntries, returnType, visibility, node.body, node.where));

    return new Fruit(Type.Void);
  }

  visitInstantiation(node: ast.Instantiation, runtime: Runtime): Fruit {
    const classFruit = runtime.classBindings.get(node.identifier);
    if (!classFruit) {
      throw new WhereError(`Class ${node.identifier} is not defined.`, node.where);
    }
    return new Fruit(new ObjectType(node.identifier), new Map(Array.from(classFruit.instanceVariableEntries, ([identifier, fruit]) => [identifier, new Fruit(fruit.type, null)])));
  }

  visitCall(_context: string, node: ast.MethodCall | ast.FunctionCall, subroutineFruit: MethodEntry | FunctionEntry, runtime: Runtime) {
    if (node.actuals.length !== subroutineFruit.formals.length) {
      throw new WhereError(`Function \`${node.identifier}\` expects ${subroutineFruit.formals.length} parameter${subroutineFruit.formals.length === 1 ? '' : 's'}. ${node.actuals.length} ${node.actuals.length === 1 ? 'was' : 'were'} given.`, node.where);
    }

    const newRuntime = Runtime.new();
    for (let [i, formal] of subroutineFruit.formals.entries()) {
      newRuntime.declareVariable(formal.identifier, formal.type);
      const fruit = node.actuals[i].visit(this, runtime);
      this.assignVariable('Parameter', node.actuals[i].where, formal.identifier, fruit, newRuntime);
    }

    let fruit;
    try {
      subroutineFruit.call(this, newRuntime, node.where);
      if (subroutineFruit instanceof FunctionFruit) {
        if (!subroutineFruit.returnType.covers(Type.Void)) {
          throw new WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${subroutineFruit.returnType}\`. It didn't return anything.`, subroutineFruit.where);
        }
      }
      fruit = new Fruit(Type.Void);
    } catch (e) {
      if (e instanceof ReturnSomethingException) {
        if (subroutineFruit.returnType.covers(Type.Void)) {
          throw new WhereError(`Function \`${node.identifier}\` is declared to return nothing. It returned something.`, e.returnWhere);
        } else if (subroutineFruit.returnType !== e.fruit.type) {
          throw new WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${subroutineFruit.returnType}\`. It returned a value of type \`${e.fruit.type}\`.`, e.returnWhere);
        } else {
          fruit = e.fruit;
        }
      } else if (e instanceof ReturnNothingException) {
        if (!subroutineFruit.returnType.covers(Type.Void)) {
          throw new WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${subroutineFruit.returnType}\`. It returned nothing.`, e.returnWhere);
        } else {
          fruit = new Fruit(Type.Void);
        }
      } else {
        throw e;
      }
    }

    return fruit;
  }

  visitMethodCall(node: ast.MethodCall, runtime: Runtime): Fruit {
    const receiverFruit = node.receiverNode.visit(this, runtime);
    if (!(receiverFruit.type instanceof ObjectType)) {
      throw new WhereError(`A value of type \`${receiverFruit.type}\` is not an object. Methods cannot be called on it.`, node.receiverNode.where);
    }

    // TODO: will classFruit be defined?
    const classFruit = runtime.classBindings.get(receiverFruit.type.text)!;

    const lambda = classFruit.instanceMethodEntries.get(node.identifier);
    if (!lambda) {
      throw new WhereError(`Function ${node.identifier} is not defined.`, node.where);
    }

    return this.visitCall('method', node, lambda, runtime);
  }

  // --------------------------------------------------------------------------
}
