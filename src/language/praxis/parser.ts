import type { Token, TokenType } from '../lexer';
import {
    type Program, type Statement, type Block, type Expression, type If, type While,
    type Return, type CallExpression, type Identifier, type FunctionDeclaration,
    type ClassDeclaration, generateId
} from '../ast';

export class PraxisParser {
    private tokens: Token[];
    private current = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    parse(): Program {
        const body: Statement[] = [];
        while (!this.isAtEnd()) {
            body.push(this.topLevelDeclaration());
        }
        return { id: generateId(), type: 'Program', body };
    }

    private topLevelDeclaration(): Statement {
        if (this.check('KEYWORD', 'class')) {
            return this.classDeclaration();
        }
        if (this.isFunctionDeclaration()) {
            return this.functionDeclaration();
        }
        return this.statement();
    }

    private classDeclaration(): ClassDeclaration {
        this.consume('KEYWORD', 'class');
        const name = this.consume('IDENTIFIER').value;
        let superClass: Identifier | undefined = undefined;
        if (this.match('KEYWORD', 'extends')) {
            superClass = { id: generateId(), type: 'Identifier', name: this.consume('IDENTIFIER').value };
        }

        const classBody: any[] = [];
        while (!this.check('KEYWORD', 'end') && !this.isAtEnd()) {
            if (this.isFunctionDeclaration()) {
                const func = this.functionDeclaration();
                classBody.push({
                    id: generateId(), type: 'MethodDeclaration',
                    name: func.name, access: 'public', isStatic: false,
                    returnType: (func as any).returnType, // Ensure return type is carried over to methods
                    params: func.params, body: func.body
                });
            } else {
                const stmt = this.statement();
                if (stmt.type === 'Assignment') {
                    classBody.push({
                        id: generateId(), type: 'FieldDeclaration',
                        name: (stmt as any).name, fieldType: (stmt as any).varType || 'auto', isStatic: false,
                        access: 'public', initializer: (stmt as any).value
                    });
                }
            }
        }

        this.consume('KEYWORD', 'end');
        this.consume('KEYWORD', 'class');
        this.match('IDENTIFIER', name); // optional match

        return { id: generateId(), type: 'ClassDeclaration', name, superClass, body: classBody };
    }

    private isFunctionDeclaration(): boolean {
        if (!this.isTypeStart() && !this.check('KEYWORD', 'void')) return false;
        let offset = 1;
        while (this.checkPeekAhead('PUNCTUATION', '[', offset)) {
            offset++;
            if (this.checkPeekAhead('PUNCTUATION', ']', offset)) offset++;
        }
        if (this.checkPeekAhead('IDENTIFIER', undefined, offset) &&
            this.checkPeekAhead('PUNCTUATION', '(', offset + 1)) {
            return true;
        }
        return false;
    }

    private isVariableDeclaration(): boolean {
        let offset = 0;
        if (this.isTypeStart()) {
            offset = 1;
        } else if (this.check('IDENTIFIER')) {
            offset = 1;
        } else {
            return false;
        }

        while (this.checkPeekAhead('PUNCTUATION', '[', offset)) {
            offset++;
            if (this.checkPeekAhead('PUNCTUATION', ']', offset)) {
                offset++;
            } else {
                while (this.current + offset < this.tokens.length && !this.checkPeekAhead('PUNCTUATION', ']', offset)) offset++;
                if (this.checkPeekAhead('PUNCTUATION', ']', offset)) offset++;
            }
        }

        // Two sequential identifiers implies 'Type Name' declaration
        return this.checkPeekAhead('IDENTIFIER', undefined, offset);
    }

