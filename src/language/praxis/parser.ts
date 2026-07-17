/**
 * Praxis parser that converts Praxis tokens into an Abstract Syntax Tree (AST).
 * Implements Praxis-specific grammar including type declarations and procedural function syntax.
 */

import type { Token, TokenType } from '../lexer';
import {
  type Program,
  type Statement,
  type Block,
  type Expression,
  type If,
  type While,
  type DoWhile,
  type RepeatUntil,
  type Return,
  type CallExpression,
  type Identifier,
  type FunctionDeclaration,
  type ClassDeclaration,
  generateId,
  makeIdentifier,
  lvalueName,
} from '../ast';
import { attachComments, insertBlankLines } from '../comments';

/**
 * Thrown when a required `(`/`)` is missing around an `if`/`while`/`do-while`/
 * `repeat-until`/`for` header. Unlike an ordinary syntax error, this is NOT
 * swallowed by `parse()`'s error recovery — it propagates so the user sees a
 * real syntax error on Run, matching how Python's `UnsupportedFeatureError`
 * and Java's `JavaEntryPointError` bypass recovery for their own hard errors.
 */
export class PraxisSyntaxError extends Error {}

export class PraxisParser {
  private tokens: Token[];
  private current = 0;
  private sourceCode: string;
  // Comments the parser claimed as print separator/newline metadata, so the
  // comment-attachment pass doesn't also emit them as ordinary comments.
  private consumedComments = new Set<number>();

