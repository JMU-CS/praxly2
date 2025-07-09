import * as ast from './ast.js';

export type NodeClass = new(...args: any[]) => ast.Node;
export type SymbolMap = Map<NodeClass | boolean, string>;

export function defaultSymbolMap(): SymbolMap {
  const symbolMap = new Map<NodeClass | boolean, string>();

  symbolMap.set(ast.Add, '+');
  symbolMap.set(ast.Subtract, '-');
  symbolMap.set(ast.Multiply, '*');
  symbolMap.set(ast.Divide, '/');
  symbolMap.set(ast.Remainder, '%');
  symbolMap.set(ast.Power, '**');
  symbolMap.set(ast.LessThan, '<');
  symbolMap.set(ast.GreaterThan, '>');
  symbolMap.set(ast.LessThanOrEqual, '<=');
  symbolMap.set(ast.GreaterThanOrEqual, '>=');
  symbolMap.set(ast.Equal, '==');
  symbolMap.set(ast.NotEqual, '!=');
  symbolMap.set(ast.LogicalAnd, '&&');
  symbolMap.set(ast.LogicalOr, '||');
  symbolMap.set(ast.BitwiseAnd, '&');
  symbolMap.set(ast.BitwiseOr, '|');
  symbolMap.set(ast.Xor, '^');
  symbolMap.set(ast.LeftShift, '<<');
  symbolMap.set(ast.RightShift, '>>');

  return symbolMap;
}
