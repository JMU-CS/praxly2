/**
 * Python Language Emitter
 * Converts AST nodes into Python source code.
 * Handles Python-specific syntax including classes with self parameter,
 * indentation-based blocks, tuple unpacking, and Python method/function syntax.
 */

import { ASTVisitor, Precedence } from '../visitor';
import type { Program, ClassDeclaration, FieldDeclaration, Constructor, MethodDeclaration, Block, For, Expression } from '../ast';

/**
 * Emitter for converting AST to Python source code.
 * Tracks class fields to properly prefix them with self.
 */
export class PythonEmitter extends ASTVisitor {
    // Tracks field names in current class scope for self. prefixing
    private currentClassFields = new Set<string>();

    private toPythonType(typeName?: string): string | undefined {
        if (!typeName) return undefined;

        const trimmed = typeName.trim();
        if (!trimmed || trimmed === 'auto' || trimmed === 'var') return undefined;

        let baseType = trimmed;
        let arrayDepth = 0;
        while (baseType.endsWith('[]')) {
            baseType = baseType.slice(0, -2);
            arrayDepth++;
        }

        const normalized = baseType.toLowerCase();
        let mappedType: string;

        switch (normalized) {
            case 'int':
            case 'byte':
            case 'short':
            case 'long':
                mappedType = 'int';
                break;
            case 'float':
            case 'double':
                mappedType = 'float';
                break;
            case 'boolean':
            case 'bool':
                mappedType = 'bool';
                break;
            case 'char':
            case 'string':
            case 'str':
                mappedType = 'str';
                break;
            case 'void':
                mappedType = 'None';
                break;
            default:
                mappedType = baseType;
                break;
        }

        for (let i = 0; i < arrayDepth; i++) {
            mappedType = `list[${mappedType}]`;
        }

        return mappedType;
    }

    private formatParameter(param: any): string {
        const annotatedType = this.toPythonType(param.paramType);
        let output = annotatedType ? `${param.name}: ${annotatedType}` : param.name;

        if (param.defaultValue) {
            output += ` = ${this.generateExpression(param.defaultValue, 0)}`;
        }

        return output;
    }

    /**
     * Check if a ClassDeclaration is Java's special Main class wrapper
     * (contains only a static main method)
     */
    private isJavaMainClass(classDecl: ClassDeclaration): boolean {
        if (classDecl.name !== 'Main') return false;
        const hasStaticMainMethod = classDecl.body.some(member => 
            member.type === 'MethodDeclaration' && 
            (member as MethodDeclaration).name === 'main' && 
            (member as MethodDeclaration).isStatic
        );
        return hasStaticMainMethod;
    }

    /**
     * Main entry point for translating a complete program.
     * Separates classes from functions and main body.
     * Handles Java Main class wrapper pattern by extracting its main method body.
     */
    visitProgram(program: Program): void {
        const classes = program.body.filter(s => s.type === 'ClassDeclaration');
        const nonClasses = program.body.filter(s => s.type !== 'ClassDeclaration');

        // Split Main class from other classes
        const mainClass = classes.find(c => this.isJavaMainClass(c as ClassDeclaration));
        const otherClasses = classes.filter(c => !this.isJavaMainClass(c as ClassDeclaration));

        // Emit non-Main classes
        otherClasses.forEach(classDecl => {
            this.visitClassDeclaration(classDecl as ClassDeclaration);
            this.emit('');
        });

        const functions = nonClasses.filter(s => s.type === 'FunctionDeclaration');
        const mainBody = nonClasses.filter(s => s.type !== 'FunctionDeclaration');

        functions.forEach(func => {
            this.visitStatement(func);
            this.emit('');
        });
        
        // Emit main body from non-class statements
        mainBody.forEach(stmt => this.visitStatement(stmt));
        
        // If there's a Java Main class, emit its main method body directly
        if (mainClass) {
            const mainClassDecl = mainClass as ClassDeclaration;
            const mainMethod = mainClassDecl.body.find(m => 
                m.type === 'MethodDeclaration' && (m as MethodDeclaration).name === 'main'
            ) as MethodDeclaration | undefined;
            
            if (mainMethod) {
                // Emit the main method's body directly without class wrapper
                this.visitBlock(mainMethod.body);
            }
        }
    }