    private functionDeclaration(): FunctionDeclaration {
        let returnType = 'auto';
        if (this.isTypeStart() || this.check('KEYWORD', 'void')) {
            returnType = this.peek().value;
            this.advance();
            while (this.check('PUNCTUATION', '[')) {
                this.advance();
                this.consume('PUNCTUATION', ']');
                returnType += '[]';
            }
        } else if (this.check('KEYWORD', 'procedure') || this.check('KEYWORD', 'function')) {
            this.advance();
            returnType = 'void';
        }

        const name = this.consume('IDENTIFIER').value;
        this.consume('PUNCTUATION', '(');

        const params: any[] = [];
        if (!this.check('PUNCTUATION', ')')) {
            do {
                let paramType = 'auto';
                if (this.isTypeStart() || this.check('IDENTIFIER')) {
                    paramType = this.peek().value;
                    this.advance();
                    while (this.check('PUNCTUATION', '[')) {
                        this.advance();
                        this.consume('PUNCTUATION', ']');
                        paramType += '[]';
                    }
                }
                const paramName = this.consume('IDENTIFIER').value;
                params.push({ id: generateId(), type: 'Identifier', name: paramName, paramType } as any);
            } while (this.match('PUNCTUATION', ','));
        }
        this.consume('PUNCTUATION', ')');

        const body = this.block();

        this.consume('KEYWORD', 'end');
        this.match('IDENTIFIER', name); // Practice 'end procedureName' structure

        return { id: generateId(), type: 'FunctionDeclaration', name, params, body, returnType } as any;
    }

    private variableDeclaration(): Statement {
        const typeToken = this.advance(); // consume type
        let typeName = typeToken.value;

        while (this.match('PUNCTUATION', '[')) {
            while (!this.check('PUNCTUATION', ']') && !this.isAtEnd()) this.advance();
            this.consume('PUNCTUATION', ']');
            typeName += '[]';
        }

        const name = this.consume('IDENTIFIER').value;
        if (this.match('PUNCTUATION', '[')) {
            while (!this.check('PUNCTUATION', ']') && !this.isAtEnd()) this.advance();
            this.consume('PUNCTUATION', ']');
            typeName += '[]';
        }

        let value: Expression = { id: generateId(), type: 'Literal', value: null, raw: 'null' };
        if (this.match('OPERATOR', '<-') || this.match('OPERATOR', '=')) {
            value = this.expression();
        }

        // Include varType to lock down specific custom class typings into translator
        return { id: generateId(), type: 'Assignment', name, value, varType: typeName } as any;
    }

    private statement(): Statement {
        if (this.check('KEYWORD', 'print')) return this.printStatement();
        if (this.check('KEYWORD', 'if')) return this.ifStatement();
        if (this.check('KEYWORD', 'while')) return this.whileStatement();
        if (this.check('KEYWORD', 'do')) return this.doWhileStatement();
        if (this.check('KEYWORD', 'repeat')) return this.repeatUntilStatement();
        if (this.check('KEYWORD', 'for')) return this.forStatement();
        if (this.check('KEYWORD', 'return')) return this.returnStatement();

        // Check for 'Type Identifier <- value'
        if (this.isVariableDeclaration()) {
            return this.variableDeclaration();
        }

        // Generic Expression Evaluation or Assignment
        const expr = this.expression();
        if (this.match('OPERATOR', '<-') || this.match('OPERATOR', '=')) {
            const value = this.expression();

            if (expr.type === 'Identifier') {
                return { id: generateId(), type: 'Assignment', name: (expr as Identifier).name, value };
            } else if (expr.type === 'MemberExpression') {
                return {
                    id: generateId(),
                    type: 'Assignment',
                    name: this.generateMemberPath(expr),
                    value
                };
            }
        }

        return { id: generateId(), type: 'ExpressionStatement', expression: expr };
    }

    private generateMemberPath(expr: any): string {
        if (expr.type === 'Identifier') return expr.name;
        if (expr.type === 'MemberExpression') {
            return `${this.generateMemberPath(expr.object)}.${expr.property.name}`;
        }
        return 'unknown';
    }

    private block(breakTokens: string[] = ['end', 'else', 'until']): Block {
        const statements: Statement[] = [];
        while (!this.isAtEnd()) {
            const token = this.peek();
            if (token.type === 'KEYWORD' && breakTokens.includes(token.value.toLowerCase())) {
                break;
            }
            statements.push(this.statement());
        }
        return { id: generateId(), type: 'Block', body: statements };
    }

    private printStatement(): Statement {
        this.consume('KEYWORD', 'print');
        const hasParen = this.match('PUNCTUATION', '(');
        const expr = this.expression();
        if (hasParen) {
            this.consume('PUNCTUATION', ')');
        }
        return { id: generateId(), type: 'Print', expressions: [expr] };
    }

