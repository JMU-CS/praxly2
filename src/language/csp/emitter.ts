import { ASTVisitor, Precedence } from '../visitor';
import type { Program, ClassDeclaration, FieldDeclaration, Constructor, MethodDeclaration, Block, Expression } from '../ast';

export class CSPEmitter extends ASTVisitor {
    protected override breakStr = 'BREAK';
    protected override continueStr = 'CONTINUE';

    visitProgram(program: Program): void {
        const classes = program.body.filter(s => s.type === 'ClassDeclaration');
        const nonClasses = program.body.filter(s => s.type !== 'ClassDeclaration');

        classes.forEach(classDecl => {
            this.visitClassDeclaration(classDecl as ClassDeclaration);
            this.emit('');
        });
        nonClasses.forEach(stmt => this.visitStatement(stmt));
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
        this.emit(`DISPLAY(${args.join(' + " " + ')})`);
    }

    visitAssignment(stmt: any): void {
        const targetStr = stmt.target ? this.generateExpression(stmt.target, 0) : stmt.name;
        this.emit(`${targetStr} <- ${this.generateExpression(stmt.value, 0)}`);
    }

    visitIf(stmt: any): void {
        this.emit(`IF (${this.generateExpression(stmt.condition, 0)})`);
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
        this.emit(`REPEAT UNTIL (NOT (${this.generateExpression(stmt.condition, 0)}))`);
        this.emit('{'); this.indent(); this.visitBlock(stmt.body); this.dedent(); this.emit('}');
    }

    visitFor(stmt: any): void {
        if (stmt.init && stmt.condition && stmt.update) {
            this.context.symbolTable.enterScope();
            this.visitStatement(stmt.init);
            this.emit(`REPEAT UNTIL (NOT (${this.generateExpression(stmt.condition, 0)}))`);
            this.emit('{');
            this.indent();
            this.visitBlock(stmt.body);
            this.visitStatement(stmt.update);
            this.dedent();
            this.emit('}');
            this.context.symbolTable.exitScope();
        } else {
            this.emit(`FOR EACH ${stmt.variable} IN ${this.generateExpression(stmt.iterable, 0)}`);
            this.emit('{'); this.indent(); this.visitBlock(stmt.body); this.dedent(); this.emit('}');
        }
    }

    visitFunctionDeclaration(stmt: any): void {
        const params = stmt.params.map((p: any) => p.name).join(', ');
        this.emit(`PROCEDURE ${stmt.name} (${params})`);
        this.emit('{'); this.indent(); this.visitBlock(stmt.body); this.dedent(); this.emit('}');
    }

    visitReturn(stmt: any): void {
        this.emit(`RETURN ${stmt.value ? this.generateExpression(stmt.value, 0) : ''}`);
    }

    visitExpressionStatement(stmt: any): void {
        this.emit(this.generateExpression(stmt.expression, 0));
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
                output = `${this.generateExpression(expr.object, currentPrecedence)}[${this.generateExpression(expr.index, 0)}]`;
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
                    '%': { op: 'MOD', prec: Precedence.Multiplicative }
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
                output = `[${elems}]`;
                break;
        }
        return (currentPrecedence < parentPrecedence) ? `(${output})` : output;
    }
}
