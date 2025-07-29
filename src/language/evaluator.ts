import * as ast from './ast.js';
import prand from 'pure-rand';
import {Visitor} from './visitor.js';
import * as error from './error.js';
import {Where} from './where.js';
import type {NodeClass, OutputFormatter} from './output-formatter.js';
import {Type, ArrayType, SizedArrayType, NumberType, UnionType, LazyClassType, ClassType, typeMap, Fruit, Visibility, FunctionType, FormalType, MethodType, InstanceVariableType} from './type.js';
import {Memdia} from './memdia.js';

// -- Functions ---------------------------------------------------------------

abstract class FunctionDefinition {
  type: FunctionType;

  constructor(type: FunctionType) {
    this.type = type;
  }

  abstract call(evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit>;
}

class FunctionFruit extends FunctionDefinition {
  body: ast.Block;
  where: Where;

  constructor(type: FunctionType, body: ast.Block, where: Where) {
    super(type);
    this.body = body;
    this.where = where;
  }

  call(evaluator: Evaluator, runtime: Runtime, _where: Where): Promise<Fruit> {
    return this.body.visit(evaluator, runtime);
  }
}

class RandomSeedFunctionEntry extends FunctionDefinition {
  constructor() {
    super(new FunctionType([
      new FormalType('seed', Type.Integer),
    ], Type.Void));
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit> {
    const seed = runtime.variableBindings.get('seed')!;
    runtime.globalRuntime.seedRng(seed.value as number);
    throw new ReturnNothingException(where);
  }
}

class RandomFloatFunctionEntry extends FunctionDefinition {
  constructor() {
    super(new FunctionType([], Type.Float));
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit> {
    // Pure-rand only generates integers. That's strange. We'll generate an
    // integer in a range and normalize it.
    const max = 2e9;
    const x = prand.unsafeUniformIntDistribution(0, max - 1, runtime.globalRuntime.rng) / max;
    throw new ReturnSomethingException(new Fruit(Type.Float, x), where);
  }
}

class InputFunctionEntry extends FunctionDefinition {
  constructor() {
    super(new FunctionType([], Type.String));
  }

  async call(_evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit> {
    const text: string = await runtime.globalRuntime.getInput();
    throw new ReturnSomethingException(new Fruit(Type.String, text), where);
  }
}

class RandomIntegerFunctionEntry extends FunctionDefinition {
  constructor() {
    super(new FunctionType([
      new FormalType('max', Type.Integer),
    ], Type.Integer));
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit> {
    const max = runtime.variableBindings.get('max')!.value as number;
    if (max < 1) {
      throw new error.WhereError(`The \`max\` parameter given to \`randomInt\` must be at least 1.`, where);
    }
    const x = prand.unsafeUniformIntDistribution(0, max - 1, runtime.globalRuntime.rng);
    throw new ReturnSomethingException(new Fruit(Type.Integer, x), where);
  }
}

class MinimumFunctionEntry extends FunctionDefinition {
  constructor() {
    super(new FunctionType([
      new FormalType('a', NumberType),
      new FormalType('b', NumberType),
    ], NumberType));
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit> {
    const a = runtime.variableBindings.get('a')!;
    const b = runtime.variableBindings.get('b')!;
    if (Type.Double.covers(a.type) && Type.Double.covers(b.type)) {
      const newValue = Math.min(a.value as number, b.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Double, newValue), where);
    } else if (Type.Float.covers(a.type) && Type.Float.covers(b.type)) {
      const newValue = Math.min(a.value as number, b.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Float, newValue), where);
    } else if (Type.Integer.covers(a.type) && Type.Integer.covers(b.type)) {
      const newValue = Math.min(a.value as number, b.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Integer, newValue), where);
    } else {
      throw new error.WhereError("The arguments to `min` must be of the same type.", where);
    }
  }
}

class MaximumFunctionEntry extends FunctionDefinition {
  constructor() {
    super(new FunctionType([
      new FormalType('a', NumberType),
      new FormalType('b', NumberType),
    ], NumberType));
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit> {
    const a = runtime.variableBindings.get('a')!;
    const b = runtime.variableBindings.get('b')!;
    if (Type.Double.covers(a.type) && Type.Double.covers(b.type)) {
      const newValue = Math.max(a.value as number, b.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Double, newValue), where);
    } else if (Type.Float.covers(a.type) && Type.Float.covers(b.type)) {
      const newValue = Math.max(a.value as number, b.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Float, newValue), where);
    } else if (Type.Integer.covers(a.type) && Type.Integer.covers(b.type)) {
      const newValue = Math.max(a.value as number, b.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Integer, newValue), where);
    } else {
      throw new error.WhereError("The arguments to `max` must be of the same type.", where);
    }
  }
}

class AbsoluteValueFunctionEntry extends FunctionDefinition {
  constructor() {
    super(new FunctionType([
      new FormalType('x', NumberType),
    ], NumberType));
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit> {
    const x = runtime.variableBindings.get('x')!;
    if (Type.Double.covers(x.type)) {
      const newValue = Math.abs(x.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Double, newValue), where);
    } else if (Type.Float.covers(x.type)) {
      const newValue = Math.abs(x.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Float, newValue), where);
    } else if (Type.Integer.covers(x.type)) {
      const newValue = Math.abs(x.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Integer, newValue), where);
    } else {
      throw new error.WhereError("The argument to `abs` must be a number.", where);
    }
  }
}

class LogFunctionEntry extends FunctionDefinition {
  constructor() {
    super(new FunctionType([
      new FormalType('x', NumberType),
    ], NumberType));
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit> {
    const x = runtime.variableBindings.get('x')!;
    if (Type.Double.covers(x.type)) {
      const newValue = Math.log(x.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Double, newValue), where);
    } else if (Type.Float.covers(x.type)) {
      const newValue = Math.log(x.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Float, newValue), where);
    } else if (Type.Integer.covers(x.type)) {
      const newValue = Math.log(x.value as number);
      // TODO: what should the return type be?
      throw new ReturnSomethingException(new Fruit(Type.Float, newValue), where);
    } else {
      throw new error.WhereError("The argument to `log` must be a number.", where);
    }
  }
}

class SquareRootFunctionEntry extends FunctionDefinition {
  constructor() {
    super(new FunctionType([
      new FormalType('x', NumberType),
    ], NumberType));
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit> {
    const x = runtime.variableBindings.get('x')!;
    if (Type.Double.covers(x.type)) {
      const newValue = Math.sqrt(x.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Double, newValue), where);
    } else if (Type.Float.covers(x.type)) {
      const newValue = Math.sqrt(x.value as number);
      throw new ReturnSomethingException(new Fruit(Type.Float, newValue), where);
    } else if (Type.Integer.covers(x.type)) {
      const newValue = Math.sqrt(x.value as number);
      // TODO: what should the return type be?
      throw new ReturnSomethingException(new Fruit(Type.Double, newValue), where);
    } else {
      throw new error.WhereError("The argument to `sqrt` must be a number.", where);
    }
  }
}

