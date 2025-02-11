import {defaultSymbolMap} from '../symbol-map.js';
import * as ast from '../ast.js';

export const praxlySymbolMap = defaultSymbolMap();

praxlySymbolMap.set(ast.LogicalAnd, 'and');
praxlySymbolMap.set(ast.LogicalOr, 'or');
praxlySymbolMap.set(ast.LogicalNegate, 'not');