    /**
     * Translates a class declaration with inheritance and Python syntax.
     * Tracks field names for self. prefixing in methods.
     */
    visitClassDeclaration(classDecl: ClassDeclaration): void {
        const baseClass = classDecl.superClass ? `(${classDecl.superClass.name})` : '';
        this.emit(`class ${classDecl.name}${baseClass}:`);
        this.indent();

        this.currentClassFields.clear();
        classDecl.body.forEach(member => {
            if (member.type === 'FieldDeclaration') {
                this.currentClassFields.add((member as any).name);
            }
        });

        classDecl.body.forEach(member => {
            this.visitStatement(member);
            this.emit('');
        });

        this.currentClassFields.clear();
        this.dedent();
    }

    /**
     * Translates a field declaration (class variable).
     * Emits Python type annotations for declarations when possible.
     */
    visitFieldDeclaration(field: FieldDeclaration): void {
        const annotatedType = this.toPythonType(field.fieldType);

        if ((field as any).declaredWithoutInitializer) {
            if (annotatedType) {
                this.emit(`${field.name}: ${annotatedType}`);
            } else {
                this.emit(`${field.name} = None`);
            }
            return;
        }

        let line = `${field.name}`;
        if (field.initializer) {
            line += ` = ${this.generateExpression(field.initializer, 0)}`;
        } else {
            line += ` = None`;
        }

        this.emit(line);
    }

    /**
     * Translates a constructor to Python __init__ method.
     * Parameters exclude self which is implicit.
     */
    visitConstructor(ctor: Constructor): void {
        const params = ctor.params.map(p => this.formatParameter(p)).join(', ');
        const paramStr = params ? `, ${params}` : '';
        this.emit(`def __init__(self${paramStr}):`);
        this.indent();
        this.context.symbolTable.enterScope();
        ctor.params.forEach(p => this.context.symbolTable.set(p.name, p.paramType || 'auto'));
        this.visitBlock(ctor.body);
        this.context.symbolTable.exitScope();
        this.dedent();
    }

    /**
     * Translates a method declaration to Python def syntax.
     * Parameters exclude self which is implicit.
     */
    visitMethodDeclaration(method: MethodDeclaration): void {
        const params = method.params.map(p => this.formatParameter(p)).join(', ');
        const paramStr = params ? `, ${params}` : '';
        this.emit(`def ${method.name}(self${paramStr}):`);
        this.indent();
        this.context.symbolTable.enterScope();
        method.params.forEach(p => this.context.symbolTable.set(p.name, p.paramType || 'auto'));
        this.visitBlock(method.body);
        this.context.symbolTable.exitScope();
        this.dedent();
    }

    /**
     * Translates a block of statements.
     * Only responsible for visiting statements; indentation handled by parent.
     */
    visitBlock(block: Block): void {
        block.body.forEach(stmt => this.visitStatement(stmt));
    }

    /**
     * Translates a print statement to Python print function.
     * Combines multiple expressions as separate arguments.
     */
    visitPrint(stmt: any): void {
        const args = stmt.expressions.map((e: any) => this.generateExpression(e, 0));
        const options: string[] = [];

        if (typeof stmt.separator === 'string') {
            options.push(`sep=${JSON.stringify(stmt.separator)}`);
        }

        if (stmt.appendLineFeed === false) {
            options.push('end=""');
        } else if (stmt.appendLineFeed === true) {
            options.push('end="\\n"');
        }

        this.emit(`print(${[...args, ...options].join(', ')})`, stmt.id);
    }

    /**
     * Translates variable assignments with tuple unpacking support.
     * Handles chained assignments, member assignments, and field prefixing.
     */
    visitAssignment(stmt: any): void {
        let target = stmt.name;
        
        // Handle member expression assignments (e.g., self.count = value)
        if (stmt.isMemberAssignment && stmt.memberExpr) {
            target = this.generateExpression(stmt.memberExpr, 0);
        } else if (stmt.target) {
            // Special handling for tuple unpacking targets (ArrayLiteral on left side)
            if (stmt.target.type === 'ArrayLiteral') {
                const elements = stmt.target.elements.map((e: any) => this.generateExpression(e, 0)).join(', ');
                target = elements;  // Render as tuple without brackets
            } else {
                target = this.generateExpression(stmt.target, 0);
            }
        } else if (this.currentClassFields.has(target)) {
            target = `self.${target}`;
        }
        
        // Handle nested assignments (chained assignment: x = y = z = 10)
        if (stmt.value && stmt.value.type === 'Assignment') {
            // Recursively visit the nested assignment
            this.visitAssignment(stmt.value);
            // Also emit the current assignment
            this.emit(`${target} = ${this.generateExpression(stmt.value.target, 0)}`, stmt.id);
        } else {
            // Special handling for tuple unpacking on right side
            let value: string;
            if (stmt.target?.type === 'ArrayLiteral' && stmt.value?.type === 'ArrayLiteral') {
                // Both sides are tuples, render right side without brackets
                value = stmt.value.elements.map((e: any) => this.generateExpression(e, 0)).join(', ');
            } else {
                value = this.generateExpression(stmt.value, 0);
            }

            if (stmt.varType) {
                const annotatedType = this.toPythonType(stmt.varType);
                if (stmt.declaredWithoutInitializer) {
                    if (annotatedType) {
                        this.emit(`${target}: ${annotatedType}`, stmt.id);
                    } else {
                        this.emit(`${target} = None`, stmt.id);
                    }
                } else {
                    this.emit(`${target} = ${value}`, stmt.id);
                }
                return;
            }

            this.emit(`${target} = ${value}`, stmt.id);
        }
    }

