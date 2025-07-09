import {defaultSymbolMap} from '../symbol-map.js';
import * as ast from '../ast.js';

export const praxisSymbolMap = defaultSymbolMap();

praxisSymbolMap.set(ast.LogicalAnd, 'and');
praxisSymbolMap.set(ast.LogicalOr, 'or');
praxisSymbolMap.set(ast.LogicalNegate, 'not');
praxisSymbolMap.set(true, 'true');
praxisSymbolMap.set(false, 'false');
