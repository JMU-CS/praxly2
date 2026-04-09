/**
 * Abstract visitor pattern base class and scope management for AST traversal.
 * Includes SymbolTable for tracking variable scopes and operator precedence definitions.
 */

import type { Program, Statement, Expression, Block, ClassDeclaration, MethodDeclaration, FieldDeclaration, Constructor } from './ast';

export type TargetLanguage = 'java' | 'python' | 'csp' | 'praxis';

export interface TranslationContext {
    symbolTable: SymbolTable;
    functionReturnTypes: Map<string, string>;
    functionParamTypes: Map<string, string[]>;
}

export type SourceMap = Map<string, number>; // AST Node ID -> Line Number

export class SymbolTable {
    private scopes: Map<string, string>[] = [new Map()];

    enterScope() {
        this.scopes.push(new Map());
    }

    exitScope() {
        this.scopes.pop();
    }

    set(name: string, type: string) {
        this.scopes[this.scopes.length - 1].set(name, type);
    }

    get(name: string): string | undefined {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name)) {
                return this.scopes[i].get(name);
            }
        }
        return undefined;
    }

    hasInCurrentScope(name: string): boolean {
        return this.scopes[this.scopes.length - 1].has(name);
    }
}

export const Precedence = {
    Member: 18, Call: 17, Instantiation: 16, Postfix: 15, Unary: 14,
    Exponential: 13, Multiplicative: 12, Additive: 11, Shift: 10,
    Relational: 9, Equality: 8, BitwiseAnd: 7, Xor: 6, BitwiseOr: 5,
    LogicalAnd: 4, LogicalOr: 3, Conditional: 2.5, Assignment: 2, Sequence: 1
};


export abstract class ASTVisitor {
    protected output: string[] = [];
    protected indentLevel = 0;
    protected context: TranslationContext;
    protected breakStr = 'break;';
    protected continueStr = 'continue;';
    protected sourceMap: SourceMap = new Map();

    constructor(context: TranslationContext) {
        this.context = context;
    }

    getGeneratedCode(): string {
        return this.output.join('\n');
    }

    getSourceMap(): SourceMap {
        return this.sourceMap;
    }

    protected emit(line: string, nodeId?: string) {
        this.output.push('  '.repeat(this.indentLevel) + line);
        // Map this line (0-based for CodeMirror) to the node ID
        if (nodeId) {
            this.sourceMap.set(nodeId, this.output.length - 1);
        }
    }

    protected indent() { this.indentLevel++; }
    protected dedent() { this.indentLevel--; }

    // -- Visit Methods (To be implemented by concrete emitters) --
    abstract visitProgram(program: Program): void;
    abstract visitBlock(block: Block): void;
    abstract visitClassDeclaration(classDecl: ClassDeclaration): void;
    abstract visitMethodDeclaration(method: MethodDeclaration): void;
    abstract visitFieldDeclaration(field: FieldDeclaration): void;
    abstract visitConstructor(ctor: Constructor): void;

    abstract visitPrint(stmt: any): void;
    abstract visitAssignment(stmt: any): void;
    abstract visitIf(stmt: any): void;
    abstract visitWhile(stmt: any): void;
    abstract visitDoWhile(stmt: any): void;
    abstract visitSwitch(stmt: any): void;
    abstract visitBreak(stmt: any): void;
    abstract visitContinue(stmt: any): void;
    abstract visitFor(stmt: any): void;
    abstract visitFunctionDeclaration(stmt: any): void;
    abstract visitReturn(stmt: any): void;
    abstract visitExpressionStatement(stmt: any): void;
    abstract visitTry(stmt: any): void;

    // Dispatcher
    visitStatement(stmt: Statement) {
        switch (stmt.type) {
            case 'Print': this.visitPrint(stmt); break;
            case 'Assignment': this.visitAssignment(stmt); break;
            case 'If': this.visitIf(stmt); break;
            case 'While': this.visitWhile(stmt); break;
            case 'DoWhile': this.visitDoWhile(stmt); break;
            case 'Switch': this.visitSwitch(stmt); break;
            case 'Break': this.visitBreak(stmt); break;
            case 'Continue': this.visitContinue(stmt); break;
            case 'For': this.visitFor(stmt); break;
            case 'Try': this.visitTry(stmt); break;
            case 'FunctionDeclaration': this.visitFunctionDeclaration(stmt); break;
            case 'Return': this.visitReturn(stmt); break;
            case 'ExpressionStatement': this.visitExpressionStatement(stmt); break;
            case 'ClassDeclaration': this.visitClassDeclaration(stmt); break;
            case 'FieldDeclaration': this.visitFieldDeclaration(stmt); break;
            case 'Constructor': this.visitConstructor(stmt); break;
            case 'MethodDeclaration': this.visitMethodDeclaration(stmt); break;
        }
    }

    abstract generateExpression(expr: Expression, parentPrecedence: number): string;

    protected inferType(expr: Expression): string {
        switch (expr.type) {
            case 'Literal':
                if (typeof expr.value === 'boolean') return 'boolean';
                if (typeof expr.value === 'string') return 'String';
                if (typeof expr.value === 'number') {
                    if (expr.raw && (expr.raw.includes('.') || expr.raw.toLowerCase().includes('e'))) return 'double';
                    return 'int';
                }
                return 'Object';
            case 'Identifier': return this.context.symbolTable.get(expr.name) || 'var';
            case 'BinaryExpression':
                if (['>', '<', '>=', '<=', '==', '!=', 'and', 'or'].includes(expr.operator)) return 'boolean';
                const left = this.inferType(expr.left);
                if (left === 'double') return 'double';
                return 'int';
            case 'UnaryExpression':
                if (expr.operator === 'not' || expr.operator === '!') return 'boolean';
                return this.inferType(expr.argument);
            case 'NewExpression': return (expr as any).className || 'Object';
            case 'IndexExpression':
                const objType = this.inferType(expr.object);
                if (objType.endsWith('[]')) return objType.slice(0, -2);
                return 'var';
            case 'CallExpression':
                const calleeName = (expr.callee as any).name;
                if (calleeName === 'range') return 'int[]';
                if (calleeName === 'input' || calleeName === 'INPUT') return 'String';
                if (calleeName && this.context.functionReturnTypes.has(calleeName)) return this.context.functionReturnTypes.get(calleeName)!;
                return 'var';
            case 'ArrayLiteral':
                if (expr.elements && expr.elements.length > 0) {
                    return this.inferType(expr.elements[0]) + '[]';
                }
                return 'Object[]';
            default: return 'var';
        }
    }
}
