import type { Token, TokenType } from '../lexer';
import {
    type Program, type Statement, type Block, type Expression, type If, type While, type For,
    type Return, type CallExpression, type Identifier, type FunctionDeclaration,
    generateId
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
        if (this.match('KEYWORD', 'procedure') || this.match('KEYWORD', 'function')) {
            return this.functionDeclaration();
        }
        return this.statement();
    }

    private statement(): Statement {
        if (this.check('KEYWORD', 'print')) return this.printStatement();
        if (this.check('KEYWORD', 'if')) return this.ifStatement();
        if (this.check('KEYWORD', 'while')) return this.whileStatement();
        if (this.check('KEYWORD', 'for')) return this.forStatement();
        if (this.check('KEYWORD', 'return')) return this.returnStatement();
        if (this.check('KEYWORD', 'call')) {
            this.advance(); // consume 'call'
            const expr = this.expression();
            return { id: generateId(), type: 'ExpressionStatement', expression: expr };
        }

        // Parse expression first, checking for an assignment operator following it
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

    private functionDeclaration(): FunctionDeclaration {
        // 'procedure' or 'function' already consumed
        const name = this.consume('IDENTIFIER').value;
        this.consume('PUNCTUATION', '(');

        const params: Identifier[] = [];
        if (!this.check('PUNCTUATION', ')')) {
            do {
                const paramName = this.consume('IDENTIFIER').value;
                params.push({ id: generateId(), type: 'Identifier', name: paramName });
            } while (this.match('PUNCTUATION', ','));
        }
        this.consume('PUNCTUATION', ')');

        const body = this.block(); // Consumes until 'end'

        // Consume specific end tag if present e.g. "end function" or just "end"
        if (this.check('KEYWORD', 'function') || this.check('KEYWORD', 'procedure')) {
            this.advance();
        }

        return { id: generateId(), type: 'FunctionDeclaration', name, params, body };
    }

    private block(): Block {
        const statements: Statement[] = [];
        // Read until 'end', 'else'
        while (!this.check('KEYWORD', 'end') &&
            !this.check('KEYWORD', 'else') &&
            !this.isAtEnd()) {
            statements.push(this.statement());
        }
        return { id: generateId(), type: 'Block', body: statements };
    }

    private printStatement(): Statement {
        this.consume('KEYWORD', 'print');
        this.consume('PUNCTUATION', '(');
        const expr = this.expression();
        this.consume('PUNCTUATION', ')');
        return { id: generateId(), type: 'Print', expression: expr };
    }

    private ifStatement(): If {
        this.consume('KEYWORD', 'if');
        const condition = this.expression();
        this.match('KEYWORD', 'then'); // Optional 'then'

        const thenBranch = this.block();
        let elseBranch: Block | undefined = undefined;

        if (this.match('KEYWORD', 'else')) {
            elseBranch = this.block();
        }

        this.consume('KEYWORD', 'end');
        this.match('KEYWORD', 'if'); // Optional 'if' after 'end'

        return { id: generateId(), type: 'If', condition, thenBranch, elseBranch };
    }

    private whileStatement(): While {
        this.consume('KEYWORD', 'while');
        const condition = this.expression();
        this.match('KEYWORD', 'do'); // Optional 'do'

        const body = this.block();

        this.consume('KEYWORD', 'end');
        this.match('KEYWORD', 'while'); // Optional 'while' after 'end'

        return { id: generateId(), type: 'While', condition, body };
    }

    private forStatement(): For {
        this.consume('KEYWORD', 'for');
        const variable = this.consume('IDENTIFIER').value;

        // Check for "for i in arr" vs "for i <- 1 to 10"
        let iterable: Expression;

        if (this.match('KEYWORD', 'in')) {
            iterable = this.expression();
        } else {
            // "for i <- 1 to 10"
            this.match('OPERATOR', '<-'); // consume arrow or equals
            const start = this.expression();
            this.consume('KEYWORD', 'to');
            const end = this.expression();

            // Synthesize a range(start, end) call
            iterable = {
                id: generateId(),
                type: 'CallExpression',
                callee: { id: generateId(), type: 'Identifier', name: 'range' },
                arguments: [start, end]
            };
        }

        this.match('KEYWORD', 'do'); // Optional

        const body = this.block();

        this.consume('KEYWORD', 'end');
        this.match('KEYWORD', 'for');

        return { id: generateId(), type: 'For', variable, iterable, body };
    }

    private returnStatement(): Return {
        this.consume('KEYWORD', 'return');
        let value: Expression | undefined = undefined;
        // Check if next token is start of an expression
        const isExprStart = this.check('IDENTIFIER') || this.check('NUMBER') ||
            this.check('STRING') || this.check('PUNCTUATION', '(') || this.check('OPERATOR', '-') || this.check('KEYWORD', 'not');

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
        while (this.match('OPERATOR', '==', '!=')) {
            const operator = this.previous().value;
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
            let operator = this.previous().value;
            if (operator === 'mod') operator = '%';
            const right = this.unary();
            left = { id: generateId(), type: 'BinaryExpression', left, operator, right };
        }
        return left;
    }

    private unary(): Expression {
        if (this.match('OPERATOR', '!', '-') || this.match('KEYWORD', 'not')) {
            let operator = this.previous().value;
            if (operator === 'not') operator = '!';
            const right = this.unary();
            return { id: generateId(), type: 'UnaryExpression', operator, argument: right };
        }
        return this.call();
    }

    private call(): Expression {
        let expr = this.primary();
        while (true) {
            // Handle array indexing: arr[i] -> MemberExpression?
            // AST.MemberExpression is obj.prop.
            // Often interpreter handles arr[i] via a different mechanism or MemberExpression with computed=true.
            // Your AST `MemberExpression` has `property: Identifier`. It might not support `arr[i]`.
            // However, standard call `arr(i)` is sometimes used in pseudocode or we treat `[...]` as specific access.
            // Based on provided files, Python parser uses CallExpression for method calls but logic for arrays is sparse.
            // We will assume array access isn't strictly requested or map it to a function call for now if syntax arises.
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
            } else {
                break;
            }
        }
        return expr;
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
        if (this.match('IDENTIFIER')) return { id: generateId(), type: 'Identifier', name: this.previous().value };

        if (this.match('PUNCTUATION', '[')) {
            const elements: Expression[] = [];
            if (!this.check('PUNCTUATION', ']')) {
                do { elements.push(this.expression()); } while (this.match('PUNCTUATION', ','));
            }
            this.consume('PUNCTUATION', ']');
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
    private match(type: TokenType, ...values: string[]): boolean {
        if (this.check(type, ...values)) { this.advance(); return true; }
        return false;
    }
    private check(type: TokenType, ...values: string[]): boolean {
        if (this.isAtEnd()) return false;
        const token = this.peek();
        if (token.type !== type) return false;
        if (values.length > 0 && !values.includes(token.value.toLowerCase())) return false;
        return true;
    }
    private consume(type: TokenType, value?: string): Token {
        if (this.check(type, ...(value ? [value] : []))) return this.advance();
        const found = this.peek();
        throw new Error(`Expected token ${type} ${value || ''} but found ${found.type} '${found.value}' at position ${found.start}`);
    }
    private advance(): Token {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }
    private isAtEnd(): boolean { return this.peek().type === 'EOF'; }
    private peek(): Token { return this.tokens[this.current]; }
    private previous(): Token { return this.tokens[this.current - 1]; }
}
