import type { Token, TokenType } from '../lexer';
import { type Program, type Statement, type Block, type Expression, type If, type While, type For, type Return, type CallExpression, type Identifier, type FunctionDeclaration, type ClassDeclaration, type FieldDeclaration, type Constructor, type MethodDeclaration, type Parameter, generateId } from '../ast';

export class Parser {
  private tokens: Token[];
  private current = 0;

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
        end: endToken.start + endToken.value.length
      };
    }
    return stmt;
  }

  parse(): Program {
    const body: Statement[] = [];
    while (!this.isAtEnd()) {
      while (this.match('PUNCTUATION', ';')) { } // Clear leading empty lines
      if (this.isAtEnd()) break;
      body.push(this.topLevelDeclaration());
    }
    return { id: generateId(), type: 'Program', body };
  }

  private topLevelDeclaration(): Statement {
    if (this.check('KEYWORD', 'class')) return this.classDeclaration();
    if (this.check('KEYWORD', 'def')) return this.functionDeclaration();
    return this.statement();
  }

  private classDeclaration(): ClassDeclaration {
    this.consume('KEYWORD', 'class');
    const name = this.consume('IDENTIFIER').value;
    let superClass: Identifier | undefined = undefined;

    if (this.match('PUNCTUATION', '(')) {
      superClass = { id: generateId(), type: 'Identifier', name: this.consume('IDENTIFIER').value };
      this.consume('PUNCTUATION', ')');
    }

    const body: (FieldDeclaration | Constructor | MethodDeclaration)[] = [];
    const blockBody = this.block().body;

    for (const stmt of blockBody) {
      if (stmt.type === 'FunctionDeclaration') {
        const fd = stmt as any as FunctionDeclaration;
        if (fd.name === '__init__') {
          body.push({ id: generateId(), type: 'Constructor', access: 'public', params: fd.params, body: fd.body });
        } else {
          body.push({ id: generateId(), type: 'MethodDeclaration', name: fd.name, access: 'public', isStatic: false, returnType: 'auto', params: fd.params, body: fd.body });
        }
      } else if (stmt.type === 'Assignment') {
        body.push({ id: generateId(), type: 'FieldDeclaration', name: stmt.name, fieldType: 'auto', isStatic: false, access: 'public', initializer: stmt.value });
      }
    }
    return { id: generateId(), type: 'ClassDeclaration', name, superClass, body };
  }

  private functionDeclaration(): FunctionDeclaration {
    this.consume('KEYWORD', 'def');
    const name = this.consume('IDENTIFIER').value;
    this.consume('PUNCTUATION', '(');
    const params: Parameter[] = [];
    if (!this.check('PUNCTUATION', ')')) {
      do {
        const paramName = this.consume('IDENTIFIER').value;
        let defaultValue: Expression | undefined = undefined;
        if (this.match('OPERATOR', '=')) {
          defaultValue = this.expression();
        }
        params.push({ id: generateId(), type: 'Parameter', name: paramName, paramType: 'auto', defaultValue });
      } while (this.match('PUNCTUATION', ','));
    }
    this.consume('PUNCTUATION', ')');
    const body = this.block();
    return { id: generateId(), type: 'FunctionDeclaration', name, params, body };
  }

  private block(): Block {
    while (this.match('PUNCTUATION', ';')) { } // Eat any virtual semicolons prior to brace start

    if (this.match('PUNCTUATION', '{')) {
      const statements: Statement[] = [];
      while (!this.check('PUNCTUATION', '}') && !this.isAtEnd()) {
        while (this.match('PUNCTUATION', ';')) { } // Clear line breaks
        if (this.check('PUNCTUATION', '}')) break;

        if (this.match('KEYWORD', 'pass')) {
          while (this.match('PUNCTUATION', ';')) { }
          continue;
        }
        
        // Handle function/method declarations inside blocks
        if (this.check('KEYWORD', 'def')) {
          statements.push(this.functionDeclaration());
        } else {
          statements.push(this.statement());
        }
      }
      this.consume('PUNCTUATION', '}');
      return { id: generateId(), type: 'Block', body: statements };
    } else {
      // Single statement block e.g., if x: return true
      if (this.match('KEYWORD', 'pass')) {
        while (this.match('PUNCTUATION', ';')) { }
        return { id: generateId(), type: 'Block', body: [] };
      }
      const stmt = this.statement();
      return { id: generateId(), type: 'Block', body: [stmt] };
    }
  }

  private statement(): Statement {
    const startIdx = this.current;
    
    if (this.check('KEYWORD', 'if')) return this.withLocation(this.ifStatement(), startIdx);
    if (this.check('KEYWORD', 'while')) return this.withLocation(this.whileStatement(), startIdx);
    if (this.check('KEYWORD', 'for')) return this.withLocation(this.forStatement(), startIdx);
    if (this.check('KEYWORD', 'try')) return this.withLocation(this.tryStatement(), startIdx);
    if (this.check('KEYWORD', 'return')) return this.withLocation(this.returnStatement(), startIdx);
    if (this.match('KEYWORD', 'break')) {
      const stmt: Statement = { id: generateId(), type: 'Break' };
      while (this.match('PUNCTUATION', ';')) { }
      return this.withLocation(stmt, startIdx);
    }
    if (this.match('KEYWORD', 'continue')) {
      const stmt: Statement = { id: generateId(), type: 'Continue' };
      while (this.match('PUNCTUATION', ';')) { }
      return this.withLocation(stmt, startIdx);
    }

    if (this.check('IDENTIFIER', 'print') && this.checkNext('PUNCTUATION', '(')) {
      this.consume('IDENTIFIER');
      this.consume('PUNCTUATION', '(');
      const expressions: Expression[] = [];
      if (!this.check('PUNCTUATION', ')')) {
        do { expressions.push(this.expression()); } while (this.match('PUNCTUATION', ','));
      }
      this.consume('PUNCTUATION', ')');
      while (this.match('PUNCTUATION', ';')) { }
      return this.withLocation({ id: generateId(), type: 'Print', expressions }, startIdx);
    }

    const expr = this.expression();

    if (this.match('OPERATOR', '=')) {
      // For chained assignment: x = y = z = 10
      // We need to collect all targets
      const targets: Expression[] = [expr];
      
      // Check if the right side is another assignment (or could be)
      let rightExpr = this.expression();
      
      // Handle chained assignments: collect all intermediate targets
      while (this.check('OPERATOR', '=')) {
        // rightExpr is actually another target, collect it
        targets.push(rightExpr);
        this.consume('OPERATOR', '=');
        rightExpr = this.expression();
      }
      
      // Now rightExpr is the final value
      const value = rightExpr;
      
      // For emissions, use the first target as the main one
      let nameStr = 'unknown';
      if (expr.type === 'Identifier') nameStr = (expr as Identifier).name;
      else if (expr.type === 'MemberExpression') nameStr = (expr.property as Identifier).name;

      while (this.match('PUNCTUATION', ';')) { }
      
      // If there are chained assignments, create nested Assignment nodes
      if (targets.length > 1) {
        // x = y = z = 10 becomes: x = (y = (z = 10))
        let result: any = { id: generateId(), type: 'Assignment', name: 'z', target: targets[targets.length - 1], value };
        for (let i = targets.length - 2; i >= 0; i--) {
          const target = targets[i];
          let targetName = 'unknown';
          if (target.type === 'Identifier') targetName = (target as Identifier).name;
          else if (target.type === 'MemberExpression') targetName = (target.property as Identifier).name;
          result = { id: generateId(), type: 'Assignment', name: targetName, target, value: result };
        }
        return this.withLocation(result, startIdx);
      }
      
      return this.withLocation({ id: generateId(), type: 'Assignment', name: nameStr, target: expr, value }, startIdx);
    }

    // Augmented assignments e.g., +=, -=
    if (this.match('OPERATOR', '+=', '-=', '*=', '/=')) {
      const op = this.previous().value.charAt(0); // Extract '+', '-', etc.
      const rVal = this.expression();
      let nameStr = 'unknown';
      if (expr.type === 'Identifier') nameStr = (expr as Identifier).name;

      const augmentedValue: Expression = {
        id: generateId(), type: 'BinaryExpression', left: expr, operator: op, right: rVal
      };
      while (this.match('PUNCTUATION', ';')) { }
      return this.withLocation({ id: generateId(), type: 'Assignment', name: nameStr, target: expr, value: augmentedValue }, startIdx);
    }

    while (this.match('PUNCTUATION', ';')) { }
    return this.withLocation({ id: generateId(), type: 'ExpressionStatement', expression: expr }, startIdx);
  }

  private ifStatement(): If {
    this.consume('KEYWORD', 'if');
    const condition = this.expression();
    const thenBranch = this.block();

    let elseBranch: Block | undefined = undefined;

    while (this.match('PUNCTUATION', ';')) { }
    if (this.match('KEYWORD', 'elif')) {
      const elifIf = this.ifStatementElif();
      elseBranch = { id: generateId(), type: 'Block', body: [elifIf] };
    } else if (this.match('KEYWORD', 'else')) {
      elseBranch = this.block();
    }
    return { id: generateId(), type: 'If', condition, thenBranch, elseBranch };
  }

  private ifStatementElif(): If {
    const condition = this.expression();
    const thenBranch = this.block();

    let elseBranch: Block | undefined = undefined;

    while (this.match('PUNCTUATION', ';')) { }
    if (this.match('KEYWORD', 'elif')) {
      const elifIf = this.ifStatementElif();
      elseBranch = { id: generateId(), type: 'Block', body: [elifIf] };
    } else if (this.match('KEYWORD', 'else')) {
      elseBranch = this.block();
    }
    return { id: generateId(), type: 'If', condition, thenBranch, elseBranch };
  }

  private whileStatement(): While {
    this.consume('KEYWORD', 'while');
    const condition = this.expression();
    const body = this.block();
    
    let elseBranch: Block | undefined = undefined;
    while (this.match('PUNCTUATION', ';')) { }
    if (this.match('KEYWORD', 'else')) {
      elseBranch = this.block();
    }
    
    return { id: generateId(), type: 'While', condition, body, elseBranch };
  }

  private tryStatement(): any {
    this.consume('KEYWORD', 'try');
    const tryBlock = this.block();
    
    const handlers: any[] = [];
    while (this.match('KEYWORD', 'except')) {
      let exceptionType: string | undefined = undefined;
      let varName: string | undefined = undefined;
      
      if (!this.check('PUNCTUATION', ':')) {
        exceptionType = this.consume('IDENTIFIER').value;
        if (this.match('KEYWORD', 'as')) {
          varName = this.consume('IDENTIFIER').value;
        }
      }
      
      const handlerBody = this.block();
      handlers.push({ type: 'ExceptionHandler', exceptionType, varName, body: handlerBody });
    }
    
    let finallyBlock: Block | undefined = undefined;
    while (this.match('PUNCTUATION', ';')) { }
    if (this.match('KEYWORD', 'finally')) {
      finallyBlock = this.block();
    }
    
    return { id: generateId(), type: 'Try', body: tryBlock, handlers, finallyBlock };
  }

  private forStatement(): For {
    this.consume('KEYWORD', 'for');
    const vars: string[] = [];
    do {
      vars.push(this.consume('IDENTIFIER').value);
    } while (this.match('PUNCTUATION', ','));

    this.consume('KEYWORD', 'in');
    const iterable = this.expression();
    const body = this.block();

    let elseBranch: Block | undefined = undefined;
    while (this.match('PUNCTUATION', ';')) { }
    if (this.match('KEYWORD', 'else')) {
      elseBranch = this.block();
    }

    return {
      id: generateId(), type: 'For',
      variable: vars[0], variables: vars.length > 1 ? vars : undefined,
      iterable, body, elseBranch
    };
  }

  private returnStatement(): Return {
    this.consume('KEYWORD', 'return');
    let value: Expression | undefined = undefined;
    if (!this.check('PUNCTUATION', ';') && !this.check('PUNCTUATION', '}') && !this.isAtEnd()) {
      value = this.expression();
    }
    while (this.match('PUNCTUATION', ';')) { }
    return { id: generateId(), type: 'Return', value };
  }

  // --- Expressions ---

  private expression(): Expression {
    // Handle tuple/sequence (comma-separated expressions)
    const first = this.logicOr();
    if (this.check('PUNCTUATION', ',') && !this.checkNext('PUNCTUATION', ';') && !this.checkNext('PUNCTUATION', ')') && !this.checkNext('PUNCTUATION', ']')) {
      const elements: Expression[] = [first];
      while (this.match('PUNCTUATION', ',')) {
        // Stop if we hit end of tuple (semicolon, paren, etc)
        if (this.check('PUNCTUATION', ';') || this.check('PUNCTUATION', ')') || this.check('PUNCTUATION', ']') || this.isAtEnd()) {
          break;
        }
        elements.push(this.logicOr());
      }
      if (elements.length > 1) {
        return { id: generateId(), type: 'ArrayLiteral', elements } as any;
      }
    }
    return first;
  }

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
    while (this.match('OPERATOR', '*', '/', '%')) {
      const operator = this.previous().value;
      const right = this.unary();
      left = { id: generateId(), type: 'BinaryExpression', left, operator, right };
    }
    return left;
  }

  private unary(): Expression {
    if (this.match('KEYWORD', 'not')) {
      const right = this.unary();
      return { id: generateId(), type: 'UnaryExpression', operator: 'not', argument: right };
    }
    if (this.match('OPERATOR', '-', '+')) {
      const right = this.unary();
      return { id: generateId(), type: 'UnaryExpression', operator: this.previous().value, argument: right };
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
        expr = { id: generateId(), type: 'MemberExpression', object: expr, property: { id: generateId(), type: 'Identifier', name }, isMethod: false };
      } else if (this.match('PUNCTUATION', '[')) {
        let index: Expression | undefined = undefined;
        let indexEnd: Expression | undefined = undefined;
        let indexStep: Expression | undefined = undefined;

        if (!this.check('PUNCTUATION', ':')) {
          index = this.expression();
        } else {
          // Implied slice zero bound (e.g. [:3])
          index = { id: generateId(), type: 'Literal', value: 0, raw: '0' };
        }

        if (this.match('PUNCTUATION', ':')) {
          if (!this.check('PUNCTUATION', ':') && !this.check('PUNCTUATION', ']')) {
            indexEnd = this.expression();
          }
          if (this.match('PUNCTUATION', ':')) {
            if (!this.check('PUNCTUATION', ']')) {
              indexStep = this.expression();
            }
          }
          this.consume('PUNCTUATION', ']');
          expr = { id: generateId(), type: 'IndexExpression', object: expr, index, indexEnd, indexStep };
        } else {
          this.consume('PUNCTUATION', ']');
          expr = { id: generateId(), type: 'IndexExpression', object: expr, index };
        }
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

    if (callee.type === 'MemberExpression') { (callee as any).isMethod = true; }

    return { id: generateId(), type: 'CallExpression', callee: callee as any, arguments: args };
  }

  private primary(): Expression {
    if (this.match('NUMBER')) return { id: generateId(), type: 'Literal', value: parseFloat(this.previous().value), raw: this.previous().value };
    if (this.match('STRING')) return { id: generateId(), type: 'Literal', value: this.previous().value, raw: `"${this.previous().value}"` };
    if (this.match('BOOLEAN')) return { id: generateId(), type: 'Literal', value: this.previous().value === 'true', raw: this.previous().value };

    if (this.match('KEYWORD', 'None')) return { id: generateId(), type: 'Literal', value: null, raw: 'None' };

    if (this.match('IDENTIFIER')) return { id: generateId(), type: 'Identifier', name: this.previous().value };

    if (this.match('PUNCTUATION', '[')) {
      // Check for empty list or list comprehension
      if (this.check('PUNCTUATION', ']')) {
        this.advance();
        return { id: generateId(), type: 'ArrayLiteral', elements: [] };
      }
      
      const firstExpr = this.logicOr();
      
      // Check for list comprehension: [expr for var in iterable]
      if (this.check('KEYWORD', 'for')) {
        this.advance(); // consume 'for'
        const varName = this.consume('IDENTIFIER').value;
        this.consume('KEYWORD', 'in');
        const iterable = this.logicOr();
        this.consume('PUNCTUATION', ']');
        return { id: generateId(), type: 'ListComprehension', element: firstExpr, variable: varName, iterable } as any;
      }
      
      // Regular list literal
      const elements: Expression[] = [firstExpr];
      while (this.match('PUNCTUATION', ',')) {
        if (this.check('PUNCTUATION', ']')) break;
        elements.push(this.logicOr());
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
    if (this.check(type, ...values)) { this.advance(); return true; }
    return false;
  }
  private check(type: TokenType, ...values: string[]): boolean {
    if (this.isAtEnd()) return false;
    const token = this.peek();
    if (token.type !== type) return false;
    if (values.length > 0 && !values.includes(token.value)) return false;
    return true;
  }
  private checkNext(type: TokenType, value?: string): boolean {
    if (this.current + 1 >= this.tokens.length) return false;
    const token = this.tokens[this.current + 1];
    if (token.type !== type) return false;
    if (value && token.value !== value) return false;
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
