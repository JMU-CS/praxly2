/**
 * JavaScript parser that converts JS tokens into the shared AST format.
 * Handles let/const/var declarations, function/class declarations,
 * console.log as Print, for-of loops, and all standard control flow.
 */

import type { Token, TokenType } from '../lexer';
import {
  type Program,
  type Statement,
  type Block,
  type Expression,
  type If,
  type While,
  type For,
  type ForEach,
  type Return,
  type CallExpression,
  type Identifier,
  type ClassDeclaration,
  type FieldDeclaration,
  type Constructor,
  type MethodDeclaration,
  type Parameter,
  generateId,
} from '../ast';
import { attachComments } from '../comments';

export class JavaScriptParser {
  private tokens: Token[];
  private current = 0;
  private currentClassName: string | null = null;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Program {
    const body: Statement[] = [];
    while (!this.isAtEnd()) {
      try {
        body.push(this.topLevel());
      } catch {
        this.synchronize();
      }
    }
    const program: Program = { id: generateId(), type: 'Program', body };
    attachComments(program, (this.tokens as any).comments, (this.tokens as any).source ?? '');
    return program;
  }

  private synchronize(): void {
    this.advance();
    while (!this.isAtEnd()) {
      if (
        this.check(
          'KEYWORD',
          'function',
          'class',
          'const',
          'let',
          'var',
          'if',
          'while',
          'for',
          'do',
          'return',
          'try',
          'switch',
          'break',
          'continue'
        )
      )
        return;
      if (this.check('PUNCTUATION', '}', ';')) {
        if (this.check('PUNCTUATION', '}')) this.advance();
        return;
      }
      this.advance();
    }
  }

  private topLevel(): Statement {
    if (this.check('KEYWORD', 'class')) return this.classDeclaration();
    if (this.check('KEYWORD', 'function')) return this.functionDeclaration();
    return this.statement();
  }

  // ── Class declarations ───────────────────────────────────────────────────

  private classDeclaration(): ClassDeclaration {
    this.consume('KEYWORD', 'class');
    const name = this.consume('IDENTIFIER').value;
    const prev = this.currentClassName;
    this.currentClassName = name;

    let superClass: Identifier | undefined;
    if (this.match('KEYWORD', 'extends')) {
      superClass = { id: generateId(), type: 'Identifier', name: this.consume('IDENTIFIER').value };
    }

    this.consume('PUNCTUATION', '{');
    const body: (FieldDeclaration | Constructor | MethodDeclaration)[] = [];
    while (!this.check('PUNCTUATION', '}') && !this.isAtEnd()) {
      body.push(this.classBodyMember());
    }
    this.consume('PUNCTUATION', '}');
    this.currentClassName = prev;
    return { id: generateId(), type: 'ClassDeclaration', name, superClass, body };
  }

  private classBodyMember(): FieldDeclaration | Constructor | MethodDeclaration {
    const isStatic = this.match('KEYWORD', 'static');

    // constructor
    if (this.check('IDENTIFIER', 'constructor') && this.checkNext('PUNCTUATION', '(')) {
      this.advance(); // consume 'constructor'
      this.consume('PUNCTUATION', '(');
      const params = this.parseParameters();
      this.consume('PUNCTUATION', ')');
      const body = this.block();
      return { id: generateId(), type: 'Constructor', access: 'public', params, body };
    }

    // method or field
    const memberName = this.consume('IDENTIFIER').value;

    if (this.check('PUNCTUATION', '(')) {
      this.consume('PUNCTUATION', '(');
      const params = this.parseParameters();
      this.consume('PUNCTUATION', ')');
      const body = this.block();
      return {
        id: generateId(),
        type: 'MethodDeclaration',
        name: memberName,
        access: 'public',
        isStatic,
        returnType: 'auto',
        params,
        body,
      };
    }

    // field
    let initializer: Expression | undefined;
    if (this.match('OPERATOR', '=')) initializer = this.expression();
    this.match('PUNCTUATION', ';');
    return {
      id: generateId(),
      type: 'FieldDeclaration',
      name: memberName,
      fieldType: 'auto',
      isStatic,
      access: 'public',
      initializer,
      declaredWithoutInitializer: initializer === undefined,
    };
  }

  // ── Function declaration ─────────────────────────────────────────────────

