import { ASTVisitor, Precedence } from '../visitor';
import type { Program, ClassDeclaration, FieldDeclaration, Constructor, MethodDeclaration, Block, Expression } from '../ast';

export class CSPEmitter extends ASTVisitor {
    protected override breakStr = 'BREAK';
    protected override continueStr = 'CONTINUE';

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
        const nonClasses = program.body.filter(s => s.type !== 'ClassDeclaration');

        // Split Main class from other classes
        const mainClass = classes.find(c => this.isJavaMainClass(c as ClassDeclaration));
        const otherClasses = classes.filter(c => !this.isJavaMainClass(c as ClassDeclaration));

        // Emit non-Main classes
        otherClasses.forEach(classDecl => {
            this.visitClassDeclaration(classDecl as ClassDeclaration);
            this.emit('');
        });
        
        // Emit non-class statements
        nonClasses.forEach(stmt => this.visitStatement(stmt));
        
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
        this.emit(`CLASS ${classDecl.name}`);
        this.emit('{');
        this.indent();
        classDecl.body.forEach(member => {
            this.visitStatement(member);
            this.emit('');
        });
        this.dedent();
        this.emit('}');
    }

    visitFieldDeclaration(field: FieldDeclaration): void {
        let line = `${field.access === 'private' ? 'PRIVATE' : 'PUBLIC'} ${field.name}`;
        if (field.initializer) {
            line += ` <- ${this.generateExpression(field.initializer, 0)}`;
        }
        this.emit(line);
    }

    visitConstructor(ctor: Constructor): void {
        const params = ctor.params.map(p => p.name).join(', ');
        this.emit(`CONSTRUCTOR (${params})`);
        this.emit('{');
        this.indent();
        this.visitBlock(ctor.body);
        this.dedent();
        this.emit('}');
    }

    visitMethodDeclaration(method: MethodDeclaration): void {
        const access = method.access === 'private' ? 'PRIVATE' : 'PUBLIC';
        const params = method.params.map(p => p.name).join(', ');
        this.emit(`${access} PROCEDURE ${method.name} (${params})`);
        this.emit('{');
        this.indent();
        this.visitBlock(method.body);
        this.dedent();
        this.emit('}');
    }

    visitBlock(block: Block): void {
        block.body.forEach(stmt => this.visitStatement(stmt));
    }

    visitPrint(stmt: any): void {
        const args = stmt.expressions.map((e: any) => this.generateExpression(e, 0));
        this.emit(`DISPLAY(${args.join(' + " " + ')})`, stmt.id);
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
                        this.emit(`${varName} <- ${valStr}`, stmt.id);
                    }
                }
            }
            return;
        }

        let targetStr = stmt.name;
        
        // Handle member expression assignments
        if (stmt.isMemberAssignment && stmt.memberExpr) {
            targetStr = this.generateExpression(stmt.memberExpr, 0);
        } else if (stmt.target) {
            targetStr = this.generateExpression(stmt.target, 0);
        }
        
        this.emit(`${targetStr} <- ${this.generateExpression(stmt.value, 0)}`, stmt.id);
    }

    visitIf(stmt: any): void {
        this.emit(`IF (${this.generateExpression(stmt.condition, 0)})`, stmt.id);
        this.emit('{'); this.indent(); this.visitBlock(stmt.thenBranch); this.dedent(); this.emit('}');

        let currentElse = stmt.elseBranch;

        while (currentElse && currentElse.body.length === 1 && currentElse.body[0].type === 'If') {
            const elifStmt = currentElse.body[0];
            this.emit(`ELSE IF (${this.generateExpression(elifStmt.condition, 0)})`);
            this.emit('{'); this.indent(); this.visitBlock(elifStmt.thenBranch); this.dedent(); this.emit('}');
            currentElse = elifStmt.elseBranch;
        }

        if (currentElse) {
            this.emit('ELSE');
            this.emit('{'); this.indent(); this.visitBlock(currentElse); this.dedent(); this.emit('}');
        }
    }

    visitWhile(stmt: any): void {
        this.emit(`REPEAT UNTIL (NOT (${this.generateExpression(stmt.condition, 0)}))`, stmt.id);
        this.emit('{'); this.indent(); this.visitBlock(stmt.body); this.dedent(); this.emit('}');
    }

    visitDoWhile(stmt: any): void {
        this.emit('{'); this.indent();
        this.visitBlock(stmt.body);
        this.emit(`REPEAT UNTIL (NOT (${this.generateExpression(stmt.condition, 0)}))`);
        this.emit('{]}');
        this.dedent(); this.emit('}');
    }

    visitSwitch(stmt: any): void {
        // CSP doesn't have switch, implement as nested IF statements
        let first = true;
        stmt.cases.forEach((caseStmt: any, _index: number) => {
            if (caseStmt.test) {
                const keyword = first ? 'IF' : 'ELSE IF';
                this.emit(`${keyword} <expr> = ${this.generateExpression(caseStmt.test, 0)}`);
                first = false;
            } else {
                this.emit(`ELSE`);
            }
            this.emit('{'); this.indent();
            caseStmt.consequent.forEach((s: any) => this.visitStatement(s));
            this.dedent(); this.emit('}');
        });
    }

    visitBreak(_stmt: any): void {
        this.emit('// BREAK');
    }

    visitContinue(_stmt: any): void {
        this.emit('// CONTINUE');
    }

    visitFor(stmt: any): void {
        if (stmt.init && stmt.condition && stmt.update) {
            this.context.symbolTable.enterScope();
            this.visitStatement(stmt.init);
            this.emit(`REPEAT UNTIL (NOT (${this.generateExpression(stmt.condition, 0)}))`, stmt.id);
            this.emit('{');
            this.indent();
            this.visitBlock(stmt.body);
            this.visitStatement(stmt.update);
            this.dedent();
            this.emit('}');
            this.context.symbolTable.exitScope();
        } else if (stmt.iterable.type === 'CallExpression' && (stmt.iterable as any).callee.name === 'range') {
            // Handle range() calls with proper iteration
            const args = (stmt.iterable as any).arguments;
            let start = '0', end = '0', step = '1';
            if (args.length === 1) { end = this.generateExpression(args[0], 0); }
            else if (args.length === 2) { start = this.generateExpression(args[0], 0); end = this.generateExpression(args[1], 0); }
            else if (args.length === 3) { start = this.generateExpression(args[0], 0); end = this.generateExpression(args[1], 0); step = this.generateExpression(args[2], 0); }
            
            // Generate for loop: FOR ${var} FROM ${start} TO ${end} STEP ${step}
            this.emit(`FOR  ${stmt.variable} FROM ${start} TO ${end} STEP ${step}`, stmt.id);
            this.emit('{'); this.indent(); this.visitBlock(stmt.body); this.dedent(); this.emit('}');
        } else if (stmt.variables && stmt.variables.length > 1 && stmt.iterable.type === 'CallExpression' && (stmt.iterable as any).callee.name === 'enumerate') {
            // Handle enumerate: for i, v in enumerate(arr)
            const arr = this.generateExpression((stmt.iterable as any).arguments[0], 0);
            const idx = stmt.variables[0];
            const val = stmt.variables[1];
            
            this.emit(`FOR  ${idx} FROM 0 TO ${arr}.length STEP 1`, stmt.id);
            this.emit('{');
            this.indent();
            this.emit(`${val} <- ${arr}[${idx}]`);
            this.visitBlock(stmt.body);
            this.dedent();
            this.emit('}');
        } else {
            this.emit(`FOR EACH ${stmt.variable} IN ${this.generateExpression(stmt.iterable, 0)}`, stmt.id);
            this.emit('{'); this.indent(); this.visitBlock(stmt.body); this.dedent(); this.emit('}');
        }
    }

    visitFunctionDeclaration(stmt: any): void {
        const params = stmt.params.map((p: any) => p.name).join(', ');
        this.emit(`PROCEDURE ${stmt.name} (${params})`);
        this.emit('{'); this.indent(); this.visitBlock(stmt.body); this.dedent(); this.emit('}');
    }

    visitReturn(stmt: any): void {
        this.emit(`RETURN ${stmt.value ? this.generateExpression(stmt.value, 0) : ''}`, stmt.id);
    }

    visitExpressionStatement(stmt: any): void {
        this.emit(this.generateExpression(stmt.expression, 0), stmt.id);
    }

    visitTry(stmt: any): void {
        this.emit('TRY');
        this.emit('{'); this.indent(); this.visitBlock(stmt.body); this.dedent(); this.emit('}');
        
        stmt.handlers.forEach((handler: any) => {
            if (handler.exceptionType) {
                this.emit(`EXCEPT ${handler.exceptionType}${handler.varName ? ` AS ${handler.varName}` : ''}`);
            } else {
                this.emit(`EXCEPT`);
            }
            this.emit('{'); this.indent(); this.visitBlock(handler.body); this.dedent(); this.emit('}');
        });
        
        if (stmt.finallyBlock) {
            this.emit('FINALLY');
            this.emit('{'); this.indent(); this.visitBlock(stmt.finallyBlock); this.dedent(); this.emit('}');
        }
    }

    generateExpression(expr: Expression, parentPrecedence: number): string {
        let output = '';
        let currentPrecedence = 99;

        switch (expr.type) {
            case 'Literal':
                if (expr.value === null) output = 'None';
                else if (typeof expr.value === 'string') {
                    const strVal = expr.value.startsWith('f') || expr.value.startsWith('r') || expr.value.startsWith('b')
                        ? expr.value.substring(1) : expr.value;
                    output = `"${strVal}"`;
                } else if (typeof expr.value === 'boolean') output = expr.value ? 'true' : 'false';
                else output = String(expr.value);
                break;
            case 'Identifier': output = expr.name; break;
            case 'ThisExpression': output = 'THIS'; break;
            case 'NewExpression':
                currentPrecedence = Precedence.Instantiation;
                const args = expr.arguments.map(a => this.generateExpression(a, 0)).join(', ');
                output = `NEW ${expr.className}(${args})`;
                break;
            case 'IndexExpression':
                currentPrecedence = Precedence.Member;
                const objStr = this.generateExpression(expr.object, currentPrecedence);
                
                // Helper function to convert index expression to CSP, handling negative indices
                const convertIndexCSP = (idx: any): string => {
                    if (!idx) return '0';
                    if (idx.type === 'Literal' && typeof idx.value === 'number' && idx.value < 0) {
                        // Negative index: arr[-1] becomes arr[arr.LENGTH() - 1]
                        const absIdx = Math.abs(idx.value);
                        return `${objStr}.LENGTH() - ${absIdx}`;
                    } else if (idx.type === 'UnaryExpression' && idx.operator === '-' && idx.argument.type === 'Literal') {
                        // Handle unary minus
                        const val = idx.argument.value as number;
                        return `${objStr}.LENGTH() - ${val}`;
                    } else {
                        return this.generateExpression(idx, 0);
                    }
                };
                
                if (expr.indexEnd) {
                    // Array slicing: arr[start:end]
                    const startE = convertIndexCSP(expr.index);
                    const endE = convertIndexCSP(expr.indexEnd);
                    // CSP doesn't have native slicing, generate a range expression
                    output = `${objStr}.SLICE(${startE}, ${endE})`;
                } else {
                    // Single index access
                    const indexStr = convertIndexCSP(expr.index);
                    output = `${objStr}[${indexStr}]`;
                }
                break;
            case 'MemberExpression':
                currentPrecedence = Precedence.Member;
                output = `${this.generateExpression(expr.object, currentPrecedence)}.${expr.property.name}`;
                break;
            case 'BinaryExpression':
                const opMap: Record<string, { op: string, prec: number }> = {
                    'or': { op: 'OR', prec: Precedence.LogicalOr }, 'and': { op: 'AND', prec: Precedence.LogicalAnd },
                    '==': { op: '=', prec: Precedence.Equality }, '!=': { op: '<>', prec: Precedence.Equality },
                    '<': { op: '<', prec: Precedence.Relational }, '>': { op: '>', prec: Precedence.Relational },
                    '<=': { op: '<=', prec: Precedence.Relational }, '>=': { op: '>=', prec: Precedence.Relational },
                    '+': { op: '+', prec: Precedence.Additive }, '-': { op: '-', prec: Precedence.Additive },
                    '*': { op: '*', prec: Precedence.Multiplicative }, '/': { op: '/', prec: Precedence.Multiplicative },
                    '%': { op: 'MOD', prec: Precedence.Multiplicative },
                    '**': { op: 'POW', prec: Precedence.Multiplicative },
                    '..': { op: '..', prec: Precedence.Relational }
                };
                const opData = opMap[expr.operator] || { op: expr.operator, prec: 0 };
                currentPrecedence = opData.prec;
                output = `${this.generateExpression(expr.left, currentPrecedence)} ${opData.op} ${this.generateExpression(expr.right, currentPrecedence)}`;
                break;
            case 'UnaryExpression':
                currentPrecedence = Precedence.Unary;
                let op = expr.operator === '!' || expr.operator === 'not' ? 'NOT ' : expr.operator;
                output = `${op}${this.generateExpression(expr.argument, currentPrecedence)}`;
                break;
            case 'UpdateExpression':
                // CSP doesn't have ++, convert to += 1
                const argStr = this.generateExpression((expr as any).argument, Precedence.Unary);
                if ((expr as any).operator === '++') {
                    output = `${argStr} <- ${argStr} + 1`;
                } else {
                    output = `${argStr} <- ${argStr} - 1`;
                }
                break;
            case 'CallExpression':
                currentPrecedence = Precedence.Call;
                const calleeStr = (expr.callee as any).type === 'MemberExpression'
                    ? this.generateExpression(expr.callee as any, 0)
                    : (expr.callee as any).name;
                
                // Handle len() builtin
                if ((calleeStr === 'len' || calleeStr === 'LENGTH') && expr.arguments.length === 1) {
                    output = `${this.generateExpression(expr.arguments[0], 0)}.LENGTH()`;
                    break;
                }
                
                const args2 = expr.arguments.map(a => this.generateExpression(a, 0)).join(', ');
                output = `${calleeStr}(${args2})`;
                break;
            case 'ArrayLiteral':
                const elems = expr.elements.map(e => this.generateExpression(e, 0)).join(', ');
                output = `[${elems}]`;
                break;
        }
        return (currentPrecedence < parentPrecedence) ? `(${output})` : output;
    }
}
