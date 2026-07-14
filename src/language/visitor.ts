/**
 * Abstract visitor pattern base class and scope management for AST traversal.
 * Includes SymbolTable for tracking variable scopes and operator precedence definitions.
 */

import type {
  Program,
  Statement,
  Expression,
  Block,
  BlankLine,
  ClassDeclaration,
  MethodDeclaration,
  FieldDeclaration,
  Constructor,
} from './ast';

export type TargetLanguage = 'java' | 'python' | 'csp' | 'praxis' | 'javascript' | 'blocks';

export interface TranslationContext {
  symbolTable: SymbolTable;
  functionReturnTypes: Map<string, string>;
  functionParamTypes: Map<string, string[]>;
  mutableCollections?: Set<string>;
  collectionElementTypes?: Map<string, string>;
  inferredVariableTypes?: Map<string, string>;
}

export type SourceMap = Map<string, number>; // AST Node ID -> Line Number

export class SymbolTable {
  private scopes: Map<string, string>[] = [new Map()];

  enterScope() {
    this.scopes.push(new Map());
  }

  exitScope() {
    this.scopes.pop();
  }

  set(name: string, type: string) {
    this.scopes[this.scopes.length - 1].set(name, type);
  }

  get(name: string): string | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name)) {
        return this.scopes[i].get(name);
      }
    }
    return undefined;
  }

  hasInCurrentScope(name: string): boolean {
    return this.scopes[this.scopes.length - 1].has(name);
  }
}

export const Precedence = {
  Member: 18,
  Call: 17,
  Instantiation: 16,
  Postfix: 15,
  Unary: 14,
  Exponential: 13,
  Multiplicative: 12,
  Additive: 11,
  Shift: 10,
  Relational: 9,
  Equality: 8,
  BitwiseAnd: 7,
  Xor: 6,
  BitwiseOr: 5,
  LogicalAnd: 4,
  LogicalOr: 3,
  Conditional: 2.5,
  Assignment: 2,
  Sequence: 1,
};

export abstract class ASTVisitor {
  protected output: string[] = [];
  protected indentLevel = 0;
  protected context: TranslationContext;
  protected breakStr = 'break;';
  protected continueStr = 'continue;';
  protected sourceMap: SourceMap = new Map();
  // Line-comment delimiter for this target (Python overrides to `#`).
  protected commentPrefix = '//';

  /**
   * Creates a new instance.
   */
  constructor(context: TranslationContext) {
    this.context = context;
  }

  getGeneratedCode(): string {
    return this.output.join('\n');
  }

  /**
   * Emits a program: the pinned file-header comments, then the body. The
   * translator calls this rather than visitProgram directly.
   */
  emitProgram(program: Program): void {
    this.emitComments(program.headerComments);
    this.visitProgram(program);
  }

  /** Emits comment lines (delimiter re-added; a blank entry becomes a bare delimiter). */
  protected emitComments(lines?: string[]): void {
    if (!lines) return;
    for (const c of lines) this.emit(c ? `${this.commentPrefix} ${c}` : this.commentPrefix);
  }

  getSourceMap(): SourceMap {
    return this.sourceMap;
  }

  /**
   * Emits target output.
   */
  protected emit(line: string, nodeId?: string) {
    this.output.push('  '.repeat(this.indentLevel) + line);
    // Map this line (0-based for CodeMirror) to the node ID
    if (nodeId) {
      this.sourceMap.set(nodeId, this.output.length - 1);
    }
  }

  protected indent() {
    this.indentLevel++;
  }
  protected dedent() {
    this.indentLevel--;
  }

  /**
   * Escapes a runtime string value back into source-literal form — the inverse
   * of the lexers' escape processing. Shared by every emitter so a value that
   * contains a backslash, quote, newline, tab, or carriage return re-emits as
   * `\\`, `\"`/`\'`, `\n`, `\t`, `\r` and re-parses, instead of breaking across
   * lines. Pass `quote` as `'` to escape single (char-literal) delimiters.
   */
  protected escapeString(value: string, quote: '"' | "'" = '"'): string {
    let out = value.replace(/\\/g, '\\\\');
    out = quote === "'" ? out.replace(/'/g, "\\'") : out.replace(/"/g, '\\"');
    return out.replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r');
  }

