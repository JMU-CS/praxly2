import {OutputFormatter as DefaultOutputFormatter} from '../output-formatter.js';
import * as ast from '../ast.js';
import {ArrayType, ClassType, Type, Fruit} from '../type.js';

export class OutputFormatter extends DefaultOutputFormatter {
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
    } else if (Type.String2.covers(fruit.type)) {
      return fruit.value.runtime.variableBindings.get('text')!.value as String;
    } else if (Type.Integer.covers(fruit.type) ||
        Type.Float.covers(fruit.type) ||
        Type.Double.covers(fruit.type)) {
      return fruit.value.toString();
    } else if (Type.Boolean.covers(fruit.type)) {
      return this.boolean(fruit);
    } else {
      return null;
    }
  }
}