class IntCastFunctionEntry extends FunctionDefinition {
  constructor() {
    super(new FunctionType([
      new FormalType('x', new UnionType([Type.Double, Type.Float, Type.Integer, Type.String])),
    ], Type.Integer));
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit> {
    const variable = runtime.variableBindings.get('x')!;
    let newValue: any;
    if (Type.Double.covers(variable.type) || Type.Float.covers(variable.type)) {
      newValue = Math.trunc(variable.value as number);
    } else if (Type.Integer.covers(variable.type)) {
      newValue = variable.value as number;
    } else {
      newValue = Number(variable.value);
      if (Number.isNaN(newValue)) {
        throw new error.WhereError(`The value \`"${variable.value}"\` cannot be converted to an integer.`, where);
      }
    }
    throw new ReturnSomethingException(new Fruit(Type.Integer, newValue), where);
  }
}

class FloatCastFunctionEntry extends FunctionDefinition {
  constructor() {
    super(new FunctionType([
      new FormalType('x', new UnionType([Type.Double, Type.Float, Type.Integer, Type.String])),
    ], Type.Float));
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit> {
    const variable = runtime.variableBindings.get('x')!;
    let newValue: any;
    if (Type.Double.covers(variable.type) || Type.Float.covers(variable.type) || Type.Integer.covers(variable.type)) {
      newValue = variable.value as number;
    } else {
      newValue = Number(variable.value);
      if (Number.isNaN(newValue)) {
        throw new error.WhereError(`The value \`"${variable.value}"\` cannot be converted to a float.`, where);
      }
    }
    throw new ReturnSomethingException(new Fruit(Type.Float, newValue), where);
  }
}

class DoubleCastFunctionEntry extends FunctionDefinition {
  constructor() {
    super(new FunctionType([
      new FormalType('x', new UnionType([Type.Double, Type.Float, Type.Integer, Type.String])),
    ], Type.Double));
  }

  call(_evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit> {
    const variable = runtime.variableBindings.get('x')!;
    let newValue: any;
    if (Type.Double.covers(variable.type) || Type.Float.covers(variable.type) || Type.Integer.covers(variable.type)) {
      newValue = variable.value as number;
    } else {
      newValue = Number(variable.value);
      if (Number.isNaN(newValue)) {
        throw new error.WhereError(`The value \`"${variable.value}"\` cannot be converted to a double.`, where);
      }
    }
    throw new ReturnSomethingException(new Fruit(Type.Double, newValue), where);
  }
}

// --------------------------------------------------------------------------- 

abstract class MethodDefinition {
  type: MethodType;

  constructor(type: MethodType) {
    this.type = type;
  }

  abstract call(evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit>;
}

class MethodFruit extends MethodDefinition {
  body: ast.Block;
  where: Where;

  constructor(type: MethodType, body: ast.Block, where: Where) {
    super(type);
    this.body = body;
    this.where = where;
  }

  async call(evaluator: Evaluator, runtime: Runtime, _where: Where): Promise<Fruit> {
    return await this.body.visit(evaluator, runtime);
  }
}

// --------------------------------------------------------------------------- 

class VariableDefinition {
  type: Type;
  value: string | number | boolean | null;

  constructor(type: Type, value: any) {
    this.type = type;
    this.value = value;
  }
}

// --------------------------------------------------------------------------- 

class ClassDefinition {
  type: ClassType;
  methodBindings: Map<string, MethodDefinition>;

  constructor(type: ClassType) {
    this.type = type;
    this.methodBindings = new Map();
  }
}

// --------------------------------------------------------------------------- 

export class Runtime {
  variableBindings: Map<string, VariableDefinition>;
  functionBindings: Map<string, FunctionDefinition>;
  classBindings: Map<string, ClassDefinition>;
  expectedType: Type | null;
  classFruit: ClassDefinition | null;
  globalRuntime!: GlobalRuntime;
  parent: Runtime | null;

  constructor(parent: Runtime | null, variableBindings: Map<string, VariableDefinition>, functionBindings: Map<string, FunctionDefinition>, classBindings: Map<string, ClassDefinition>, expectedType: Type | null, classFruit: ClassDefinition | null) {
    this.parent = parent;
    this.variableBindings = variableBindings;
    this.functionBindings = functionBindings;
    this.classBindings = classBindings;
    this.expectedType = expectedType;
    this.classFruit = classFruit;
  }

  shallowClone() {
    const newRuntime = new Runtime(this, this.variableBindings, this.functionBindings, this.classBindings, this.expectedType, this.classFruit);
    newRuntime.globalRuntime = this.globalRuntime;
    return newRuntime;
  }

  child() {
    const newRuntime = new Runtime(this, new Map(), new Map(), new Map(), this.expectedType, this.classFruit);
    newRuntime.globalRuntime = this.globalRuntime;
    return newRuntime;
  }

  declareVariable(identifier: string, type: Type) {
    this.variableBindings.set(identifier, new VariableDefinition(type, null));
  }

  setUndeclaredVariable(identifier: string, entry: VariableDefinition): boolean {
    if (this.variableBindings.has(identifier) ||
        (!this.parent || !this.parent.setUndeclaredVariable(identifier, entry))) {
      this.variableBindings.set(identifier, entry);
      return true;
    } else {
      return false;
    }
  }

  setDeclaredVariable(identifier: string, entry: VariableDefinition) {
    if (this.variableBindings.has(identifier)) {
      this.variableBindings.set(identifier, entry);
    } else if (this.parent) {
      this.parent.setDeclaredVariable(identifier, entry);
    } else {
      throw new Error('undeclared variable snuck through');
    }
  }

  getVariable(identifier: string): VariableDefinition | undefined {
    // Consult this runtime first, but traverse its ancestors as needed.
    if (this.variableBindings.has(identifier)) {
      return this.variableBindings.get(identifier);
    } else if (this.parent) {
      return this.parent.getVariable(identifier);
    } else {
      return undefined;
    }
  }

  getClassDefinition(identifier: string): ClassDefinition | null {
    // Consult this runtime first, but traverse its ancestors as needed.
    if (this.classBindings.has(identifier)) {
      return this.classBindings.get(identifier)!;
    } else if (this.parent) {
      return this.parent.getClassDefinition(identifier);
    } else {
      return null;
    }
  }

  getOwnVariable(identifier: string): VariableDefinition | undefined {
    // Consult only this runtime. Declarations should call this instead of
    // getVariable since variables can shadow variables from parent scopes.
    if (this.variableBindings.has(identifier)) {
      return this.variableBindings.get(identifier);
    } else {
      return undefined;
    }
  }

  setFunction(identifier: string, lambda: FunctionDefinition) {
    this.functionBindings.set(identifier, lambda);
  }

  getFunction(identifier: string): FunctionDefinition | undefined {
    if (this.functionBindings.has(identifier)) {
      return this.functionBindings.get(identifier);
    } else if (this.parent) {
      return this.parent.getFunction(identifier);
    } else {
      return undefined;
    }
  }

  functionOwner(identifier: string): Runtime | undefined {
    if (this.functionBindings.has(identifier)) {
      return this;
    } else if (this.parent) {
      return this.parent.functionOwner(identifier);
    } else {
      return undefined;
    }
  }
}

export class GlobalRuntime extends Runtime {
  seed!: number;
  rng!: any;
  log: (text: string) => void;
  getInput: () => Promise<string>;
  allowsUndeclared: boolean;
  receiverName: string;