    private ifStatement(): If {
        this.consume('KEYWORD', 'if');
        this.match('PUNCTUATION', '(');
        const condition = this.expression();
        this.match('PUNCTUATION', ')');

        const thenBranch = this.block();
        let elseBranch: Block | undefined = undefined;

        if (this.match('KEYWORD', 'else')) {
            elseBranch = this.block();
        }

        this.consume('KEYWORD', 'end');
        this.consume('KEYWORD', 'if');

        return { id: generateId(), type: 'If', condition, thenBranch, elseBranch };
    }

    private whileStatement(): While {
        this.consume('KEYWORD', 'while');
        this.match('PUNCTUATION', '(');
        const condition = this.expression();
        this.match('PUNCTUATION', ')');

        const body = this.block();

        this.consume('KEYWORD', 'end');
        this.consume('KEYWORD', 'while');

        return { id: generateId(), type: 'While', condition, body };
    }

    private doWhileStatement(): While {
        this.consume('KEYWORD', 'do');
        const body = this.block(['end', 'else', 'until', 'while']);
        this.consume('KEYWORD', 'while');
        this.match('PUNCTUATION', '(');
        const condition = this.expression();
        this.match('PUNCTUATION', ')');

        return { id: generateId(), type: 'While', condition, body };
    }

    private repeatUntilStatement(): While {
        this.consume('KEYWORD', 'repeat');
        const body = this.block();
        this.consume('KEYWORD', 'until');
        this.match('PUNCTUATION', '(');
        const condition = this.expression();
        this.match('PUNCTUATION', ')');

        const notCond: Expression = { id: generateId(), type: 'UnaryExpression', operator: 'not', argument: condition };
        return { id: generateId(), type: 'While', condition: notCond, body };
    }

    private forStatement(): any {
        this.consume('KEYWORD', 'for');
        const hasParen = this.match('PUNCTUATION', '(');

        // Detect whether this is a C-Style (init; cond; update) loop or a Python-style iterator loop
        let isCStyle = false;
        for (let i = this.current; i < this.tokens.length; i++) {
            const val = this.tokens[i].value;
            if (val === ';' || val === 'do' || val === ')' || val === 'end') {
                if (val === ';') isCStyle = true;
                break;
            }
        }

        if (isCStyle) {
            // Parse C-Style components
            let initStmt: Statement;
            if (this.isTypeStart() || this.checkPeekAhead('IDENTIFIER', undefined, 1)) {
                initStmt = this.variableDeclaration();
            } else {
                const expr = this.expression();
                if (this.match('OPERATOR', '<-') || this.match('OPERATOR', '=')) {
                    initStmt = { id: generateId(), type: 'Assignment', name: this.generateMemberPath(expr), value: this.expression() };
                } else {
                    initStmt = { id: generateId(), type: 'ExpressionStatement', expression: expr };
                }
            }
            this.consume('PUNCTUATION', ';');
            const condition = this.expression();
            this.consume('PUNCTUATION', ';');

            let updateStmt: Statement;
            const updateExpr = this.expression();
            if (this.match('OPERATOR', '<-') || this.match('OPERATOR', '=')) {
                updateStmt = { id: generateId(), type: 'Assignment', name: this.generateMemberPath(updateExpr), value: this.expression() };
            } else {
                updateStmt = { id: generateId(), type: 'ExpressionStatement', expression: updateExpr };
            }

            if (hasParen) this.consume('PUNCTUATION', ')');
            this.match('KEYWORD', 'do');

            const body = this.block();

            this.consume('KEYWORD', 'end');
            this.consume('KEYWORD', 'for');

            return { id: generateId(), type: 'For', init: initStmt, condition, update: updateStmt, body };
        } else {
            // Iterator Loop
            let variable = '';
            if (this.isTypeStart()) {
                this.advance();
                while (this.match('PUNCTUATION', '[')) { this.consume('PUNCTUATION', ']'); }
            }
            variable = this.consume('IDENTIFIER').value;

            let iterable: Expression;
            if (this.match('KEYWORD', 'in')) {
                iterable = this.expression();
            } else {
                this.match('OPERATOR', '<-') || this.match('OPERATOR', '=');
                const start = this.expression();
                this.consume('KEYWORD', 'to');
                const end = this.expression();
                iterable = {
                    id: generateId(), type: 'CallExpression',
                    callee: { id: generateId(), type: 'Identifier', name: 'range' },
                    arguments: [start, end]
                };
            }

            if (hasParen) this.consume('PUNCTUATION', ')');
            this.match('KEYWORD', 'do');

            const body = this.block();
            this.consume('KEYWORD', 'end');
            this.consume('KEYWORD', 'for');

            return { id: generateId(), type: 'For', variable, iterable, body };
        }
    }