    /**
     * Translates if-else statements with elif chains.
     * Python colon-based syntax with indentation.
     */
    visitIf(stmt: any): void {
        this.emit(`if ${this.generateExpression(stmt.condition, 0)}:`, stmt.id);
        this.indent(); this.visitBlock(stmt.thenBranch); this.dedent();

        let currentElse = stmt.elseBranch;

        while (currentElse && currentElse.body.length === 1 && currentElse.body[0].type === 'If') {
            const elifStmt = currentElse.body[0];
            this.emit(`elif ${this.generateExpression(elifStmt.condition, 0)}:`);
            this.indent(); this.visitBlock(elifStmt.thenBranch); this.dedent();
            currentElse = elifStmt.elseBranch;
        }

        if (currentElse) {
            this.emit('else:');
            this.indent(); this.visitBlock(currentElse); this.dedent();
        }
    }

    /**
     * Translates while loop with optional else clause.
     * Python supports while-else executed when condition becomes false.
     */
    visitWhile(stmt: any): void {
        this.emit(`while ${this.generateExpression(stmt.condition, 0)}:`, stmt.id);
        this.indent(); this.visitBlock(stmt.body); this.dedent();
        if (stmt.elseBranch) {
            this.emit(`else:`);
            this.indent(); this.visitBlock(stmt.elseBranch); this.dedent();
        }
    }

    /**
     * Translates do-while loop to Python equivalent.
     * Python lacks do-while, so implements as while True with break condition.
     */
    visitDoWhile(stmt: any): void {
        // Python doesn't have do-while, implement as while True with break
        this.emit(`while True:`);
        this.indent(); 
        this.visitBlock(stmt.body);
        this.emit(`if not (${this.generateExpression(stmt.condition, 0)}): break`);
        this.dedent();
    }

    /**
     * Translates switch statement to Python if-elif-else.
     * Python lacks switch/case, so uses sequential equality checks.
     */
    visitSwitch(stmt: any): void {
        // Python doesn't have switch, implement as if-elif-else
        console.log(stmt);
        let first = true;
        stmt.cases.forEach((caseStmt: any, _index: number) => {
            if (caseStmt.test) {
                const keyword = first ? 'if' : 'elif';
                this.emit(`${keyword} ${stmt.discriminant.name} == ${this.generateExpression(caseStmt.test, 0)}:`);
                first = false;
            } else {
                this.emit(`else:`);
            }
            this.indent();
            caseStmt.consequent.forEach((s: any) => this.visitStatement(s));
            this.dedent();
        });
    }

    visitBreak(_stmt: any): void {
        this.emit('break');
    }

    visitContinue(_stmt: any): void {
        this.emit('continue');
    }

    /**
     * Translates for loops in multiple formats:
     * 1. C-style: converts to while loop
     * 2. Iterator-based: for var in iterable with optional tuple unpacking
     * Supports optional else clause executed if loop completes without break.
     */
    visitFor(stmt: For): void {
        if (stmt.init && stmt.condition && stmt.update) {
            this.context.symbolTable.enterScope();
            this.visitStatement(stmt.init);
            this.emit(`while ${this.generateExpression(stmt.condition, 0)}:`, stmt.id);
            this.indent();
            this.visitBlock(stmt.body);
            this.visitStatement(stmt.update);
            this.dedent();
            this.context.symbolTable.exitScope();
        } else {
            if (stmt.variables && stmt.variables.length > 1) {
                this.emit(`for ${stmt.variables.join(', ')} in ${this.generateExpression(stmt.iterable, 0)}:`, stmt.id);
            } else {
                this.emit(`for ${stmt.variable} in ${this.generateExpression(stmt.iterable, 0)}:`, stmt.id);
            }
            this.indent(); this.visitBlock(stmt.body); this.dedent();
        }

        if (stmt.elseBranch) {
            this.emit('else:');
            this.indent(); this.visitBlock(stmt.elseBranch); this.dedent();
        }
    }

