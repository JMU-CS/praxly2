/**
 * CSP (Communicating Sequential Processes) parser that converts CSP tokens into an Abstract Syntax Tree (AST).
 * Implements CSP-specific grammar including REPEAT UNTIL, FOR FROM TO, and PROCEDURE declarations.
 */

import type { Token, TokenType } from '../lexer';
import {
  type Program,
  type Statement,
  type Block,
  type Expression,
  type If,
  type ForEach,
  type Return,
  type CallExpression,
  type Identifier,
  type UnaryExpression,
  type FunctionDeclaration,
  type Parameter,
  generateId,
} from '../ast';
import { attachComments } from '../comments';

export class CSPParser {
  private tokens: Token[];
  private current = 0;

  /**
   * Creates a new instance.
   */
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Helper to attach location info to a statement based on token positions
   */
  private withLocation<T extends Statement>(stmt: T, startIdx: number): T {
    if (startIdx >= 0 && startIdx < this.tokens.length && this.current > startIdx) {
      const startToken = this.tokens[startIdx];
      const endToken = this.tokens[this.current - 1];
      stmt.loc = {
        start: startToken.start,
        end: endToken.start + endToken.value.length,
      };
    }
    return stmt;
  }

  /**
   * Parses input.
   */
  parse(): Program {
    const body: Statement[] = [];
    while (!this.isAtEnd()) {
      try {
        body.push(this.topLevelDeclaration());
      } catch (e) {
        // Error recovery: skip to next valid statement
        this.synchronize();
        continue;
      }
    }
    const program: Program = { id: generateId(), type: 'Program', body };
    attachComments(program, (this.tokens as any).comments, (this.tokens as any).source ?? '');
    return program;
  }

  private topLevelDeclaration(): Statement {
    if (this.check('KEYWORD', 'PROCEDURE')) {
      return this.procedureDeclaration();
    }
    return this.statement();
  }

  /**
   * Synchronize to the next statement by skipping tokens until we find
   * a keyword that likely starts a new statement or class
   */
  private synchronize(): void {
    this.advance();

    while (!this.isAtEnd()) {
      // Skip to next statement-starting keyword
      if (this.check('KEYWORD', 'PROCEDURE', 'IF', 'ELSE', 'REPEAT', 'FOR', 'RETURN')) {
        return;
      }
      // Also sync on closing braces or semicolons
      if (this.check('PUNCTUATION', '}', ';')) {
        if (this.check('PUNCTUATION', '}')) this.advance();
        return;
      }
      this.advance();
    }
  }

  private procedureDeclaration(): FunctionDeclaration {
    this.consume('KEYWORD', 'PROCEDURE');
    const name = this.consume('IDENTIFIER').value;
    this.consume('PUNCTUATION', '(');
    const params: Parameter[] = [];
    if (!this.check('PUNCTUATION', ')')) {
      do {
        params.push({
          id: generateId(),
          type: 'Parameter',
          name: this.consume('IDENTIFIER').value,
          paramType: 'auto',
        });
      } while (this.match('PUNCTUATION', ','));
    }
    this.consume('PUNCTUATION', ')');
    const body = this.block();
    return { id: generateId(), type: 'FunctionDeclaration', name, params, body };
  }

  private block(): Block {
    if (this.check('PUNCTUATION', '{')) this.consume('PUNCTUATION', '{');
    const statements: Statement[] = [];
    while (!this.check('PUNCTUATION', '}') && !this.isAtEnd()) {
      try {
        statements.push(this.statement());
      } catch (e) {
        // Error recovery: skip to next statement
        while (
          !this.check('PUNCTUATION', '}') &&
          !this.isAtEnd() &&
          !this.check('KEYWORD', 'IF', 'ELSE', 'REPEAT', 'FOR', 'SKIP', 'RETURN', 'CHECK')
        ) {
          this.advance();
        }
        if (!this.check('PUNCTUATION', '}') && !this.isAtEnd()) continue;
        break;
      }
    }
    if (this.check('PUNCTUATION', '}')) this.consume('PUNCTUATION', '}');
    return { id: generateId(), type: 'Block', body: statements };
  }

