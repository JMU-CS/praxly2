import * as ast from './ast.js';
import {Fruit} from './type.js';

export type NodeClass = new(...args: any[]) => ast.Node;

export abstract class OutputFormatter {
  operatorMap: Map<NodeClass, string>;

  constructor() {
    this.operatorMap = new Map();
    this.operatorMap.set(ast.Add, '+');
    this.operatorMap.set(ast.Subtract, '-');
    this.operatorMap.set(ast.Multiply, '*');
    this.operatorMap.set(ast.Divide, '/');
    this.operatorMap.set(ast.Remainder, '%');
    this.operatorMap.set(ast.Power, '**');
    this.operatorMap.set(ast.LessThan, '<');
    this.operatorMap.set(ast.GreaterThan, '>');
    this.operatorMap.set(ast.LessThanOrEqual, '<=');
    this.operatorMap.set(ast.GreaterThanOrEqual, '>=');
    this.operatorMap.set(ast.Equal, '==');
    this.operatorMap.set(ast.NotEqual, '!=');
    this.operatorMap.set(ast.LogicalAnd, '&&');
    this.operatorMap.set(ast.LogicalOr, '||');
    this.operatorMap.set(ast.BitwiseAnd, '&');
    this.operatorMap.set(ast.BitwiseOr, '|');
    this.operatorMap.set(ast.Xor, '^');
    this.operatorMap.set(ast.LeftShift, '<<');
    this.operatorMap.set(ast.RightShift, '>>');
  }

  operator(nodeType: NodeClass) {
    return this.operatorMap.get(nodeType);
  }

  abstract array(fruit: Fruit): string;

  abstract boolean(fruit: Fruit): string;
  
  abstract value(fruit: Fruit): string;
}