    /**
     * Translates function declaration with optional default parameters.
     */
    visitFunctionDeclaration(stmt: any): void {
        const params = stmt.params.map((p: any) => this.formatParameter(p)).join(', ');
        this.emit(`def ${stmt.name}(${params}):`);
        this.indent(); this.visitBlock(stmt.body); this.dedent();
    }

    /**
     * Emits return statement with optional return value.
     */
    visitReturn(stmt: any): void {
        this.emit(`return ${stmt.value ? this.generateExpression(stmt.value, 0) : ''}`, stmt.id);
    }

    /**
     * Emits a standalone expression statement.
     */
    visitExpressionStatement(stmt: any): void {
        this.emit(this.generateExpression(stmt.expression, 0), stmt.id);
    }

    /**
     * Translates try-except-finally statement with exception type binding.
     * Supports multiple except blocks and optional finally cleanup block.
     */
    visitTry(stmt: any): void {
        this.emit('try:');
        this.indent(); this.visitBlock(stmt.body); this.dedent();
        
        stmt.handlers.forEach((handler: any) => {
            if (handler.exceptionType) {
                if (handler.varName) {
                    this.emit(`except ${handler.exceptionType} as ${handler.varName}:`);
                } else {
                    this.emit(`except ${handler.exceptionType}:`);
                }
            } else {
                this.emit(`except:`);
            }
            this.indent(); this.visitBlock(handler.body); this.dedent();
        });
        
        if (stmt.finallyBlock) {
            this.emit('finally:');
            this.indent(); this.visitBlock(stmt.finallyBlock); this.dedent();
        }
    }

