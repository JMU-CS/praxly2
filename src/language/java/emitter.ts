import { ASTVisitor, Precedence, SymbolTable } from '../visitor';
import type { Program, Statement, ClassDeclaration, FieldDeclaration, Constructor, MethodDeclaration, Block, For, Expression } from '../ast';

export class JavaEmitter extends ASTVisitor {
    visitProgram(program: Program): void {
        const classes = program.body.filter(s => s.type === 'ClassDeclaration');
        const functions = program.body.filter(s => s.type === 'FunctionDeclaration');
        const mainBody = program.body.filter(s => s.type !== 'ClassDeclaration' && s.type !== 'FunctionDeclaration');

        classes.forEach(classDecl => {
            this.visitClassDeclaration(classDecl as ClassDeclaration);
            this.emit('');
        });

        if (functions.length > 0 || mainBody.length > 0) {
            this.context.symbolTable = new SymbolTable();
            this.emit('public class Main {');
            this.indent();

            functions.forEach(func => {
                this.visitFunctionDeclaration(func as any);
                this.emit('');
            });

            if (mainBody.length > 0) {
                this.emit('public static void main(String[] args) {');
                this.indent();
                mainBody.forEach(stmt => this.visitStatement(stmt));
                this.dedent();
                this.emit('}');
            }

            this.dedent();
            this.emit('}');
        }
    }

    visitClassDeclaration(classDecl: ClassDeclaration): void {
        const superClass = classDecl.superClass ? ` extends ${classDecl.superClass.name}` : '';
        this.emit(`public class ${classDecl.name}${superClass} {`);
        this.indent();
        this.context.symbolTable.enterScope();
        classDecl.body.forEach(member => {
            if (member.type === 'FieldDeclaration') {
                let type = (member as any).fieldType;
                if (type === 'auto' && (member as any).initializer) {
                    type = this.inferType((member as any).initializer);
                }
                this.context.symbolTable.set((member as any).name, type);
            }
        });
        classDecl.body.forEach(member => {
            this.visitStatement(member);
            this.emit('');
        });
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit('}');
    }

    visitFieldDeclaration(field: FieldDeclaration): void {
        let line = `${field.access} `;
        if (field.isStatic) line += 'static ';
        let type = field.fieldType;
        if (type === 'auto') type = field.initializer ? this.inferType(field.initializer) : 'Object';
        line += `${type} ${field.name}`;
        if (field.initializer) {
            line += ` = ${this.generateExpression(field.initializer, 0)}`;
        }
        this.emit(`${line};`);
    }

    visitConstructor(ctor: Constructor): void {
        const className = 'TempClass';
        const params = ctor.params.map(p => `${p.paramType} ${p.name}`).join(', ');
        this.emit(`public ${className}(${params}) {`);
        this.indent();
        this.context.symbolTable.enterScope();
        ctor.params.forEach(p => this.context.symbolTable.set(p.name, p.paramType));
        this.visitBlock(ctor.body);
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit('}');
    }

    visitMethodDeclaration(method: MethodDeclaration): void {
        let line = `${method.access} `;
        if (method.isStatic) line += 'static ';
        let returnType = method.returnType === 'auto' ? 'Object' : method.returnType;
        line += `${returnType} ${method.name}(`;
        line += method.params.map(p => `${p.paramType} ${p.name}`).join(', ') + ')';
        this.emit(`${line} {`);
        this.indent();
        this.context.symbolTable.enterScope();
        method.params.forEach(p => this.context.symbolTable.set(p.name, p.paramType));
        this.visitBlock(method.body);
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit('}');
    }

    visitBlock(block: Block): void {
        block.body.forEach(stmt => this.visitStatement(stmt));
    }

    visitPrint(stmt: any): void {
        const args = stmt.expressions.map((e: any) => this.generateExpression(e, 0));
        this.emit(`System.out.println(${args.join(' + " " + ')});`, stmt.id);
    }