  // -- Visit Methods (To be implemented by concrete emitters) --
  /**
   * Visits program and returns the result.
   */
  abstract visitProgram(program: Program): void;
  /**
   * Visits block and returns the result.
   */
  abstract visitBlock(block: Block): void;
  /**
   * Visits class declaration and returns the result.
   */
  abstract visitClassDeclaration(classDecl: ClassDeclaration): void;
  /**
   * Visits method declaration and returns the result.
   */
  abstract visitMethodDeclaration(method: MethodDeclaration): void;
  /**
   * Visits field declaration and returns the result.
   */
  abstract visitFieldDeclaration(field: FieldDeclaration): void;
  /**
   * Visits constructor and returns the result.
   */
  abstract visitConstructor(ctor: Constructor): void;

  /**
   * Visits print and returns the result.
   */
  abstract visitPrint(stmt: any): void;
  /**
   * Visits assignment and returns the result.
   */
  abstract visitAssignment(stmt: any): void;
  /**
   * Visits if and returns the result.
   */
  abstract visitIf(stmt: any): void;
  /**
   * Visits while and returns the result.
   */
  abstract visitWhile(stmt: any): void;
  /**
   * Visits do while and returns the result.
   */
  abstract visitDoWhile(stmt: any): void;
  /**
   * Visits repeat-until (post-condition) loop and returns the result.
   */
  abstract visitRepeatUntil(stmt: any): void;
  /**
   * Visits switch and returns the result.
   */
  abstract visitSwitch(stmt: any): void;
  /**
   * Visits break and returns the result.
   */
  abstract visitBreak(stmt: any): void;
  /**
   * Visits continue and returns the result.
   */
  abstract visitContinue(stmt: any): void;
  /**
   * Visits a C-style for loop and returns the result.
   */
  abstract visitFor(stmt: any): void;
  /**
   * Visits a for-each (iterator) loop and returns the result.
   */
  abstract visitForEach(stmt: any): void;
  /**
   * Visits function declaration and returns the result.
   */
  abstract visitFunctionDeclaration(stmt: any): void;
  /**
   * Visits return and returns the result.
   */
  abstract visitReturn(stmt: any): void;
  /**
   * Visits expression statement and returns the result.
   */
  abstract visitExpressionStatement(stmt: any): void;
  /**
   * Visits try and returns the result.
   */
  abstract visitTry(stmt: any): void;

  /**
   * Emits a preserved source blank line. Concrete (not abstract) because every
   * target emits a blank line identically, and the correct emission must push
   * '' directly — the indent-prepending `emit()` would produce whitespace
   * rather than a truly empty line inside a block.
   */
  visitBlankLine(_stmt: BlankLine): void {
    this.output.push('');
  }

  // Dispatcher
  /**
   * Visits statement and returns the result.
   */
  visitStatement(stmt: Statement) {
    this.emitComments(stmt.leadingComments);
    const lineCountBefore = this.output.length;
    this.dispatchStatement(stmt);
    // Append an inline trailing comment to the statement's last emitted line.
    if (stmt.trailingComment !== undefined && this.output.length > lineCountBefore) {
      this.output[this.output.length - 1] +=
        `  ${this.commentPrefix} ${stmt.trailingComment}`.trimEnd();
    }
  }