    /**
     * Converts AST expression nodes to Python code with proper operator precedence.
     * Handles literals, identifiers, operators, function calls, and Python-specific syntax.
     * Tracks class fields to properly prefix with self.
     */
    generateExpression(expr: Expression, parentPrecedence: number): string {
        let output = '';
        let currentPrecedence = 99;

        switch (expr.type) {
            case 'Literal':
                if (expr.value === null || expr.raw === 'None' || expr.raw === '"None"') output = 'None';
                else if (typeof expr.value === 'string') {
                    const strVal = expr.value.startsWith('f') || expr.value.startsWith('r') || expr.value.startsWith('b')
                        ? expr.value.substring(1) : expr.value;
                    output = `"${strVal}"`;
                } else if (typeof expr.value === 'boolean') output = expr.value ? 'True' : 'False';
                else output = String(expr.value);
                break;
            case 'Identifier':
                if (this.currentClassFields.has(expr.name)) {
                    output = `self.${expr.name}`;
                } else {
                    output = expr.name;
                }
                break;
            case 'ThisExpression': output = 'self'; break;
            case 'NewExpression':
                currentPrecedence = Precedence.Instantiation;
                const args = expr.arguments.map(a => this.generateExpression(a, 0)).join(', ');
                output = `${expr.className}(${args})`;
                break;
            case 'IndexExpression':
                currentPrecedence = Precedence.Member;
                const objE = this.generateExpression(expr.object, currentPrecedence);
                const idxE = this.generateExpression(expr.index, 0);
                if (expr.indexEnd) {
                    const endE = this.generateExpression(expr.indexEnd, 0);
                    const stepE = expr.indexStep ? `:${this.generateExpression(expr.indexStep, 0)}` : '';
                    output = `${objE}[${idxE}:${endE}${stepE}]`;
                } else {
                    output = `${objE}[${idxE}]`;
                }
                break;
            case 'MemberExpression':
                currentPrecedence = Precedence.Member;
                output = `${this.generateExpression(expr.object, currentPrecedence)}.${expr.property.name}`;
                break;
            case 'BinaryExpression':
                const opMap: Record<string, { op: string, prec: number }> = {
                    'or': { op: 'or', prec: Precedence.LogicalOr }, 'and': { op: 'and', prec: Precedence.LogicalAnd },
                    '==': { op: '==', prec: Precedence.Equality }, '!=': { op: '!=', prec: Precedence.Equality },
                    '<': { op: '<', prec: Precedence.Relational }, '>': { op: '>', prec: Precedence.Relational },
                    '<=': { op: '<=', prec: Precedence.Relational }, '>=': { op: '>=', prec: Precedence.Relational },
                    '+': { op: '+', prec: Precedence.Additive }, '-': { op: '-', prec: Precedence.Additive },
                    '*': { op: '*', prec: Precedence.Multiplicative }, '/': { op: '/', prec: Precedence.Multiplicative },
                    '%': { op: '%', prec: Precedence.Multiplicative }, '**': { op: '**', prec: Precedence.Multiplicative },
                    // '..': { op: '..', prec: Precedence.Relational }
                };
                const opData = opMap[expr.operator] || { op: expr.operator, prec: 0 };
                currentPrecedence = opData.prec;
                output = `${this.generateExpression(expr.left, currentPrecedence)} ${opData.op} ${this.generateExpression(expr.right, currentPrecedence)}`;
                break;
            case 'UnaryExpression':
                currentPrecedence = Precedence.Unary;
                let op = (expr.operator === '!' || expr.operator === 'not') ? 'not ' : expr.operator;
                output = `${op}${this.generateExpression(expr.argument, currentPrecedence)}`;
                break;
            case 'UpdateExpression':
                // Python doesn't have ++ and --, convert to += and -=
                const argStr = this.generateExpression((expr as any).argument, Precedence.Unary);
                if ((expr as any).operator === '++') {
                    output = `${argStr} = ${argStr} + 1`;
                } else {
                    output = `${argStr} = ${argStr} - 1`;
                }
                break;
            case 'CallExpression':
                currentPrecedence = Precedence.Call;
                let calleeStrPy = '';
                if ((expr.callee as any).type === 'MemberExpression') {
                    calleeStrPy = this.generateExpression(expr.callee as any, 0);
                } else {
                    calleeStrPy = (expr.callee as any).name;
                }

                // Handle builtins
                if ((calleeStrPy === 'len' || calleeStrPy === 'LENGTH') && expr.arguments.length === 1) {
                    output = `len(${this.generateExpression(expr.arguments[0], 0)})`;
                    break;
                }
                if (calleeStrPy === 'LENGTH' && expr.arguments.length === 1) {
                    output = `len(${this.generateExpression(expr.arguments[0], 0)})`;
                    break;
                }
                // Handle INPUT() from CSP - map to Python input()
                if (calleeStrPy === 'INPUT') {
                    const argsPy = expr.arguments.map(a => this.generateExpression(a, 0)).join(', ');
                    output = `input(${argsPy})`;
                    break;
                }
                if (calleeStrPy === 'APPEND' && expr.arguments.length === 2) {
                    output = `${this.generateExpression(expr.arguments[0], 0)}.append(${this.generateExpression(expr.arguments[1], 0)})`;
                    break;
                }
                if (calleeStrPy === 'INSERT' && expr.arguments.length === 3) {
                    output = `${this.generateExpression(expr.arguments[0], 0)}.insert(${this.generateExpression(expr.arguments[1], 0)} - 1, ${this.generateExpression(expr.arguments[2], 0)})`;
                    break;
                }
                if (calleeStrPy === 'REMOVE' && expr.arguments.length === 2) {
                    output = `${this.generateExpression(expr.arguments[0], 0)}.pop(${this.generateExpression(expr.arguments[1], 0)} - 1)`;
                    break;
                }

                const args2Py = expr.arguments.map(a => this.generateExpression(a, 0)).join(', ');
                output = `${calleeStrPy}(${args2Py})`;
                break;
            case 'ArrayLiteral':
                const elems = expr.elements.map(e => this.generateExpression(e, 0)).join(', ');
                output = `[${elems}]`;
                break;
            case 'ListComprehension':
                const elemExpr = this.generateExpression((expr as any).element, 0);
                const compVar = (expr as any).variable;
                const iterExpr = this.generateExpression((expr as any).iterable, 0);
                output = `[${elemExpr} for ${compVar} in ${iterExpr}]`;
                break;
            case 'CompoundAssignment':
                const target = (expr as any).name;
                const value = this.generateExpression((expr as any).value, 0);
                const operator = (expr as any).operator;
                output = `${target} ${operator}= ${value}`;
                break;
        }
        return (currentPrecedence < parentPrecedence) ? `(${output})` : output;
    }
}
