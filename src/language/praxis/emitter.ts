import { ASTVisitor, Precedence } from '../visitor';
import type { Program, ClassDeclaration, FieldDeclaration, Constructor, MethodDeclaration, Block, Expression } from '../ast';

export class PraxisEmitter extends ASTVisitor {
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

    visitProgram(program: Program): void {
        const classes = program.body.filter(s => s.type === 'ClassDeclaration');
        const functions = program.body.filter(s => s.type === 'FunctionDeclaration');
        const mainBody = program.body.filter(s => s.type !== 'ClassDeclaration' && s.type !== 'FunctionDeclaration');

        // Split Main class from other classes
        const mainClass = classes.find(c => this.isJavaMainClass(c as ClassDeclaration));
        const otherClasses = classes.filter(c => !this.isJavaMainClass(c as ClassDeclaration));

        // Emit non-Main classes
        otherClasses.forEach(classDecl => { this.visitClassDeclaration(classDecl as ClassDeclaration); this.emit(''); });
        
        // Emit functions
        functions.forEach(func => { this.visitFunctionDeclaration(func as any); this.emit(''); });
        
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

    visitClassDeclaration(classDecl: ClassDeclaration): void {
        const superClass = classDecl.superClass ? ` extends ${classDecl.superClass.name}` : '';
        this.emit(`class ${classDecl.name}${superClass}`);
        this.indent();
        this.context.symbolTable.enterScope();

        classDecl.body.forEach(member => {
            if (member.type === 'FieldDeclaration') {
                let type = (member as any).fieldType;
                if (type === 'auto' && (member as any).initializer) { type = this.inferType((member as any).initializer); }
                this.context.symbolTable.set((member as any).name, type);
            }
        });

        classDecl.body.forEach(member => { this.visitStatement(member); this.emit(''); });
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit(`end class ${classDecl.name}`);
    }

    visitFieldDeclaration(field: FieldDeclaration): void {
        let type = field.fieldType === 'auto' && field.initializer ? this.inferType(field.initializer) : field.fieldType;
        if (type === 'auto') type = 'var';

        let line = `${type} ${field.name}`;
        if (field.initializer) { line += ` <- ${this.generateExpression(field.initializer, 0)}`; }
        this.emit(line);
    }

    visitConstructor(ctor: Constructor): void {
        const params = ctor.params.map(p => `${p.paramType} ${p.name}`).join(', ');
        this.emit(`procedure new(${params})`);
        this.indent();
        this.context.symbolTable.enterScope();
        ctor.params.forEach(p => this.context.symbolTable.set(p.name, p.paramType || 'auto'));
        this.visitBlock(ctor.body);
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit(`end new`);
    }

    visitMethodDeclaration(method: MethodDeclaration): void {
        let returnType = method.returnType === 'auto' ? 'procedure' : method.returnType;
        if (returnType === 'void') returnType = 'procedure';

        const params = method.params.map(p => { const type = p.paramType === 'auto' ? '' : `${p.paramType} `; return `${type}${p.name}`.trim(); }).join(', ');

        this.emit(`${returnType} ${method.name}(${params})`);
        this.indent();
        this.context.symbolTable.enterScope();
        method.params.forEach(p => this.context.symbolTable.set(p.name, p.paramType || 'auto'));
        this.visitBlock(method.body);
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit(`end ${method.name}`);
    }

    visitBlock(block: Block): void { block.body.forEach(stmt => this.visitStatement(stmt)); }

    visitPrint(stmt: any): void {
        const args = stmt.expressions.map((e: any) => this.generateExpression(e, 0));
        this.emit(`print(${args.join(', ')})`, stmt.id);
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
                        if (type === 'var') type = 'int';
                        
                        if (this.context.symbolTable.get(varName) === undefined) {
                            this.emit(`${type} ${varName} <- ${valStr}`, stmt.id);
                            this.context.symbolTable.set(varName, type);
                        } else {
                            this.emit(`${varName} <- ${valStr}`, stmt.id);
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
            if (initVal.startsWith('[') && initVal.endsWith(']')) { initVal = '{' + initVal.slice(1, -1) + '}'; }
        }
        
        // Handle member expression assignments
        if (stmt.isMemberAssignment && stmt.memberExpr) {
            const targetStr = this.generateExpression(stmt.memberExpr, 0);
            this.emit(`${targetStr} <- ${rVal}`, stmt.id);
            return;
        }
        
        const targetStr = stmt.target ? this.generateExpression(stmt.target, 0) : stmt.name;
        if (stmt.varType) {
            this.emit(`${stmt.varType} ${targetStr} <- ${initVal}`, stmt.id);
            this.context.symbolTable.set(stmt.name, stmt.varType);
        } else if (stmt.target && stmt.target.type !== 'Identifier') {
            this.emit(`${targetStr} <- ${rVal}`, stmt.id);
        } else if (this.context.symbolTable.get(stmt.name) !== undefined) {
            this.emit(`${targetStr} <- ${rVal}`, stmt.id);
        } else {
            let type = this.inferType(stmt.value);
            if (type === 'var') type = 'int';
            this.emit(`${type} ${targetStr} <- ${initVal}`, stmt.id);
            this.context.symbolTable.set(stmt.name, type);
        }
    }

    visitIf(stmt: any): void {
        this.emit(`if (${this.generateExpression(stmt.condition, 0)})`, stmt.id);
        this.indent();
        this.context.symbolTable.enterScope();
        this.visitBlock(stmt.thenBranch);
        this.context.symbolTable.exitScope();
        this.dedent();

        let currentElse = stmt.elseBranch;

        while (currentElse && currentElse.body.length === 1 && currentElse.body[0].type === 'If') {
            const elifStmt = currentElse.body[0];
            this.emit(`else if (${this.generateExpression(elifStmt.condition, 0)})`);
            this.indent();
            this.context.symbolTable.enterScope();
            this.visitBlock(elifStmt.thenBranch);
            this.context.symbolTable.exitScope();
            this.dedent();
            currentElse = elifStmt.elseBranch;
        }

        if (currentElse) {
            this.emit('else');
            this.indent();
            this.context.symbolTable.enterScope();
            this.visitBlock(currentElse);
            this.context.symbolTable.exitScope();
            this.dedent();
        }
        this.emit('end if');
    }

    visitWhile(stmt: any): void {
        this.emit(`while (${this.generateExpression(stmt.condition, 0)})`, stmt.id);
        this.indent(); this.context.symbolTable.enterScope(); this.visitBlock(stmt.body); this.context.symbolTable.exitScope(); this.dedent();
        this.emit('end while');
    }

    visitDoWhile(stmt: any): void {
        this.emit(`do`);
        this.indent(); this.context.symbolTable.enterScope(); this.visitBlock(stmt.body); this.context.symbolTable.exitScope(); this.dedent();
        this.emit(`while (${this.generateExpression(stmt.condition, 0)})`);
    }

    visitSwitch(stmt: any): void {
        this.emit(`switch (${this.generateExpression(stmt.discriminant, 0)})`);
        this.indent();
        stmt.cases.forEach((caseStmt: any) => {
            if (caseStmt.test) {
                this.emit(`case ${this.generateExpression(caseStmt.test, 0)}:`);
            } else {
                this.emit(`default:`);
            }
            this.indent();
            caseStmt.consequent.forEach((s: any) => this.visitStatement(s));
            this.dedent();
        });
        this.dedent();
        this.emit('end switch');
    }

    visitBreak(_stmt: any): void {
        this.emit('break');
    }

    visitContinue(_stmt: any): void {
        this.emit('continue');
    }

    visitFor(stmt: any): void {
        if (stmt.init && stmt.condition && stmt.update) {
            this.context.symbolTable.enterScope();
            let initCode = '';
            if (stmt.init.type === 'Assignment') {
                const rVal = this.generateExpression(stmt.init.value, 0);
                let type = stmt.init.varType || this.inferType(stmt.init.value);
                if (type === 'var') type = 'int';
                initCode = `${type} ${stmt.init.name} <- ${rVal}`;
                this.context.symbolTable.set(stmt.init.name, type);
            } else { initCode = this.generateExpression(stmt.init.expression, 0); }
            const condCode = this.generateExpression(stmt.condition, 0);
            let updateCode = '';
            if (stmt.update.type === 'Assignment') {
                const updateTarget = stmt.update.target ? this.generateExpression(stmt.update.target, 0) : stmt.update.name;
                updateCode = `${updateTarget} <- ${this.generateExpression(stmt.update.value, 0)}`;
            } else { updateCode = this.generateExpression(stmt.update.expression, 0); }

            this.emit(`for (${initCode}; ${condCode}; ${updateCode})`, stmt.id);
            this.indent(); this.visitBlock(stmt.body); this.dedent();
            this.emit('end for');
            this.context.symbolTable.exitScope();
        } else {
            this.emit(`for ${stmt.variable} in ${this.generateExpression(stmt.iterable, 0)}`, stmt.id);
            this.indent();
            this.context.symbolTable.enterScope();
            this.context.symbolTable.set(stmt.variable, 'var');
            this.visitBlock(stmt.body);
            this.context.symbolTable.exitScope();
            this.dedent();
            this.emit('end for');
        }
    }

    visitFunctionDeclaration(stmt: any): void {
        this.context.symbolTable.enterScope();

        const params = stmt.params.map((p: any) => { const type = p.paramType && p.paramType !== 'auto' ? `${p.paramType} ` : ''; return `${type}${p.name}`; }).join(', ');

        this.emit(`procedure ${stmt.name}(${params})`);
        this.indent(); this.visitBlock(stmt.body); this.dedent();
        this.emit(`end ${stmt.name}`);
        this.context.symbolTable.exitScope();
    }

    visitReturn(stmt: any): void { this.emit(`return ${stmt.value ? this.generateExpression(stmt.value, 0) : ''}`, stmt.id); }

    visitExpressionStatement(stmt: any): void { this.emit(this.generateExpression(stmt.expression, 0), stmt.id); }

    visitTry(stmt: any): void {
        this.emit('try');
        this.indent(); this.visitBlock(stmt.body); this.dedent();
        
        stmt.handlers.forEach((handler: any) => {
            if (handler.exceptionType) {
                this.emit(`catch ${handler.exceptionType}${handler.varName ? ` as ${handler.varName}` : ''}`);
            } else {
                this.emit(`catch`);
            }
            this.indent(); this.visitBlock(handler.body); this.dedent();
        });
        
        if (stmt.finallyBlock) {
            this.emit('finally');
            this.indent(); this.visitBlock(stmt.finallyBlock); this.dedent();
        }
        this.emit('end try');
    }

    generateExpression(expr: Expression, parentPrecedence: number): string {
        let output = '';
        let currentPrecedence = 99;

        switch (expr.type) {
            case 'Literal':
                if (expr.value === null) output = 'null';
                else if (typeof expr.value === 'string') {
                    const strVal = expr.value.startsWith('f') || expr.value.startsWith('r') || expr.value.startsWith('b')
                        ? expr.value.substring(1) : expr.value;
                    output = `"${strVal}"`;
                } else if (typeof expr.value === 'boolean') output = expr.value ? 'true' : 'false';
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
                // Praxis emitter needs to convert 0-based indices back to 1-based
                // If the index is a BinaryExpression with operator '-' and right === 1,
                // it was converted from 1-based to 0-based during parsing, so unwrap it
                let indexExpr = expr.index;
                if (indexExpr.type === 'BinaryExpression' && 
                    indexExpr.operator === '-' && 
                    indexExpr.right.type === 'Literal' && 
                    indexExpr.right.value === 1) {
                    // This is a 0-based index converted from 1-based, use the original
                    indexExpr = indexExpr.left;
                }
                output = `${this.generateExpression(expr.object, currentPrecedence)}[${this.generateExpression(indexExpr, 0)}]`;
                break;
            case 'MemberExpression':
                currentPrecedence = Precedence.Member;
                output = `${this.generateExpression(expr.object, currentPrecedence)}.${expr.property.name}`;
                break;
            case 'BinaryExpression':
                const opMap: Record<string, { op: string, prec: number }> = {
                    'or': { op: 'or', prec: Precedence.LogicalOr }, 'and': { op: 'and', prec: Precedence.LogicalAnd },
                    '==': { op: '=', prec: Precedence.Equality }, '!=': { op: '!=', prec: Precedence.Equality },
                    '<': { op: '<', prec: Precedence.Relational }, '>': { op: '>', prec: Precedence.Relational },
                    '<=': { op: '<=', prec: Precedence.Relational }, '>=': { op: '>=', prec: Precedence.Relational },
                    '+': { op: '+', prec: Precedence.Additive }, '-': { op: '-', prec: Precedence.Additive },
                    '*': { op: '*', prec: Precedence.Multiplicative }, '/': { op: '/', prec: Precedence.Multiplicative },
                    '%': { op: 'mod', prec: Precedence.Multiplicative },
                    '..': { op: '..', prec: Precedence.Relational }
                };
                const opData = opMap[expr.operator] || { op: expr.operator, prec: 0 };
                currentPrecedence = opData.prec;
                output = `${this.generateExpression(expr.left, currentPrecedence)} ${opData.op} ${this.generateExpression(expr.right, currentPrecedence)}`;
                break;
            case 'UnaryExpression':
                currentPrecedence = Precedence.Unary;
                let op = expr.operator === '!' || expr.operator === 'not' ? 'not ' : expr.operator;
                output = `${op}${this.generateExpression(expr.argument, currentPrecedence)}`;
                break;
            case 'UpdateExpression':
                // Praxis doesn't have ++, convert to += 1
                const argStr = this.generateExpression((expr as any).argument, Precedence.Unary);
                if ((expr as any).operator === '++') {
                    output = `${argStr}++`;
                } else {
                    output = `${argStr}--`;
                }
                break;
            case 'CallExpression':
                currentPrecedence = Precedence.Call;
                const args2 = expr.arguments.map(a => this.generateExpression(a, 0)).join(', ');
                const calleeStr = (expr.callee as any).type === 'MemberExpression'
                    ? this.generateExpression(expr.callee as any, 0)
                    : (expr.callee as any).name;
                output = `${calleeStr}(${args2})`;
                break;
            case 'ArrayLiteral':
                const elems = expr.elements.map(e => this.generateExpression(e, 0)).join(', ');
                output = `{${elems}}`;
                break;
        }
        return (currentPrecedence < parentPrecedence) ? `(${output})` : output;
    }
}