  private dispatchStatement(stmt: Statement) {
    switch (stmt.type) {
      case 'Print':
        this.visitPrint(stmt);
        break;
      case 'Assignment':
        this.visitAssignment(stmt);
        break;
      case 'If':
        this.visitIf(stmt);
        break;
      case 'While':
        this.visitWhile(stmt);
        break;
      case 'DoWhile':
        this.visitDoWhile(stmt);
        break;
      case 'RepeatUntil':
        this.visitRepeatUntil(stmt);
        break;
      case 'Switch':
        this.visitSwitch(stmt);
        break;
      case 'Break':
        this.visitBreak(stmt);
        break;
      case 'Continue':
        this.visitContinue(stmt);
        break;
      case 'BlankLine':
        this.visitBlankLine(stmt);
        break;
      case 'For':
        this.visitFor(stmt);
        break;
      case 'ForEach':
        this.visitForEach(stmt);
        break;
      case 'Try':
        this.visitTry(stmt);
        break;
      case 'FunctionDeclaration':
        this.visitFunctionDeclaration(stmt);
        break;
      case 'Return':
        this.visitReturn(stmt);
        break;
      case 'ExpressionStatement':
        this.visitExpressionStatement(stmt);
        break;
      case 'ClassDeclaration':
        this.visitClassDeclaration(stmt);
        break;
      case 'FieldDeclaration':
        this.visitFieldDeclaration(stmt);
        break;
      case 'Constructor':
        this.visitConstructor(stmt);
        break;
      case 'MethodDeclaration':
        this.visitMethodDeclaration(stmt);
        break;
    }
  }

  abstract generateExpression(expr: Expression, parentPrecedence: number): string;

  protected inferType(expr: Expression): string {
    switch (expr.type) {
      case 'Placeholder':
        return 'int'; // hole defaults to 0
      case 'Literal':
        if (typeof expr.value === 'boolean') return 'boolean';
        if (typeof expr.value === 'string') return 'String';
        if (typeof expr.value === 'number') {
          if (expr.raw && (expr.raw.includes('.') || expr.raw.toLowerCase().includes('e')))
            return 'double';
          return 'int';
        }
        return 'Object';
      case 'Identifier':
        return this.context.symbolTable.get(expr.name) || 'var';
      case 'BinaryExpression':
        if (['>', '<', '>=', '<=', '==', '!=', 'and', 'or', 'in', 'not in'].includes(expr.operator))
          return 'boolean';
        const left = this.inferType(expr.left);
        const right = this.inferType(expr.right);
        // `+` with a String operand is concatenation, so the result is a String.
        if (expr.operator === '+' && (left === 'String' || right === 'String')) return 'String';
        if (left === 'double' || right === 'double') return 'double';
        return 'int';
      case 'UnaryExpression':
        if (expr.operator === 'not' || expr.operator === '!') return 'boolean';
        return this.inferType(expr.argument);
      case 'ConditionalExpression': {
        // A ternary's type is its branches' type (String/double win on mismatch).
        const cons = this.inferType((expr as any).consequent);
        const alt = this.inferType((expr as any).alternate);
        if (cons === alt) return cons;
        if (cons === 'String' || alt === 'String') return 'String';
        if (cons === 'double' || alt === 'double') return 'double';
        return cons;
      }
      case 'NewExpression':
        return (expr as any).className || 'Object';
      case 'IndexExpression':
        const objType = this.inferType(expr.object);
        if (objType.endsWith('[]')) return objType.slice(0, -2);
        if (objType.startsWith('ArrayList<') && objType.endsWith('>')) {
          return objType.slice('ArrayList<'.length, -1);
        }
        return 'var';
      case 'CallExpression': {
        const callee = expr.callee as any;
        if (callee.type === 'MemberExpression') {
          const m = callee.property?.name;
          if (m === 'split') return 'String[]';
          if (m === 'substring' || m === 'toUpperCase' || m === 'toLowerCase' || m === 'charAt')
            return 'String';
          if (m === 'indexOf' || m === 'length' || m === 'size' || m === 'compareTo') return 'int';
          if (m === 'contains' || m === 'equals') return 'boolean';
        }
        const calleeName = callee.name;
        if (calleeName === 'range') return 'int[]';
        if (calleeName === 'input' || calleeName === 'INPUT') return 'String';
        if (calleeName && this.context.functionReturnTypes.has(calleeName))
          return this.context.functionReturnTypes.get(calleeName)!;
        return 'var';
      }
      case 'ArrayLiteral':
        if (expr.elements && expr.elements.length > 0) {
          return this.inferType(expr.elements[0]) + '[]';
        }
        return 'Object[]';
      case 'ArrayCreation':
        return (expr as any).elementType + '[]';
      default:
        return 'var';
    }
  }
}