  /**
   * Creates a new instance. Source text (for print-metadata comment extraction)
   * comes from the token stream the lexer produced, so the signature matches the
   * other parsers.
   */
  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.sourceCode = (tokens as any).source ?? '';
  }

  /**
   * Helper to attach location info to a statement based on current position
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
        // A missing required header paren is a genuine syntax error and must
        // reach the user — don't recover from it.
        if (e instanceof PraxisSyntaxError) throw e;
        // Error recovery: skip to next valid statement
        this.synchronize();
        continue;
      }
    }
    const program: Program = { id: generateId(), type: 'Program', body };
    attachComments(program, (this.tokens as any).comments, this.sourceCode, this.consumedComments);
    insertBlankLines(
      program,
      (this.tokens as any).comments,
      this.sourceCode,
      this.consumedComments
    );
    return program;
  }

  private topLevelDeclaration(): Statement {
    // A class may carry an optional `public`/`private` modifier: `public class C`.
    if (
      this.check('KEYWORD', 'class') ||
      ((this.check('KEYWORD', 'public') || this.check('KEYWORD', 'private')) &&
        this.checkPeekAhead('KEYWORD', 'class', 1))
    ) {
      return this.classDeclaration();
    }
    if (this.isFunctionDeclaration()) {
      return this.functionDeclaration();
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
      if (
        this.check(
          'KEYWORD',
          'class',
          'function',
          'if',
          'else',
          'while',
          'for',
          'return',
          'try',
          'catch',
          'finally'
        )
      ) {
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

  private classDeclaration(): ClassDeclaration {
    this.match('KEYWORD', 'public') || this.match('KEYWORD', 'private'); // optional modifier
    this.consume('KEYWORD', 'class');
    const name = this.consume('IDENTIFIER').value;
    let superClass: Identifier | undefined = undefined;
    if (this.match('KEYWORD', 'extends')) {
      superClass = { id: generateId(), type: 'Identifier', name: this.consume('IDENTIFIER').value };
    }

    const classBody: any[] = [];
    while (!this.check('KEYWORD', 'end') && !this.isAtEnd()) {
      // Consume optional access modifier before each member
      let access: 'public' | 'private' = 'public';
      if (this.match('KEYWORD', 'public')) access = 'public';
      else if (this.match('KEYWORD', 'private')) access = 'private';

      // A constructor is named after the class with no return type, i.e. the
      // class name immediately followed by `(`.
      if (this.check('IDENTIFIER', name) && this.checkPeekAhead('PUNCTUATION', '(', 1)) {
        classBody.push(this.constructorDeclaration(access, name));
      } else if (this.isFunctionDeclaration()) {
        const func = this.functionDeclaration();
        classBody.push({
          id: generateId(),
          type: 'MethodDeclaration',
          name: func.name,
          access,
          isStatic: false,
          returnType: (func as any).returnType,
          params: func.params,
          body: func.body,
        });
      } else {
        const stmt = this.statement();
        if (stmt.type === 'Assignment') {
          classBody.push({
            id: generateId(),
            type: 'FieldDeclaration',
            name: lvalueName(stmt) ?? 'unknown',
            fieldType: (stmt as any).varType || 'auto',
            isStatic: false,
            access,
            initializer: (stmt as any).value,
            declaredWithoutInitializer: (stmt as any).declaredWithoutInitializer,
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
    // A void procedure is introduced by the `procedure` keyword.
    if (this.check('KEYWORD', 'procedure')) {
      return (
        this.checkPeekAhead('IDENTIFIER', undefined, 1) &&
        this.checkPeekAhead('PUNCTUATION', '(', 2)
      );
    }
    // Check for return type declarations
    if (!this.isTypeStart() && !this.check('KEYWORD', 'void')) return false;
    let offset = 1;
    while (this.checkPeekAhead('PUNCTUATION', '[', offset)) {
      offset++;
      if (this.checkPeekAhead('PUNCTUATION', ']', offset)) offset++;
    }
    if (
      this.checkPeekAhead('IDENTIFIER', undefined, offset) &&
      this.checkPeekAhead('PUNCTUATION', '(', offset + 1)
    ) {
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
        while (
          this.current + offset < this.tokens.length &&
          !this.checkPeekAhead('PUNCTUATION', ']', offset)
        )
          offset++;
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
    } else if (this.check('KEYWORD', 'procedure')) {
      this.advance();
      returnType = 'void';
    }

    const name = this.consume('IDENTIFIER').value;
    const params = this.parseParamList();

    const body = this.block();

    this.consume('KEYWORD', 'end');
    this.match('IDENTIFIER', name); // Practice 'end procedureName' structure

    return { id: generateId(), type: 'FunctionDeclaration', name, params, body, returnType } as any;
  }

  /** Parses a parenthesized `(Type? name, ...)` parameter list, consuming the parens. */
  private parseParamList(): any[] {
    this.consume('PUNCTUATION', '(');
    const params: any[] = [];
    if (!this.check('PUNCTUATION', ')')) {
      do {
        let paramType = 'auto';
        // A type precedes the name only when it's a type keyword, or a custom
        // class name (an identifier immediately followed by another identifier).
        // A lone identifier before `,`/`)` is a bare, untyped parameter name.
        if (this.isTypeStart() || (this.check('IDENTIFIER') && this.checkPeekAhead('IDENTIFIER'))) {
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
    return params;
  }

  /** Parses `[modifier] ClassName(...) ... end ClassName` as a Constructor. */
  private constructorDeclaration(access: 'public' | 'private', className: string): any {
    this.consume('IDENTIFIER'); // the class name
    const params = this.parseParamList();
    const body = this.block();
    this.consume('KEYWORD', 'end');
    this.match('IDENTIFIER', className); // optional `end ClassName`
    return { id: generateId(), type: 'Constructor', access, params, body };
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

    const hasInitializer = this.match('OPERATOR', '<-') || this.match('OPERATOR', '=');

    // Provide type-appropriate defaults for uninitialized variables
    let value: Expression;
    if (hasInitializer) {
      value = this.expression();
    } else {
      // Default initialization based on type
      const baseType = typeName.replace(/\[\]/g, ''); // Remove array brackets to get base type
      if (['int', 'byte', 'short', 'long', 'float', 'double'].includes(baseType)) {
        value = { id: generateId(), type: 'Literal', value: 0, raw: '0' };
      } else if (baseType === 'boolean') {
        value = { id: generateId(), type: 'Literal', value: false, raw: 'false' };
      } else {
        // String, custom classes, and other types default to null
        value = { id: generateId(), type: 'Literal', value: null, raw: 'null' };
      }
    }

    // Include varType to lock down specific custom class typings into translator
    return {
      id: generateId(),
      type: 'Assignment',
      target: makeIdentifier(name),
      value,
      varType: typeName,
      declaredWithoutInitializer: !hasInitializer,
    } as any;
  }

  private statement(): Statement {
    const startIdx = this.current;
    let stmt: Statement;

    if (this.check('KEYWORD', 'print')) stmt = this.printStatement();
    else if (this.check('KEYWORD', 'if')) stmt = this.ifStatement();
    else if (this.check('KEYWORD', 'while')) stmt = this.whileStatement();
    else if (this.check('KEYWORD', 'do')) stmt = this.doWhileStatement();
    else if (this.check('KEYWORD', 'repeat')) stmt = this.repeatUntilStatement();
    else if (this.check('KEYWORD', 'for')) stmt = this.forStatement();
    else if (this.check('KEYWORD', 'return')) stmt = this.returnStatement();
    else if (this.check('KEYWORD', 'break')) {
      this.advance();
      stmt = { id: generateId(), type: 'Break' } as any;
    } else if (this.check('KEYWORD', 'continue')) {
      this.advance();
      stmt = { id: generateId(), type: 'Continue' } as any;
    } else if (this.check('KEYWORD', 'try')) stmt = this.tryStatement();
    // Check for 'Type Identifier <- value'
    else if (this.isVariableDeclaration()) {
      stmt = this.variableDeclaration();
    } else {
      // Generic Expression Evaluation or Assignment
      const expr = this.expression();
      if (this.match('OPERATOR', '<-') || this.match('OPERATOR', '=')) {
        const value = this.expression();

        if (
          expr.type === 'Identifier' ||
          expr.type === 'MemberExpression' ||
          expr.type === 'IndexExpression'
        ) {
          // `expr` is the lvalue: a plain variable, or a member/index target.
          stmt = { id: generateId(), type: 'Assignment', target: expr, value };
        } else {
          stmt = { id: generateId(), type: 'ExpressionStatement', expression: expr };
        }
      } else {
        stmt = { id: generateId(), type: 'ExpressionStatement', expression: expr };
      }
    }

    // Optional semicolons are accepted as statement terminators.
    this.match('PUNCTUATION', ';');

    return this.withLocation(stmt, startIdx);
  }

  private block(breakTokens: string[] = ['end', 'else', 'until']): Block {
    const statements: Statement[] = [];
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (token.type === 'KEYWORD' && breakTokens.includes(token.value.toLowerCase())) {
        break;
      }
      try {
        statements.push(this.statement());
      } catch (e) {
        // Error recovery: skip to next statement
        while (!this.isAtEnd()) {
          const t = this.peek();
          if (
            t.type === 'KEYWORD' &&
            (breakTokens.includes(t.value.toLowerCase()) ||
              ['if', 'while', 'for', 'function', 'class', 'return'].includes(t.value.toLowerCase()))
          ) {
            break;
          }
          if (t.type === 'PUNCTUATION' && ['}', ';'].includes(t.value)) {
            this.advance();
            break;
          }
          this.advance();
        }
        if (this.isAtEnd()) break;
      }
    }
    return { id: generateId(), type: 'Block', body: statements };
  }

  /**
   * Runs print statement.
   * Supports Texas dialect: print arg | print(arg) | print(arg1, arg2, ...)
   */
  private printStatement(): Statement {
    const printToken = this.consume('KEYWORD', 'print');
    const expressions: Expression[] = [];

    const savedPos = this.current;
    if (this.match('PUNCTUATION', '(')) {
      // Parenthesized form: print(arg1, arg2, ...)
      if (!this.check('PUNCTUATION', ')')) {
        do {
          expressions.push(this.expression());
        } while (this.match('PUNCTUATION', ','));
      }
      this.consume('PUNCTUATION', ')');

      // If the closing ) is immediately followed by a binary/logical operator,
      // the ( was part of a larger expression, not a function-call arg list.
      // Back up and re-parse the whole thing as a bare expression.
      if (expressions.length === 1) {
        const next = this.peek();
        const isBinaryOp =
          next &&
          ((next.type === 'KEYWORD' && (next.value === 'and' || next.value === 'or')) ||
            (next.type === 'OPERATOR' &&
              ['+', '-', '*', '/', '%', '**', '^', '==', '!=', '<', '>', '<=', '>='].includes(
                next.value
              )));
        if (isBinaryOp) {
          this.current = savedPos;
          expressions.length = 0;
          expressions.push(this.expression());
        }
      }
    } else {
      // Bare form: print expr
      expressions.push(this.expression());
    }

    const stmt: any = { id: generateId(), type: 'Print', expressions };
    const trailing = this.extractTrailingLineComment(printToken.start);
    if (trailing) {
      const metadata = this.parsePrintCommentMetadata(trailing.text);
      let consumed = false;
      if (metadata.separator !== undefined) {
        stmt.separator = metadata.separator;
        consumed = true;
      }
      if (metadata.appendLineFeed !== undefined) {
        stmt.appendLineFeed = metadata.appendLineFeed;
        consumed = true;
      }
      // Metadata comments are regenerated from the fields on emit, so mark them
      // consumed to keep the comment-attachment pass from duplicating them.
      if (consumed) this.consumedComments.add(trailing.start);
    }

    return stmt;
  }

  private extractTrailingLineComment(
    lineStartPos: number
  ): { text: string; start: number } | undefined {
    if (!this.sourceCode) return undefined;

    const lineEndPos = this.sourceCode.indexOf('\n', lineStartPos);
    const safeLineEnd = lineEndPos === -1 ? this.sourceCode.length : lineEndPos;
    const lineText = this.sourceCode.slice(lineStartPos, safeLineEnd);
    const commentStart = this.findSingleLineCommentStart(lineText);

    if (commentStart === -1) return undefined;
    return { text: lineText.slice(commentStart + 2).trim(), start: lineStartPos + commentStart };
  }

  private findSingleLineCommentStart(lineText: string): number {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;

    for (let i = 0; i < lineText.length - 1; i++) {
      const ch = lineText[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === '\\') {
        escaped = true;
        continue;
      }

      if (ch === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        continue;
      }

      if (ch === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }

      if (!inSingleQuote && !inDoubleQuote && ch === '/' && lineText[i + 1] === '/') {
        return i;
      }
    }

    return -1;
  }

  /**
   * Parses print comment metadata.
   */
  private parsePrintCommentMetadata(comment: string): {
    separator?: string;
    appendLineFeed?: boolean;
  } {
    const normalized = comment.toLowerCase();
    const metadata: { separator?: string; appendLineFeed?: boolean } = {};

    if (/(\bno\b|\bwithout\b)\s+(separator|space|blank)/.test(normalized)) {
      metadata.separator = '';
    }

    const mentionsBlank = /\b(space|blank)\b/.test(normalized);
    const indicatesAppend = /\b(append|appended|after|trailing)\b/.test(normalized);
    if (mentionsBlank && indicatesAppend && metadata.separator === undefined) {
      metadata.separator = ' ';
    }

    if (/(\bno\b|\bwithout\b)\s+(line\s*feed|new\s*line|newline)/.test(normalized)) {
      metadata.appendLineFeed = false;
    } else if (/(line\s*feed|new\s*line|newline)/.test(normalized)) {
      metadata.appendLineFeed = true;
    } else if (mentionsBlank && indicatesAppend) {
      // "print a space after ..." means keep output on the same line.
      metadata.appendLineFeed = false;
    }

    return metadata;
  }

  private ifStatement(): If {
    // A whole `if ... else if ... else ... end if` chain has a single `end if`;
    // ifBody() parses the (possibly recursive) structure without consuming it.
    const node = this.ifBody();
    this.consume('KEYWORD', 'end');
    this.consume('KEYWORD', 'if');
    return node;
  }

  // Parses `if (cond) then [else if ... | else ...]` WITHOUT the trailing
  // `end if`. `else if` recurses, nesting a fresh If inside the else block, so
  // the chain is modeled as nested If nodes (there is no dedicated ElseIf node).
  private ifBody(): If {
    this.consume('KEYWORD', 'if');
    this.consumeHeaderParen('(');
    const condition = this.expression();
    this.consumeHeaderParen(')');

    const thenBranch = this.block();
    let elseBranch: Block | undefined = undefined;

    if (this.match('KEYWORD', 'else')) {
      const elseTok = this.previous();
      // `else if` on the SAME line is an else-if chain (recurse; the whole chain
      // shares one trailing `end if`). An `else` followed by an `if` on a NEW
      // line is a genuine nested if statement inside the else block — it carries
      // its own `end if`, so parse the else as a normal block.
      if (this.check('KEYWORD', 'if') && this.sameLine(elseTok, this.peek())) {
        const nested = this.ifBody();
        elseBranch = { id: generateId(), type: 'Block', body: [nested] };
      } else {
        elseBranch = this.block();
      }
    }

    return { id: generateId(), type: 'If', condition, thenBranch, elseBranch };
  }

  /** True if no newline separates the two tokens in the source (i.e. same line). */
  private sameLine(a: Token, b: Token): boolean {
    return !this.sourceCode.slice(a.start, b.start).includes('\n');
  }

  private whileStatement(): While {
    this.consume('KEYWORD', 'while');
    this.consumeHeaderParen('(');
    const condition = this.expression();
    this.consumeHeaderParen(')');

    const body = this.block();

    this.consume('KEYWORD', 'end');
    this.consume('KEYWORD', 'while');

    return { id: generateId(), type: 'While', condition, body };
  }

  private doWhileStatement(): DoWhile {
    this.consume('KEYWORD', 'do');
    const body = this.block(['end', 'else', 'until', 'while']);
    this.consume('KEYWORD', 'while');
    this.consumeHeaderParen('(');
    const condition = this.expression();
    this.consumeHeaderParen(')');

    return { id: generateId(), type: 'DoWhile', body, condition };
  }

  /**
   * Parses a Praxis `repeat...until(cond)` post-condition loop.
   * Stored as a RepeatUntil node (body runs first, loop stops when condition is TRUE).
   */
  private repeatUntilStatement(): RepeatUntil {
    this.consume('KEYWORD', 'repeat');
    const body = this.block();
    this.consume('KEYWORD', 'until');
    this.consumeHeaderParen('(');
    const condition = this.expression();
    this.consumeHeaderParen(')');
    return { id: generateId(), type: 'RepeatUntil', condition, body };
  }

  // Praxis has only the C-style `for (init; condition; update)` loop.
  private forStatement(): any {
    this.consume('KEYWORD', 'for');
    this.consumeHeaderParen('(');

    let initStmt: Statement;
    if (this.isTypeStart() || this.checkPeekAhead('IDENTIFIER', undefined, 1)) {
      initStmt = this.variableDeclaration();
    } else {
      const expr = this.expression();
      if (this.match('OPERATOR', '<-') || this.match('OPERATOR', '=')) {
        initStmt = {
          id: generateId(),
          type: 'Assignment',
          target: expr,
          value: this.expression(),
        };
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
      updateStmt = {
        id: generateId(),
        type: 'Assignment',
        target: updateExpr,
        value: this.expression(),
      };
    } else {
      updateStmt = { id: generateId(), type: 'ExpressionStatement', expression: updateExpr };
    }

    this.consumeHeaderParen(')');
    this.match('KEYWORD', 'do');

    const body = this.block();

    this.consume('KEYWORD', 'end');
    this.consume('KEYWORD', 'for');

    return { id: generateId(), type: 'For', init: initStmt, condition, update: updateStmt, body };
  }

  private returnStatement(): Return {
    this.consume('KEYWORD', 'return');
    let value: Expression | undefined = undefined;
    const isExprStart =
      this.check('IDENTIFIER') ||
      this.check('NUMBER') ||
      this.check('STRING') ||
      this.check('BOOLEAN') ||
      this.check('PUNCTUATION', '(') ||
      this.check('OPERATOR', '-') ||
      this.check('KEYWORD', 'not') ||
      this.check('PUNCTUATION', '{') ||
      this.check('PUNCTUATION', '[');

    if (isExprStart) {
      value = this.expression();
    }
    return { id: generateId(), type: 'Return', value };
  }

  /**
   * Parses a Praxis `try ... catch [Type] [as var] ... finally ... end try`.
   * The catch head is emitted as `catch [ExceptionType] [as varName]`, where
   * both the type and the `as var` binding are optional.
   */
  private tryStatement(): Statement {
    const bodyBreaks = ['end', 'catch', 'finally'];
    this.consume('KEYWORD', 'try');
    const body = this.block(bodyBreaks);

    const handlers: any[] = [];
    while (this.check('KEYWORD', 'catch')) {
      this.consume('KEYWORD', 'catch');
      let exceptionType: string | undefined;
      let varName: string | undefined;
      // Optional exception type (any identifier that is not the `as` marker).
      if (this.check('IDENTIFIER') && this.peek().value !== 'as') {
        exceptionType = this.advance().value;
      }
      // Optional `as varName` binding.
      if (this.check('IDENTIFIER', 'as')) {
        this.advance();
        varName = this.consume('IDENTIFIER').value;
      }
      const handlerBody = this.block(bodyBreaks);
      handlers.push({
        id: generateId(),
        type: 'ExceptionHandler',
        exceptionType,
        varName,
        body: handlerBody,
      });
    }

    let finallyBlock: Block | undefined;
    if (this.match('KEYWORD', 'finally')) {
      finallyBlock = this.block(bodyBreaks);
    }

    this.consume('KEYWORD', 'end');
    this.consume('KEYWORD', 'try');

    return { id: generateId(), type: 'Try', body, handlers, finallyBlock } as any;
  }

  // --- Expressions (Standard Precedence) ---

  private expression(): Expression {
    return this.logicOr();
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
    while (this.match('OPERATOR', '*', '/', '%')) {
      const operator = this.previous().value.toLowerCase();
      const right = this.exponent();
      left = { id: generateId(), type: 'BinaryExpression', left, operator, right };
    }
    return left;
  }

  private exponent(): Expression {
    let left = this.unary();
    // Right-associative: handle ^ operator from right to left
    if (this.match('OPERATOR', '^')) {
      const right = this.exponent(); // Right-associative recursion
      left = { id: generateId(), type: 'BinaryExpression', left, operator: '^', right };
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
    // Prefix increment / decrement: ++i, --i
    if (this.match('OPERATOR', '++', '--')) {
      const op = this.previous().value as '++' | '--';
      const arg = this.call();
      return {
        id: generateId(),
        type: 'UpdateExpression',
        operator: op,
        prefix: true,
        argument: arg,
      };
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
        let savedPos = this.current;
        try {
          const index = this.expression();
          this.consume('PUNCTUATION', ']');
          // Use 0-based indexing (JavaScript standard)
          expr = {
            id: generateId(),
            type: 'IndexExpression',
            object: expr,
            index: index,
          };
        } catch (e) {
          this.current = savedPos;
          break;
        }
      } else if (this.match('OPERATOR', '++', '--')) {
        // Postfix increment / decrement: i++, i--
        const op = this.previous().value as '++' | '--';
        expr = {
          id: generateId(),
          type: 'UpdateExpression',
          operator: op,
          prefix: false,
          argument: expr,
        };
      } else {
        break;
      }
    }
    return expr;
  }

  // @ts-ignore - Used recursively for binary expression string conversion
  private stringifyExpressionForProperty(expr: Expression): string {
    if (expr.type === 'Identifier') return (expr as any).name;
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
      do {
        args.push(this.expression());
      } while (this.match('PUNCTUATION', ','));
    }
    this.consume('PUNCTUATION', ')');
    return { id: generateId(), type: 'CallExpression', callee: callee as any, arguments: args };
  }

  private primary(): Expression {
    if (this.match('PLACEHOLDER'))
      return { id: generateId(), type: 'Placeholder', text: this.previous().value } as any;
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
    // Char literal: a single character written with single quotes (`'a'`).
    if (this.match('CHAR'))
      return {
        id: generateId(),
        type: 'Literal',
        value: this.previous().value,
        raw: `'${this.previous().value}'`,
      };
    if (this.match('BOOLEAN'))
      return {
        id: generateId(),
        type: 'Literal',
        value: this.previous().value === 'true',
        raw: this.previous().value,
      };
    if (this.match('KEYWORD', 'null'))
      return { id: generateId(), type: 'Literal', value: null, raw: 'null' };
    if (this.match('IDENTIFIER'))
      return { id: generateId(), type: 'Identifier', name: this.previous().value };

    // `super(...)` calls the superclass constructor; treat `super` as an identifier
    // so the call/member machinery handles it uniformly.
    if (this.match('KEYWORD', 'super'))
      return { id: generateId(), type: 'Identifier', name: 'super' };

    // Allow the numeric conversion keywords `int()` / `float()` to be called as
    // functions. Other type keywords are not callable (`str()` works as a plain
    // identifier call).
    const callableTypeKeywords = ['int', 'float'];
    if (this.check('KEYWORD') && callableTypeKeywords.includes(this.peek().value.toLowerCase())) {
      const name = this.peek().value;
      this.advance();
      return { id: generateId(), type: 'Identifier', name };
    }

    // Handle Object Instantiation
    if (this.match('KEYWORD', 'new')) {
      // Fixed-size array creation: `new int[n]` / `new ClassName[n]`.
      if (
        (this.isTypeStart() || this.check('IDENTIFIER')) &&
        this.checkPeekAhead('PUNCTUATION', '[', 1)
      ) {
        const elementType = this.advance().value;
        this.consume('PUNCTUATION', '[');
        const size = this.expression();
        this.consume('PUNCTUATION', ']');
        return { id: generateId(), type: 'ArrayCreation', elementType, size } as any;
      }
      const className = this.consume('IDENTIFIER').value;
      this.consume('PUNCTUATION', '(');
      const args: Expression[] = [];
      if (!this.check('PUNCTUATION', ')')) {
        do {
          args.push(this.expression());
        } while (this.match('PUNCTUATION', ','));
      }
      this.consume('PUNCTUATION', ')');
      return { id: generateId(), type: 'NewExpression', className, arguments: args } as any;
    }

    if (this.match('PUNCTUATION', '[') || this.match('PUNCTUATION', '{')) {
      const isBrace = this.previous().value === '{';
      const closePunct = isBrace ? '}' : ']';
      const elements: Expression[] = [];
      if (!this.check('PUNCTUATION', closePunct)) {
        do {
          elements.push(this.expression());
        } while (this.match('PUNCTUATION', ','));
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
    if (
      values.length > 0 &&
      !values.map((v) => v.toLowerCase()).includes(token.value.toLowerCase())
    )
      return false;
    return true;
  }
  private consume(type: TokenType, value?: string): Token {
    if (this.check(type, ...(value ? [value] : []))) return this.advance();
    const found = this.peek();
    throw new Error(
      `Expected token ${type} ${value || ''} but found ${found.type} '${found.value}'`
    );
  }
  /** Requires the given `(`/`)` around an if/while/do-while/repeat-until/for header. */
  private consumeHeaderParen(value: '(' | ')'): Token {
    if (this.check('PUNCTUATION', value)) return this.advance();
    const found = this.peek();
    throw new PraxisSyntaxError(`Expected '${value}' but found ${found.type} '${found.value}'`);
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
