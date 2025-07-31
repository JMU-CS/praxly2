import {Type, FormalType, FunctionType, Fruit, NumberType, UnionType, MethodType, ClassType, InstanceVariableType, Visibility, StringType} from './type.js';
import {Evaluator} from './evaluator.js';
import {Where} from './where.js';
import * as ast from './ast.js';
import prand from 'pure-rand';
import * as error from './error.js';

export abstract class FunctionDefinition {
  type: FunctionType;

  constructor(type: FunctionType) {
    this.type = type;
  }

  abstract call(evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit>;
}

export class FunctionFruit extends FunctionDefinition {
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

export abstract class MethodDefinition {
  type: MethodType;

  constructor(type: MethodType) {
    this.type = type;
  }

  abstract call(evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit>;
}

export class MethodFruit extends MethodDefinition {
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

export class VariableDefinition {
  type: Type;
  value: any; //string | number | boolean | null;

  constructor(type: Type, value: any) {
    this.type = type;
    this.value = value;
  }
}

export class ClassDefinition {
  type: ClassType;
  methodBindings: Map<string, MethodDefinition>;

  constructor(type: ClassType) {
    this.type = type;
    this.methodBindings = new Map();
  }
}

export class Runtime {
  variableBindings: Map<string, VariableDefinition>;
  functionBindings: Map<string, FunctionDefinition>;
  classBindings: Map<string, ClassDefinition>;
  expectedType: Type | null;
  classContext: ClassDefinition | null;
  globalRuntime!: GlobalRuntime;
  parent: Runtime | null;

  constructor(parent: Runtime | null, variableBindings: Map<string, VariableDefinition>, functionBindings: Map<string, FunctionDefinition>, classBindings: Map<string, ClassDefinition>, expectedType: Type | null, classContext: ClassDefinition | null) {
    this.parent = parent;
    this.variableBindings = variableBindings;
    this.functionBindings = functionBindings;
    this.classBindings = classBindings;
    this.expectedType = expectedType;
    this.classContext = classContext;
  }

  shallowClone() {
    const newRuntime = new Runtime(this, this.variableBindings, this.functionBindings, this.classBindings, this.expectedType, this.classContext);
    newRuntime.globalRuntime = this.globalRuntime;
    return newRuntime;
  }

  child() {
    const newRuntime = new Runtime(this, new Map(), new Map(), new Map(), this.expectedType, this.classContext);
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

export class ReturnSomethingException extends Error {
  fruit: Fruit;
  returnWhere: Where;

  constructor(fruit: Fruit, returnWhere: Where) {
    super();
    this.fruit = fruit;
    this.returnWhere = returnWhere;
  }
}

export class ReturnNothingException extends Error {
  returnWhere: Where;

  constructor(returnWhere: Where) {
    super();
    this.returnWhere = returnWhere;
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

    this.setFunction('int', new IntCastFunction());
    this.setFunction('float', new FloatCastFunction());
    this.setFunction('double', new DoubleCastFunction());
    this.setFunction('min', new MinimumFunction());
    this.setFunction('max', new MaximumFunction());
    this.setFunction('abs', new AbsoluteValueFunction());
    this.setFunction('log', new LogFunction());
    this.setFunction('sqrt', new SquareRootFunction());
    this.setFunction('randomSeed', new RandomSeedFunction());
    this.setFunction('random', new RandomFloatFunction());
    this.setFunction('randomInt', new RandomIntegerFunction());
    this.setFunction('input', new InputFunction());

    this.classBindings.set('String', new StringClass());

    this.seedRng(Date.now() ^ (Math.random() * 0x100000000));
  }

  seedRng(seed: number) {
    this.seed = seed;
    this.rng = prand.xoroshiro128plus(seed);
  }
}

export class RandomSeedFunction extends FunctionDefinition {
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

export class RandomFloatFunction extends FunctionDefinition {
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

export class InputFunction extends FunctionDefinition {
  constructor() {
    super(new FunctionType([], Type.String));
  }

  async call(evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit> {
    const text: string = await runtime.globalRuntime.getInput();

    const fruit = await new ast.Instantiation('String', Where.Nowhere).visit(evaluator, runtime);
    fruit.value.runtime.setDeclaredVariable('text', new VariableDefinition(Type.PrivateString, text));

    throw new ReturnSomethingException(fruit, where);
  }
}

export class RandomIntegerFunction extends FunctionDefinition {
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

export class MinimumFunction extends FunctionDefinition {
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

export class MaximumFunction extends FunctionDefinition {
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

export class AbsoluteValueFunction extends FunctionDefinition {
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

export class LogFunction extends FunctionDefinition {
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

export class SquareRootFunction extends FunctionDefinition {
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

export class IntCastFunction extends FunctionDefinition {
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
      const text = variable.value!.runtime.variableBindings.get('text')!.value;
      newValue = Number(text);
      if (Number.isNaN(newValue)) {
        throw new error.WhereError(`The value \`"${text}"\` cannot be converted to an integer.`, where);
      }
    }
    throw new ReturnSomethingException(new Fruit(Type.Integer, newValue), where);
  }
}

export class FloatCastFunction extends FunctionDefinition {
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
      const text = variable.value!.runtime.variableBindings.get('text')!.value;
      newValue = Number(text);
      if (Number.isNaN(newValue)) {
        throw new error.WhereError(`The value \`"${text}"\` cannot be converted to a float.`, where);
      }
    }
    throw new ReturnSomethingException(new Fruit(Type.Float, newValue), where);
  }
}

export class DoubleCastFunction extends FunctionDefinition {
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
      const text = variable.value!.runtime.variableBindings.get('text')!.value;
      newValue = Number(text);
      if (Number.isNaN(newValue)) {
        throw new error.WhereError(`The value \`"${text}"\` cannot be converted to a double.`, where);
      }
    }
    throw new ReturnSomethingException(new Fruit(Type.Double, newValue), where);
  }
}

export class StringClass extends ClassDefinition {
  constructor() {
    super(Type.String);
    this.methodBindings.set('length', new StringLengthMethod());
    this.methodBindings.set('substring', new StringSubstringMethod());
  }

  static async instance(text: string, evaluator: Evaluator, runtime: Runtime) {
    const fruit = await new ast.Instantiation('String', Where.Nowhere).visit(evaluator, runtime);
    fruit.value.runtime.setDeclaredVariable('text', new VariableDefinition(Type.PrivateString, text));
    return fruit;
  }
}

export class StringLengthMethod extends MethodDefinition {
  constructor() {
    super(Type.String.instanceMethodTypes.get('length')!);
  }

  async call(_evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit> {
    const text = runtime.getVariable('text')!.value as String;
    throw new ReturnSomethingException(new Fruit(Type.Integer, text.length), where);;
  }
}

export class StringSubstringMethod extends MethodDefinition {
  constructor() {
    super(Type.String.instanceMethodTypes.get('substring')!);
  }

  async call(evaluator: Evaluator, runtime: Runtime, where: Where): Promise<Fruit> {
    const text = runtime.getVariable('text')!.value as string;
    const start = runtime.getVariable('start')!.value as number;
    const end = runtime.getVariable('end')!.value as number;
    const subText = text.substring(start, end);
    const fruit = await StringClass.instance(subText, evaluator, runtime);
    throw new ReturnSomethingException(fruit, where);;
  }
}