  private functionDeclaration(): Statement {
    this.consume('KEYWORD', 'function');
    const name = this.consume('IDENTIFIER').value;
    this.consume('PUNCTUATION', '(');
    const params = this.parseParameters();
    this.consume('PUNCTUATION', ')');
    const body = this.block();
    return { id: generateId(), type: 'FunctionDeclaration', name, params, body };
  }

  private parseParameters(): Parameter[] {
    const params: Parameter[] = [];
    if (!this.check('PUNCTUATION', ')')) {
      do {
        // skip destructuring or rest params gracefully
        this.match('OPERATOR', '...');
        const paramName = this.check('IDENTIFIER') ? this.consume('IDENTIFIER').value : '_';
        params.push({
          id: generateId(),
          type: 'Parameter',
          name: paramName,
          paramType: 'auto',
        });
      } while (this.match('PUNCTUATION', ','));
    }
    return params;
  }

  // ── Block ────────────────────────────────────────────────────────────────

  private block(): Block {
    this.consume('PUNCTUATION', '{');
    const stmts: Statement[] = [];
    while (!this.check('PUNCTUATION', '}') && !this.isAtEnd()) {
      try {
        stmts.push(this.statement());
      } catch {
        while (
          !this.check('PUNCTUATION', '}', ';') &&
          !this.isAtEnd() &&
          !this.check('KEYWORD', 'if', 'else', 'while', 'for', 'return', 'break', 'continue')
        )
          this.advance();
        if (this.check('PUNCTUATION', ';')) this.advance();
        if (!this.check('PUNCTUATION', '}') && !this.isAtEnd()) continue;
        break;
      }
    }
    this.consume('PUNCTUATION', '}');
    return { id: generateId(), type: 'Block', body: stmts };
  }

  // ── Statements ───────────────────────────────────────────────────────────

  private statement(): Statement {
    const si = this.current;

    if (this.check('KEYWORD', 'if')) return this.withLoc(this.ifStatement(), si);
    if (this.check('KEYWORD', 'while')) return this.withLoc(this.whileStatement(), si);
    if (this.check('KEYWORD', 'do')) return this.withLoc(this.doWhileStatement(), si);
    if (this.check('KEYWORD', 'for')) return this.withLoc(this.forStatement(), si);
    if (this.check('KEYWORD', 'switch')) return this.withLoc(this.switchStatement(), si);
    if (this.check('KEYWORD', 'break')) return this.withLoc(this.breakStatement(), si);
    if (this.check('KEYWORD', 'continue')) return this.withLoc(this.continueStatement(), si);
    if (this.check('KEYWORD', 'return')) return this.withLoc(this.returnStatement(), si);
    if (this.check('KEYWORD', 'try')) return this.withLoc(this.tryStatement(), si);
    if (this.check('KEYWORD', 'throw')) return this.withLoc(this.throwStatement(), si);
    if (this.check('KEYWORD', 'function')) return this.functionDeclaration();
    if (this.check('KEYWORD', 'class')) return this.classDeclaration();

    // Variable declarations: let / const / var
    if (this.check('KEYWORD', 'let', 'const', 'var')) {
      return this.withLoc(this.variableDeclaration(), si);
    }

    // console.log(...) → Print
    if (this.check('IDENTIFIER', 'console') && this.checkNext('PUNCTUATION', '.')) {
      const saved = this.current;
      this.advance(); // console
      this.advance(); // .
      if (this.check('IDENTIFIER', 'log')) {
        this.advance(); // log
        this.consume('PUNCTUATION', '(');
        const args: Expression[] = [];
        if (!this.check('PUNCTUATION', ')')) {
          do {
            args.push(this.expression());
          } while (this.match('PUNCTUATION', ','));
        }
        this.consume('PUNCTUATION', ')');
        this.match('PUNCTUATION', ';');
        return this.withLoc({ id: generateId(), type: 'Print', expressions: args }, si);
      }
      // Not console.log — rewind and fall through
      this.current = saved;
    }

    // Expression statement (assignments, calls, etc.)
    const expr = this.expression();
    this.match('PUNCTUATION', ';');

    if ((expr as any).type === 'Assignment') return expr as any as Statement;

    return this.withLoc({ id: generateId(), type: 'ExpressionStatement', expression: expr }, si);
  }