  constructor(log: (text: string) => void, getInput: () => Promise<string>, allowsUndeclared: boolean, receiverName: string) {
    super(null, new Map(), new Map(), new Map(), null, null);
    this.globalRuntime = this;
    this.getInput = getInput;
    this.log = log;
    this.allowsUndeclared = allowsUndeclared;
    this.receiverName = receiverName;

    this.setFunction('int', new IntCastFunctionEntry());
    this.setFunction('float', new FloatCastFunctionEntry());
    this.setFunction('double', new DoubleCastFunctionEntry());
    this.setFunction('min', new MinimumFunctionEntry());
    this.setFunction('max', new MaximumFunctionEntry());
    this.setFunction('abs', new AbsoluteValueFunctionEntry());
    this.setFunction('log', new LogFunctionEntry());
    this.setFunction('sqrt', new SquareRootFunctionEntry());
    this.setFunction('randomSeed', new RandomSeedFunctionEntry());
    this.setFunction('random', new RandomFloatFunctionEntry());
    this.setFunction('randomInt', new RandomIntegerFunctionEntry());
    this.setFunction('input', new InputFunctionEntry());

    this.seedRng(Date.now() ^ (Math.random() * 0x100000000));
  }

  seedRng(seed: number) {
    this.seed = seed;
    this.rng = prand.xoroshiro128plus(seed);
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

export class Evaluator extends Visitor<Runtime, Promise<Fruit>> {
  outputFormatter: OutputFormatter;
  step: (node: ast.Node) => Promise<void> | null;
  mem: Memdia;

  constructor(outputFormatter: OutputFormatter, mem: Memdia) {
    super();
    this.outputFormatter = outputFormatter;
    this.step = () => null;
    this.mem = mem;
  }

  // --------------------------------------------------------------------------
  // Primitives
  // --------------------------------------------------------------------------

  async visitNull(_node: ast.Null, _runtime: Runtime): Promise<Fruit> {
    return new Fruit(Type.Null);
  }

  async visitInteger(node: ast.Integer, _runtime: Runtime): Promise<Fruit> {
    return new Fruit(Type.Integer, node.rawValue);
  }

  async visitFloat(node: ast.Float, _runtime: Runtime): Promise<Fruit> {
    return new Fruit(Type.Float, node.rawValue);
  }

  async visitDouble(node: ast.Double, _runtime: Runtime): Promise<Fruit> {
    return new Fruit(Type.Double, node.rawValue);
  }

  async visitBoolean(node: ast.Boolean, _runtime: Runtime): Promise<Fruit> {
    return new Fruit(Type.Boolean, node.rawValue);
  }

  async visitString(node: ast.String, _runtime: Runtime): Promise<Fruit> {
    return new Fruit(Type.String, node.rawValue);
  }

  // --------------------------------------------------------------------------
  // Unary Operators
  // --------------------------------------------------------------------------

  async visitAssociation(node: ast.Association, runtime: Runtime): Promise<Fruit> {
    return await node.operandNode.visit(this, runtime);
  }

  async visitLogicalNegate(node: ast.LogicalNegate, runtime: Runtime): Promise<Fruit> {
    const operandFruit = await node.operandNode.visit(this, runtime);
    if (operandFruit.type === Type.Boolean) {
      return new Fruit(Type.Boolean, !operandFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.LogicalNegate)} can only be applied to a boolean.`, node.where);
    }
  }

  async visitArithmeticNegate(node: ast.ArithmeticNegate, runtime: Runtime): Promise<Fruit> {
    const operandFruit = await node.operandNode.visit(this, runtime);
    if (Type.Integer.covers(operandFruit.type)) {
      return new Fruit(Type.Integer, -operandFruit.value);
    } else if (Type.Integer.covers(operandFruit.type)) {
      return new Fruit(Type.Float, operandFruit.value);
    } else {
      throw new error.TypeError(`${this.outputFormatter.operator(ast.ArithmeticNegate)} can only be applied to numbers.`, node.where);
    }
  }

  async visitBitwiseNegate(node: ast.BitwiseNegate, runtime: Runtime): Promise<Fruit> {
    const operandFruit = await node.operandNode.visit(this, runtime);
    if (Type.Integer.covers(operandFruit.type)) {
      return new Fruit(Type.Integer, ~operandFruit.value);
    } else {
      throw new error.TypeError(`${this.outputFormatter.operator(ast.BitwiseNegate)} can only be applied to integers.`, node.where);
    }
  }

  async visitPostIncrement(node: ast.PostIncrement, runtime: Runtime): Promise<Fruit> {
    // x++ is just syntactic sugar for x = x + 1.
    const fruit = await node.operandNode.visit(this, runtime);
    let unincrementedPrimitive;
    if (fruit.type.equals(Type.Integer)) {
      unincrementedPrimitive = new ast.Integer(fruit.value, Where.Nowhere);
    } else if (fruit.type.equals(Type.Float)) {
      unincrementedPrimitive = new ast.Float(fruit.value, Where.Nowhere);
    } else {
      throw new error.TypeError('Only ints and floats can be incremented.', node.where);
    }
    await this.assignWithoutStep(new ast.Assignment(node.operandNode, new ast.Add(unincrementedPrimitive, new ast.Integer(1, Where.Nowhere), Where.Nowhere), Where.Nowhere), runtime);
    return fruit;
  }

  async visitPostDecrement(node: ast.PostDecrement, runtime: Runtime): Promise<Fruit> {
    // x-- is just syntactic sugar for x = x - 1.
    const fruit = await node.operandNode.visit(this, runtime);
    let unincrementedPrimitive;
    if (fruit.type.equals(Type.Integer)) {
      unincrementedPrimitive = new ast.Integer(fruit.value, Where.Nowhere);
    } else if (fruit.type.equals(Type.Float)) {
      unincrementedPrimitive = new ast.Float(fruit.value, Where.Nowhere);
    } else {
      throw new error.TypeError('Only ints and floats can be incremented.', node.where);
    }
    await new ast.Assignment(node.operandNode, new ast.Subtract(unincrementedPrimitive, new ast.Integer(1, Where.Nowhere), Where.Nowhere), Where.Nowhere).visit(this, runtime);
    return fruit;
  }


  // --------------------------------------------------------------------------
  // Binary Operators
  // --------------------------------------------------------------------------

  async visitAdd(node: ast.Add, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if (Type.Integer.covers(leftFruit.type) && Type.Integer.covers(rightFruit.type)) {
      return new Fruit(Type.Integer, leftFruit.value + rightFruit.value);
    } else if ((Type.Integer.covers(leftFruit.type) || Type.Float.covers(leftFruit.type)) &&
               (Type.Integer.covers(rightFruit.type) || Type.Float.covers(rightFruit.type))) {
      return new Fruit(Type.Float, leftFruit.value + rightFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.Add)} can only be applied to numbers.`, node.where);
    }
  }

  async visitSubtract(node: ast.Subtract, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if (Type.Integer.covers(leftFruit.type) && Type.Integer.covers(rightFruit.type)) {
      return new Fruit(Type.Integer, leftFruit.value - rightFruit.value);
    } else if ((Type.Integer.covers(leftFruit.type) || Type.Float.covers(leftFruit.type)) &&
               (Type.Integer.covers(rightFruit.type) || Type.Float.covers(rightFruit.type))) {
      return new Fruit(Type.Float, leftFruit.value - rightFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.Subtract)} can only be applied to numbers.`, node.where);
    }
  }

  async visitMultiply(node: ast.Multiply, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if (Type.Integer.covers(leftFruit.type) && Type.Integer.covers(rightFruit.type)) {
      return new Fruit(Type.Integer, leftFruit.value * rightFruit.value);
    } else if ((Type.Integer.covers(leftFruit.type) || Type.Float.covers(leftFruit.type) || Type.Double.covers(leftFruit.type)) &&
               (Type.Integer.covers(rightFruit.type) || Type.Float.covers(rightFruit.type) || Type.Double.covers(rightFruit.type))) {
      return new Fruit(Type.Float, leftFruit.value * rightFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.Multiply)} can only be applied to numbers.`, node.where);
    }
  }