    visitAssignment(stmt: any): void {
        // Handle tuple unpacking: y, z = 4, 5
        if (stmt.target && stmt.target.type === 'ArrayLiteral') {
            const targets = stmt.target.elements;
            const valueExpr = stmt.value;
            
            if (valueExpr.type === 'ArrayLiteral') {
                // Both sides are arrays, unpack them
                const values = valueExpr.elements;
                for (let i = 0; i < targets.length; i++) {
                    const target = targets[i];
                    const value = values[i];
                    
                    if (target.type === 'Identifier') {
                        const varName = target.name;
                        const valStr = this.generateExpression(value, 0);
                        let type = this.inferType(value);
                        if (type === 'var') type = 'Object';
                        
                        if (this.context.symbolTable.get(varName) === undefined) {
                            this.emit(`${type} ${varName} = ${valStr};`, stmt.id);
                            this.context.symbolTable.set(varName, type);
                        } else {
                            this.emit(`${varName} = ${valStr};`, stmt.id);
                        }
                    }
                }
            }
            return;
        }

        const rVal = this.generateExpression(stmt.value, 0);
        let initVal = rVal;
        if (stmt.value.type === 'ArrayLiteral') {
            initVal = initVal.replace(/^new \w+\[\] /, '');
        }

        // Handle member expression assignments (e.g., this.count = value)
        if (stmt.isMemberAssignment && stmt.memberExpr) {
            const targetStr = this.generateExpression(stmt.memberExpr, 0);
            this.emit(`${targetStr} = ${rVal};`, stmt.id);
            return;
        }

        const targetStr = stmt.target ? this.generateExpression(stmt.target, 0) : stmt.name;

        if (stmt.varType) {
            this.emit(`${stmt.varType} ${targetStr} = ${initVal};`, stmt.id);
            this.context.symbolTable.set(stmt.name, stmt.varType);
        } else if (stmt.target && stmt.target.type !== 'Identifier') {
            this.emit(`${targetStr} = ${rVal};`, stmt.id);
        } else if (this.context.symbolTable.get(stmt.name) !== undefined) {
            this.emit(`${targetStr} = ${rVal};`, stmt.id);
        } else {
            let type = this.inferType(stmt.value);
            if (type === 'var') type = 'Object';
            this.emit(`${type} ${targetStr} = ${initVal};`, stmt.id);
            this.context.symbolTable.set(stmt.name, type);
        }
    }

    visitIf(stmt: any): void {
        this.emit(`if (${this.generateExpression(stmt.condition, 0)}) {`, stmt.id);
        this.indent();
        this.context.symbolTable.enterScope();
        this.visitBlock(stmt.thenBranch);
        this.context.symbolTable.exitScope();
        this.dedent();

        let currentElse = stmt.elseBranch;

        // Unroll nested `elif` blocks into `else if` chains
        while (currentElse && currentElse.body.length === 1 && currentElse.body[0].type === 'If') {
            const elifStmt = currentElse.body[0];
            this.emit(`} else if (${this.generateExpression(elifStmt.condition, 0)}) {`);
            this.indent();
            this.context.symbolTable.enterScope();
            this.visitBlock(elifStmt.thenBranch);
            this.context.symbolTable.exitScope();
            this.dedent();
            currentElse = elifStmt.elseBranch;
        }

        if (currentElse) {
            this.emit(`} else {`);
            this.indent();
            this.context.symbolTable.enterScope();
            this.visitBlock(currentElse);
            this.context.symbolTable.exitScope();
            this.dedent();
            this.emit(`}`);
        } else {
            this.emit(`}`);
        }
    }

    visitWhile(stmt: any): void {
        this.emit(`while (${this.generateExpression(stmt.condition, 0)}) {`, stmt.id);
        this.indent();
        this.context.symbolTable.enterScope();
        this.visitBlock(stmt.body);
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit('}');
    }

    visitDoWhile(stmt: any): void {
        this.emit(`do {`);
        this.indent();
        this.context.symbolTable.enterScope();
        this.visitBlock(stmt.body);
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit(`} while (${this.generateExpression(stmt.condition, 0)});`);
    }

