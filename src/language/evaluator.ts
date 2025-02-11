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
}

class PrimitiveFruit<T> extends Fruit {
  value: T;

  constructor(type: string, value: T) {
    super(type);
    this.value = value;
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

class VoidFruit extends Fruit {
  constructor() {
    super('void');
  }
}

class Lambda {
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

class VariableCell {
  type: string;
  fruit: Fruit | null;

  constructor(type: string) {
    this.type = type;
    this.fruit = null;
  }
}

export class Runtime {
  variableBindings: Map<string, VariableCell>;
  functionBindings: Map<string, Lambda>;
  static stdout: string = '';

  constructor() {
    this.variableBindings = new Map();
    this.functionBindings = new Map();
  }

  declareVariable(identifier: string, type: string) {
    this.variableBindings.set(identifier, new VariableCell(type));
  }

  setVariable(identifier: string, fruit: Fruit) {
    this.variableBindings.get(identifier)!.fruit = fruit;
  }

  getVariable(identifier: string): VariableCell | undefined {
    return this.variableBindings.get(identifier);
  }

  setFunction(identifier: string, lambda: Lambda) {
    this.functionBindings.set(identifier, lambda);
  }

  getFunction(identifier: string): Lambda | undefined {
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
    const cell = runtime.getVariable(identifier);
    if (cell) {
      if (fruit.type === cell.type) {
        cell.fruit = fruit;
      } else {
        throw new WhereError(`${label} \`${identifier}\` has type \`${cell.type}\`. A value of type \`${fruit.type}\` cannot be assigned to it.`, where);
      }
    } else {
      throw new WhereError(`${label} \`${identifier}\` is undeclared.`, where);
    }
  }

  visitAssignment(node: ast.Assignment, runtime: Runtime): Fruit {
    const rightFruit = node.rightNode.visit(this, runtime);

    // Don't evaluate left-hand side because that does an rvalue lookup.
    if (node.leftNode instanceof ast.Variable) {
      const identifier = node.leftNode.identifier;
      this.assignVariable('Variable', node.where, identifier, rightFruit, runtime);
    }

    return new VoidFruit();
  }

  visitDeclaration(node: ast.Declaration, runtime: Runtime): Fruit {
    let cell = runtime.getVariable(node.identifier);
    if (cell) {
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
    const cell = runtime.getVariable(node.identifier);
    if (cell) {
      if (cell.fruit) {
        return cell.fruit;
      } else {
        throw new WhereError(`Variable ${node.identifier} is uninitialized.`, node.where);
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
    if (fruit instanceof IntegerFruit || fruit instanceof FloatFruit || fruit instanceof StringFruit || fruit instanceof BooleanFruit) {
      Runtime.stdout += fruit.value + "\n";
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

  // --------------------------------------------------------------------------
  // Functions
  // --------------------------------------------------------------------------

  visitFunctionDefinition(node: ast.FunctionDefinition, runtime: Runtime): Fruit {
    runtime.functionBindings.set(node.identifier, new Lambda(node.formals, node.returnType, node.body, node.where));
    return new VoidFruit();
  }

  visitFunctionCall(node: ast.FunctionCall, runtime: Runtime): Fruit {
    const lambda = runtime.functionBindings.get(node.identifier);
    if (lambda) {
      if (node.actuals.length !== lambda.formals.length) {
        throw new WhereError(`Function \`${node.identifier}\` expects ${lambda.formals.length} parameter${lambda.formals.length === 1 ? '' : 's'}. ${node.actuals.length} ${node.actuals.length === 1 ? 'was' : 'were'} given.`, node.where);
      }

      const newRuntime = new Runtime();
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
}
