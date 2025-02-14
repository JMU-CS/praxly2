import * as ast from './ast.js';
import {Visitor} from './visitor.js';
import {WhereError} from './exception.js';
import {Where} from './where.js';
import type {NodeClass, SymbolMap} from './symbol-map.js';

abstract class Fruit {
  type: string;

  constructor(type: string) {
    this.type = type;
  }

  abstract toString(): string;
}

class UninitializedFruit extends Fruit {
  constructor(type: string) {
    super(type);
  }

  toString(): string {
    return `${this.type}?`;
  }
}

interface ToStringable {
  toString: () => string;
}

class PrimitiveFruit<T extends ToStringable> extends Fruit {
  value: T;

  constructor(type: string, value: T) {
    super(type);
    this.value = value;
  }

  toString(): string {
    return this.value.toString();
  }
}

class IntegerFruit extends PrimitiveFruit<number> {
  constructor(value: number) {
    super('int', value);
  }
}

class FloatFruit extends PrimitiveFruit<number> {
  constructor(value: number) {
    super('float', value);
  }
}

class StringFruit extends PrimitiveFruit<string> {
  constructor(value: string) {
    super('string', value);
  }
}

class BooleanFruit extends PrimitiveFruit<boolean> {
  constructor(value: boolean) {
    super('boolean', value);
  }
}

class ArrayFruit extends PrimitiveFruit<Fruit[]> {
  constructor(type: string, value: Fruit[]) {
    super(type, value);
  }

  toString(): string {
    return `{${this.value.map(element => element.toString()).join(', ')}}`;
  }
}

class ObjectFruit extends PrimitiveFruit<Map<string, Fruit>> {
  constructor(type: string, value: Map<string, Fruit>) {
    super(type, value);
  }

  toString(): string {
    return `{${Array.from(this.value, ([identifier, fruit]) => `${identifier}: ${fruit.toString()}`).join(', ')}}`;
  }
}

class VoidFruit extends Fruit {
  constructor() {
    super('void');
  }

  toString(): string {
    return 'void';
  }
}

class FunctionFruit {
  formals: ast.Formal[];
  returnType: string;
  body: ast.Block;
  where: Where;

  constructor(formals: ast.Formal[], returnType: string, body: ast.Block, where: Where) {
    this.formals = formals;
    this.returnType = returnType;
    this.body = body;
    this.where = where;
  }
}

class MethodFruit extends FunctionFruit {
  visibility: ast.Visibility;

  constructor(formals: ast.Formal[], returnType: string, body: ast.Block, visibility: ast.Visibility, where: Where) {
    super(formals, returnType, body, where);
    this.visibility = visibility;
  }
}

class InstanceVariableFruit {
  type: string;
  visibility: ast.Visibility;

  constructor(type: string, visibility: ast.Visibility) {
    this.type = type;
    this.visibility = visibility;
  }
}

class ClassFruit {
  superclass: string | null;
  instanceVariableFruits: Map<string, InstanceVariableFruit>;
  instanceMethodFruits: Map<string, FunctionFruit>;
  where: Where;

  constructor(superclass: string | null, where: Where) {
    this.superclass = superclass;
    this.instanceVariableFruits = new Map();
    this.instanceMethodFruits = new Map();
    this.where = where;
  }
}

export class Runtime {
  variableBindings: Map<string, Fruit>;
  functionBindings: Map<string, FunctionFruit>;
  classBindings: Map<string, ClassFruit>;
  expectedType: string | null;
  classFruit: ClassFruit | null;
  static stdout: string = '';

  constructor(variableBindings: Map<string, Fruit>, functionBindings: Map<string, FunctionFruit>, classBindings: Map<string, ClassFruit>, expectedType: string | null, classFruit: ClassFruit | null) {
    this.variableBindings = variableBindings;
    this.functionBindings = functionBindings;
    this.classBindings = classBindings;
    this.expectedType = expectedType;
    this.classFruit = classFruit;
  }

  static new() {
    return new Runtime(new Map(), new Map(), new Map(), null, null);
  }

  shallowClone() {
    return new Runtime(this.variableBindings, this.functionBindings, this.classBindings, this.expectedType, this.classFruit);
  }