    visitSwitch(stmt: any): void {
        this.emit(`switch (${this.generateExpression(stmt.discriminant, 0)}) {`);
        this.indent();
        this.context.symbolTable.enterScope();
        
        stmt.cases.forEach((caseStmt: any, index: number) => {
            if (caseStmt.test) {
                this.emit(`case ${this.generateExpression(caseStmt.test, 0)}:`);
            } else {
                this.emit(`default:`);
            }
            this.indent();
            caseStmt.consequent.forEach((s: Statement) => this.visitStatement(s));
            
            // Add break unless the last statement is already a break and not the default case
            if (caseStmt.consequent.length > 0 && caseStmt.consequent[caseStmt.consequent.length - 1].type === 'Break') {
                // Already has break, no need to add
            } else if (index < stmt.cases.length - 1) {
                // Not the last case, add break to prevent fallthrough
                this.emit('break;');
            } else if (caseStmt.test) {
                // Last case but not default, add break anyway for consistency
                this.emit('break;');
            }
            
            this.dedent();
        });
        
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit('}');
    }

    visitBreak(_stmt: any): void {
        this.emit('break;');
    }

    visitContinue(_stmt: any): void {
        this.emit('continue;');
    }

    visitFor(stmt: For): void {
        if (stmt.init && stmt.condition && stmt.update) {
            this.context.symbolTable.enterScope();
            let initCode = '';
            let initCodes: string[] = [];
            
            if (stmt.init.type === 'Assignment') {
                const initStmt = stmt.init as any;
                const rVal = this.generateExpression(initStmt.value, 0);
                let type = initStmt.varType || this.inferType(initStmt.value);
                if (type === 'var') type = 'int';
                initCode = `${type} ${initStmt.name} = ${rVal}`;
                this.context.symbolTable.set(initStmt.name, type);
            } else if (Array.isArray(stmt.init)) {
                // Handle multiple initializations (array of statements)
                const stmts = stmt.init as any;
                initCodes = stmts.map((s: any) => {
                    if (s.type === 'Assignment') {
                        const rVal = this.generateExpression(s.value, 0);
                        let type = s.varType || this.inferType(s.value);
                        if (type === 'var') type = 'int';
                        this.context.symbolTable.set(s.name, type);
                        return `${type} ${s.name} = ${rVal}`;
                    }
                    return this.generateExpression((s as any).expression, 0);
                });
                initCode = initCodes.join(', ');
            } else if ((stmt.init as any)?.type === 'Block') {
                // Handle Block node (shouldn't happen with new code, but keep for compatibility)
                const blockStmt = stmt.init as any;
                initCodes = blockStmt.body.map((s: any) => {
                    if (s.type === 'Assignment') {
                        const rVal = this.generateExpression(s.value, 0);
                        let type = s.varType || this.inferType(s.value);
                        if (type === 'var') type = 'int';
                        this.context.symbolTable.set(s.name, type);
                        return `${type} ${s.name} = ${rVal}`;
                    }
                    return this.generateExpression((s as any).expression, 0);
                });
                initCode = initCodes.join(', ');
            } else {
                initCode = this.generateExpression((stmt.init as any).expression, 0);
            }

            const condCode = this.generateExpression(stmt.condition, 0);

            let updateCode = '';
            let updateCodes: string[] = [];
            if (stmt.update.type === 'Assignment') {
                const updateStmt = stmt.update as any;
                const updateTarget = updateStmt.target ? this.generateExpression(updateStmt.target, 0) : updateStmt.name;
                updateCode = `${updateTarget} = ${this.generateExpression(updateStmt.value, 0)}`;
            } else if (Array.isArray(stmt.update)) {
                // Handle multiple update statements (array of statements)
                const stmts = stmt.update as any;
                updateCodes = stmts.map((s: any) => {
                    if (s.type === 'ExpressionStatement') {
                        return this.generateExpression(s.expression, 0);
                    }
                    return this.generateExpression((s as any).expression, 0);
                });
                updateCode = updateCodes.join(', ');
            } else if ((stmt.update as any)?.type === 'Block') {
                // Handle Block node (shouldn't happen with new code, but keep for compatibility)
                const blockStmt = stmt.update as any;
                updateCodes = blockStmt.body.map((s: any) => {
                    if (s.type === 'ExpressionStatement') {
                        return this.generateExpression(s.expression, 0);
                    }
                    return this.generateExpression((s as any).expression, 0);
                });
                updateCode = updateCodes.join(', ');
            } else {
                updateCode = this.generateExpression((stmt.update as any).expression, 0);
            }

            this.emit(`for (${initCode}; ${condCode}; ${updateCode}) {`, stmt.id);
            this.indent();
            this.visitBlock(stmt.body);
            this.dedent();
            this.emit('}');
            this.context.symbolTable.exitScope();
        } else if (stmt.iterable.type === 'CallExpression' && (stmt.iterable as any).callee.name === 'range') {
            const args = (stmt.iterable as any).arguments;
            let start = '0', end = '0', step = '1';
            if (args.length === 1) { end = this.generateExpression(args[0], 0); }
            else if (args.length === 2) { start = this.generateExpression(args[0], 0); end = this.generateExpression(args[1], 0); }
            else if (args.length === 3) { start = this.generateExpression(args[0], 0); end = this.generateExpression(args[1], 0); step = this.generateExpression(args[2], 0); }

            this.emit(`for (int ${stmt.variable} = ${start}; ${stmt.variable} < ${end}; ${stmt.variable} += ${step}) {`, stmt.id);
            this.indent(); this.visitBlock(stmt.body); this.dedent(); this.emit('}');
        } else if (stmt.variables && stmt.variables.length > 1 && stmt.iterable.type === 'CallExpression' && (stmt.iterable as any).callee.name === 'enumerate') {
            const arr = this.generateExpression((stmt.iterable as any).arguments[0], 0);
            const idx = stmt.variables[0];
            const val = stmt.variables[1];
            this.emit(`for (int ${idx} = 0; ${idx} < ${arr}.length; ${idx}++) {`);
            this.indent();
            let varType = this.inferType((stmt.iterable as any).arguments[0]);
            if (varType.endsWith('[]')) varType = varType.slice(0, -2); else varType = 'var';
            this.emit(`${varType} ${val} = ${arr}[${idx}];`);
            this.visitBlock(stmt.body);
            this.dedent();
            this.emit('}');
        } else {
            let varType = 'var';
            const iterType = this.inferType(stmt.iterable);
            if (iterType.endsWith('[]')) varType = iterType.slice(0, -2);
            else if (iterType === 'int[]') varType = 'int';

            this.emit(`for (${varType} ${stmt.variable} : ${this.generateExpression(stmt.iterable, 0)}) {`);
            this.indent();
            this.context.symbolTable.enterScope();
            this.context.symbolTable.set(stmt.variable, varType);
            this.visitBlock(stmt.body);
            this.context.symbolTable.exitScope();
            this.dedent();
            this.emit('}');
        }

        if (stmt.elseBranch) {
            this.emit('// for-else fallback');
            this.visitBlock(stmt.elseBranch);
        }
    }