    private returnStatement(): Return {
        this.consume('KEYWORD', 'return');
        let value: Expression | undefined = undefined;
        const isExprStart = this.check('IDENTIFIER') || this.check('NUMBER') ||
            this.check('STRING') || this.check('BOOLEAN') || this.check('PUNCTUATION', '(') ||
            this.check('OPERATOR', '-') || this.check('KEYWORD', 'not') || this.check('PUNCTUATION', '{') || this.check('PUNCTUATION', '[');

        if (isExprStart) {
            value = this.expression();
        }
        return { id: generateId(), type: 'Return', value };
    }

    // --- Expressions (Standard Precedence) ---

    private expression(): Expression { return this.logicOr(); }

    private logicOr(): Expression {
        let left = this.logicAnd();
        while (this.match('KEYWORD', 'or')) {
            const right = this.logicAnd();
            left = { id: generateId(), type: 'BinaryExpression', left, operator: 'or', right };
        }
        return left;
    }

    private logicAnd(): Expression {
        let left = this.equality();
        while (this.match('KEYWORD', 'and')) {
            const right = this.equality();
            left = { id: generateId(), type: 'BinaryExpression', left, operator: 'and', right };
        }
        return left;
    }

    private equality(): Expression {
        let left = this.comparison();
        while (this.match('OPERATOR', '==', '!=', '=', '<>')) {
            let operator = this.previous().value;
            if (operator === '=') operator = '==';
            if (operator === '<>') operator = '!=';
            const right = this.comparison();
            left = { id: generateId(), type: 'BinaryExpression', left, operator, right };
        }
        return left;
    }

    private comparison(): Expression {
        let left = this.term();
        while (this.match('OPERATOR', '>', '>=', '<', '<=')) {
            const operator = this.previous().value;
            const right = this.term();
            left = { id: generateId(), type: 'BinaryExpression', left, operator, right };
        }
        return left;
    }

    private term(): Expression {
        let left = this.factor();
        while (this.match('OPERATOR', '+', '-')) {
            const operator = this.previous().value;
            const right = this.factor();
            left = { id: generateId(), type: 'BinaryExpression', left, operator, right };
        }
        return left;
    }

    private factor(): Expression {
        let left = this.unary();
        while (this.match('OPERATOR', '*', '/', '%') || this.match('KEYWORD', 'mod')) {
            let operator = this.previous().value.toLowerCase();
            if (operator === 'mod') operator = '%';
            const right = this.unary();
            left = { id: generateId(), type: 'BinaryExpression', left, operator, right };
        }
        return left;
    }

    private unary(): Expression {
        if (this.match('OPERATOR', '!', '-') || this.match('KEYWORD', 'not')) {
            let operator = this.previous().value.toLowerCase();
            if (operator === 'not') operator = '!';
            const right = this.unary();
            return { id: generateId(), type: 'UnaryExpression', operator, argument: right };
        }
        return this.call();
    }

    private call(): Expression {
        let expr = this.primary();
        while (true) {
            if (this.match('PUNCTUATION', '(')) {
                expr = this.finishCall(expr);
            } else if (this.match('PUNCTUATION', '.')) {
                const name = this.consume('IDENTIFIER').value;
                expr = {
                    id: generateId(),
                    type: 'MemberExpression',
                    object: expr,
                    property: { id: generateId(), type: 'Identifier', name },
                    isMethod: false
                };
            } else if (this.match('PUNCTUATION', '[')) {
                let savedPos = this.current;
                try {
                    const index = this.expression();
                    this.consume('PUNCTUATION', ']');
                    const propName = `[${this.stringifyExpressionForProperty(index)}]`;
                    expr = {
                        id: generateId(),
                        type: 'MemberExpression',
                        object: expr,
                        property: { id: generateId(), type: 'Identifier', name: propName },
                        isMethod: false
                    };
                } catch (e) {
                    this.current = savedPos;
                    break;
                }
            } else {
                break;
            }
        }
        return expr;
    }