  declareVariable(identifier: string, type: string) {
    this.variableBindings.set(identifier, new UninitializedFruit(type));
  }

  setVariable(identifier: string, fruit: Fruit) {
    this.variableBindings.set(identifier, fruit);
  }

  getVariable(identifier: string): Fruit | undefined {
    return this.variableBindings.get(identifier);
  }

  setFunction(identifier: string, lambda: FunctionFruit) {
    this.functionBindings.set(identifier, lambda);
  }

  getFunction(identifier: string): FunctionFruit | undefined {
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
    return new IntegerFruit(node.rawValue);
  }

  visitFloat(node: ast.Float, _runtime: Runtime): Fruit {
    return new FloatFruit(node.rawValue);
  }

  visitBoolean(node: ast.Boolean, _runtime: Runtime): Fruit {
    return new BooleanFruit(node.rawValue);
  }

  visitString(node: ast.String, _runtime: Runtime): Fruit {
    return new StringFruit(node.rawValue);
  }

  // --------------------------------------------------------------------------
  // Unary Operators
  // --------------------------------------------------------------------------

  visitLogicalNegate(node: ast.LogicalNegate, runtime: Runtime): Fruit {
    const operandFruit = node.operandNode.visit(this, runtime);
    if (operandFruit instanceof BooleanFruit) {
      return new BooleanFruit(!operandFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.LogicalNegate)} can only be applied to a boolean.`, node.where);
    }
  }

  visitArithmeticNegate(node: ast.ArithmeticNegate, runtime: Runtime): Fruit {
    const operandFruit = node.operandNode.visit(this, runtime);
    if (operandFruit instanceof IntegerFruit) {
      return new IntegerFruit(-operandFruit.value);
    } else if (operandFruit instanceof IntegerFruit) {
      return new FloatFruit(operandFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.ArithmeticNegate)} can only be applied to numbers.`, node.where);
    }
  }

  visitBitwiseNegate(node: ast.BitwiseNegate, runtime: Runtime): Fruit {
    const operandFruit = node.operandNode.visit(this, runtime);
    if (operandFruit instanceof IntegerFruit) {
      return new IntegerFruit(~operandFruit.value);
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
    if (leftFruit instanceof IntegerFruit && rightFruit instanceof IntegerFruit) {
      return new IntegerFruit(leftFruit.value + rightFruit.value);
    } else if ((leftFruit instanceof IntegerFruit || leftFruit instanceof FloatFruit) &&
               (rightFruit instanceof IntegerFruit || rightFruit instanceof FloatFruit)) {
      return new FloatFruit(leftFruit.value + rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.Add)} can only be applied to numbers.`, node.where);
    }
  }

  visitSubtract(node: ast.Subtract, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit instanceof IntegerFruit && rightFruit instanceof IntegerFruit) {
      return new IntegerFruit(leftFruit.value - rightFruit.value);
    } else if ((leftFruit instanceof IntegerFruit || leftFruit instanceof FloatFruit) &&
               (rightFruit instanceof IntegerFruit || rightFruit instanceof FloatFruit)) {
      return new FloatFruit(leftFruit.value - rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.Subtract)} can only be applied to numbers.`, node.where);
    }
  }

  visitMultiply(node: ast.Multiply, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit instanceof IntegerFruit && rightFruit instanceof IntegerFruit) {
      return new IntegerFruit(leftFruit.value * rightFruit.value);
    } else if ((leftFruit instanceof IntegerFruit || leftFruit instanceof FloatFruit) &&
               (rightFruit instanceof IntegerFruit || rightFruit instanceof FloatFruit)) {
      return new FloatFruit(leftFruit.value * rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.Multiply)} can only be applied to numbers.`, node.where);
    }
  }

  visitDivide(node: ast.Divide, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit instanceof IntegerFruit && rightFruit instanceof IntegerFruit) {
      return new IntegerFruit(Math.trunc(leftFruit.value / rightFruit.value));
    } else if ((leftFruit instanceof IntegerFruit || leftFruit instanceof FloatFruit) &&
               (rightFruit instanceof IntegerFruit || rightFruit instanceof FloatFruit)) {
      return new FloatFruit(leftFruit.value / rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.Divide)} can only be applied to numbers.`, node.where);
    }
  }

  visitRemainder(node: ast.Remainder, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit instanceof IntegerFruit && rightFruit instanceof IntegerFruit) {
      return new IntegerFruit(leftFruit.value % rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.Remainder)} can only be applied to integers.`, node.where);
    }
    // TODO: support % on floats too?
  }

  visitPower(node: ast.Power, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit instanceof IntegerFruit && rightFruit instanceof IntegerFruit) {
      return new IntegerFruit(leftFruit.value ** rightFruit.value);
    } else if ((leftFruit instanceof IntegerFruit || leftFruit instanceof FloatFruit) &&
               (rightFruit instanceof IntegerFruit || rightFruit instanceof FloatFruit)) {
      return new FloatFruit(leftFruit.value ** rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.Power)} can only be applied to numbers.`, node.where);
    }
  }

  visitLessThan(node: ast.LessThan, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if ((leftFruit instanceof IntegerFruit || leftFruit instanceof FloatFruit) &&
        (rightFruit instanceof IntegerFruit || rightFruit instanceof FloatFruit)) {
      return new BooleanFruit(leftFruit.value < rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.LessThan)} can only be applied to numbers.`, node.where);
    }
  }

  visitGreaterThan(node: ast.GreaterThan, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if ((leftFruit instanceof IntegerFruit || leftFruit instanceof FloatFruit) &&
        (rightFruit instanceof IntegerFruit || rightFruit instanceof FloatFruit)) {
      return new BooleanFruit(leftFruit.value > rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.GreaterThan)} can only be applied to numbers.`, node.where);
    }
  }

  visitLessThanOrEqual(node: ast.LessThanOrEqual, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if ((leftFruit instanceof IntegerFruit || leftFruit instanceof FloatFruit) &&
        (rightFruit instanceof IntegerFruit || rightFruit instanceof FloatFruit)) {
      return new BooleanFruit(leftFruit.value <= rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.LessThanOrEqual)} can only be applied to numbers.`, node.where);
    }
  }

  visitGreaterThanOrEqual(node: ast.GreaterThanOrEqual, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if ((leftFruit instanceof IntegerFruit || leftFruit instanceof FloatFruit) &&
        (rightFruit instanceof IntegerFruit || rightFruit instanceof FloatFruit)) {
      return new BooleanFruit(leftFruit.value >= rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.GreaterThanOrEqual)} can only be applied to numbers.`, node.where);
    }
  }

  visitEqual(node: ast.Equal, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit.constructor.name !== rightFruit.constructor.name) {
      throw new WhereError(`${this.symbol(ast.Equal)} can only be applied to values of the same type.`, node.where);
    } else if ((leftFruit instanceof IntegerFruit || leftFruit instanceof FloatFruit || leftFruit instanceof StringFruit || leftFruit instanceof BooleanFruit) &&
               (rightFruit instanceof IntegerFruit || rightFruit instanceof FloatFruit || rightFruit instanceof StringFruit || rightFruit instanceof BooleanFruit)) {
      return new BooleanFruit(leftFruit.value === rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.Equal)} can only be applied to values of the same type.`, node.where);
    }
  }

  visitNotEqual(node: ast.NotEqual, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit.constructor.name !== rightFruit.constructor.name) {
      throw new WhereError(`${this.symbol(ast.NotEqual)} can only be applied to values of the same type.`, node.where);
    } else if ((leftFruit instanceof IntegerFruit || leftFruit instanceof FloatFruit || leftFruit instanceof StringFruit || leftFruit instanceof BooleanFruit) &&
               (rightFruit instanceof IntegerFruit || rightFruit instanceof FloatFruit || rightFruit instanceof StringFruit || rightFruit instanceof BooleanFruit)) {
      return new BooleanFruit(leftFruit.value !== rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.NotEqual)} can only be applied to values of the same type.`, node.where);
    }
  }

  visitLogicalAnd(node: ast.LogicalAnd, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    if (leftFruit instanceof BooleanFruit) {
      if (!leftFruit.value) {
        return new BooleanFruit(false);
      } else {
        const rightFruit = node.rightNode.visit(this, runtime);
        if (rightFruit instanceof BooleanFruit) {
          return rightFruit;
        }
      }
    }
    throw new WhereError(`\`${this.symbol(ast.LogicalAnd)}\` can only be applied to booleans.`, node.where);
  }

  visitLogicalOr(node: ast.LogicalOr, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    if (leftFruit instanceof BooleanFruit) {
      if (leftFruit.value) {
        return new BooleanFruit(true);
      } else {
        const rightFruit = node.rightNode.visit(this, runtime);
        if (rightFruit instanceof BooleanFruit) {
          return rightFruit;
        }
      }
    }
    throw new WhereError(`\`${this.symbol(ast.LogicalOr)}\` can only be applied to booleans.`, node.where);
  }

  visitBitwiseAnd(node: ast.BitwiseAnd, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit instanceof IntegerFruit && rightFruit instanceof IntegerFruit) {
      return new IntegerFruit(leftFruit.value & rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.BitwiseAnd)} can only be applied to integers.`, node.where);
    }
  }

  visitBitwiseOr(node: ast.BitwiseOr, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit instanceof IntegerFruit && rightFruit instanceof IntegerFruit) {
      return new IntegerFruit(leftFruit.value | rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.BitwiseOr)} can only be applied to integers.`, node.where);
    }
  }

  visitXor(node: ast.Xor, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit instanceof IntegerFruit && rightFruit instanceof IntegerFruit) {
      return new IntegerFruit(leftFruit.value ^ rightFruit.value);
    } else if (leftFruit instanceof BooleanFruit && rightFruit instanceof BooleanFruit) {
      return new BooleanFruit(leftFruit.value !== rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.Xor)} can only be applied to integers or booleans.`, node.where);
    }
  }

  visitLeftShift(node: ast.LeftShift, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit instanceof IntegerFruit && rightFruit instanceof IntegerFruit) {
      return new IntegerFruit(leftFruit.value << rightFruit.value);
    } else {
      throw new WhereError(`${this.symbol(ast.LeftShift)} can only be applied to integers.`, node.where);
    }
  }

  visitRightShift(node: ast.RightShift, runtime: Runtime): Fruit {
    const leftFruit = node.leftNode.visit(this, runtime);
    const rightFruit = node.rightNode.visit(this, runtime);
    if (leftFruit instanceof IntegerFruit && rightFruit instanceof IntegerFruit) {
      return new IntegerFruit(leftFruit.value >> rightFruit.value);
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
      if (fruit.type === oldFruit.type) {
        runtime.setVariable(identifier, fruit);
      } else {
        throw new WhereError(`${label} \`${identifier}\` has type \`${oldFruit.type}\`. A value of type \`${fruit.type}\` cannot be assigned to it.`, where);
      }
    } else {
      throw new WhereError(`${label} \`${identifier}\` is undeclared.`, where);
    }
  }

  visitBlank(_node: ast.Blank, _runtime: Runtime): Fruit {
    return new VoidFruit();
  }

  visitAssignment(node: ast.Assignment, runtime: Runtime): Fruit {
    const rightFruit = node.rightNode.visit(this, runtime);

    // Don't evaluate left-hand side because that does an rvalue lookup.
    if (node.leftNode instanceof ast.Variable) {
      const identifier = node.leftNode.identifier;
      this.assignVariable('Variable', node.where, identifier, rightFruit, runtime);
    } else if (node.leftNode instanceof ast.ArraySubscript) {
      const receiverFruit = node.leftNode.arrayNode.visit(this, runtime);
      if (!(receiverFruit instanceof ArrayFruit)) {
        throw new WhereError(`The index operator cannot be applied to a value of type \`${receiverFruit.type}\`.`, node.leftNode.where);
      }

      const indexFruit = node.leftNode.indexNode.visit(this, runtime);
      if (!(indexFruit instanceof IntegerFruit)) {
        throw new WhereError(`An index must be an integer.`, node.leftNode.indexNode.where);
      }

      if (0 <= indexFruit.value && indexFruit.value < receiverFruit.value.length) {
        receiverFruit.value[indexFruit.value] = rightFruit;
      } else {
        throw new WhereError(`This array has ${receiverFruit.value.length} element${receiverFruit.value.length === 1 ? '' : 's'}. Index ${indexFruit.value} is out of bounds.`, node.leftNode.indexNode.where);
      }
    } else if (node.leftNode instanceof ast.Member) {
      const receiverFruit = node.leftNode.receiverNode.visit(this, runtime);
      if (!(receiverFruit instanceof ObjectFruit)) {
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

    return new VoidFruit();
  }

  visitDeclaration(node: ast.Declaration, runtime: Runtime): Fruit {
    let oldFruit = runtime.getVariable(node.identifier);
    if (oldFruit) {
      throw new WhereError(`Variable \`${node.identifier}\` is already declared.`, node.where);
    }

    runtime.declareVariable(node.identifier, node.variableType);

    if (node.rightNode) {
      const rightFruit = node.rightNode.visit(this, runtime);
      this.assignVariable('Variable', node.where, node.identifier, rightFruit, runtime);
    }

    return new VoidFruit();
  }

  visitVariable(node: ast.Variable, runtime: Runtime): Fruit {
    const fruit = runtime.getVariable(node.identifier);
    if (fruit) {
      if (fruit instanceof UninitializedFruit) {
        throw new WhereError(`Variable ${node.identifier} is uninitialized.`, node.where);
      } else {
        return fruit;
      }
    } else {
      throw new WhereError(`Variable ${node.identifier} is undeclared.`, node.where);
    }
  }

  visitBlock(node: ast.Block, runtime: Runtime): Fruit {
    for (let statement of node.statements) {
      statement.visit(this, runtime);
    }
    return new VoidFruit();
  }

  visitPrint(node: ast.Print, runtime: Runtime): Fruit {
    const fruit = node.operandNode.visit(this, runtime);
    if (fruit instanceof IntegerFruit || fruit instanceof FloatFruit || fruit instanceof StringFruit || fruit instanceof BooleanFruit || fruit instanceof ArrayFruit || fruit instanceof ObjectFruit) {
      Runtime.stdout += fruit.toString() + "\n";
    } else {
      throw new WhereError('Only values may be printed.', node.where);
    }
    return new VoidFruit();
  }

  visitIf(node: ast.If, runtime: Runtime): Fruit {
    const fruit = node.conditionNode.visit(this, runtime);
    if (fruit instanceof BooleanFruit) {
      if (fruit.value) {
        node.thenBlock.visit(this, runtime);
      } else if (node.elseBlock) {
        node.elseBlock.visit(this, runtime);
      }
    } else {
      throw new WhereError('A condition must yield a boolean value.', node.conditionNode.where);
    }
    return new VoidFruit();
  }

  visitWhile(node: ast.While, runtime: Runtime): Fruit {
    let isTerminated = false;
    while (!isTerminated) {
      const fruit = node.conditionNode.visit(this, runtime);
      if (fruit instanceof BooleanFruit) {
        if (fruit.value) {
          node.body.visit(this, runtime);
        } else {
          isTerminated = true;
        }
      } else {
        throw new WhereError('A condition must yield a boolean value.', node.conditionNode.where);
      }
    }
    return new VoidFruit();
  }

  visitDoWhile(node: ast.DoWhile, runtime: Runtime): Fruit {
    let isTerminated = false;
    while (!isTerminated) {
      node.body.visit(this, runtime);
      const fruit = node.conditionNode.visit(this, runtime);
      if (fruit instanceof BooleanFruit) {
        if (!fruit.value) {
          isTerminated = true;
        }
      } else {
        throw new WhereError('A condition must yield a boolean value.', node.conditionNode.where);
      }
    }
    return new VoidFruit();
  }

  visitRepeatUntil(node: ast.RepeatUntil, runtime: Runtime): Fruit {
    let isTerminated = false;
    while (!isTerminated) {
      node.body.visit(this, runtime);
      const fruit = node.conditionNode.visit(this, runtime);
      if (fruit instanceof BooleanFruit) {
        if (fruit.value) {
          isTerminated = true;
        }
      } else {
        throw new WhereError('A condition must yield a boolean value.', node.conditionNode.where);
      }
    }
    return new VoidFruit();
  }

  visitFor(node: ast.For, _runtime: Runtime): Fruit {
    let isTerminated = false;
    const newRuntime = Runtime.new();
    node.initializationNode?.visit(this, newRuntime);
    while (!isTerminated) {
      const fruit = node.conditionNode.visit(this, newRuntime);
      if (fruit instanceof BooleanFruit) {
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
    return new VoidFruit();
  }

  // --------------------------------------------------------------------------
  // Functions
  // --------------------------------------------------------------------------

  visitFunctionDefinition(node: ast.FunctionDefinition, runtime: Runtime): Fruit {
    runtime.functionBindings.set(node.identifier, new FunctionFruit(node.formals, node.returnType, node.body, node.where));
    return new VoidFruit();
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
        lambda.body.visit(this, newRuntime);
        if (lambda.returnType !== 'void') {
          throw new WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${lambda.returnType}\`. It didn't return anything.`, lambda.where);
        }
        fruit = new VoidFruit();
      } catch (e) {
        if (e instanceof ReturnSomethingException) {
          if (lambda.returnType === 'void') {
            throw new WhereError(`Function \`${node.identifier}\` is declared to return nothing. It returned something.`, e.returnWhere);
          } else if (lambda.returnType !== e.fruit.type) {
            throw new WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${lambda.returnType}\`. It returned a value of type \`${e.fruit.type}\`.`, e.returnWhere);
          } else {
            fruit = e.fruit;
          }
        } else if (e instanceof ReturnNothingException) {
          if (lambda.returnType !== 'void') {
            throw new WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${lambda.returnType}\`. It returned nothing.`, e.returnWhere);
          } else {
            fruit = new VoidFruit();
          }
        } else {
          throw e;
        }
      }

      return fruit;
    } else {
      throw new WhereError(`Function ${node.identifier} is not defined.`, node.where);
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
    return new VoidFruit();
  }

  // --------------------------------------------------------------------------
  // Arrays
  // --------------------------------------------------------------------------

  visitArrayLiteral(node: ast.ArrayLiteral, runtime: Runtime): Fruit {
    if (!runtime.expectedType) {
      throw new WhereError("An array literal is an unexpected place. It must be part of an array declaration.", node.where);
    }

    const elementType = runtime.expectedType.substring(0, runtime.expectedType.length - 2);
    const newRuntime = runtime.shallowClone();
    newRuntime.expectedType = elementType;

    const elementFruits = node.elementNodes.map(elementNode => elementNode.visit(this, newRuntime));
    const badIndex = elementFruits.findIndex(elementFruit => elementFruit.type !== elementType);
    if (badIndex >= 0) {
      throw new WhereError(`An array element has the wrong type. It must have type \`${runtime.expectedType!}\`.`, node.elementNodes[badIndex].where);
    }
    return new ArrayFruit(`${runtime.expectedType}`, elementFruits);
  }

  visitArrayDeclaration(node: ast.ArrayDeclaration, runtime: Runtime): Fruit {
    // The array literal needs to know what type its elements should have. We
    // pass the element type through the runtime.
    const newRuntime = runtime.shallowClone();
    newRuntime.expectedType = node.variableType;
    return this.visitDeclaration(node, newRuntime);
  }

  visitArraySubscript(node: ast.ArraySubscript, runtime: Runtime): Fruit {
    const receiverFruit = node.arrayNode.visit(this, runtime);
    if (!(receiverFruit instanceof ArrayFruit)) {
      throw new WhereError(`The index operator cannot be applied to a value of type \`${receiverFruit.type}\`.`, node.where);
    }

    const indexFruit = node.indexNode.visit(this, runtime);
    if (!(indexFruit instanceof IntegerFruit)) {
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
    if (receiverFruit instanceof ArrayFruit && node.identifier === 'length') {
      return new IntegerFruit(receiverFruit.value.length);
    } else if (receiverFruit instanceof ObjectFruit) {
      const memberFruit = receiverFruit.value.get(node.identifier);
      if (memberFruit) {
        if (memberFruit instanceof UninitializedFruit) {
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
    const classFruit = new ClassFruit(node.superclass, node.where);
    const newRuntime = runtime.shallowClone();
    newRuntime.classFruit = classFruit;

    node.instanceVariableDeclarations.forEach(declaration => declaration.visit(this, newRuntime));
    node.methodDefinitions.forEach(definition => definition.visit(this, newRuntime));

    runtime.classBindings.set(node.identifier, classFruit);

    return new VoidFruit();
  }

  visitInstanceVariableDeclaration(node: ast.InstanceVariableDeclaration, runtime: Runtime): Fruit {
    const classFruit = runtime.classFruit!;

    if (classFruit.instanceVariableFruits.has(node.identifier)) {
      throw new WhereError(`Variable ${node.identifier} has already been declared.`, node.where);
    }    

    const visibility = node.visibility ?? ast.Visibility.Public;
    classFruit.instanceVariableFruits.set(node.identifier, new InstanceVariableFruit(node.variableType, visibility));

    return new VoidFruit();
  }

  visitMethodDefinition(node: ast.MethodDefinition, runtime: Runtime): Fruit {
    const classFruit = runtime.classFruit!;

    if (classFruit.instanceMethodFruits.has(node.identifier)) {
      throw new WhereError(`Method ${node.identifier} has already been defined.`, node.where);
    }    

    const visibility = node.visibility ?? ast.Visibility.Public;
    classFruit.instanceMethodFruits.set(node.identifier, new MethodFruit(node.formals, node.returnType, node.body, visibility, node.where));

    return new VoidFruit();
  }

  visitInstantiation(node: ast.Instantiation, runtime: Runtime): Fruit {
    const classFruit = runtime.classBindings.get(node.identifier);
    if (!classFruit) {
      throw new WhereError(`Class ${node.identifier} is not defined.`, node.where);
    }
    return new ObjectFruit(node.identifier, new Map(Array.from(classFruit.instanceVariableFruits, ([identifier, fruit]) => [identifier, new UninitializedFruit(fruit.type)])));
  }

  visitCall(_context: string, node: ast.MethodCall | ast.FunctionCall, subroutineFruit: MethodFruit | FunctionFruit, runtime: Runtime) {
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
      subroutineFruit.body.visit(this, newRuntime);
      if (subroutineFruit.returnType !== 'void') {
        throw new WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${subroutineFruit.returnType}\`. It didn't return anything.`, subroutineFruit.where);
      }
      fruit = new VoidFruit();
    } catch (e) {
      if (e instanceof ReturnSomethingException) {
        if (subroutineFruit.returnType === 'void') {
          throw new WhereError(`Function \`${node.identifier}\` is declared to return nothing. It returned something.`, e.returnWhere);
        } else if (subroutineFruit.returnType !== e.fruit.type) {
          throw new WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${subroutineFruit.returnType}\`. It returned a value of type \`${e.fruit.type}\`.`, e.returnWhere);
        } else {
          fruit = e.fruit;
        }
      } else if (e instanceof ReturnNothingException) {
        if (subroutineFruit.returnType !== 'void') {
          throw new WhereError(`Function \`${node.identifier}\` is declared to return a value of type \`${subroutineFruit.returnType}\`. It returned nothing.`, e.returnWhere);
        } else {
          fruit = new VoidFruit();
        }
      } else {
        throw e;
      }
    }

    return fruit;
  }

  visitMethodCall(node: ast.MethodCall, runtime: Runtime): Fruit {
    const receiverFruit = node.receiverNode.visit(this, runtime);
    if (!(receiverFruit instanceof ObjectFruit)) {
      throw new WhereError(`A value of type \`${receiverFruit.type}\` is not an object. Methods cannot be called on it.`, node.receiverNode.where);
    }

    // TODO: will classFruit be defined?
    const classFruit = runtime.classBindings.get(receiverFruit.type)!;

    const lambda = classFruit.instanceMethodFruits.get(node.identifier);
    if (!lambda) {
      throw new WhereError(`Function ${node.identifier} is not defined.`, node.where);
    }

    return this.visitCall('method', node, lambda, runtime);
  }

  // --------------------------------------------------------------------------
}
