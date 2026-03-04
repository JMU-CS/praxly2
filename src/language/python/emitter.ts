import { ASTVisitor, Precedence } from '../visitor';
import type { Program, ClassDeclaration, FieldDeclaration, Constructor, MethodDeclaration, Block, For, Expression } from '../ast';

export class PythonEmitter extends ASTVisitor {
    private currentClassFields = new Set<string>();

    visitProgram(program: Program): void {
        const classes = program.body.filter(s => s.type === 'ClassDeclaration');
        const nonClasses = program.body.filter(s => s.type !== 'ClassDeclaration');

        classes.forEach(classDecl => {
            this.visitClassDeclaration(classDecl as ClassDeclaration);
            this.emit('');
        });

        const functions = nonClasses.filter(s => s.type === 'FunctionDeclaration');
        const mainBody = nonClasses.filter(s => s.type !== 'FunctionDeclaration');

        functions.forEach(func => {
            this.visitStatement(func);
            this.emit('');
        });
        mainBody.forEach(stmt => this.visitStatement(stmt));
    }

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

    visitFieldDeclaration(field: FieldDeclaration): void {
        let line = `${field.name}`;
        if (field.initializer) {
            line += ` = ${this.generateExpression(field.initializer, 0)}`;
        } else {
            line += ` = None`;
        }
        this.emit(line);
    }

    visitConstructor(ctor: Constructor): void {
        const params = ctor.params.map(p => p.name).join(', ');
        const paramStr = params ? `, ${params}` : '';
        this.emit(`def __init__(self${paramStr}):`);
        this.indent();
        this.context.symbolTable.enterScope();
        ctor.params.forEach(p => this.context.symbolTable.set(p.name, p.paramType || 'auto'));
        this.visitBlock(ctor.body);
        this.context.symbolTable.exitScope();
        this.dedent();
    }

    visitMethodDeclaration(method: MethodDeclaration): void {
        const params = method.params.map(p => p.name).join(', ');
        const paramStr = params ? `, ${params}` : '';
        this.emit(`def ${method.name}(self${paramStr}):`);
        this.indent();
        this.context.symbolTable.enterScope();
        method.params.forEach(p => this.context.symbolTable.set(p.name, p.paramType || 'auto'));
        this.visitBlock(method.body);
        this.context.symbolTable.exitScope();
        this.dedent();
    }

    visitBlock(block: Block): void {
        block.body.forEach(stmt => this.visitStatement(stmt));
    }

    visitPrint(stmt: any): void {
        const args = stmt.expressions.map((e: any) => this.generateExpression(e, 0));
        this.emit(`print(${args.join(', ')})`);
    }

    visitAssignment(stmt: any): void {
        let target = stmt.name;
        
        // Handle member expression assignments (e.g., self.count = value)
        if (stmt.isMemberAssignment && stmt.memberExpr) {
            target = this.generateExpression(stmt.memberExpr, 0);
        } else if (stmt.target) {
            target = this.generateExpression(stmt.target, 0);
        } else if (this.currentClassFields.has(target)) {
            target = `self.${target}`;
        }
        this.emit(`${target} = ${this.generateExpression(stmt.value, 0)}`);
    }

    visitIf(stmt: any): void {
        this.emit(`if ${this.generateExpression(stmt.condition, 0)}:`);
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

    visitWhile(stmt: any): void {
        this.emit(`while ${this.generateExpression(stmt.condition, 0)}:`);
        this.indent(); this.visitBlock(stmt.body); this.dedent();
    }

    visitDoWhile(stmt: any): void {
        // Python doesn't have do-while, implement as while True with break
        this.emit(`while True:`);
        this.indent(); 
        this.visitBlock(stmt.body);
        this.emit(`if not (${this.generateExpression(stmt.condition, 0)}): break`);
        this.dedent();
    }

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

    visitFor(stmt: For): void {
        if (stmt.init && stmt.condition && stmt.update) {
            this.context.symbolTable.enterScope();
            this.visitStatement(stmt.init);
            this.emit(`while ${this.generateExpression(stmt.condition, 0)}:`);
            this.indent();
            this.visitBlock(stmt.body);
            this.visitStatement(stmt.update);
            this.dedent();
            this.context.symbolTable.exitScope();
        } else {
            if (stmt.variables && stmt.variables.length > 1) {
                this.emit(`for ${stmt.variables.join(', ')} in ${this.generateExpression(stmt.iterable, 0)}:`);
            } else {
                this.emit(`for ${stmt.variable} in ${this.generateExpression(stmt.iterable, 0)}:`);
            }
            this.indent(); this.visitBlock(stmt.body); this.dedent();
        }

        if (stmt.elseBranch) {
            this.emit('else:');
            this.indent(); this.visitBlock(stmt.elseBranch); this.dedent();
        }
    }

    visitFunctionDeclaration(stmt: any): void {
        const params = stmt.params.map((p: any) => {
            if (p.defaultValue) return `${p.name}=${this.generateExpression(p.defaultValue, 0)}`;
            return p.name;
        }).join(', ');
        this.emit(`def ${stmt.name}(${params}):`);
        this.indent(); this.visitBlock(stmt.body); this.dedent();
    }

    visitReturn(stmt: any): void {
        this.emit(`return ${stmt.value ? this.generateExpression(stmt.value, 0) : ''}`);
    }

    visitExpressionStatement(stmt: any): void {
        this.emit(this.generateExpression(stmt.expression, 0));
    }

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
                    '%': { op: '%', prec: Precedence.Multiplicative }
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

                if (calleeStrPy === 'LENGTH' && expr.arguments.length === 1) {
                    output = `len(${this.generateExpression(expr.arguments[0], 0)})`;
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
        }
        return (currentPrecedence < parentPrecedence) ? `(${output})` : output;
    }
}