  private variableDeclaration(): Statement {
    this.advance(); // consume let/const/var
    const name = this.consume('IDENTIFIER').value;
    if (this.match('OPERATOR', '=')) {
      const value = this.expression();
      this.match('PUNCTUATION', ';');
      return { id: generateId(), type: 'Assignment', name, value, varType: 'auto' };
    }
    this.match('PUNCTUATION', ';');
    return {
      id: generateId(),
      type: 'Assignment',
      name,
      value: { id: generateId(), type: 'Literal', value: undefined, raw: 'undefined' },
      varType: 'auto',
      declaredWithoutInitializer: true,
    };
  }

  private ifStatement(): If {
    this.consume('KEYWORD', 'if');
    this.consume('PUNCTUATION', '(');
    const condition = this.expression();
    this.consume('PUNCTUATION', ')');
    const thenBranch = this.blockOrStatement();
    let elseBranch: Block | undefined;
    if (this.match('KEYWORD', 'else')) {
      if (this.check('KEYWORD', 'if')) {
        elseBranch = { id: generateId(), type: 'Block', body: [this.ifStatement()] };
      } else {
        elseBranch = this.blockOrStatement();
      }
    }
    return { id: generateId(), type: 'If', condition, thenBranch, elseBranch };
  }

  private blockOrStatement(): Block {
    if (this.check('PUNCTUATION', '{')) return this.block();
    const stmt = this.statement();
    return { id: generateId(), type: 'Block', body: [stmt] };
  }

  private whileStatement(): While {
    this.consume('KEYWORD', 'while');
    this.consume('PUNCTUATION', '(');
    const condition = this.expression();
    this.consume('PUNCTUATION', ')');
    const body = this.blockOrStatement();
    return { id: generateId(), type: 'While', condition, body };
  }

  private doWhileStatement(): Statement {
    this.consume('KEYWORD', 'do');
    const body = this.blockOrStatement();
    this.consume('KEYWORD', 'while');
    this.consume('PUNCTUATION', '(');
    const condition = this.expression();
    this.consume('PUNCTUATION', ')');
    this.match('PUNCTUATION', ';');
    return { id: generateId(), type: 'DoWhile', body, condition };
  }

  private forStatement(): For | ForEach {
    this.consume('KEYWORD', 'for');
    this.consume('PUNCTUATION', '(');

    // for (let x of iterable) or for (let x in obj)
    if (this.check('KEYWORD', 'let', 'const', 'var')) {
      const saved = this.current;
      this.advance(); // consume let/const/var
      if (this.check('IDENTIFIER')) {
        const varName = this.consume('IDENTIFIER').value;
        if (this.match('KEYWORD', 'of', 'in')) {
          const iterable = this.expression();
          this.consume('PUNCTUATION', ')');
          const body = this.blockOrStatement();
          return { id: generateId(), type: 'ForEach', variable: varName, iterable, body };
        }
        // C-style: for (let i = 0; ...)
        this.consume('OPERATOR', '=');
        const initVal = this.expression();
        const init: Statement = {
          id: generateId(),
          type: 'Assignment',
          name: varName,
          value: initVal,
        };
        this.consume('PUNCTUATION', ';');
        const condition = this.check('PUNCTUATION', ';') ? undefined : this.expression();
        this.consume('PUNCTUATION', ';');
        let update: Statement | undefined;
        if (!this.check('PUNCTUATION', ')')) {
          const updateExpr = this.expression();
          update = { id: generateId(), type: 'ExpressionStatement', expression: updateExpr };
        }
        this.consume('PUNCTUATION', ')');
        const body = this.blockOrStatement();
        return {
          id: generateId(),
          type: 'For',
          body,
          init,
          condition,
          update,
        };
      }
      this.current = saved;
    }

    // Fallback: expression-based for loop
    let init: Statement | undefined;
    if (!this.check('PUNCTUATION', ';')) {
      const e = this.expression();
      init =
        (e as any).type === 'Assignment'
          ? (e as any)
          : { id: generateId(), type: 'ExpressionStatement', expression: e };
    }
    this.consume('PUNCTUATION', ';');
    const condition = this.check('PUNCTUATION', ';') ? undefined : this.expression();
    this.consume('PUNCTUATION', ';');
    let update: Statement | undefined;
    if (!this.check('PUNCTUATION', ')')) {
      const u = this.expression();
      update = { id: generateId(), type: 'ExpressionStatement', expression: u };
    }
    this.consume('PUNCTUATION', ')');
    const body = this.blockOrStatement();
    return {
      id: generateId(),
      type: 'For',
      body,
      init,
      condition,
      update,
    };
  }