    visitFunctionDeclaration(stmt: any): void {
        this.context.symbolTable.enterScope();
        const paramTypes = this.context.functionParamTypes.get(stmt.name) || [];

        stmt.params.forEach((p: any, i: number) => {
            let type = p.paramType && p.paramType !== 'var' && p.paramType !== 'auto' ? p.paramType : paramTypes[i];
            if (!type || type === 'var' || type === 'auto') type = 'Object';
            this.context.symbolTable.set(p.name, type);
        });

        const params = stmt.params.map((p: any, i: number) => {
            let type = p.paramType && p.paramType !== 'var' && p.paramType !== 'auto' ? p.paramType : paramTypes[i];
            if (!type || type === 'var' || type === 'auto') type = 'Object';
            return `${type} ${p.name}`;
        }).join(', ');

        let returnType = stmt.returnType && stmt.returnType !== 'auto' ? stmt.returnType : (this.context.functionReturnTypes.get(stmt.name) || 'void');
        this.emit(`public static ${returnType} ${stmt.name}(${params}) {`);
        this.indent();
        this.visitBlock(stmt.body);
        this.dedent();
        this.emit('}');
        this.context.symbolTable.exitScope();
    }

    visitReturn(stmt: any): void {
        this.emit(`return ${stmt.value ? this.generateExpression(stmt.value, 0) : ''};`, stmt.id);
    }

    visitExpressionStatement(stmt: any): void {
        this.emit(`${this.generateExpression(stmt.expression, 0)};`, stmt.id);
    }