  private statement(): Statement {
    const startIdx = this.current;

    if (this.check('KEYWORD', 'IF')) return this.withLocation(this.ifStatement(), startIdx);
    if (this.check('KEYWORD', 'REPEAT')) return this.withLocation(this.repeatStatement(), startIdx);
    if (this.check('KEYWORD', 'FOR')) return this.withLocation(this.forStatement(), startIdx);
    if (this.check('KEYWORD', 'RETURN')) return this.withLocation(this.returnStatement(), startIdx);
    if (this.check('KEYWORD', 'DISPLAY')) return this.withLocation(this.printStatement(), startIdx);

    const expr = this.expression();

    // Assignment Check (handles variable and array index assignments)
    if (this.match('OPERATOR', '<-')) {
      const value = this.expression();
      return this.withLocation(
        { id: generateId(), type: 'Assignment', target: expr, value },
        startIdx
      );
    }

    return this.withLocation(
      { id: generateId(), type: 'ExpressionStatement', expression: expr },
      startIdx
    );
  }

  private printStatement(): Statement {
    this.consume('KEYWORD', 'DISPLAY');
    if (this.check('PUNCTUATION', '(')) {
      this.consume('PUNCTUATION', '(');
      const expr = this.expression();
      this.consume('PUNCTUATION', ')');
      return { id: generateId(), type: 'Print', expressions: [expr] };
    }
    const expr = this.expression();
    return { id: generateId(), type: 'Print', expressions: [expr] };
  }

  private ifStatement(): If {
    this.consume('KEYWORD', 'IF');
    if (this.check('PUNCTUATION', '(')) this.consume('PUNCTUATION', '(');
    const condition = this.expression();
    if (this.check('PUNCTUATION', ')')) this.consume('PUNCTUATION', ')');

    const thenBranch = this.block();
    let elseBranch: Block | undefined = undefined;
    if (this.match('KEYWORD', 'ELSE')) {
      elseBranch = this.block();
    }
    return { id: generateId(), type: 'If', condition, thenBranch, elseBranch };
  }

  private repeatStatement(): Statement {
    this.consume('KEYWORD', 'REPEAT');

    if (this.match('KEYWORD', 'UNTIL')) {
      if (this.check('PUNCTUATION', '(')) this.consume('PUNCTUATION', '(');
      const condition = this.expression();
      if (this.check('PUNCTUATION', ')')) this.consume('PUNCTUATION', ')');

      const negatedCondition: UnaryExpression = {
        id: generateId(),
        type: 'UnaryExpression',
        operator: 'not',
        argument: condition,
      };

      const body = this.block();
      return { id: generateId(), type: 'While', condition: negatedCondition, body };
    } else {
      // REPEAT n TIMES
      const timesExpr = this.expression();
      this.consume('KEYWORD', 'TIMES');
      const body = this.block();

      const varName = `_i_${generateId()}`;
      const initStmt: Statement = {
        id: generateId(),
        type: 'Assignment',
        target: { id: generateId(), type: 'Identifier', name: varName },
        value: { id: generateId(), type: 'Literal', value: 0, raw: '0' },
        varType: 'int',
      };
      const condExpr: Expression = {
        id: generateId(),
        type: 'BinaryExpression',
        left: { id: generateId(), type: 'Identifier', name: varName },
        operator: '<',
        right: timesExpr,
      };
      const updateStmt: Statement = {
        id: generateId(),
        type: 'Assignment',
        target: { id: generateId(), type: 'Identifier', name: varName },
        value: {
          id: generateId(),
          type: 'BinaryExpression',
          left: { id: generateId(), type: 'Identifier', name: varName },
          operator: '+',
          right: { id: generateId(), type: 'Literal', value: 1, raw: '1' },
        },
      };

      return {
        id: generateId(),
        type: 'For',
        init: initStmt,
        condition: condExpr,
        update: updateStmt,
        body,
      };
    }
  }