  private switchStatement(): Statement {
    this.consume('KEYWORD', 'switch');
    this.consume('PUNCTUATION', '(');
    const discriminant = this.expression();
    this.consume('PUNCTUATION', ')');
    this.consume('PUNCTUATION', '{');
    const cases: any[] = [];
    while (!this.check('PUNCTUATION', '}') && !this.isAtEnd()) {
      if (this.match('KEYWORD', 'case')) {
        const test = this.expression();
        this.consume('PUNCTUATION', ':');
        const consequent: Statement[] = [];
        while (
          !this.check('KEYWORD', 'case', 'default') &&
          !this.check('PUNCTUATION', '}') &&
          !this.isAtEnd()
        ) {
          consequent.push(this.statement());
        }
        cases.push({ id: generateId(), type: 'SwitchCase', test, consequent });
      } else if (this.match('KEYWORD', 'default')) {
        this.consume('PUNCTUATION', ':');
        const consequent: Statement[] = [];
        while (
          !this.check('KEYWORD', 'case', 'default') &&
          !this.check('PUNCTUATION', '}') &&
          !this.isAtEnd()
        ) {
          consequent.push(this.statement());
        }
        cases.push({ id: generateId(), type: 'SwitchCase', consequent });
      } else {
        this.advance();
      }
    }
    this.consume('PUNCTUATION', '}');
    return { id: generateId(), type: 'Switch', discriminant, cases };
  }

  private breakStatement(): Statement {
    this.consume('KEYWORD', 'break');
    this.match('PUNCTUATION', ';');
    return { id: generateId(), type: 'Break' };
  }

  private continueStatement(): Statement {
    this.consume('KEYWORD', 'continue');
    this.match('PUNCTUATION', ';');
    return { id: generateId(), type: 'Continue' };
  }

  private returnStatement(): Return {
    this.consume('KEYWORD', 'return');
    let value: Expression | undefined;
    if (!this.check('PUNCTUATION', ';') && !this.check('PUNCTUATION', '}') && !this.isAtEnd()) {
      value = this.expression();
    }
    this.match('PUNCTUATION', ';');
    return { id: generateId(), type: 'Return', value };
  }

  private tryStatement(): Statement {
    this.consume('KEYWORD', 'try');
    const body = this.block();
    const handlers: any[] = [];
    while (this.match('KEYWORD', 'catch')) {
      let exceptionType: string | undefined;
      let varName: string | undefined;
      if (this.match('PUNCTUATION', '(')) {
        varName = this.consume('IDENTIFIER').value;
        this.consume('PUNCTUATION', ')');
      }
      const handlerBody = this.block();
      handlers.push({
        id: generateId(),
        type: 'ExceptionHandler',
        exceptionType,
        varName,
        body: handlerBody,
      });
    }
    let finallyBlock: Block | undefined;
    if (this.match('KEYWORD', 'finally')) finallyBlock = this.block();
    return { id: generateId(), type: 'Try', body, handlers, finallyBlock };
  }

  private throwStatement(): Statement {
    this.consume('KEYWORD', 'throw');
    const value = this.expression();
    this.match('PUNCTUATION', ';');
    // Represent as an expression statement wrapping a call to throw-like function
    return { id: generateId(), type: 'ExpressionStatement', expression: value };
  }

  // ── Expressions (Pratt-style) ─────────────────────────────────────────────

  private expression(): Expression {
    return this.assignment();
  }

