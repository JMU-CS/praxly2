import {defaultSymbolMap} from '../symbol-map.js';
import * as ast from '../ast.js';

export const pythonSymbolMap = defaultSymbolMap();

pythonSymbolMap.set(ast.LogicalAnd, 'and');
pythonSymbolMap.set(ast.LogicalOr, 'or');
pythonSymbolMap.set(ast.LogicalNegate, 'not');
pythonSymbolMap.set(true, 'True');
pythonSymbolMap.set(false, 'False');
