/**
 * Python parser that converts Python tokens into an Abstract Syntax Tree (AST).
 * Implements Python-specific grammar including indentation-based blocks and tuple unpacking.
 */

import type { Token, TokenType } from '../lexer';
import {
  type Program,
  type Statement,
  type Block,
  type Expression,
  type If,
  type While,
  type ForEach,
  type Return,
  type CallExpression,
  type Identifier,
  type FunctionDeclaration,
  type ClassDeclaration,
  type FieldDeclaration,
  type Constructor,
  type MethodDeclaration,
  type Parameter,
  generateId,
  lvalueName,
} from '../ast';
import { attachComments } from '../comments';

/**
 * Thrown when the source uses a feature Praxly deliberately does not support
 * (e.g. Python's `for...else`/`while...else`). Unlike an ordinary syntax error,
 * this is NOT swallowed by `parse()`'s error recovery — it propagates so the
 * user gets a clear "not supported" message instead of silently-dropped code.
 */
export class UnsupportedFeatureError extends Error {}

export class Parser {
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
      while (this.match('PUNCTUATION', ';')) {} // Clear leading empty lines
      if (this.isAtEnd()) break;
      try {
        body.push(this.topLevelDeclaration());
      } catch (e) {
        // An unsupported-feature error is intentional and must reach the user —
        // don't recover from it.
        if (e instanceof UnsupportedFeatureError) throw e;
        // Error recovery: skip to next valid statement and continue
        this.synchronize();
        continue;
      }
    }
    const program: Program = { id: generateId(), type: 'Program', body };
    attachComments(program, (this.tokens as any).comments, (this.tokens as any).source ?? '');
    return program;
  }

  private topLevelDeclaration(): Statement {
    if (this.check('KEYWORD', 'class')) return this.classDeclaration();
    if (this.check('KEYWORD', 'def')) return this.functionDeclaration();
    return this.statement();
  }

  /**
   * Synchronize to the next statement by skipping tokens until we find
   * a keyword that likely starts a new statement
   */
  private synchronize(): void {
    this.advance();

    while (!this.isAtEnd()) {
      // Skip to next statement-starting keyword
      if (
        this.check(
          'KEYWORD',
          'if',
          'elif',
          'else',
          'while',
          'for',
          'def',
          'class',
          'return',
          'try',
          'except',
          'finally',
          'pass',
          'break',
          'continue'
        )
      ) {
        return;
      }
      // Also sync on semicolons or closing braces
      if (this.check('PUNCTUATION', ';', '}')) {
        this.advance();
        return;
      }
      this.advance();
    }
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
        const params = this.stripSelfParameter(fd.params);
        if (fd.name === '__init__') {
          body.push({
            id: generateId(),
            type: 'Constructor',
            access: 'public',
            params,
            body: fd.body,
          });
        } else {
          body.push({
            id: generateId(),
            type: 'MethodDeclaration',
            name: fd.name,
            access: 'public',
            isStatic: false,
            returnType: 'auto',
            params,
            body: fd.body,
          });
        }
      } else if (stmt.type === 'Assignment') {
        body.push({
          id: generateId(),
          type: 'FieldDeclaration',
          name: lvalueName(stmt) ?? 'unknown',
          fieldType: 'auto',
          isStatic: false,
          access: 'public',
          initializer: stmt.value,
        });
      }
    }
    return { id: generateId(), type: 'ClassDeclaration', name, superClass, body };
  }

  private stripSelfParameter(params: Parameter[]): Parameter[] {
    if (params.length === 0) return params;
    return params[0].name === 'self' ? params.slice(1) : params;
  }

  private functionDeclaration(): FunctionDeclaration {
    this.consume('KEYWORD', 'def');
    const name = this.consume('IDENTIFIER').value;
    this.consume('PUNCTUATION', '(');
    const params: Parameter[] = [];
    if (!this.check('PUNCTUATION', ')')) {
      do {
        const paramName = this.consume('IDENTIFIER').value;
        let paramType = 'auto';
        if (this.match('PUNCTUATION', ':')) {
          paramType = this.parseParameterTypeAnnotation();
        }
        params.push({
          id: generateId(),
          type: 'Parameter',
          name: paramName,
          paramType,
        });
      } while (this.match('PUNCTUATION', ','));
    }
    this.consume('PUNCTUATION', ')');
    const body = this.block();
    return { id: generateId(), type: 'FunctionDeclaration', name, params, body };
  }

  /**
   * Parses parameter type annotation.
   */
  private parseParameterTypeAnnotation(): string {
    const parts: string[] = [];
    let nestingDepth = 0;

    while (!this.isAtEnd()) {
      const token = this.peek();

      if (nestingDepth === 0) {
        if (token.type === 'PUNCTUATION' && (token.value === ',' || token.value === ')')) break;
        if (token.type === 'OPERATOR' && token.value === '=') break;
      }

      if (token.type === 'PUNCTUATION' && ['[', '(', '{'].includes(token.value)) {
        nestingDepth++;
      } else if (token.type === 'PUNCTUATION' && [']', ')', '}'].includes(token.value)) {
        nestingDepth = Math.max(0, nestingDepth - 1);
      }

      parts.push(token.value);
      this.advance();
    }

    const annotation = parts.join('').trim();
    return annotation || 'auto';
  }

  private block(): Block {
    while (this.match('PUNCTUATION', ';')) {} // Eat any virtual semicolons prior to brace start

    if (this.match('PUNCTUATION', '{')) {
      const statements: Statement[] = [];
      while (!this.check('PUNCTUATION', '}') && !this.isAtEnd()) {
        while (this.match('PUNCTUATION', ';')) {} // Clear line breaks
        if (this.check('PUNCTUATION', '}')) break;

        if (this.match('KEYWORD', 'pass')) {
          while (this.match('PUNCTUATION', ';')) {}
          continue;
        }

        // Handle function/method declarations inside blocks
        try {
          if (this.check('KEYWORD', 'def')) {
            statements.push(this.functionDeclaration());
          } else {
            statements.push(this.statement());
          }
        } catch (e) {
          // Error recovery: skip to next statement
          while (
            !this.check('PUNCTUATION', '}') &&
            !this.isAtEnd() &&
            !this.check(
              'KEYWORD',
              'if',
              'elif',
              'else',
              'while',
              'for',
              'def',
              'class',
              'return',
              'try',
              'except',
              'finally',
              'pass',
              'break',
              'continue'
            )
          ) {
            this.advance();
          }
          if (!this.check('PUNCTUATION', '}') && !this.isAtEnd()) continue;
          break;
        }
      }
      if (this.check('PUNCTUATION', '}')) this.consume('PUNCTUATION', '}');
      return { id: generateId(), type: 'Block', body: statements };
    } else {
      // Single statement block e.g., if x: return true
      if (this.match('KEYWORD', 'pass')) {
        while (this.match('PUNCTUATION', ';')) {}
        return { id: generateId(), type: 'Block', body: [] };
      }
      try {
        const stmt = this.statement();
        return { id: generateId(), type: 'Block', body: [stmt] };
      } catch (e) {
        // Return empty block on error
        return { id: generateId(), type: 'Block', body: [] };
      }
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
      while (this.match('PUNCTUATION', ';')) {}
      return this.withLocation(stmt, startIdx);
    }
    if (this.match('KEYWORD', 'continue')) {
      const stmt: Statement = { id: generateId(), type: 'Continue' };
      while (this.match('PUNCTUATION', ';')) {}
      return this.withLocation(stmt, startIdx);
    }

    if (this.check('IDENTIFIER', 'print') && this.checkNext('PUNCTUATION', '(')) {
      this.consume('IDENTIFIER');
      this.consume('PUNCTUATION', '(');
      const expressions: Expression[] = [];
      const print: any = { id: generateId(), type: 'Print', expressions };
      if (!this.check('PUNCTUATION', ')')) {
        do {
          // `sep=`/`end=` keyword arguments configure the Print node.
          if (
            this.check('IDENTIFIER', 'sep') ||
            (this.check('IDENTIFIER', 'end') && this.checkNext('OPERATOR', '='))
          ) {
            const kw = this.consume('IDENTIFIER').value;
            this.consume('OPERATOR', '=');
            const val = this.logicOr();
            const strVal = val.type === 'Literal' ? String((val as any).value) : '';
            if (kw === 'sep') print.separator = strVal;
            else {
              print.appendLineFeed = strVal === '\n';
              // A non-newline `end` (e.g. `end=" "`) is a terminator; the
              // interpreter renders a single-arg print's terminator via separator.
              if (strVal !== '\n') print.separator = strVal;
            }
          } else {
            expressions.push(this.logicOr());
          }
        } while (this.match('PUNCTUATION', ','));
      }
      this.consume('PUNCTUATION', ')');
      while (this.match('PUNCTUATION', ';')) {}
      return this.withLocation(print, startIdx);
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

      while (this.match('PUNCTUATION', ';')) {}

      // If there are chained assignments, create nested Assignment nodes
      if (targets.length > 1) {
        // x = y = z = 10 becomes: x = (y = (z = 10))
        let result: any = {
          id: generateId(),
          type: 'Assignment',
          target: targets[targets.length - 1],
          value,
        };
        for (let i = targets.length - 2; i >= 0; i--) {
          result = {
            id: generateId(),
            type: 'Assignment',
            target: targets[i],
            value: result,
          };
        }
        return this.withLocation(result, startIdx);
      }

      return this.withLocation(
        { id: generateId(), type: 'Assignment', target: expr, value },
        startIdx
      );
    }

    // Augmented assignments e.g., +=, -=, %=, //=
    if (this.match('OPERATOR', '+=', '-=', '*=', '/=', '%=', '//=')) {
      const op = this.previous().value.slice(0, -1); // strip '=' => '+','//', etc.
      const rVal = this.expression();

      const augmentedValue: Expression = {
        id: generateId(),
        type: 'BinaryExpression',
        left: expr,
        operator: op,
        right: rVal,
      };
      while (this.match('PUNCTUATION', ';')) {}
      return this.withLocation(
        {
          id: generateId(),
          type: 'Assignment',
          target: expr,
          value: augmentedValue,
        },
        startIdx
      );
    }

    // Annotated declaration, e.g. `later: int` (bare) or `later: int = 5`.
    // Bare form mirrors a Java `int later;` (declaredWithoutInitializer + a
    // type-default value) so the interpreter treats them identically.
    if (expr.type === 'Identifier' && this.check('PUNCTUATION', ':')) {
      this.consume('PUNCTUATION', ':');
      const typeName = this.consume('IDENTIFIER').value;
      let value: Expression;
      let declaredWithoutInitializer = false;
      if (this.match('OPERATOR', '=')) {
        value = this.expression();
      } else {
        value = this.defaultValueForType(typeName);
        declaredWithoutInitializer = true;
      }
      while (this.match('PUNCTUATION', ';')) {}
      return this.withLocation(
        {
          id: generateId(),
          type: 'Assignment',
          target: expr,
          value,
          varType: typeName,
          declaredWithoutInitializer,
        } as any,
        startIdx
      );
    }

    while (this.match('PUNCTUATION', ';')) {}
    return this.withLocation(
      { id: generateId(), type: 'ExpressionStatement', expression: expr },
      startIdx
    );
  }

  private defaultValueForType(typeName: string): Expression {
    const base = typeName.replace(/\[\]/g, '');
    if (['int', 'byte', 'short', 'long'].includes(base))
      return { id: generateId(), type: 'Literal', value: 0, raw: '0' };
    if (['double', 'float'].includes(base))
      return { id: generateId(), type: 'Literal', value: 0.0, raw: '0.0' };
    if (['boolean', 'bool'].includes(base))
      return { id: generateId(), type: 'Literal', value: false, raw: 'false' };
    if (['string', 'str'].includes(base))
      return { id: generateId(), type: 'Literal', value: '', raw: '""' };
    return { id: generateId(), type: 'Literal', value: null, raw: 'None' };
  }

  private ifStatement(): If {
    this.consume('KEYWORD', 'if');
    const condition = this.expression();
    const thenBranch = this.block();

    let elseBranch: Block | undefined = undefined;

    while (this.match('PUNCTUATION', ';')) {}
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

    while (this.match('PUNCTUATION', ';')) {}
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

    while (this.match('PUNCTUATION', ';')) {}
    if (this.check('KEYWORD', 'else')) {
      throw new UnsupportedFeatureError("'while ... else' is not supported");
    }

    return { id: generateId(), type: 'While', condition, body };
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
    while (this.match('PUNCTUATION', ';')) {}
    if (this.match('KEYWORD', 'finally')) {
      finallyBlock = this.block();
    }

    return { id: generateId(), type: 'Try', body: tryBlock, handlers, finallyBlock };
  }

  private forStatement(): ForEach {
    this.consume('KEYWORD', 'for');
    const variable = this.consume('IDENTIFIER').value;
    // Multiple loop targets (`for i, x in enumerate(...)`) are not supported —
    // no other Praxly target has destructuring loops.
    if (this.check('PUNCTUATION', ',')) {
      throw new UnsupportedFeatureError(
        'multiple loop variables (destructuring) are not supported'
      );
    }

    this.consume('KEYWORD', 'in');
    const iterable = this.expression();
    const body = this.block();

    while (this.match('PUNCTUATION', ';')) {}
    if (this.check('KEYWORD', 'else')) {
      throw new UnsupportedFeatureError("'for ... else' is not supported");
    }

    return {
      id: generateId(),
      type: 'ForEach',
      variable,
      iterable,
      body,
    };
  }

  private returnStatement(): Return {
    this.consume('KEYWORD', 'return');
    let value: Expression | undefined = undefined;
    if (!this.check('PUNCTUATION', ';') && !this.check('PUNCTUATION', '}') && !this.isAtEnd()) {
      value = this.expression();
    }
    while (this.match('PUNCTUATION', ';')) {}
    return { id: generateId(), type: 'Return', value };
  }

  // --- Expressions ---

  private expression(): Expression {
    const expr = this.logicOr();
    // Tuple expressions / tuple assignment (`a, b = 1, 2`) are not supported —
    // no other Praxly target has tuples. A top-level comma signals a tuple.
    if (
      this.check('PUNCTUATION', ',') &&
      !this.checkNext('PUNCTUATION', ';') &&
      !this.checkNext('PUNCTUATION', ')') &&
      !this.checkNext('PUNCTUATION', ']')
    ) {
      throw new UnsupportedFeatureError('tuple assignment / tuple expressions are not supported');
    }
    return expr;
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
    let left = this.exponent();
    while (this.match('OPERATOR', '*', '/', '%', '//')) {
      const operator = this.previous().value;
      const right = this.exponent();
      left = { id: generateId(), type: 'BinaryExpression', left, operator, right };
    }
    return left;
  }

  private exponent(): Expression {
    let left = this.unary();
    while (this.match('OPERATOR', '**')) {
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
      const operator = this.previous().value; // Capture the operator before recursive call
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
          isMethod: false,
        };
      } else if (this.match('PUNCTUATION', '[')) {
        // List slicing (`a[start:end:step]`) is not supported — no other Praxly
        // target has it. A `:` inside the subscript signals a slice.
        if (this.check('PUNCTUATION', ':')) {
          throw new UnsupportedFeatureError('list slicing is not supported');
        }
        const index = this.expression();
        if (this.check('PUNCTUATION', ':')) {
          throw new UnsupportedFeatureError('list slicing is not supported');
        }
        this.consume('PUNCTUATION', ']');
        expr = { id: generateId(), type: 'IndexExpression', object: expr, index };
      } else {
        break;
      }
    }
    return expr;
  }

  private finishCall(callee: Expression): CallExpression {
    const args: Expression[] = [];
    if (!this.check('PUNCTUATION', ')')) {
      do {
        args.push(this.logicOr());
      } while (this.match('PUNCTUATION', ','));
    }
    this.consume('PUNCTUATION', ')');

    if (callee.type === 'MemberExpression') {
      (callee as any).isMethod = true;
    }

    return { id: generateId(), type: 'CallExpression', callee: callee as any, arguments: args };
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

    if (this.match('KEYWORD', 'None'))
      return { id: generateId(), type: 'Literal', value: null, raw: 'None' };

    if (this.match('IDENTIFIER'))
      return { id: generateId(), type: 'Identifier', name: this.previous().value };

    if (this.match('PUNCTUATION', '[')) {
      // Check for empty list or list comprehension
      if (this.check('PUNCTUATION', ']')) {
        this.advance();
        return { id: generateId(), type: 'ArrayLiteral', elements: [] };
      }

      const firstExpr = this.logicOr();

      // List comprehensions (`[expr for var in iterable]`) are not supported —
      // no other Praxly target has them.
      if (this.check('KEYWORD', 'for')) {
        throw new UnsupportedFeatureError('list comprehensions are not supported');
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