  private assignment(): Expression {
    let left = this.ternary();

    if (this.check('OPERATOR', '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=')) {
      const operator = this.peek().value;
      this.advance();
      const right = this.assignment();

      if (operator === '=') {
        let name = '';
        if (left.type === 'Identifier') name = (left as Identifier).name;
        if (left.type === 'MemberExpression' || left.type === 'IndexExpression') {
          return {
            id: generateId(),
            type: 'Assignment',
            name: '',
            value: right,
            isMemberAssignment: true,
            memberExpr: left,
          } as any;
        }
        return { id: generateId(), type: 'Assignment', name, value: right } as any;
      }

      const opMap: Record<string, string> = {
        '+=': '+',
        '-=': '-',
        '*=': '*',
        '/=': '/',
        '%=': '%',
        '&=': '&',
        '|=': '|',
        '^=': '^',
      };
      const name = left.type === 'Identifier' ? (left as Identifier).name : '';
      return {
        id: generateId(),
        type: 'CompoundAssignment',
        name,
        operator: opMap[operator] ?? operator,
        left,
        right,
        value: right,
      } as any;
    }

    return left;
  }

  private ternary(): Expression {
    const expr = this.logicOr();
    if (this.match('PUNCTUATION', '?')) {
      const consequent = this.expression();
      this.consume('PUNCTUATION', ':');
      const alternate = this.ternary();
      return {
        id: generateId(),
        type: 'ConditionalExpression',
        test: expr,
        consequent,
        alternate,
      } as any;
    }
    return expr;
  }

  private logicOr(): Expression {
    let left = this.logicAnd();
    while (this.match('OPERATOR', '||', '??')) {
      const right = this.logicAnd();
      left = { id: generateId(), type: 'BinaryExpression', left, operator: 'or', right };
    }
    return left;
  }

  private logicAnd(): Expression {
    let left = this.equality();
    while (this.match('OPERATOR', '&&')) {
      const right = this.equality();
      left = { id: generateId(), type: 'BinaryExpression', left, operator: 'and', right };
    }
    return left;
  }

  private equality(): Expression {
    let left = this.comparison();
    while (this.match('OPERATOR', '==', '!=')) {
      const op = this.previous().value;
      left = {
        id: generateId(),
        type: 'BinaryExpression',
        left,
        operator: op,
        right: this.comparison(),
      };
    }
    return left;
  }

  private comparison(): Expression {
    let left = this.term();
    while (this.match('OPERATOR', '<', '>', '<=', '>=')) {
      const op = this.previous().value;
      left = { id: generateId(), type: 'BinaryExpression', left, operator: op, right: this.term() };
    }
    return left;
  }

  private term(): Expression {
    let left = this.factor();
    while (this.match('OPERATOR', '+', '-')) {
      const op = this.previous().value;
      left = {
        id: generateId(),
        type: 'BinaryExpression',
        left,
        operator: op,
        right: this.factor(),
      };
    }
    return left;
  }

  private factor(): Expression {
    let left = this.exponent();
    while (this.match('OPERATOR', '*', '/', '%')) {
      const op = this.previous().value;
      left = {
        id: generateId(),
        type: 'BinaryExpression',
        left,
        operator: op,
        right: this.exponent(),
      };
    }
    return left;
  }

  private exponent(): Expression {
    let left = this.unary();
    while (this.match('OPERATOR', '**')) {
      const right = this.unary();
      left = { id: generateId(), type: 'BinaryExpression', left, operator: '**', right };
    }
    return left;
  }

  private unary(): Expression {
    if (this.match('OPERATOR', '++', '--')) {
      const op = this.previous().value as '++' | '--';
      return {
        id: generateId(),
        type: 'UpdateExpression',
        operator: op,
        argument: this.unary(),
        prefix: true,
      };
    }
    if (this.match('OPERATOR', '!', '-', '~')) {
      const op = this.previous().value === '!' ? 'not' : this.previous().value;
      return { id: generateId(), type: 'UnaryExpression', operator: op, argument: this.unary() };
    }
    if (this.match('KEYWORD', 'new')) {
      const className = this.consume('IDENTIFIER').value;
      this.consume('PUNCTUATION', '(');
      const args: Expression[] = [];
      if (!this.check('PUNCTUATION', ')')) {
        do {
          args.push(this.expression());
        } while (this.match('PUNCTUATION', ','));
      }
      this.consume('PUNCTUATION', ')');
      return {
        id: generateId(),
        type: 'NewExpression',
        className,
        arguments: args,
      } as any;
    }
    if (this.match('KEYWORD', 'typeof')) {
      const arg = this.unary();
      return { id: generateId(), type: 'UnaryExpression', operator: 'typeof', argument: arg };
    }
    return this.postfix();
  }

