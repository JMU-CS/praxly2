import type { Program, Statement, Expression, Block } from './ast';
import { type TargetLanguage, type TranslationContext, SymbolTable, ASTVisitor } from './visitor';

import { JavaEmitter } from './java/emitter';
import { CSPEmitter } from './csp/emitter';
import { PythonEmitter } from './python/emitter';
import { PraxisEmitter } from './praxis/emitter';

export class Translator {
    translate(program: Program, targetLang: TargetLanguage): string {
        const context = this.analyze(program);

        let emitter: ASTVisitor;
        switch (targetLang) {
            case 'java': emitter = new JavaEmitter(context); break;
            case 'csp': emitter = new CSPEmitter(context); break;
            case 'python': emitter = new PythonEmitter(context); break;
            case 'praxis': emitter = new PraxisEmitter(context); break;
            default: throw new Error(`Unsupported target language: ${targetLang}`);
        }

        emitter.visitProgram(program);
        return emitter.getGeneratedCode();
    }

    private analyze(program: Program): TranslationContext {
        const context: TranslationContext = {
            symbolTable: new SymbolTable(),
            functionReturnTypes: new Map(),
            functionParamTypes: new Map()
        };

        const inferType = (expr: Expression): string => {
            switch (expr.type) {
                case 'Literal':
                    if (typeof expr.value === 'boolean') return 'boolean';
                    if (typeof expr.value === 'string') return 'String';
                    if (typeof expr.value === 'number') {
                        if (expr.raw && (expr.raw.includes('.') || expr.raw.toLowerCase().includes('e'))) return 'double';
                        return 'int';
                    }
                    return 'Object';
                case 'Identifier': return context.symbolTable.get(expr.name) || 'var';
                case 'BinaryExpression':
                    if (['>', '<', '>=', '<=', '==', '!=', 'and', 'or'].includes(expr.operator)) return 'boolean';
                    const left = inferType(expr.left);
                    if (left === 'double') return 'double';
                    return 'int';
                case 'UnaryExpression':
                    if (expr.operator === 'not' || expr.operator === '!') return 'boolean';
                    return inferType(expr.argument);
                case 'NewExpression': return (expr as any).className || 'Object';
                case 'IndexExpression':
                    const objType = inferType(expr.object);
                    if (objType.endsWith('[]')) return objType.slice(0, -2);
                    return 'var';
                case 'CallExpression':
                    const calleeNameForAnalysis = (expr.callee as any).name;
                    if (calleeNameForAnalysis === 'range') return 'int[]';
                    if (calleeNameForAnalysis && context.functionReturnTypes.has(calleeNameForAnalysis)) return context.functionReturnTypes.get(calleeNameForAnalysis)!;
                    return 'var';
                case 'ArrayLiteral':
                    if (expr.elements && expr.elements.length > 0) {
                        return inferType(expr.elements[0]) + '[]';
                    }
                    return 'Object[]';
                default: return 'var';
            }
        };

        const analyzeBlock = (statements: Statement[]) => {
            statements.forEach(stmt => {
                if (stmt.type === 'Assignment') {
                    const type = inferType(stmt.value);
                    if (type !== 'var') context.symbolTable.set(stmt.name, type);
                }
                if (stmt.type === 'If') {
                    analyzeBlock(stmt.thenBranch.body);
                    if (stmt.elseBranch) analyzeBlock(stmt.elseBranch.body);
                }
                if (stmt.type === 'While') analyzeBlock(stmt.body.body);
                if (stmt.type === 'For') analyzeBlock(stmt.body.body);
            });
        };

        const analyzeCalls = (node: any) => {
            if (!node) return;
            if (node.type === 'CallExpression') {
                const funcName = node.callee.name;
                const argTypes = node.arguments.map((arg: Expression) => inferType(arg));
                if (!context.functionParamTypes.has(funcName)) {
                    context.functionParamTypes.set(funcName, argTypes);
                }
            }
            for (const key in node) {
                if (typeof node[key] === 'object' && node[key] !== null) {
                    if (Array.isArray(node[key])) node[key].forEach((c: any) => analyzeCalls(c));
                    else analyzeCalls(node[key]);
                }
            }
        };

        const analyzeReturnType = (block: Block): string => {
            for (const stmt of block.body) {
                if (stmt.type === 'Return') return stmt.value ? inferType(stmt.value) : 'void';
                if (stmt.type === 'If') {
                    const t = analyzeReturnType(stmt.thenBranch);
                    if (t !== 'void') return t;
                    if (stmt.elseBranch) {
                        const e = analyzeReturnType(stmt.elseBranch);
                        if (e !== 'void') return e;
                    }
                }
            }
            return 'void';
        };

        const functions = program.body.filter(s => s.type === 'FunctionDeclaration');

        // Multi-pass dependency resolution for chained nested procedures (max_two -> max_three)
        let changed = true;
        let passLimit = 10;
        while (changed && passLimit-- > 0) {
            changed = false;
            functions.forEach((func: any) => {
                const oldType = context.functionReturnTypes.get(func.name) || 'void';
                const newType = analyzeReturnType(func.body);
                if (oldType !== newType && newType !== 'var' && newType !== 'void') {
                    context.functionReturnTypes.set(func.name, newType);
                    changed = true;
                }
            });
        }

        analyzeBlock(program.body);
        analyzeCalls(program);

        return context;
    }
}