  private forStatement(): ForEach {
    this.consume('KEYWORD', 'FOR');

    // FOR EACH item IN iterable { ... }
    if (this.match('KEYWORD', 'EACH')) {
      const variable = this.consume('IDENTIFIER').value;
      this.consume('KEYWORD', 'IN');
      const iterable = this.expression();
      const body = this.block();
      return { id: generateId(), type: 'ForEach', variable, iterable, body };
    }

    // FOR i FROM start TO end [STEP step] { ... }
    const variable = this.consume('IDENTIFIER').value;
    this.consume('KEYWORD', 'FROM');
    const start = this.expression();
    this.consume('KEYWORD', 'TO');
    const end = this.expression();

    let step: Expression | undefined = undefined;
    if (this.match('KEYWORD', 'STEP')) {
      step = this.expression();
    }

    const iterable: Expression = {
      id: generateId(),
      type: 'CallExpression',
      callee: { id: generateId(), type: 'Identifier', name: 'range' },
      arguments: step ? [start, end, step] : [start, end],
    };

    const body = this.block();
    return { id: generateId(), type: 'ForEach', variable, iterable, body };
  }

  private returnStatement(): Return {
    this.consume('KEYWORD', 'RETURN');
    let value: Expression | undefined = undefined;
    if (!this.check('PUNCTUATION', '}') && !this.isAtEnd()) {
      value = this.expression();
    }
    return { id: generateId(), type: 'Return', value };
  }

  // --- Expressions ---

  private expression(): Expression {
    return this.logicOr();
  }

  private logicOr(): Expression {
    let left = this.logicAnd();
    while (this.match('KEYWORD', 'OR')) {
      const right = this.logicAnd();
      left = { id: generateId(), type: 'BinaryExpression', left, operator: 'or', right };
    }
    return left;
  }

  private logicAnd(): Expression {
    let left = this.equality();
    while (this.match('KEYWORD', 'AND')) {
      const right = this.equality();
      left = { id: generateId(), type: 'BinaryExpression', left, operator: 'and', right };
    }
    return left;
  }