  private postfix(): Expression {
    let expr = this.primary();

    while (true) {
      if (this.match('OPERATOR', '++', '--')) {
        const op = this.previous().value as '++' | '--';
        expr = {
          id: generateId(),
          type: 'UpdateExpression',
          operator: op,
          argument: expr,
          prefix: false,
        };
      } else if (this.match('PUNCTUATION', '[')) {
        const index = this.expression();
        this.consume('PUNCTUATION', ']');
        expr = { id: generateId(), type: 'IndexExpression', object: expr, index };
      } else if (this.match('PUNCTUATION', '.')) {
        const property = this.consume('IDENTIFIER').value;
        if (this.check('PUNCTUATION', '(')) {
          this.advance();
          const args: Expression[] = [];
          if (!this.check('PUNCTUATION', ')')) {
            do {
              args.push(this.expression());
            } while (this.match('PUNCTUATION', ','));
          }
          this.consume('PUNCTUATION', ')');
          expr = {
            id: generateId(),
            type: 'CallExpression',
            callee: {
              id: generateId(),
              type: 'MemberExpression',
              object: expr,
              property: { id: generateId(), type: 'Identifier', name: property },
              isMethod: true,
            },
            arguments: args,
          } as CallExpression;
        } else {
          expr = {
            id: generateId(),
            type: 'MemberExpression',
            object: expr,
            property: { id: generateId(), type: 'Identifier', name: property },
            isMethod: false,
          };
        }
      } else if (this.check('PUNCTUATION', '(') && expr.type === 'Identifier') {
        this.advance();
        const args: Expression[] = [];
        if (!this.check('PUNCTUATION', ')')) {
          do {
            args.push(this.expression());
          } while (this.match('PUNCTUATION', ','));
        }
        this.consume('PUNCTUATION', ')');
        expr = {
          id: generateId(),
          type: 'CallExpression',
          callee: expr as Identifier,
          arguments: args,
        };
      } else {
        break;
      }
    }
    return expr;
  }

  private primary(): Expression {
    if (this.match('NUMBER')) {
      const raw = this.previous().value;
      return { id: generateId(), type: 'Literal', value: parseFloat(raw), raw };
    }
    if (this.match('STRING')) {
      const v = this.previous().value;
      return { id: generateId(), type: 'Literal', value: v, raw: `"${v}"` };
    }
    if (this.match('BOOLEAN')) {
      const v = this.previous().value === 'true';
      return { id: generateId(), type: 'Literal', value: v, raw: String(v) };
    }
    if (this.match('KEYWORD', 'null')) {
      return { id: generateId(), type: 'Literal', value: null, raw: 'null' };
    }
    if (this.match('KEYWORD', 'undefined')) {
      return { id: generateId(), type: 'Literal', value: undefined, raw: 'undefined' };
    }
    if (this.match('KEYWORD', 'this')) {
      return { id: generateId(), type: 'ThisExpression' };
    }
    if (this.match('KEYWORD', 'super')) {
      return { id: generateId(), type: 'Identifier', name: 'super' };
    }
    if (this.match('IDENTIFIER')) {
      return { id: generateId(), type: 'Identifier', name: this.previous().value };
    }
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
    throw new Error(`Unexpected token: ${this.peek().value}`);
  }

  // ── Token helpers ─────────────────────────────────────────────────────────

  private withLoc<T extends Statement>(stmt: T, startIdx: number): T {
    if (startIdx >= 0 && startIdx < this.tokens.length && this.current > startIdx) {
      stmt.loc = {
        start: this.tokens[startIdx].start,
        end: this.tokens[this.current - 1].start + this.tokens[this.current - 1].value.length,
      };
    }
    return stmt;
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
    const t = this.peek();
    if (t.type !== type) return false;
    if (values.length > 0 && !values.includes(t.value)) return false;
    return true;
  }

  private checkNext(type: TokenType, value?: string): boolean {
    if (this.current + 1 >= this.tokens.length) return false;
    const t = this.tokens[this.current + 1];
    if (t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    return true;
  }

  private consume(type: TokenType, value?: string): Token {
    if (this.check(type, ...(value ? [value] : []))) return this.advance();
    const found = this.peek();
    throw new Error(`Expected ${type} ${value ?? ''} but got ${found.type} '${found.value}'`);
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