    private stringifyExpressionForProperty(expr: Expression): string {
        if (expr.type === 'Identifier') return (expr as Identifier).name;
        if (expr.type === 'Literal') return String((expr as any).value);
        if (expr.type === 'BinaryExpression') {
            const bin = expr as any;
            return `${this.stringifyExpressionForProperty(bin.left)} ${bin.operator} ${this.stringifyExpressionForProperty(bin.right)}`;
        }
        return 'expr';
    }

    private finishCall(callee: Expression): CallExpression {
        const args: Expression[] = [];
        if (!this.check('PUNCTUATION', ')')) {
            do { args.push(this.expression()); } while (this.match('PUNCTUATION', ','));
        }
        this.consume('PUNCTUATION', ')');
        return { id: generateId(), type: 'CallExpression', callee: callee as any, arguments: args };
    }

    private primary(): Expression {
        if (this.match('NUMBER')) return { id: generateId(), type: 'Literal', value: parseFloat(this.previous().value), raw: this.previous().value };
        if (this.match('STRING')) return { id: generateId(), type: 'Literal', value: this.previous().value, raw: `"${this.previous().value}"` };
        if (this.match('BOOLEAN')) return { id: generateId(), type: 'Literal', value: this.previous().value === 'true', raw: this.previous().value };
        if (this.match('KEYWORD', 'null')) return { id: generateId(), type: 'Literal', value: null, raw: 'null' };
        if (this.match('IDENTIFIER')) return { id: generateId(), type: 'Identifier', name: this.previous().value };

        // Handle Object Instantiation
        if (this.match('KEYWORD', 'new')) {
            const className = this.consume('IDENTIFIER').value;
            this.consume('PUNCTUATION', '(');
            const args: Expression[] = [];
            if (!this.check('PUNCTUATION', ')')) {
                do { args.push(this.expression()); } while (this.match('PUNCTUATION', ','));
            }
            this.consume('PUNCTUATION', ')');
            return { id: generateId(), type: 'NewExpression', className, arguments: args } as any;
        }

        if (this.match('PUNCTUATION', '[') || this.match('PUNCTUATION', '{')) {
            const isBrace = this.previous().value === '{';
            const closePunct = isBrace ? '}' : ']';
            const elements: Expression[] = [];
            if (!this.check('PUNCTUATION', closePunct)) {
                do { elements.push(this.expression()); } while (this.match('PUNCTUATION', ','));
            }
            this.consume('PUNCTUATION', closePunct);
            return { id: generateId(), type: 'ArrayLiteral', elements };
        }

        if (this.match('PUNCTUATION', '(')) {
            const expr = this.expression();
            this.consume('PUNCTUATION', ')');
            return expr;
        }

        throw new Error(`Expect expression. Found ${this.peek().value}`);
    }

    // Helpers
    private isTypeStart(): boolean {
        if (this.isAtEnd()) return false;
        const token = this.peek();
        if (token.type !== 'KEYWORD') return false;
        const types = ['boolean', 'char', 'double', 'float', 'int', 'short', 'string', 'void'];
        return types.includes(token.value.toLowerCase());
    }
    private checkPeekAhead(type: TokenType, value?: string, distance: number = 1): boolean {
        if (this.current + distance >= this.tokens.length) return false;
        const token = this.tokens[this.current + distance];
        if (token.type !== type) return false;
        if (value && token.value.toLowerCase() !== value.toLowerCase()) return false;
        return true;
    }
    private match(type: TokenType, ...values: string[]): boolean {
        if (this.check(type, ...values)) { this.advance(); return true; }
        return false;
    }
    private check(type: TokenType, ...values: string[]): boolean {
        if (this.isAtEnd()) return false;
        const token = this.peek();
        if (token.type !== type) return false;
        if (values.length > 0 && !values.map(v => v.toLowerCase()).includes(token.value.toLowerCase())) return false;
        return true;
    }
    private consume(type: TokenType, value?: string): Token {
        if (this.check(type, ...(value ? [value] : []))) return this.advance();
        const found = this.peek();
        throw new Error(`Expected token ${type} ${value || ''} but found ${found.type} '${found.value}'`);
    }
    private advance(): Token {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }
    private isAtEnd(): boolean { return this.peek().type === 'EOF'; }
    private peek(): Token { return this.tokens[this.current]; }
    private previous(): Token { return this.tokens[this.current - 1]; }
}