  private equality(): Expression {
    let left = this.comparison();
    while (this.match('OPERATOR', '=', '<>')) {
      let op = this.previous().value;
      if (op === '=') op = '==';
      if (op === '<>') op = '!=';
      const right = this.comparison();
      left = { id: generateId(), type: 'BinaryExpression', left, operator: op, right };
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
    while (this.match('OPERATOR', '*', '/')) {
      const operator = this.previous().value;
      const right = this.unary();
      left = { id: generateId(), type: 'BinaryExpression', left, operator, right };
    }
    while (this.match('KEYWORD', 'MOD')) {
      const right = this.unary();
      left = { id: generateId(), type: 'BinaryExpression', left, operator: '%', right };
    }
    return left;
  }

  private unary(): Expression {
    if (this.match('KEYWORD', 'NOT')) {
      const right = this.unary();
      return { id: generateId(), type: 'UnaryExpression', operator: 'not', argument: right };
    }
    return this.call();
  }

  // CSP lists are 1-based; the universal AST is 0-based. Convert a 1-based
  // position expression to 0-based: a numeric literal is decremented directly,
  // anything else becomes `expr - 1`.
  private toZeroBased(e: Expression): Expression {
    if (e.type === 'Literal' && typeof (e as any).value === 'number') {
      const v = (e as any).value - 1;
      return { id: generateId(), type: 'Literal', value: v, raw: String(v) };
    }
    return {
      id: generateId(),
      type: 'BinaryExpression',
      operator: '-',
      left: e,
      right: { id: generateId(), type: 'Literal', value: 1, raw: '1' },
    } as any;
  }

  private call(): Expression {
    let expr = this.primary();
    while (true) {
      if (this.match('PUNCTUATION', '(')) {
        expr = this.finishCall(expr);
      } else if (this.match('PUNCTUATION', '[')) {
        const index = this.expression();
        this.consume('PUNCTUATION', ']');
        expr = {
          id: generateId(),
          type: 'IndexExpression',
          object: expr,
          index: this.toZeroBased(index),
        };
      } else {
        break;
      }
    }
    return expr;
  }

  private finishCall(callee: Expression): CallExpression {
    if (callee.type !== 'Identifier') throw new Error('Can only call identifiers');
    const args: Expression[] = [];
    if (!this.check('PUNCTUATION', ')')) {
      do {
        args.push(this.expression());
      } while (this.match('PUNCTUATION', ','));
    }
    this.consume('PUNCTUATION', ')');
    // INSERT(list, pos, value) / REMOVE(list, pos) take 1-based positions in CSP.
    const name = (callee as Identifier).name;
    if (name === 'INSERT' && args.length === 3) args[1] = this.toZeroBased(args[1]);
    else if (name === 'REMOVE' && args.length === 2) args[1] = this.toZeroBased(args[1]);
    return {
      id: generateId(),
      type: 'CallExpression',
      callee: callee as Identifier,
      arguments: args,
    };
  }

  private primary(): Expression {
    if (this.match('NUMBER'))
      return {
        id: generateId(),
        type: 'Literal',
        value: parseFloat(this.previous().value),
        raw: this.previous().value,
      };
    if (this.match('STRING'))
      return {
        id: generateId(),
        type: 'Literal',
        value: this.previous().value,
        raw: `"${this.previous().value}"`,
      };
    if (this.match('BOOLEAN'))
      return {
        id: generateId(),
        type: 'Literal',
        value: this.previous().value === 'true',
        raw: this.previous().value,
      };

    if (this.match('KEYWORD', 'INPUT')) {
      if (this.check('PUNCTUATION', '(')) {
        this.consume('PUNCTUATION', '(');
        this.consume('PUNCTUATION', ')');
      }
      const callee: Identifier = { id: generateId(), type: 'Identifier', name: 'INPUT' };
      return { id: generateId(), type: 'CallExpression', callee, arguments: [] };
    }

    if (this.match('IDENTIFIER'))
      return { id: generateId(), type: 'Identifier', name: this.previous().value };

    if (this.match('PUNCTUATION', '[')) {
      const elements: Expression[] = [];
      if (!this.check('PUNCTUATION', ']')) {
        do {
          elements.push(this.expression());
        } while (this.match('PUNCTUATION', ','));
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

  private match(type: TokenType, ...values: string[]): boolean {
    if (this.check(type, ...values)) {
      this.advance();
      return true;
    }
    return false;
  }
  private check(type: TokenType, ...values: string[]): boolean {
    if (this.isAtEnd()) return false;
    const token = this.peek();
    if (token.type !== type) return false;
    if (values.length > 0 && !values.includes(token.value)) return false;
    return true;
  }
  // private checkNext(type: TokenType, value?: string): boolean {
  //   if (this.current + 1 >= this.tokens.length) return false;
  //   const token = this.tokens[this.current + 1];
  //   if (token.type !== type) return false;
  //   if (value && token.value !== value) return false;
  //   return true;
  // }
  private consume(type: TokenType, value?: string): Token {
    if (this.check(type, ...(value ? [value] : []))) return this.advance();
    const found = this.peek();
    throw new Error(
      `Expected token ${type} ${value || ''} but found ${found.type} '${found.value}' at position ${found.start}`
    );
  }
  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }
  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }
  private peek(): Token {
    return this.tokens[this.current];
  }
  private previous(): Token {
    return this.tokens[this.current - 1];
  }
}
