/**
 * Java parser that converts Java tokens into an Abstract Syntax Tree (AST).
 * Implements Java-specific grammar including class declarations, access modifiers, and method overloading.
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
  type Return,
  type CallExpression,
  type Identifier,
  type ClassDeclaration,
  type FieldDeclaration,
  type Constructor,
  type MethodDeclaration,
  type Parameter,
  type AccessModifier,
  generateId,
} from '../ast';

export class JavaParser {
  private tokens: Token[];
  private current = 0;
  private currentClassName: string | null = null;

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
   * Get default value for a type when variable is uninitialized
   */
  private getDefaultValueForType(typeStr: string): Expression {
    const baseType = typeStr.replace(/\[\]/g, ''); // Remove array brackets
    if (['int', 'byte', 'short', 'long', 'float', 'double'].includes(baseType)) {
      return { id: generateId(), type: 'Literal', value: 0, raw: '0' };
    } else if (baseType === 'boolean') {
      return { id: generateId(), type: 'Literal', value: false, raw: 'false' };
    } else {
      return { id: generateId(), type: 'Literal', value: null, raw: 'null' };
    }
  }

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
    return { id: generateId(), type: 'Program', body };
  }

  private topLevelDeclaration(): Statement {
    // Handle class declarations
    if (
      this.check('KEYWORD', 'public', 'private', 'protected') ||
      this.checkPeekAhead('KEYWORD', 'class', 2)
    ) {
      return this.classDeclaration();
    }
    // Handle regular statements for non-class programs
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
          'public',
          'private',
          'protected',
          'static',
          'if',
          'else',
          'while',
          'for',
          'do',
          'return',
          'try',
          'catch',
          'finally'
        )
      ) {
        return;
      }
      // Also sync on closing braces
      if (this.check('PUNCTUATION', '}', ';')) {
        if (this.check('PUNCTUATION', '}')) this.advance();
        return;
      }
      this.advance();
    }
  }

  private classDeclaration(): ClassDeclaration {
    this.parseAccessModifier(); // consume access modifier but typically classes are public
    this.consume('KEYWORD', 'class');
    const name = this.consume('IDENTIFIER').value;
    const previousClassName = this.currentClassName;
    this.currentClassName = name;

    let superClass: Identifier | undefined = undefined;
    if (this.match('KEYWORD', 'extends')) {
      superClass = { id: generateId(), type: 'Identifier', name: this.consume('IDENTIFIER').value };
    }

    this.consume('PUNCTUATION', '{');
    const body: (FieldDeclaration | Constructor | MethodDeclaration)[] = [];

    while (!this.check('PUNCTUATION', '}') && !this.isAtEnd()) {
      body.push(this.classBodyDeclaration());
    }

    this.consume('PUNCTUATION', '}');
    this.currentClassName = previousClassName;
    return { id: generateId(), type: 'ClassDeclaration', name, superClass, body };
  }

  private classBodyDeclaration(): FieldDeclaration | Constructor | MethodDeclaration {
    const access = this.parseAccessModifier();
    const isStatic = this.match('KEYWORD', 'static');
    this.match('KEYWORD', 'final'); // consume but don't need to track

    // Constructor: className (params) { ... }
    if (
      this.currentClassName &&
      this.check('IDENTIFIER', this.currentClassName) &&
      this.checkNext('PUNCTUATION', '(')
    ) {
      return this.constructorDeclaration(access);
    }

    // Check if it's a method or field
    // Accept type keywords (String, int, etc) or identifier types
    let typeString: string;
    if (this.isTypeStart()) {
      typeString = this.peek().value;
      this.advance();
    } else if (this.check('IDENTIFIER')) {
      typeString = this.peek().value;
      this.advance();
    } else {
      throw new Error('Expected type in class member declaration');
    }

    const name = this.consume('IDENTIFIER').value;

    if (this.check('PUNCTUATION', '(')) {
      // It's a method
      return this.methodDeclaration(name, access, isStatic, typeString);
    } else {
      // It's a field
      let initializer: Expression | undefined = undefined;
      if (this.match('OPERATOR', '=')) {
        initializer = this.expression();
      }
      this.consume('PUNCTUATION', ';');
      return {
        id: generateId(),
        type: 'FieldDeclaration',
        name,
        fieldType: typeString,
        isStatic,
        access,
        initializer,
        declaredWithoutInitializer: initializer === undefined,
      };
    }

    throw new Error('Expected class member declaration');
  }

  private constructorDeclaration(access: AccessModifier): Constructor {
    this.consume('IDENTIFIER'); // consume class name
    this.consume('PUNCTUATION', '(');
    const params = this.parseParameters();
    this.consume('PUNCTUATION', ')');
    const body = this.block();
    return { id: generateId(), type: 'Constructor', access, params, body };
  }

  private methodDeclaration(
    name: string,
    access: AccessModifier,
    isStatic: boolean,
    returnType: string
  ): MethodDeclaration {
    this.consume('PUNCTUATION', '(');
    const params = this.parseParameters();
    this.consume('PUNCTUATION', ')');
    const body = this.block();
    return {
      id: generateId(),
      type: 'MethodDeclaration',
      name,
      access,
      isStatic,
      returnType,
      params,
      body,
    };
  }

  private parseParameters(): Parameter[] {
    const params: Parameter[] = [];
    if (!this.check('PUNCTUATION', ')')) {
      do {
        // Accept both KEYWORD types (String, int, etc) and IDENTIFIER types
        let paramType: string;
        if (this.isTypeStart()) {
          paramType = this.peek().value;
          this.advance();
        } else {
          paramType = this.consume('IDENTIFIER').value;
        }
        // Handle array types (e.g., String[])
        while (this.match('PUNCTUATION', '[')) {
          this.consume('PUNCTUATION', ']');
          paramType += '[]';
        }
        const paramName = this.consume('IDENTIFIER').value;
        params.push({ id: generateId(), type: 'Parameter', name: paramName, paramType });
      } while (this.match('PUNCTUATION', ','));
    }
    return params;
  }

  private parseAccessModifier(): AccessModifier {
    if (this.match('KEYWORD', 'public')) return 'public';
    if (this.match('KEYWORD', 'private')) return 'private';
    if (this.match('KEYWORD', 'protected')) return 'protected';
    return 'public'; // default access
  }

  private checkPeekAhead(type: TokenType, value: string, distance: number): boolean {
    if (this.current + distance >= this.tokens.length) return false;
    const token = this.tokens[this.current + distance];
    return token.type === type && token.value === value;
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
          !this.check(
            'KEYWORD',
            'if',
            'else',
            'while',
            'do',
            'for',
            'switch',
            'break',
            'continue',
            'return',
            'try',
            'catch',
            'finally'
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
  }

  private statement(): Statement {
    const startIdx = this.current;

    if (this.check('KEYWORD', 'if')) return this.withLocation(this.ifStatement(), startIdx);
    if (this.check('KEYWORD', 'while')) return this.withLocation(this.whileStatement(), startIdx);
    if (this.check('KEYWORD', 'do')) return this.withLocation(this.doWhileStatement(), startIdx);
    if (this.check('KEYWORD', 'switch')) return this.withLocation(this.switchStatement(), startIdx);
    if (this.check('KEYWORD', 'for')) return this.withLocation(this.forStatement(), startIdx);
    if (this.check('KEYWORD', 'break')) return this.withLocation(this.breakStatement(), startIdx);
    if (this.check('KEYWORD', 'continue'))
      return this.withLocation(this.continueStatement(), startIdx);
    if (this.check('KEYWORD', 'return')) return this.withLocation(this.returnStatement(), startIdx);

    // Fix: System is now an IDENTIFIER in Lexer
    if (this.check('IDENTIFIER', 'System'))
      return this.withLocation(this.printStatement(), startIdx);

    if (this.isTypeStart()) {
      let typeStr = this.peek().value;
      this.advance();
      // Handle array types (e.g., String[] arr)
      while (this.check('PUNCTUATION', '[')) {
        this.advance();
        this.consume('PUNCTUATION', ']');
        typeStr += '[]';
      }

      const name = this.consume('IDENTIFIER').value;
      const hasInitializer = this.match('OPERATOR', '=');
      let value: Expression = this.getDefaultValueForType(typeStr);

      if (hasInitializer) {
        value = this.expression();
      }
      if (!this.isAtEnd() && this.check('PUNCTUATION', ';')) this.advance();
      return this.withLocation(
        {
          id: generateId(),
          type: 'Assignment',
          name,
          value,
          varType: typeStr,
          declaredWithoutInitializer: !hasInitializer,
        },
        startIdx
      );
    }

    if (this.check('IDENTIFIER')) {
      // Check for simple assignment: identifier = expression
      if (this.checkNext('OPERATOR', '=')) {
        const name = this.consume('IDENTIFIER').value;
        this.consume('OPERATOR', '=');
        const value = this.expression();
        if (!this.isAtEnd() && this.check('PUNCTUATION', ';')) this.advance();
        return this.withLocation({ id: generateId(), type: 'Assignment', name, value }, startIdx);
      }
      // Check for type declarations: identifier identifier (e.g., "String name", "int x")
      // NOT for: this.xxx, obj.xxx, or other member accesses
      else if (this.checkNext('IDENTIFIER')) {
        // Peek two positions ahead to check if there's a dot after the next identifier
        const hasDotAfterNext =
          this.current + 2 < this.tokens.length && this.tokens[this.current + 2].value === '.';

        if (!hasDotAfterNext) {
          const firstId = this.peek().value;
          // Check if this looks like a type
          const isTypeKeyword = [
            'String',
            'Object',
            'Integer',
            'Double',
            'Boolean',
            'Float',
            'Long',
            'Char',
          ].includes(firstId);
          const startsUppercase = firstId[0] === firstId[0].toUpperCase() && firstId !== 'this';

          if (isTypeKeyword || startsUppercase) {
            let typeStr = this.consume('IDENTIFIER').value;
            if (this.check('PUNCTUATION', '[')) {
              this.advance();
              this.consume('PUNCTUATION', ']');
              typeStr += '[]';
            }
            const name = this.consume('IDENTIFIER').value;
            const hasInitializer = this.match('OPERATOR', '=');
            let value: Expression = this.getDefaultValueForType(typeStr);
            if (hasInitializer) {
              value = this.expression();
            }
            if (!this.isAtEnd() && this.check('PUNCTUATION', ';')) this.advance();
            return this.withLocation(
              {
                id: generateId(),
                type: 'Assignment',
                name,
                value,
                varType: typeStr,
                declaredWithoutInitializer: !hasInitializer,
              },
              startIdx
            );
          }
        }
      }
    }

    const expr = this.expression();
    if (!this.isAtEnd()) {
      this.consume('PUNCTUATION', ';');
    }

    // If the expression is an assignment, return it as an Assignment statement
    if ((expr as any).type === 'Assignment') {
      return expr as any as Statement;
    }

    return this.withLocation(
      { id: generateId(), type: 'ExpressionStatement', expression: expr },
      startIdx
    );
  }

  private isTypeStart(): boolean {
    const token = this.peek();
    const types = [
      'int',
      'double',
      'boolean',
      'String',
      'var',
      'char',
      'float',
      'long',
      'void',
      'Object',
    ];
    return types.includes(token.value);
  }

  private printStatement(): Statement {
    // Fix: Consume IDENTIFIER 'System'
    this.consume('IDENTIFIER', 'System');
    this.consume('PUNCTUATION', '.');
    this.consume('IDENTIFIER', 'out');
    this.consume('PUNCTUATION', '.');
    this.consume('IDENTIFIER', 'println');
    this.consume('PUNCTUATION', '(');
    const expr = this.expression();
    this.consume('PUNCTUATION', ')');
    this.consume('PUNCTUATION', ';');
    return { id: generateId(), type: 'Print', expressions: [expr] };
  }

  private ifStatement(): If {
    this.consume('KEYWORD', 'if');
    this.consume('PUNCTUATION', '(');
    const condition = this.expression();
    this.consume('PUNCTUATION', ')');
    const thenBranch = this.block();
    let elseBranch: Block | undefined = undefined;
    if (this.match('KEYWORD', 'else')) {
      if (this.check('KEYWORD', 'if')) {
        // Handle else if as nested If statement wrapped in a block
        const elifStatement = this.ifStatement();
        elseBranch = { id: generateId(), type: 'Block', body: [elifStatement] };
      } else {
        // Handle regular else block
        elseBranch = this.block();
      }
    }
    return { id: generateId(), type: 'If', condition, thenBranch, elseBranch };
  }

  private whileStatement(): While {
    this.consume('KEYWORD', 'while');
    this.consume('PUNCTUATION', '(');
    const condition = this.expression();
    this.consume('PUNCTUATION', ')');
    const body = this.block();
    return { id: generateId(), type: 'While', condition, body };
  }

  private doWhileStatement(): any {
    this.consume('KEYWORD', 'do');
    const body = this.block();
    this.consume('KEYWORD', 'while');
    this.consume('PUNCTUATION', '(');
    const condition = this.expression();
    this.consume('PUNCTUATION', ')');
    this.consume('PUNCTUATION', ';');
    return { id: generateId(), type: 'DoWhile', body, condition };
  }

  private switchStatement(): any {
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
          !this.check('KEYWORD', 'case') &&
          !this.check('KEYWORD', 'default') &&
          !this.check('PUNCTUATION', '}')
        ) {
          consequent.push(this.statement());
        }
        cases.push({ id: generateId(), type: 'SwitchCase', test, consequent });
      } else if (this.match('KEYWORD', 'default')) {
        this.consume('PUNCTUATION', ':');
        const consequent: Statement[] = [];
        while (
          !this.check('KEYWORD', 'case') &&
          !this.check('KEYWORD', 'default') &&
          !this.check('PUNCTUATION', '}')
        ) {
          consequent.push(this.statement());
        }
        cases.push({ id: generateId(), type: 'SwitchCase', consequent });
      }
    }

    this.consume('PUNCTUATION', '}');
    return { id: generateId(), type: 'Switch', discriminant, cases };
  }

  private breakStatement(): any {
    this.consume('KEYWORD', 'break');
    this.consume('PUNCTUATION', ';');
    return { id: generateId(), type: 'Break' };
  }

  private continueStatement(): any {
    this.consume('KEYWORD', 'continue');
    this.consume('PUNCTUATION', ';');
    return { id: generateId(), type: 'Continue' };
  }

  private forStatement(): For {
    this.consume('KEYWORD', 'for');
    this.consume('PUNCTUATION', '(');

    // Try to parse as C-style for loop first
    let init: Statement | undefined = undefined;
    let condition: Expression | undefined = undefined;
    let update: Statement | undefined = undefined;
    let variable = '';
    let iterable: Expression = { id: generateId(), type: 'Literal', value: null, raw: 'null' };

    // Check if it's a type declaration or variable
    if (this.isTypeStart()) {
      this.advance();
      const varName = this.consume('IDENTIFIER').value;

      if (this.check('OPERATOR', '=')) {
        // C-style: int i = 0; or int i = 0, j = 10;
        const assignIdx = this.current;
        this.consume('OPERATOR', '=');
        const value = this.expression();
        const initAssignment = {
          id: generateId(),
          type: 'Assignment',
          name: varName,
          value,
        } as Statement;
        this.withLocation(initAssignment, assignIdx);
        const inits: Statement[] = [initAssignment];

        // Handle multiple variable declarations with commas
        while (this.match('PUNCTUATION', ',')) {
          const nextAssignIdx = this.current;
          const nextVarName = this.consume('IDENTIFIER').value;
          this.consume('OPERATOR', '=');
          const nextValue = this.expression();
          const nextAssignment = {
            id: generateId(),
            type: 'Assignment',
            name: nextVarName,
            value: nextValue,
          } as Statement;
          this.withLocation(nextAssignment, nextAssignIdx);
          inits.push(nextAssignment);
        }

        init = inits.length === 1 ? inits[0] : (inits as any);
        this.consume('PUNCTUATION', ';');
        condition = this.expression();
        this.consume('PUNCTUATION', ';');

        // Parse update expression(s) - could be i++, i = i + 1, etc., or multiple comma-separated
        const updates: Statement[] = [];
        if (!this.check('PUNCTUATION', ')')) {
          const updateExpr = this.expression();
          updates.push({ id: generateId(), type: 'ExpressionStatement', expression: updateExpr });

          while (this.match('PUNCTUATION', ',')) {
            const nextUpdateExpr = this.expression();
            updates.push({
              id: generateId(),
              type: 'ExpressionStatement',
              expression: nextUpdateExpr,
            });
          }
        }
        update =
          updates.length === 1 ? updates[0] : updates.length > 1 ? (updates as any) : undefined;

        this.consume('PUNCTUATION', ')');
        const body = this.block();
        return {
          id: generateId(),
          type: 'For',
          variable: varName,
          iterable,
          body,
          init,
          condition,
          update,
        };
      } else if (this.check('PUNCTUATION', ':')) {
        // For-each: int x : array
        this.advance(); // consume ':'
        iterable = this.expression();
        this.consume('PUNCTUATION', ')');
        const body = this.block();
        return { id: generateId(), type: 'For', variable: varName, iterable, body };
      }
    } else if (this.check('IDENTIFIER')) {
      // Could be for-each with already-declared type or C-style with expression
      const varName = this.consume('IDENTIFIER').value;

      if (this.check('PUNCTUATION', ':')) {
        // For-each: arr[item]
        this.advance(); // consume ':'
        iterable = this.expression();
        this.consume('PUNCTUATION', ')');
        const body = this.block();
        return { id: generateId(), type: 'For', variable: varName, iterable, body };
      } else if (this.check('OPERATOR', '=')) {
        // C-style: i = 0;
        const assignIdx = this.current;
        this.consume('OPERATOR', '=');
        const value = this.expression();
        const assignment = {
          id: generateId(),
          type: 'Assignment',
          name: varName,
          value,
        } as Statement;
        this.withLocation(assignment, assignIdx);
        init = assignment;
        this.consume('PUNCTUATION', ';');
        condition = this.expression();
        this.consume('PUNCTUATION', ';');

        if (!this.check('PUNCTUATION', ')')) {
          const updateExpr = this.expression();
          update = { id: generateId(), type: 'ExpressionStatement', expression: updateExpr };
        }
        this.consume('PUNCTUATION', ')');
        const body = this.block();
        return {
          id: generateId(),
          type: 'For',
          variable: varName,
          iterable,
          body,
          init,
          condition,
          update,
        };
      }
    }

    // Default fallback - parse as expression-based for loop
    if (!init && !this.check('PUNCTUATION', ';')) {
      const expr = this.expression();
      init = { id: generateId(), type: 'ExpressionStatement', expression: expr };
    }

    this.consume('PUNCTUATION', ';');

    if (!this.check('PUNCTUATION', ';')) {
      condition = this.expression();
    }
    this.consume('PUNCTUATION', ';');

    if (!this.check('PUNCTUATION', ')')) {
      const updateExpr = this.expression();
      update = { id: generateId(), type: 'ExpressionStatement', expression: updateExpr };
    }
    this.consume('PUNCTUATION', ')');

    const body = this.block();
    return { id: generateId(), type: 'For', variable, iterable, body, init, condition, update };
  }

  private returnStatement(): Return {
    this.consume('KEYWORD', 'return');
    let value: Expression | undefined = undefined;
    if (!this.check('PUNCTUATION', ';')) value = this.expression();
    this.consume('PUNCTUATION', ';');
    return { id: generateId(), type: 'Return', value };
  }

  private expression(): Expression {
    return this.assignment();
  }

  private assignment(): Expression {
    let left = this.ternary();

    if (
      this.check(
        'OPERATOR',
        '=',
        '+=',
        '-=',
        '*=',
        '/=',
        '%=',
        '&=',
        '|=',
        '^=',
        '<<=',
        '>>=',
        '>>>='
      )
    ) {
      const operator = this.peek().value;
      this.advance();
      const right = this.assignment(); // Right-associative

      // Regular assignment (=)
      if (operator === '=') {
        const assignIdx = this.current - 1; // Index of the = operator
        let name = '';
        if (left.type === 'Identifier') {
          name = (left as any).name;
        } else if (left.type === 'MemberExpression' || left.type === 'IndexExpression') {
          // For member expressions like this.count or array[i], we need to preserve them
          const memberAssignment = {
            id: generateId(),
            type: 'Assignment',
            name: JSON.stringify(left),
            value: right,
            isMemberAssignment: true,
            memberExpr: left,
          } as any;
          this.withLocation(memberAssignment, assignIdx);
          return memberAssignment;
        }
        const assignment = { id: generateId(), type: 'Assignment', name, value: right } as any;
        this.withLocation(assignment, assignIdx);
        return assignment;
      }

      // Compound assignments - return as CompoundAssignment or convert to binary
      let binaryOp = '';
      switch (operator) {
        case '+=':
          binaryOp = '+';
          break;
        case '-=':
          binaryOp = '-';
          break;
        case '*=':
          binaryOp = '*';
          break;
        case '/=':
          binaryOp = '/';
          break;
        case '%=':
          binaryOp = '%';
          break;
        case '&=':
          binaryOp = '&';
          break;
        case '|=':
          binaryOp = '|';
          break;
        case '^=':
          binaryOp = '^';
          break;
        case '<<=':
          binaryOp = '<<';
          break;
        case '>>=':
          binaryOp = '>>';
          break;
        case '>>>=':
          binaryOp = '>>>';
          break;
      }

      let name = '';
      if (left.type === 'Identifier') {
        name = (left as any).name;
      }

      // Return as CompoundAssignment node (or use Assignment with operator field)
      return {
        id: generateId(),
        type: 'CompoundAssignment',
        name,
        operator: binaryOp,
        value: right,
      } as any;
    }

    return left;
  }

  private ternary(): Expression {
    let expr = this.logicOr();

    if (this.match('PUNCTUATION', '?')) {
      const thenExpr = this.expression();
      this.consume('PUNCTUATION', ':');
      const elseExpr = this.ternary();
      return {
        id: generateId(),
        type: 'ConditionalExpression',
        test: expr,
        consequent: thenExpr,
        alternate: elseExpr,
      } as any;
    }

    return expr;
  }

  private logicOr(): Expression {
    let left = this.logicAnd();
    while (this.match('OPERATOR', '||')) {
      const right = this.logicAnd();
      left = { id: generateId(), type: 'BinaryExpression', left, operator: 'or', right };
    }
    return left;
  }

  private logicAnd(): Expression {
    let left = this.bitwiseOr();
    while (this.match('OPERATOR', '&&')) {
      const right = this.bitwiseOr();
      left = { id: generateId(), type: 'BinaryExpression', left, operator: 'and', right };
    }
    return left;
  }

  private bitwiseOr(): Expression {
    let left = this.bitwiseXor();
    while (this.match('OPERATOR', '|')) {
      const right = this.bitwiseXor();
      left = { id: generateId(), type: 'BinaryExpression', left, operator: '|', right };
    }
    return left;
  }

  private bitwiseXor(): Expression {
    let left = this.bitwiseAnd();
    while (this.match('OPERATOR', '^')) {
      const right = this.bitwiseAnd();
      left = { id: generateId(), type: 'BinaryExpression', left, operator: '^', right };
    }
    return left;
  }

  private bitwiseAnd(): Expression {
    let left = this.equality();
    while (this.match('OPERATOR', '&')) {
      const right = this.equality();
      left = { id: generateId(), type: 'BinaryExpression', left, operator: '&', right };
    }
    return left;
  }

  private equality(): Expression {
    let left = this.shift();
    while (this.match('OPERATOR', '==', '!=')) {
      const operator = this.previous().value;
      const right = this.shift();
      left = { id: generateId(), type: 'BinaryExpression', left, operator, right };
    }
    return left;
  }

  private shift(): Expression {
    let left = this.comparison();
    while (this.match('OPERATOR', '<<', '>>', '>>>')) {
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
    // Prefix ++ and --
    if (this.match('OPERATOR', '++', '--')) {
      const operator = this.previous().value as '++' | '--';
      const argument = this.unary();
      return { id: generateId(), type: 'UpdateExpression', operator, argument, prefix: true };
    }
    if (this.match('OPERATOR', '!', '-', '~')) {
      let operator = this.previous().value;
      if (operator === '!') operator = 'not';
      const right = this.unary();
      return { id: generateId(), type: 'UnaryExpression', operator, argument: right };
    }
    if (this.match('KEYWORD', 'new')) {
      return this.newExpression();
    }
    return this.postfix();
  }

  private newExpression(): Expression {
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
      type: 'CallExpression',
      callee: { id: generateId(), type: 'Identifier', name: className },
      arguments: args,
    };
  }

  private postfix(): Expression {
    let expr = this.call();

    // Handle postfix ++ and --
    if (this.match('OPERATOR', '++', '--')) {
      const operator = this.previous().value as '++' | '--';
      return {
        id: generateId(),
        type: 'UpdateExpression',
        operator,
        argument: expr,
        prefix: false,
      };
    }

    // Handle array access: expr[index]
    while (this.match('PUNCTUATION', '[')) {
      const index = this.expression();
      this.consume('PUNCTUATION', ']');
      expr = { id: generateId(), type: 'IndexExpression', object: expr, index };
    }

    // Handle member access: expr.property
    while (this.match('PUNCTUATION', '.')) {
      const property = this.consume('IDENTIFIER').value;
      if (this.check('PUNCTUATION', '(')) {
        // Method call: obj.method(args)
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
          callee: { id: generateId(), type: 'Identifier', name: property },
          arguments: args,
        };
      } else {
        // Field access: obj.field
        expr = {
          id: generateId(),
          type: 'MemberExpression',
          object: expr,
          property: { id: generateId(), type: 'Identifier', name: property },
          isMethod: false,
        };
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
    if (this.match('KEYWORD', 'null'))
      return { id: generateId(), type: 'Literal', value: null, raw: 'null' };
    if (this.match('KEYWORD', 'this'))
      return { id: generateId(), type: 'Identifier', name: 'this' };
    if (this.match('IDENTIFIER'))
      return { id: generateId(), type: 'Identifier', name: this.previous().value };
    if (this.match('PUNCTUATION', '{')) {
      // Array literal: { ... }
      const elements: Expression[] = [];
      if (!this.check('PUNCTUATION', '}')) {
        do {
          elements.push(this.expression());
        } while (this.match('PUNCTUATION', ','));
      }
      this.consume('PUNCTUATION', '}');
      return { id: generateId(), type: 'ArrayLiteral', elements };
    }
    if (this.match('PUNCTUATION', '(')) {
      const expr = this.expression();
      this.consume('PUNCTUATION', ')');
      return expr;
    }
    throw new Error(`Expect expression. Found ${this.peek().value}`);
  }

  private call(): Expression {
    let expr = this.primary();
    while (this.match('PUNCTUATION', '(')) {
      expr = this.finishCall(expr);
    }
    return expr;
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