    visitTry(stmt: any): void {
        this.emit('try {');
        this.indent(); this.visitBlock(stmt.body); this.dedent();
        this.emit('}');
        
        stmt.handlers.forEach((handler: any) => {
            if (handler.exceptionType) {
                if (handler.varName) {
                    this.emit(`catch (${handler.exceptionType} ${handler.varName}) {`);
                } else {
                    this.emit(`catch (Exception e) {`);
                }
            } else {
                this.emit(`catch (Exception e) {`);
            }
            this.indent(); this.visitBlock(handler.body); this.dedent();
            this.emit('}');
        });
        
        if (stmt.finallyBlock) {
            this.emit('finally {');
            this.indent(); this.visitBlock(stmt.finallyBlock); this.dedent();
            this.emit('}');
        }
    }

    generateExpression(expr: Expression, parentPrecedence: number): string {
        let output = '';
        let currentPrecedence = 99;

        switch (expr.type) {
            case 'Literal':
                if (expr.value === null || expr.raw === '"None"') output = 'null';
                else if (typeof expr.value === 'string') {
                    const strVal = expr.value.startsWith('f') || expr.value.startsWith('r') || expr.value.startsWith('b')
                        ? expr.value.substring(1) : expr.value;
                    output = `"${strVal}"`;
                } else if (typeof expr.value === 'boolean') output = expr.value.toString();
                else output = String(expr.value);
                break;
            case 'Identifier': output = expr.name; break;
            case 'ThisExpression': output = 'this'; break;
            case 'NewExpression':
                currentPrecedence = Precedence.Instantiation;
                const args = expr.arguments.map(a => this.generateExpression(a, 0)).join(', ');
                output = `new ${expr.className}(${args})`;
                break;
            case 'IndexExpression':
                currentPrecedence = Precedence.Member;
                const objE = this.generateExpression(expr.object, currentPrecedence);
                const idxE = this.generateExpression(expr.index, 0);
                if (expr.indexEnd) {
                    const endE = this.generateExpression(expr.indexEnd, 0);
                    output = `Arrays.copyOfRange(${objE}, ${idxE}, ${endE})`;
                } else {
                    output = `${objE}[${idxE}]`;
                }
                break;
            case 'MemberExpression':
                currentPrecedence = Precedence.Member;
                output = `${this.generateExpression(expr.object, currentPrecedence)}.${expr.property.name}`;
                break;
            case 'BinaryExpression':
                // Handle power operator specially
                if (expr.operator === '**') {
                    currentPrecedence = Precedence.Exponential;
                    const base = this.generateExpression(expr.left, currentPrecedence);
                    const exponent = this.generateExpression(expr.right, currentPrecedence);
                    output = `Math.pow(${base}, ${exponent})`;
                    break;
                }
                
                const opMap: Record<string, { op: string, prec: number }> = {
                    'or': { op: '||', prec: Precedence.LogicalOr }, 'and': { op: '&&', prec: Precedence.LogicalAnd },
                    '==': { op: '==', prec: Precedence.Equality }, '!=': { op: '!=', prec: Precedence.Equality },
                    '<': { op: '<', prec: Precedence.Relational }, '>': { op: '>', prec: Precedence.Relational },
                    '<=': { op: '<=', prec: Precedence.Relational }, '>=': { op: '>=', prec: Precedence.Relational },
                    '+': { op: '+', prec: Precedence.Additive }, '-': { op: '-', prec: Precedence.Additive },
                    '*': { op: '*', prec: Precedence.Multiplicative }, '/': { op: '/', prec: Precedence.Multiplicative },
                    '%': { op: '%', prec: Precedence.Multiplicative },
                    '&': { op: '&', prec: Precedence.BitwiseAnd }, '|': { op: '|', prec: Precedence.BitwiseOr },
                    '^': { op: '^', prec: Precedence.Xor }, '<<': { op: '<<', prec: Precedence.Shift },
                    '>>': { op: '>>', prec: Precedence.Shift }, '>>>': { op: '>>>', prec: Precedence.Shift },
                    '..': { op: '..', prec: Precedence.Relational }
                };
                
                // Special handling for String equality
                if ((expr.operator === '==' || expr.operator === '!=')) {
                    const leftType = this.inferType(expr.left);
                    const rightType = this.inferType(expr.right);
                    
                    if (leftType === 'String' || rightType === 'String') {
                        const leftStr = this.generateExpression(expr.left, Precedence.Call);
                        const rightStr = this.generateExpression(expr.right, Precedence.Call);
                        
                        if (expr.operator === '==') {
                            output = `${leftStr}.equals(${rightStr})`;
                        } else {
                            output = `!${leftStr}.equals(${rightStr})`;
                        }
                        currentPrecedence = Precedence.Equality;
                        break;
                    }
                }
                
                const opData = opMap[expr.operator] || { op: expr.operator, prec: 0 };
                currentPrecedence = opData.prec;
                output = `${this.generateExpression(expr.left, currentPrecedence)} ${opData.op} ${this.generateExpression(expr.right, currentPrecedence)}`;
                break;
            case 'UnaryExpression':
                currentPrecedence = Precedence.Unary;
                let op = expr.operator === 'not' ? '!' : expr.operator;
                output = `${op}${this.generateExpression(expr.argument, currentPrecedence)}`;
                break;
            case 'UpdateExpression':
                currentPrecedence = Precedence.Unary;
                const argStr = this.generateExpression((expr as any).argument, currentPrecedence);
                if ((expr as any).prefix) {
                    output = `${(expr as any).operator}${argStr}`;
                } else {
                    output = `${argStr}${(expr as any).operator}`;
                }
                break;
            case 'CallExpression':
                currentPrecedence = Precedence.Call;
                let calleeStr = '';
                const argsF = expr.arguments.map(a => this.generateExpression(a, 0));

                if ((expr.callee as any).type === 'MemberExpression') {
                    const memberExpr = expr.callee as any;
                    const obj = this.generateExpression(memberExpr.object, 0);
                    const method = memberExpr.property.name;

                    if (method === 'append') output = `${obj}.add(${argsF[0]})`;
                    else if (method === 'insert') output = `${obj}.add(${argsF[0]}, ${argsF[1]})`;
                    else if (method === 'remove') output = `${obj}.remove((Object)${argsF[0]})`;
                    else if (method === 'pop') output = argsF.length > 0 ? `${obj}.remove(${argsF[0]})` : `${obj}.remove(${obj}.size() - 1)`;
                    else if (method === 'extend') output = `${obj}.addAll(${argsF[0]})`;
                    else if (method === 'sort') output = `Collections.sort(${obj})`;
                    else if (method === 'lower') output = `${obj}.toLowerCase()`;
                    else if (method === 'upper') output = `${obj}.toUpperCase()`;
                    else if (method === 'replace') output = `${obj}.replace(${argsF[0]}, ${argsF[1]})`;
                    else output = `${obj}.${method}(${argsF.join(', ')})`;
                    break;
                } else {
                    calleeStr = (expr.callee as any).name;
                }

                // Global Intercepts
                if (calleeStr === 'LENGTH' || calleeStr === 'len') {
                    output = `${this.generateExpression(expr.arguments[0], 0)}.length`; // simplified
                    break;
                }
                if (calleeStr === 'APPEND' && argsF.length === 2) { output = `${argsF[0]}.add(${argsF[1]})`; break; }
                if (calleeStr === 'INSERT' && argsF.length === 3) { output = `${argsF[0]}.add(${argsF[1]} - 1, ${argsF[2]})`; break; }
                if (calleeStr === 'REMOVE' && argsF.length === 2) { output = `${argsF[0]}.remove(${argsF[1]} - 1)`; break; }

                output = `${calleeStr}(${argsF.join(', ')})`;
                break;
            case 'ArrayLiteral':
                const type = this.inferType(expr);
                const baseType = type.endsWith('[]') ? type.slice(0, -2) : 'Object';
                const elems = expr.elements.map(e => this.generateExpression(e, 0)).join(', ');
                output = `new ${baseType}[] {${elems}}`;
                break;
            case 'ConditionalExpression':
                currentPrecedence = Precedence.Conditional;
                const test = this.generateExpression((expr as any).test, currentPrecedence);
                const consequent = this.generateExpression((expr as any).consequent, currentPrecedence);
                const alternate = this.generateExpression((expr as any).alternate, currentPrecedence);
                output = `${test} ? ${consequent} : ${alternate}`;
                break;
            case 'CompoundAssignment':
                const target = (expr as any).name;
                const value = this.generateExpression((expr as any).value, 0);
                output = `${target} ${(expr as any).operator}= ${value}`;
                break;
        }
        return (currentPrecedence < parentPrecedence) ? `(${output})` : output;
    }
}
