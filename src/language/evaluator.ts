import * as ast from './ast.js';
import {Visitor} from './visitor.js';
import {WhereError} from './error.js';
import type {NodeClass, SymbolMap} from './symbol-map.js';

abstract class Fruit {}

class PrimitiveFruit<T> extends Fruit {
  value: T;

  constructor(value: T) {
    super();
    this.value = value;
  }
}

class IntegerFruit extends PrimitiveFruit<number> {}
class FloatFruit extends PrimitiveFruit<number> {}
class StringFruit extends PrimitiveFruit<string> {}
class BooleanFruit extends PrimitiveFruit<boolean> {}
class VoidFruit extends Fruit {}

export class Runtime {
  bindings: Map<string, Fruit>;
  stdout: string;

  constructor() {
    this.bindings = new Map();
    this.stdout = '';
  }

  setVariable(identifier: string, fruit: Fruit) {
    this.bindings.set(identifier, fruit);
  }

  getVariable(identifier: string): Fruit | undefined {
    return this.bindings.get(identifier);
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
    throw new WhereError(`${this.symbol(ast.LogicalAnd)} can only be applied to booleans.`, node.where);
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
    throw new WhereError(`${this.symbol(ast.LogicalOr)} can only be applied to booleans.`, node.where);
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

  visitAssignment(node: ast.Assignment, runtime: Runtime): Fruit {
    const rightFruit = node.rightNode.visit(this, runtime);

    // Don't evaluate left-hand side because that does an rvalue lookup.
    if (node.leftNode instanceof ast.Variable) {
      runtime.setVariable(node.leftNode.identifier, rightFruit);
    }

    // TODO: How do I typecheck variable assignments? I need a record of declared types.

    return new VoidFruit();
  }

  visitVariable(node: ast.Variable, runtime: Runtime): Fruit {
    const fruit = runtime.getVariable(node.identifier);
    if (fruit) {
      return fruit;
    } else {
      throw new WhereError(`Variable ${node.identifier} is unknown.`, node.where);
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
      runtime.stdout += fruit.value + "\n";
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
    const fruit = node.conditionNode.visit(this, runtime);
    if (fruit instanceof BooleanFruit) {
      if (fruit.value) {
        node.body.visit(this, runtime);
      }
    } else {
      throw new WhereError('A condition must yield a boolean value.', node.conditionNode.where);
    }
    return new VoidFruit();
  }

  // --------------------------------------------------------------------------
}