  async visitDivide(node: ast.Divide, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if (Type.Integer.covers(leftFruit.type) && Type.Integer.covers(rightFruit.type)) {
      return new Fruit(Type.Integer, Math.trunc(leftFruit.value / rightFruit.value));
    } else if ((Type.Integer.covers(leftFruit.type) || Type.Float.covers(leftFruit.type) || Type.Double.covers(leftFruit.type)) &&
               (Type.Integer.covers(rightFruit.type) || Type.Float.covers(rightFruit.type) || Type.Double.covers(rightFruit.type))) {
      return new Fruit(Type.Float, leftFruit.value / rightFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.Divide)} can only be applied to numbers.`, node.where);
    }
  }

  async visitRemainder(node: ast.Remainder, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if (Type.Integer.covers(leftFruit.type) && Type.Integer.covers(rightFruit.type)) {
      // Do remainder rather than modulus. They differ in how they handle
      // negative numbers.
      return new Fruit(Type.Integer, leftFruit.value - rightFruit.value * (Math.floor(leftFruit.value / rightFruit.value)));
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.Remainder)} can only be applied to integers.`, node.where);
    }
  }

  async visitPower(node: ast.Power, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if (Type.Integer.covers(leftFruit.type) && Type.Integer.covers(rightFruit.type)) {
      return new Fruit(Type.Integer, leftFruit.value ** rightFruit.value);
    } else if ((Type.Integer.covers(leftFruit.type) || Type.Float.covers(leftFruit.type)) &&
               (Type.Integer.covers(rightFruit.type) || Type.Float.covers(rightFruit.type))) {
      return new Fruit(Type.Float, leftFruit.value ** rightFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.Power)} can only be applied to numbers.`, node.where);
    }
  }

  async visitLessThan(node: ast.LessThan, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if ((Type.Integer.covers(leftFruit.type) || Type.Float.covers(leftFruit.type)) &&
        (Type.Integer.covers(rightFruit.type) || Type.Float.covers(rightFruit.type))) {
      return new Fruit(Type.Boolean, leftFruit.value < rightFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.LessThan)} can only be applied to numbers.`, node.where);
    }
  }

  async visitGreaterThan(node: ast.GreaterThan, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if ((Type.Integer.covers(leftFruit.type) || Type.Float.covers(leftFruit.type)) &&
        (Type.Integer.covers(rightFruit.type) || Type.Float.covers(rightFruit.type))) {
      return new Fruit(Type.Boolean, leftFruit.value > rightFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.GreaterThan)} can only be applied to numbers.`, node.where);
    }
  }

  async visitLessThanOrEqual(node: ast.LessThanOrEqual, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if ((Type.Integer.covers(leftFruit.type) || Type.Float.covers(leftFruit.type)) &&
        (Type.Integer.covers(rightFruit.type) || Type.Float.covers(rightFruit.type))) {
      return new Fruit(Type.Boolean, leftFruit.value <= rightFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.LessThanOrEqual)} can only be applied to numbers.`, node.where);
    }
  }

  async visitGreaterThanOrEqual(node: ast.GreaterThanOrEqual, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if ((Type.Integer.covers(leftFruit.type) || Type.Float.covers(leftFruit.type)) &&
        (Type.Integer.covers(rightFruit.type) || Type.Float.covers(rightFruit.type))) {
      return new Fruit(Type.Boolean, leftFruit.value >= rightFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.GreaterThanOrEqual)} can only be applied to numbers.`, node.where);
    }
  }

  async visitEqual(node: ast.Equal, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if (leftFruit.constructor.name !== rightFruit.constructor.name) {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.Equal)} can only be applied to values of the same type.`, node.where);
    } else if ((Type.Integer.covers(leftFruit.type) || Type.Float.covers(leftFruit.type) || Type.String.covers(leftFruit.type) || Type.Boolean.covers(leftFruit.type)) &&
               (Type.Integer.covers(rightFruit.type) || Type.Float.covers(rightFruit.type) || Type.String.covers(rightFruit.type) || Type.Boolean.covers(rightFruit.type))) {
      return new Fruit(Type.Boolean, leftFruit.value === rightFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.Equal)} can only be applied to values of the same type.`, node.where);
    }
  }

  async visitNotEqual(node: ast.NotEqual, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if (leftFruit.constructor.name !== rightFruit.constructor.name) {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.NotEqual)} can only be applied to values of the same type.`, node.where);
    } else if ((Type.Integer.covers(leftFruit.type) || Type.Float.covers(leftFruit.type) || Type.String.covers(leftFruit.type) || Type.Boolean.covers(leftFruit.type)) &&
               (Type.Integer.covers(rightFruit.type) || Type.Float.covers(rightFruit.type) || Type.String.covers(rightFruit.type) || Type.Boolean.covers(rightFruit.type))) {
      return new Fruit(Type.Boolean, leftFruit.value !== rightFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.NotEqual)} can only be applied to values of the same type.`, node.where);
    }
  }

  async visitLogicalAnd(node: ast.LogicalAnd, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    if (Type.Boolean.covers(leftFruit.type)) {
      if (!leftFruit.value) {
        return new Fruit(Type.Boolean, false);
      } else {
        const rightFruit = await node.rightNode.visit(this, runtime);
        if (Type.Boolean.covers(rightFruit.type)) {
          return rightFruit;
        }
      }
    }
    throw new error.WhereError(`\`${this.outputFormatter.operator(ast.LogicalAnd)}\` can only be applied to booleans.`, node.where);
  }

  async visitLogicalOr(node: ast.LogicalOr, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    if (Type.Boolean.covers(leftFruit.type)) {
      if (leftFruit.value) {
        return new Fruit(Type.Boolean, true);
      } else {
        const rightFruit = await node.rightNode.visit(this, runtime);
        if (Type.Boolean.covers(rightFruit.type)) {
          return rightFruit;
        }
      }
    }
    throw new error.WhereError(`\`${this.outputFormatter.operator(ast.LogicalOr)}\` can only be applied to booleans.`, node.where);
  }

  async visitBitwiseAnd(node: ast.BitwiseAnd, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if (Type.Integer.covers(leftFruit.type) && Type.Integer.covers(rightFruit.type)) {
      return new Fruit(Type.Integer, leftFruit.value & rightFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.BitwiseAnd)} can only be applied to integers.`, node.where);
    }
  }

  async visitBitwiseOr(node: ast.BitwiseOr, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if (Type.Integer.covers(leftFruit.type) && Type.Integer.covers(rightFruit.type)) {
      return new Fruit(Type.Integer, leftFruit.value | rightFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.BitwiseOr)} can only be applied to integers.`, node.where);
    }
  }

  async visitXor(node: ast.Xor, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if (Type.Integer.covers(leftFruit.type) && Type.Integer.covers(rightFruit.type)) {
      return new Fruit(Type.Integer, leftFruit.value ^ rightFruit.value);
    } else if (Type.Boolean.covers(leftFruit.type) && Type.Boolean.covers(rightFruit.type)) {
      return new Fruit(Type.Boolean, leftFruit.value !== rightFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.Xor)} can only be applied to integers or booleans.`, node.where);
    }
  }

  async visitLeftShift(node: ast.LeftShift, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if (Type.Integer.covers(leftFruit.type) && Type.Integer.covers(rightFruit.type)) {
      return new Fruit(Type.Integer, leftFruit.value << rightFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.LeftShift)} can only be applied to integers.`, node.where);
    }
  }

  async visitRightShift(node: ast.RightShift, runtime: Runtime): Promise<Fruit> {
    const leftFruit = await node.leftNode.visit(this, runtime);
    const rightFruit = await node.rightNode.visit(this, runtime);
    if (Type.Integer.covers(leftFruit.type) && Type.Integer.covers(rightFruit.type)) {
      return new Fruit(Type.Integer, leftFruit.value >> rightFruit.value);
    } else {
      throw new error.WhereError(`${this.outputFormatter.operator(ast.RightShift)} can only be applied to integers.`, node.where);
    }
  }

  // --------------------------------------------------------------------------
  // Variables
  // --------------------------------------------------------------------------

  assignVariable(label: string, where: Where, identifier: string, fruit: Fruit, runtime: Runtime) {
    if (runtime.globalRuntime.allowsUndeclared) {
      runtime.setUndeclaredVariable(identifier, new VariableDefinition(fruit.type, fruit.value));
    } else {
      const oldFruit = runtime.getVariable(identifier);
      if (oldFruit) {
        if (oldFruit.type.covers(fruit.type)) {
          runtime.setDeclaredVariable(identifier, new VariableDefinition(oldFruit.type, fruit.value));
        } else {
          throw new error.TypeError(`${label} \`${identifier}\` has type \`${oldFruit.type}\`. A value of type \`${fruit.type}\` cannot be assigned to it.`, where);
        }
      } else {
        throw new error.UnknownError(`${label} \`${identifier}\` is undeclared.`, where);
      }
    }
  }

  async visitBlank(_node: ast.Blank, _runtime: Runtime): Promise<Fruit> {
    return new Fruit(Type.Void);
  }

  async assignWithoutStep(node: ast.Assignment, runtime: Runtime) {
    // In debug mode, the visitAssignment method pauses before being evaluated.
    // Some nodes create an artificial assignment node, but we don't want to
    // pause on these fake nodes.

    // In Praxis, array literals can only appear in declarations. We
    // communicate across nodes that we're in a declaration-context with
    // Runtime.expectedType. In languages without declarations, we need
    // to artificially set this expected type.
    let rhsRuntime = runtime;
    if (runtime.globalRuntime.allowsUndeclared) {
      rhsRuntime = runtime.shallowClone();
      rhsRuntime.expectedType = Type.Any;
    }

    const rightFruit = await node.rightNode.visit(this, rhsRuntime);

    // Don't evaluate left-hand side because that does an rvalue lookup.
    if (node.leftNode instanceof ast.Variable) {
      const identifier = node.leftNode.identifier;
      this.assignVariable('Variable', node.where, identifier, rightFruit, runtime);
      this.mem.assignment(identifier, rightFruit);

    } else if (node.leftNode instanceof ast.ArraySubscript) {
      const receiverFruit = await node.leftNode.arrayNode.visit(this, runtime);
      if (!(receiverFruit.type instanceof ArrayType)) {
        throw new error.TypeError(`The index operator cannot be applied to a value of type \`${receiverFruit.type}\`.`, node.leftNode.where);
      }

      const indexFruit = await node.leftNode.indexNode.visit(this, runtime);
      if (!(Type.Integer.covers(indexFruit.type))) {
        throw new error.TypeError(`An index must be an integer.`, node.leftNode.indexNode.where);
      }

      if (0 <= indexFruit.value && indexFruit.value < receiverFruit.value.length) {
        receiverFruit.value[indexFruit.value] = rightFruit;
      } else {
        throw new error.IllegalIndexError(`This array has ${receiverFruit.value.length} element${receiverFruit.value.length === 1 ? '' : 's'}. Index ${indexFruit.value} is out of bounds.`, node.leftNode.indexNode.where);
      }
    } else if (node.leftNode instanceof ast.Member) {
      const receiverFruit = await node.leftNode.receiverNode.visit(this, runtime);
      if (!(receiverFruit.type instanceof ClassType)) {
        throw new error.WhereError(`A value of type \`${receiverFruit.type}\` has no properties.`, node.leftNode.where);
      }

      const identifier = node.leftNode.identifier;

      // Ensure that variable is public.
      const declaration = receiverFruit.type.instanceVariable(identifier);
      if (declaration) {
        if (declaration.visibility !== Visibility.Public) {
          throw new error.WhereError(`Variable \`${identifier}\` is private.`, node.where);
        }
      } else {
        throw new error.UnknownError(`Variable \`${identifier}\` is undeclared.`, node.where);
      }

      this.assignVariable('Variable', node.where, identifier, rightFruit, receiverFruit.value.runtime);
    }

    return new Fruit(Type.Void);
  }

  async visitAssignment(node: ast.Assignment, runtime: Runtime): Promise<Fruit> {
    await this.step(node);
    return await this.assignWithoutStep(node, runtime);
  }

  async visitDeclaration(node: ast.Declaration, runtime: Runtime): Promise<Fruit> {
    await this.step(node);
    let oldFruit = runtime.getOwnVariable(node.identifier);
    if (oldFruit) {
      throw new error.WhereError(`Variable \`${node.identifier}\` is already declared.`, node.where);
    }

    const resolvedType = this.resolveType(node.variableType, runtime, node.where);
    runtime.declareVariable(node.identifier, resolvedType);
    this.mem.declaration(node.identifier, resolvedType);

    if (node.rightNode) {
      const rightFruit = await node.rightNode.visit(this, runtime);
      rightFruit.type = resolvedType;
      // TODO: do I need this?
      this.assignVariable('Variable', node.where, node.identifier, rightFruit, runtime);
      this.mem.assignment(node.identifier, rightFruit);
    }

    return new Fruit(Type.Void);
  }

  async visitVariable(node: ast.Variable, runtime: Runtime): Promise<Fruit> {
    const entry = runtime.getVariable(node.identifier);
    if (entry) {
      if (entry.value === null) {
        throw new error.UninitializedError(`Variable \`${node.identifier}\` is uninitialized.`, node.where);
      } else {
        return new Fruit(entry.type, entry.value);
      }
    } else {
      throw new error.UnknownError(`Variable \`${node.identifier}\` is undeclared.`, node.where);
    }
  }

  async visitBlock(node: ast.Block, runtime: Runtime): Promise<Fruit> {
    for (let statement of node.statements) {
      await statement.visit(this, runtime);
    }
    return new Fruit(Type.Void);
  }

  async visitPrint(node: ast.Print, runtime: Runtime): Promise<Fruit> {
    await this.step(node);
    const fruit = await node.operandNode.visit(this, runtime);
    const text = this.outputFormatter.value(fruit);
    if (text) {
      runtime.globalRuntime.log(text + node.trailer);
    } else {
      throw new error.WhereError('Only values may be printed.', node.where);
    }
    return new Fruit(Type.Void);
  }

  async visitIf(node: ast.If, runtime: Runtime): Promise<Fruit> {
    for (let i = 0; i < node.conditionNodes.length; ++i) {
      await this.step(node.conditionNodes[i]);
      const fruit = await node.conditionNodes[i].visit(this, runtime);
      if (Type.Boolean.covers(fruit.type)) {
        if (fruit.value) {
          await node.thenBlocks[i].visit(this, runtime);
          return new Fruit(Type.Void);
        }
      } else {
        throw new error.WhereError('A condition must yield a boolean value.', node.conditionNodes[i].where);
      }
    }
    if (node.elseBlock) {
      await node.elseBlock.visit(this, runtime);
    }
    return new Fruit(Type.Void);
  }

  async visitWhile(node: ast.While, runtime: Runtime): Promise<Fruit> {
    let isTerminated = false;
    while (!isTerminated) {
      await this.step(node.conditionNode);
      const fruit = await node.conditionNode.visit(this, runtime);
      if (Type.Boolean.covers(fruit.type)) {
        if (fruit.value) {
          await node.body.visit(this, runtime);
        } else {
          isTerminated = true;
        }
      } else {
        throw new error.WhereError('A condition must yield a boolean value.', node.conditionNode.where);
      }
    }
    return new Fruit(Type.Void);
  }

  async visitDoWhile(node: ast.DoWhile, runtime: Runtime): Promise<Fruit> {
    let isTerminated = false;
    while (!isTerminated) {
      await node.body.visit(this, runtime);
      await this.step(node.conditionNode);
      const fruit = await node.conditionNode.visit(this, runtime);
      if (Type.Boolean.covers(fruit.type)) {
        if (!fruit.value) {
          isTerminated = true;
        }
      } else {
        throw new error.WhereError('A condition must yield a boolean value.', node.conditionNode.where);
      }
    }
    return new Fruit(Type.Void);
  }

  async visitRepeatUntil(node: ast.RepeatUntil, runtime: Runtime): Promise<Fruit> {
    let isTerminated = false;
    while (!isTerminated) {
      await node.body.visit(this, runtime);
      await this.step(node.conditionNode);
      const fruit = await node.conditionNode.visit(this, runtime);
      if (Type.Boolean.covers(fruit.type)) {
        if (fruit.value) {
          isTerminated = true;
        }
      } else {
        throw new error.WhereError('A condition must yield a boolean value.', node.conditionNode.where);
      }
    }
    return new Fruit(Type.Void);
  }

  async visitFor(node: ast.For, runtime: Runtime): Promise<Fruit> {
    let isTerminated = false;
    const newRuntime = runtime.child();
    if (node.initializationNode) {
      await node.initializationNode.visit(this, newRuntime);
    }
    while (!isTerminated) {
      await this.step(node.conditionNode);
      const fruit = await node.conditionNode.visit(this, newRuntime);
      if (Type.Boolean.covers(fruit.type)) {
        if (fruit.value) {
          await node.body.visit(this, newRuntime);
          await node.incrementBlock.visit(this, newRuntime);
        } else {
          isTerminated = true;
        }
      } else {
        throw new error.WhereError('A condition must yield a boolean value.', node.conditionNode.where);
      }
    }
    return new Fruit(Type.Void);
  }

  async visitForEach(node: ast.ForEach, runtime: Runtime): Promise<Fruit> {
    const newRuntime = runtime.child();
    // TODO: is setting the expected type reasonable? Should the evaluator be
    // making certain that array literals only appear in declarations?
    newRuntime.expectedType = new ArrayType(Type.Integer);
    const iterableFruit = await node.iterableNode.visit(this, newRuntime);
    if (iterableFruit.type instanceof ArrayType) {
      for (let elementFruit of iterableFruit.value) {
        const bodyRuntime = runtime.child();
        bodyRuntime.declareVariable(node.identifier, iterableFruit.type.elementType);
        bodyRuntime.setDeclaredVariable(node.identifier, new VariableDefinition(iterableFruit.type.elementType, elementFruit.value));
        await node.body.visit(this, bodyRuntime);
      }
    } else if (Type.IntegerRange.covers(iterableFruit.type)) {
      for (let i = iterableFruit.value.lo; i < iterableFruit.value.hi; ++i) {
        const bodyRuntime = runtime.child();
        bodyRuntime.declareVariable(node.identifier, Type.Integer);
        bodyRuntime.setDeclaredVariable(node.identifier, new VariableDefinition(Type.Integer, i));
        await node.body.visit(this, bodyRuntime);
      }
    } else {
      throw new error.TypeError(`A value of type ${iterableFruit.type} is not iteratable.`, node.iterableNode.where);
    }

    return new Fruit(Type.Void);
  }

  async visitExpressionStatement(node: ast.ExpressionStatement, runtime: Runtime): Promise<Fruit> {
    await this.step(node);
    await node.expressionNode.visit(this, runtime);
    return new Fruit(Type.Void);
  }

  // --------------------------------------------------------------------------
  // Functions
  // --------------------------------------------------------------------------

  async visitFunctionDefinition(node: ast.FunctionDefinition, runtime: Runtime): Promise<Fruit> {
    const formalTypes = node.formals.map(formal => new FormalType(formal.identifier, formal.type));
    runtime.functionBindings.set(node.identifier, new FunctionFruit(new FunctionType(formalTypes, node.returnType), node.body, node.where));
    return new Fruit(Type.Void);
  }

  async visitFunctionCall(node: ast.FunctionCall, runtime: Runtime): Promise<Fruit> {
    const definerRuntime = runtime.functionOwner(node.identifier);
    if (definerRuntime) {
      // getFunction will succeed because definerRuntime owns the function.
      const lambda = definerRuntime.getFunction(node.identifier)!;

      if (node.actuals.length !== lambda.type.formals.length) {
        throw new error.WhereError(`Function \`${node.identifier}\` expects ${lambda.type.formals.length} parameter${lambda.type.formals.length === 1 ? '' : 's'}. ${node.actuals.length} ${node.actuals.length === 1 ? 'was' : 'were'} given.`, node.where);
      }

      this.mem.functionCall(node.identifier);
      const newRuntime = definerRuntime.child();

      for (let [i, formal] of lambda.type.formals.entries()) {
        newRuntime.declareVariable(formal.identifier, formal.type);
        this.mem.declaration(formal.identifier, formal.type);
        const fruit = await node.actuals[i].visit(this, runtime);
        this.assignVariable('Parameter', node.actuals[i].where, formal.identifier, fruit, newRuntime);
      }

      let fruit;
      try {
        await lambda.call(this, newRuntime, node.where);
        if (lambda instanceof FunctionFruit) {
          if (!Type.Void.covers(lambda.type.returnType)) {
            throw new error.WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${lambda.type.returnType}\`. It didn't return anything.`, lambda.where);
          }
        }
        fruit = new Fruit(Type.Void);
      } catch (e) {
        if (e instanceof ReturnSomethingException) {
          if (Type.Void.covers(lambda.type.returnType)) {
            throw new error.WhereError(`Function \`${node.identifier}\` is declared to return nothing. It returned something.`, e.returnWhere);
          } else if (!lambda.type.returnType.covers(e.fruit.type)) {
            throw new error.WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${lambda.type.returnType}\`. It returned a value of type \`${e.fruit.type}\`.`, e.returnWhere);
          } else {
            fruit = e.fruit;
          }
        } else if (e instanceof ReturnNothingException) {
          if (!(Type.Void.covers(lambda.type.returnType))) {
            throw new error.WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${lambda.type.returnType}\`. It returned nothing.`, e.returnWhere);
          } else {
            fruit = new Fruit(Type.Void);
          }
        } else {
          throw e;
        }
      }

      return fruit;
    } else {
      throw new error.WhereError(`Function \`${node.identifier}\` is not defined.`, node.where);
    }
  }

  async visitReturn(node: ast.Return, runtime: Runtime): Promise<Fruit> {
    this.mem.functionReturn();

    if (node.operandNode) {
      const fruit = await node.operandNode.visit(this, runtime);
      throw new ReturnSomethingException(fruit, node.where);
    } else {
      throw new ReturnNothingException(node.where);
    }
  }

  async visitLineComment(_node: ast.LineComment, _runtime: Runtime): Promise<Fruit> {
    return new Fruit(Type.Void);
  }

  // --------------------------------------------------------------------------
  // Range
  // --------------------------------------------------------------------------

  async visitRangeLiteral(node: ast.RangeLiteral, runtime: Runtime): Promise<Fruit> {
    const loFruit = await node.loNode.visit(this, runtime);
    if (!Type.Integer.covers(loFruit.type)) {
      throw new error.TypeError(`The lower bound of this range has the wrong type. It must be an integer.`, node.loNode.where);
    }

    const hiFruit = await node.hiNode.visit(this, runtime);
    if (!Type.Integer.covers(hiFruit.type)) {
      throw new error.TypeError(`The upper bound of this range has the wrong type. It must be an integer.`, node.hiNode.where);
    }

    return new Fruit(Type.IntegerRange, {
      lo: loFruit.value,
      hi: hiFruit.value,
    });
  }

  // --------------------------------------------------------------------------
  // Arrays
  // --------------------------------------------------------------------------

  async visitArrayLiteral(node: ast.ArrayLiteral, runtime: Runtime): Promise<Fruit> {
    if (!runtime.expectedType) {
      throw new error.WhereError("An array literal is in an unexpected place. It must be part of an array declaration.", node.where);
    }

    // If we don't have specific types, the element type can be anything.
    let elementType;
    if (runtime.expectedType.equals(Type.Any)) {
      elementType = Type.Any;
    } else {
      elementType = (runtime.expectedType as ArrayType).elementType;
    }

    const newRuntime = runtime.shallowClone();
    newRuntime.expectedType = elementType;
    const elementFruits = [];
    for (let elementNode of node.elementNodes) {
      const elementFruit = await elementNode.visit(this, newRuntime);
      elementFruits.push(elementFruit);
    }

    const badIndex = elementFruits.findIndex(elementFruit => !elementType.covers(elementFruit.type));
    if (badIndex >= 0) {
      throw new error.TypeError(`An array element has the wrong type. It must have type \`${elementType}\`.`, node.elementNodes[badIndex].where);
    }

    return new Fruit(new SizedArrayType(elementType, elementFruits.length), elementFruits);
  }

  async visitArrayDeclaration(node: ast.ArrayDeclaration, runtime: Runtime): Promise<Fruit> {
    // The array literal needs to know what type its elements should have. We
    // pass the element type through the runtime.
    const newRuntime = runtime.shallowClone();
    newRuntime.expectedType = this.resolveType(node.variableType, runtime, node.where);
    const fruit = await this.visitDeclaration(node, newRuntime);
    return fruit;
  }

  async visitArraySubscript(node: ast.ArraySubscript, runtime: Runtime): Promise<Fruit> {
    const receiverFruit = await node.arrayNode.visit(this, runtime);
    if (!(receiverFruit.type instanceof ArrayType)) {
      throw new error.WhereError(`The index operator cannot be applied to a value of type \`${receiverFruit.type}\`.`, node.where);
    }

    const indexFruit = await node.indexNode.visit(this, runtime);
    if (!(Type.Integer.covers(indexFruit.type))) {
      throw new error.TypeError(`An index must be an integer.`, node.indexNode.where);
    }

    if (0 <= indexFruit.value && indexFruit.value < receiverFruit.value.length) {
      return receiverFruit.value[indexFruit.value];
    } else {
      throw new error.IllegalIndexError(`This array has ${receiverFruit.value.length} element${receiverFruit.value.length === 1 ? '' : 's'}. Index ${indexFruit.value} is out of bounds.`, node.indexNode.where);
    }
  }

  async visitMember(node: ast.Member, runtime: Runtime): Promise<Fruit> {
    const receiverFruit = await node.receiverNode.visit(this, runtime);
    if (receiverFruit.type instanceof ArrayType && node.identifier === 'length') {
      return new Fruit(Type.Integer, receiverFruit.value.length);
    } else if (receiverFruit.type instanceof ClassType) {
      // Ensure that variable is public.
      const declaration = receiverFruit.type.instanceVariable(node.identifier);
      if (declaration) {
        if (declaration.visibility !== Visibility.Public) {
          throw new error.VisibilityError(`Variable \`${node.identifier}\` is private.`, node.where);
        }
      } else {
        throw new error.UnknownError(`Variable \`${node.identifier}\` is undeclared.`, node.where);
      }

      const entry = receiverFruit.value.runtime.getVariable(node.identifier);
      if (entry) {
        if (entry.value === null) {
          throw new error.UninitializedError(`Variable \`${node.identifier}\` is uninitialized.`, node.where);
        } else {
          return new Fruit(entry.type, entry.value);
        }
      } else {
        throw new error.UnknownError(`Variable \`${node.identifier}\` is undeclared.`, node.where);
      }
    }
    throw new error.WhereError(`A value of type \`${receiverFruit.type}\` does not have a \`${node.identifier}\` property.`, node.where);
  }

  // --------------------------------------------------------------------------
  // Classes
  // --------------------------------------------------------------------------

  async visitClassDefinition(node: ast.ClassDefinition, runtime: Runtime): Promise<Fruit> {
    const superclassType = this.resolveClassName(node.superclass, runtime);
    const classFruit = new ClassDefinition(new ClassType(node.identifier, superclassType, node.where));
    const newRuntime = runtime.shallowClone();
    newRuntime.classFruit = classFruit;

    const ancestorTypes = [];
    let ancestorType: ClassType | null = classFruit.type.superclass;
    while (ancestorType) {
      ancestorTypes.push(ancestorType);
      ancestorType = ancestorType.superclass;
    }
    ancestorTypes.reverse();

    for (let ancestorType of ancestorTypes) {
      const ancestorDefinition = runtime.classBindings.get(ancestorType.text)!;

      for (const [identifier, type] of ancestorType.instanceVariableTypes) {
        classFruit.type.instanceVariableTypes.set(identifier, type);
      }

      for (const [identifier, type] of ancestorType.instanceMethodTypes) {
        classFruit.type.instanceMethodTypes.set(identifier, type);
        classFruit.methodBindings.set(identifier, ancestorDefinition.methodBindings.get(identifier)!);
      }
    }

    for (let declaration of node.instanceVariableDeclarations) {
      await declaration.visit(this, newRuntime);
    }

    for (let definition of node.methodDefinitions) {
      await definition.visit(this, newRuntime);
    }

    runtime.classBindings.set(node.identifier, classFruit);

    return new Fruit(Type.Void);
  }

  async visitInstanceVariableDeclaration(node: ast.InstanceVariableDeclaration, runtime: Runtime): Promise<Fruit> {
    const classFruit = runtime.classFruit!;

    if (classFruit.type.instanceVariableTypes.has(node.identifier)) {
      throw new error.WhereError(`Variable \`${node.identifier}\` has already been declared.`, node.where);
    }

    const instanceVariableEntry = classFruit.type.instanceVariableTypes.get(node.identifier);

    // If the declaration provides an initial value, we eagerly evaluate the
    // expression and store it as part of the declaration.
    let initialValue = null;
    if (node.valueNode) {
      const initialValueFruit = await node.valueNode.visit(this, runtime);
      if (node.variableType.covers(initialValueFruit.type)) {
        initialValue = initialValueFruit.value;
      } else {
        throw new error.WhereError(`The initial value of \`${node.identifier}\` must be of type \`${node.variableType}\`.`, node.valueNode.where);
      }
    }

    const visibility = node.visibility ?? Visibility.Public;
    classFruit.type.instanceVariableTypes.set(node.identifier, new InstanceVariableType(node.variableType, visibility, initialValue));

    return new Fruit(Type.Void);
  }

  async visitMethodDefinition(node: ast.MethodDefinition, runtime: Runtime): Promise<Fruit> {
    const classFruit = runtime.classFruit!;

    if (classFruit.type.instanceMethodTypes.has(node.identifier)) {
      throw new error.WhereError(`Method \`${node.identifier}\` has already been defined.`, node.where);
    }

    const formalTypes = node.formals.map(formal => new FormalType(formal.identifier, formal.type));

    const visibility = node.visibility ?? Visibility.Public;
    const methodType = new MethodType(formalTypes, node.returnType, visibility);

    classFruit.type.instanceMethodTypes.set(node.identifier, methodType);
    classFruit.methodBindings.set(node.identifier, new MethodFruit(methodType, node.body, node.where));

    return new Fruit(Type.Void);
  }

  async visitInstantiation(node: ast.Instantiation, runtime: Runtime): Promise<Fruit> {
    const classFruit = runtime.classBindings.get(node.identifier);
    if (!classFruit) {
      throw new error.WhereError(`Class ${node.identifier} is not defined.`, node.where);
    }

    const instance = {
      classDefinition: classFruit,
      runtime: runtime.globalRuntime.child(),
    };

    // Each instance of a class is a runtime that persists the instance's state.
    // let ancestorType: ClassType | null = classFruit.type;
    // while (ancestorType) {
      // for (let [name, entry] of ancestorType.instanceVariableTypes) {
        // instance.runtime.declareVariable(name, entry.type);
        // instance.runtime.setDeclaredVariable(name, new VariableDefinition(entry.type, entry.initialValue));
      // }
      // ancestorType = ancestorType.superclass;
    // }

    for (let [name, entry] of classFruit.type.instanceVariableTypes) {
      instance.runtime.declareVariable(name, entry.type);
      instance.runtime.setDeclaredVariable(name, new VariableDefinition(entry.type, entry.initialValue));
    }

    // Each instance also carries around a list of the class's methods. Having
    // each instance carry around such a list is not necessary. A vtable, for
    // example, could be stored with the class. Perhaps we could eliminate this
    // redundancy someday. For now, it's the easiest implementation given how
    // Runtime performs lookups.
    for (let [name, entry] of classFruit.methodBindings) {
      instance.runtime.setFunction(name, entry);
    }

    const instanceType = classFruit.type;
    const instanceFruit = new Fruit(instanceType, instance);
    instance.runtime.declareVariable(runtime.globalRuntime.receiverName, instanceType);
    instance.runtime.setDeclaredVariable(runtime.globalRuntime.receiverName, new VariableDefinition(instanceType, instance));

    return instanceFruit;
  }

  async visitCall(_context: string, node: ast.MethodCall | ast.FunctionCall, subroutine: MethodDefinition | FunctionDefinition, runtime: Runtime) {
    if (node.actuals.length !== subroutine.type.formals.length) {
      throw new error.WhereError(`Function \`${node.identifier}\` expects ${subroutine.type.formals.length} parameter${subroutine.type.formals.length === 1 ? '' : 's'}. ${node.actuals.length} ${node.actuals.length === 1 ? 'was' : 'were'} given.`, node.where);
    }

    const newRuntime = runtime.child();
    for (let [i, formal] of subroutine.type.formals.entries()) {
      newRuntime.declareVariable(formal.identifier, formal.type);
      const fruit = await node.actuals[i].visit(this, runtime);
      this.assignVariable('Parameter', node.actuals[i].where, formal.identifier, fruit, newRuntime);
    }

    let fruit;
    try {
      await subroutine.call(this, newRuntime, node.where);
      if (subroutine instanceof FunctionFruit) {
        if (!Type.Void.covers(subroutine.type.returnType)) {
          throw new error.WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${subroutine.type.returnType}\`. It didn't return anything.`, subroutine.where);
        }
      }
      fruit = new Fruit(Type.Void);
    } catch (e) {
      if (e instanceof ReturnSomethingException) {
        if (Type.Void.covers(subroutine.type.returnType)) {
          throw new error.WhereError(`Function \`${node.identifier}\` is declared to return nothing. It returned something.`, e.returnWhere);
        } else if (!subroutine.type.returnType.covers(e.fruit.type)) {
          throw new error.WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${subroutine.type.returnType}\`. It returned a value of type \`${e.fruit.type}\`.`, e.returnWhere);
        } else {
          fruit = e.fruit;
        }
      } else if (e instanceof ReturnNothingException) {
        if (!Type.Void.covers(subroutine.type.returnType)) {
          throw new error.WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${subroutine.type.returnType}\`. It returned nothing.`, e.returnWhere);
        } else {
          fruit = new Fruit(Type.Void);
        }
      } else {
        throw e;
      }
    }

    return fruit;
  }

  async visitMethodCall(node: ast.MethodCall, runtime: Runtime): Promise<Fruit> {
    const receiverFruit = await node.receiverNode.visit(this, runtime);
    if (!(receiverFruit.type instanceof ClassType)) {
      throw new error.TypeError(`A value of type \`${receiverFruit.type}\` is not an object. Methods cannot be called on it.`, node.receiverNode.where);
    }

    // TODO: will classFruit be defined?
    const classFruit = runtime.classBindings.get(receiverFruit.type.text)!;

    const declaration = receiverFruit.type.instanceMethod(node.identifier);
    if (!declaration) {
      throw new error.WhereError(`Method ${node.identifier} is not defined.`, node.where);
    }

    const lambda = classFruit.methodBindings.get(node.identifier)!;

    return await this.visitCall('method', node, lambda, receiverFruit.value.runtime);
  }

  // ------------------------------------------------------------------------- 

  resolveClassName(name: string | null, runtime: Runtime): ClassType | null {
    if (name) {
      const classDefinition = runtime.getClassDefinition(name);
      if (classDefinition) {
        return classDefinition.type;
      }
    }
    return null;
  }

  resolveType(type: Type, runtime: Runtime, where: Where) {
    if (type instanceof LazyClassType) {
      let classDefinition = runtime.getClassDefinition(type.text);
      if (classDefinition) {
        return classDefinition.type;
      } else {
        throw new error.TypeError(`The type \`${type.text}\` is unknown.`, where);
      }
    } else {
      return type;
    }
  }
}
