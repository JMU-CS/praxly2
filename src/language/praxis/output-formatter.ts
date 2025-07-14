import * as common from '../output-formatter.js';
import * as ast from '../ast.js';
import {ArrayType, ObjectType, Type, Fruit} from '../type.js';

export class OutputFormatter extends common.OutputFormatter {
  constructor() {
    super();
    this.operatorMap.set(ast.LogicalAnd, 'and');
    this.operatorMap.set(ast.LogicalOr, 'or');
    this.operatorMap.set(ast.LogicalNegate, 'not');
  }

  boolean(fruit: Fruit) {
    return fruit.value.toString();
  }

  array(fruit: Fruit) {
    return `{${fruit.value.map((element: Fruit) => this.value(element)).join(', ')}}`;
  }

  value(fruit: Fruit) {
    if (fruit.type instanceof ArrayType) {
      return this.array(fruit);
    } else if (Type.Integer.covers(fruit.type) ||
        Type.Float.covers(fruit.type) ||
        Type.Double.covers(fruit.type) ||
        Type.String.covers(fruit.type) ||
        fruit.type instanceof ObjectType) {
      return fruit.value.toString();
    } else {
      return null;
    }
  }
}
