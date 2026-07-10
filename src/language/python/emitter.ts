/**
 * Python Language Emitter
 * Converts AST nodes into Python source code.
 * Handles Python-specific syntax including classes with self parameter,
 * indentation-based blocks, tuple unpacking, and Python method/function syntax.
 */

import { ASTVisitor, Precedence } from '../visitor';
import type {
  Program,
  ClassDeclaration,
  FieldDeclaration,
  Constructor,
  MethodDeclaration,
  Block,
  For,
  Expression,
} from '../ast';

/**
 * Emitter for converting AST to Python source code.
 * Tracks class fields to properly prefix them with self.
 */
export class PythonEmitter extends ASTVisitor {
  protected override commentPrefix = '#';
  // Tracks field names in current class scope for self. prefixing
  private currentClassFields = new Set<string>();
  // Statements that must be emitted immediately before the statement currently
  // being built — used to lower expression-position ++/-- (Python has neither).
  private preludeLines: string[] = [];
  private tempCounter = 0;
  // Names explicitly declared with an integer type (drives `int(a / b)`), so we
  // reproduce the source's integer-division semantics without touching untyped
  // Python/JS/CSP variables.
  private declaredIntVars = new Set<string>();

  // Flush any hoisted prelude statements (at the current indent) before `line`.
  protected emit(line: string, nodeId?: string): void {
    if (this.preludeLines.length > 0) {
      const pending = this.preludeLines;
      this.preludeLines = [];
      for (const p of pending) super.emit(p);
    }
    super.emit(line, nodeId);
  }
  // Full field registry: class name → all fields (own + implicit + inherited)
  private classFieldRegistry = new Map<string, Set<string>>();

  /** Pre-pass: build field registry for every class, including inherited fields. */
  private buildClassFieldRegistry(program: Program): void {
    const classDeclMap = new Map<string, ClassDeclaration>();
    program.body.forEach((s) => {
      if (s.type === 'ClassDeclaration') {
        classDeclMap.set((s as ClassDeclaration).name, s as ClassDeclaration);
      }
    });

    const getFields = (name: string): Set<string> => {
      if (this.classFieldRegistry.has(name)) return this.classFieldRegistry.get(name)!;
      const decl = classDeclMap.get(name);
      if (!decl) return new Set();

      const fields = new Set<string>();

      // Explicit FieldDeclarations
      decl.body.forEach((m) => {
        if (m.type === 'FieldDeclaration') fields.add((m as any).name);
      });

      // Implicit: self.x = y  in constructors and methods
      decl.body.forEach((m) => {
        if (m.type === 'Constructor' || m.type === 'MethodDeclaration') {
          this.collectSelfFields((m as any).body, fields);
        }
      });

      // Inherited fields from superclass
      if (decl.superClass) {
        getFields(decl.superClass.name).forEach((f) => fields.add(f));
      }

      this.classFieldRegistry.set(name, fields);
      return fields;
    };

    classDeclMap.forEach((_, n) => getFields(n));
  }

  /** Walk a block and add every `self.x = …` / `this.x = …` field name to the set. */
  private collectSelfFields(body: Block, fields: Set<string>): void {
    if (!body?.body) return;
    body.body.forEach((stmt: any) => {
      // target: MemberExpression(self/this, x)
      const me =
        stmt.target?.type === 'MemberExpression'
          ? stmt.target
          : stmt.memberExpr?.type === 'MemberExpression'
            ? stmt.memberExpr
            : null;
      if (
        me &&
        (me.object?.name === 'self' ||
          me.object?.name === 'this' ||
          me.object?.type === 'ThisExpression')
      ) {
        fields.add(me.property?.name);
      }
      // Recurse into nested blocks
      if (stmt.body) this.collectSelfFields(stmt.body, fields);
      if (stmt.thenBranch) this.collectSelfFields(stmt.thenBranch, fields);
      if (stmt.elseBranch) this.collectSelfFields(stmt.elseBranch, fields);
    });
  }

  private toPythonType(typeName?: string): string | undefined {
    if (!typeName) return undefined;

    const trimmed = typeName.trim();
    if (!trimmed || trimmed === 'auto' || trimmed === 'var') return undefined;

    let baseType = trimmed;
    let arrayDepth = 0;
    while (baseType.endsWith('[]')) {
      baseType = baseType.slice(0, -2);
      arrayDepth++;
    }

    const normalized = baseType.toLowerCase();
    let mappedType: string;

    switch (normalized) {
      case 'int':
      case 'byte':
      case 'short':
      case 'long':
        mappedType = 'int';
        break;
      case 'float':
      case 'double':
        mappedType = 'float';
        break;
      case 'boolean':
      case 'bool':
        mappedType = 'bool';
        break;
      case 'char':
      case 'string':
      case 'str':
        mappedType = 'str';
        break;
      case 'void':
        mappedType = 'None';
        break;
      default:
        mappedType = baseType;
        break;
    }

    for (let i = 0; i < arrayDepth; i++) {
      mappedType = `list[${mappedType}]`;
    }

    return mappedType;
  }

  private formatParameter(param: any): string {
    const annotatedType = this.toPythonType(param.paramType);
    return annotatedType ? `${param.name}: ${annotatedType}` : param.name;
  }

  /**
   * Check if a ClassDeclaration is Java's special Main class wrapper
   * (contains only a static main method)
   */
  private isJavaMainClass(classDecl: ClassDeclaration): boolean {
    if (classDecl.name !== 'Main') return false;
    const hasStaticMainMethod = classDecl.body.some(
      (member) =>
        member.type === 'MethodDeclaration' &&
        (member as MethodDeclaration).name === 'main' &&
        (member as MethodDeclaration).isStatic
    );
    return hasStaticMainMethod;
  }

  /**
   * Main entry point for translating a complete program.
   * Separates classes from functions and main body.
   * Handles Java Main class wrapper pattern by extracting its main method body.
   */
  visitProgram(program: Program): void {
    this.buildClassFieldRegistry(program);
    const classes = program.body.filter((s) => s.type === 'ClassDeclaration');
    const nonClasses = program.body.filter((s) => s.type !== 'ClassDeclaration');

    // Split Main class from other classes
    const mainClass = classes.find((c) => this.isJavaMainClass(c as ClassDeclaration));
    const otherClasses = classes.filter((c) => !this.isJavaMainClass(c as ClassDeclaration));

    // Emit non-Main classes
    otherClasses.forEach((classDecl) => {
      this.visitClassDeclaration(classDecl as ClassDeclaration);
      this.emit('');
    });

    const functions = nonClasses.filter((s) => s.type === 'FunctionDeclaration');
    const mainBody = nonClasses.filter((s) => s.type !== 'FunctionDeclaration');

    functions.forEach((func) => {
      this.visitStatement(func);
      this.emit('');
    });

    // Emit main body from non-class statements
    mainBody.forEach((stmt) => this.visitStatement(stmt));

    // If there's a Java Main class, emit its main method body directly
    if (mainClass) {
      const mainClassDecl = mainClass as ClassDeclaration;
      const mainMethod = mainClassDecl.body.find(
        (m) => m.type === 'MethodDeclaration' && (m as MethodDeclaration).name === 'main'
      ) as MethodDeclaration | undefined;

      if (mainMethod) {
        // Emit the main method's body directly without class wrapper
        this.visitBlock(mainMethod.body);
      }
    }
  }

  /**
   * Translates a class declaration with inheritance and Python syntax.
   * Tracks field names for self. prefixing in methods.
   */
  visitClassDeclaration(classDecl: ClassDeclaration): void {
    const baseClass = classDecl.superClass ? `(${classDecl.superClass.name})` : '';
    this.emit(`class ${classDecl.name}${baseClass}:`);
    this.indent();

    this.currentClassFields = this.classFieldRegistry.get(classDecl.name) ?? new Set();

    classDecl.body.forEach((member) => {
      this.visitStatement(member);
      this.emit('');
    });

    this.currentClassFields = new Set();
    this.dedent();
  }

  /**
   * Translates a field declaration (class variable).
   * Emits Python type annotations for declarations when possible.
   */
  visitFieldDeclaration(field: FieldDeclaration): void {
    const annotatedType = this.toPythonType(field.fieldType);

    if ((field as any).declaredWithoutInitializer) {
      if (annotatedType) {
        this.emit(`${field.name}: ${annotatedType}`);
      } else {
        this.emit(`${field.name} = None`);
      }
      return;
    }

    let line = `${field.name}`;
    if (field.initializer) {
      line += ` = ${this.generateExpression(field.initializer, 0)}`;
    } else {
      line += ` = None`;
    }

    this.emit(line);
  }

  /**
   * Translates a constructor to Python __init__ method.
   * Parameters exclude self which is implicit.
   */
  visitConstructor(ctor: Constructor): void {
    const params = ctor.params.map((p) => this.formatParameter(p)).join(', ');
    const paramStr = params ? `, ${params}` : '';
    this.emit(`def __init__(self${paramStr}):`);
    this.indent();
    this.context.symbolTable.enterScope();
    ctor.params.forEach((p) => this.context.symbolTable.set(p.name, p.paramType || 'auto'));
    this.visitBlock(ctor.body);
    this.context.symbolTable.exitScope();
    this.dedent();
  }

  /**
   * Translates a method declaration to Python def syntax.
   * Parameters exclude self which is implicit.
   */
  visitMethodDeclaration(method: MethodDeclaration): void {
    const params = method.params.map((p) => this.formatParameter(p)).join(', ');
    const paramStr = params ? `, ${params}` : '';
    this.emit(`def ${method.name}(self${paramStr}):`);
    this.indent();
    this.context.symbolTable.enterScope();
    method.params.forEach((p) => this.context.symbolTable.set(p.name, p.paramType || 'auto'));
    this.visitBlock(method.body);
    this.context.symbolTable.exitScope();
    this.dedent();
  }

  /**
   * Translates a block of statements.
   * Only responsible for visiting statements; indentation handled by parent.
   */
  visitBlock(block: Block): void {
    block.body.forEach((stmt) => this.visitStatement(stmt));
  }

  /**
   * Translates a print statement to Python print function.
   * Combines multiple expressions as separate arguments.
   */
  visitPrint(stmt: any): void {
    const args = stmt.expressions.map((e: any) => this.generateExpression(e, 0));
    const options: string[] = [];
    const hasSeparator = typeof stmt.separator === 'string';
    const suppressLineFeed = stmt.appendLineFeed === false;

    if (hasSeparator && !(suppressLineFeed && args.length === 1)) {
      options.push(`sep=${JSON.stringify(stmt.separator)}`);
    }

    if (suppressLineFeed) {
      if (hasSeparator && args.length === 1) {
        options.push(`end=${JSON.stringify(stmt.separator)}`);
      } else {
        options.push('end=""');
      }
    } else if (stmt.appendLineFeed === true) {
      options.push('end="\\n"');
    }

    this.emit(`print(${[...args, ...options].join(', ')})`, stmt.id);
  }

  /**
   * Translates variable assignments with tuple unpacking support.
   * Handles chained assignments, member assignments, and field prefixing.
   */
  visitAssignment(stmt: any): void {
    let target = stmt.name;

    // Handle member expression assignments (e.g., self.count = value)
    if (stmt.isMemberAssignment && stmt.memberExpr) {
      target = this.generateExpression(stmt.memberExpr, 0);
    } else if (stmt.target) {
      // Special handling for tuple unpacking targets (ArrayLiteral on left side)
      if (stmt.target.type === 'ArrayLiteral') {
        const elements = stmt.target.elements
          .map((e: any) => this.generateExpression(e, 0))
          .join(', ');
        target = elements; // Render as tuple without brackets
      } else {
        target = this.generateExpression(stmt.target, 0);
      }
    } else if (this.currentClassFields.has(target)) {
      target = `self.${target}`;
    }

    // Handle nested assignments (chained assignment: x = y = z = 10)
    if (stmt.value && stmt.value.type === 'Assignment') {
      // Recursively visit the nested assignment
      this.visitAssignment(stmt.value);
      // Also emit the current assignment
      this.emit(`${target} = ${this.generateExpression(stmt.value.target, 0)}`, stmt.id);
    } else {
      // Special handling for tuple unpacking on right side
      let value: string;
      if (stmt.target?.type === 'ArrayLiteral' && stmt.value?.type === 'ArrayLiteral') {
        // Both sides are tuples, render right side without brackets
        value = stmt.value.elements.map((e: any) => this.generateExpression(e, 0)).join(', ');
      } else {
        value = this.generateExpression(stmt.value, 0);
      }

      if (stmt.varType) {
        if (this.isIntegerType(stmt.varType) && typeof stmt.name === 'string') {
          this.declaredIntVars.add(stmt.name);
        }
        const annotatedType = this.toPythonType(stmt.varType);
        if (stmt.declaredWithoutInitializer) {
          if (annotatedType) {
            this.emit(`${target}: ${annotatedType}`, stmt.id);
          } else {
            this.emit(`${target} = None`, stmt.id);
          }
        } else {
          this.emit(`${target} = ${value}`, stmt.id);
        }
        return;
      }

      this.emit(`${target} = ${value}`, stmt.id);
    }
  }

  /**
   * Translates if-else statements with elif chains.
   * Python colon-based syntax with indentation.
   */
  visitIf(stmt: any): void {
    this.emit(`if ${this.generateExpression(stmt.condition, 0)}:`, stmt.id);
    this.indent();
    this.visitBlock(stmt.thenBranch);
    this.dedent();

    let currentElse = stmt.elseBranch;

    while (currentElse && currentElse.body.length === 1 && currentElse.body[0].type === 'If') {
      const elifStmt = currentElse.body[0];
      this.emit(`elif ${this.generateExpression(elifStmt.condition, 0)}:`);
      this.indent();
      this.visitBlock(elifStmt.thenBranch);
      this.dedent();
      currentElse = elifStmt.elseBranch;
    }

    if (currentElse) {
      this.emit('else:');
      this.indent();
      this.visitBlock(currentElse);
      this.dedent();
    }
  }

  /**
   * Translates while loop.
   */
  visitWhile(stmt: any): void {
    this.emit(`while ${this.generateExpression(stmt.condition, 0)}:`, stmt.id);
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
  }

  /**
   * Translates do-while loop to Python equivalent.
   * Python lacks do-while, so implements as while True with break condition.
   */
  visitDoWhile(stmt: any): void {
    this.emit(`while True:`);
    this.indent();
    this.visitBlock(stmt.body);
    this.emit(`if not (${this.generateExpression(stmt.condition, 0)}):`);
    this.indent();
    this.emit('break');
    this.dedent();
    this.dedent();
  }

  /**
   * Translates a post-condition repeat-until loop (Praxis) to Python.
   * `repeat...until(cond)` → `while True: body; if cond: break`
   */
  visitRepeatUntil(stmt: any): void {
    this.emit(`while True:`, stmt.id);
    this.indent();
    this.visitBlock(stmt.body);
    this.emit(`if ${this.generateExpression(stmt.condition, 0)}:`);
    this.indent();
    this.emit('break');
    this.dedent();
    this.dedent();
  }

  /**
   * Translates switch statement to Python if-elif-else.
   * Python lacks switch/case, so uses sequential equality checks.
   */
  visitSwitch(stmt: any): void {
    // Python has no switch: lower to if/elif/else. There is no fall-through,
    // so a case's terminating `break` is dropped (and any statements after it),
    // which would otherwise escape as a stray `break` outside a loop.
    const discriminant = this.generateExpression(stmt.discriminant, 0);
    let first = true;
    stmt.cases.forEach((caseStmt: any) => {
      if (caseStmt.test) {
        const keyword = first ? 'if' : 'elif';
        this.emit(`${keyword} ${discriminant} == ${this.generateExpression(caseStmt.test, 0)}:`);
        first = false;
      } else {
        this.emit(`else:`);
      }
      this.indent();
      let emittedBody = false;
      for (const s of caseStmt.consequent) {
        if (s.type === 'Break') break;
        this.visitStatement(s);
        emittedBody = true;
      }
      if (!emittedBody) this.emit('pass');
      this.dedent();
    });
  }

  /**
   * Visits break and returns the result.
   */
  visitBreak(_stmt: any): void {
    this.emit('break');
  }

  /**
   * Visits continue and returns the result.
   */
  visitContinue(_stmt: any): void {
    this.emit('continue');
  }

  /**
   * Attempts to extract range() arguments from a C-style for loop.
   * Returns null if the loop cannot be cleanly expressed as for-in-range.
   */
  private tryExtractRangeArgs(
    stmt: For
  ): { variable: string; start: string; end: string; step: string; inclusive: boolean } | null {
    if (!stmt.init || !stmt.condition || !stmt.update) return null;

    // init must be a simple assignment: var = start
    const init = stmt.init as any;
    if (init.type !== 'Assignment') return null;
    const variable = init.name as string;
    const start = this.generateExpression(init.value, 0);

    // condition must be: variable < end  OR  variable <= end
    if (stmt.condition.type !== 'BinaryExpression') return null;
    const cond = stmt.condition as any;
    if (cond.left?.type !== 'Identifier' || cond.left.name !== variable) return null;
    if (!['<', '<='].includes(cond.operator)) return null;
    const inclusive = cond.operator === '<=';
    const end = this.generateExpression(cond.right, 0);

    // update must be: variable++ / ++variable  OR  variable = variable + step
    const update = stmt.update as any;
    let step = '1';
    if (update.type === 'ExpressionStatement') {
      const upd = update.expression as any;
      if (upd?.type !== 'UpdateExpression') return null;
      if (upd.argument?.name !== variable || upd.operator !== '++') return null;
    } else if (update.type === 'Assignment') {
      if (update.name !== variable) return null;
      const val = update.value as any;
      if (val?.type !== 'BinaryExpression') return null;
      if (val.left?.type !== 'Identifier' || val.left.name !== variable) return null;
      if (val.operator !== '+') return null;
      step = this.generateExpression(val.right, 0);
    } else {
      return null;
    }

    return { variable, start, end, step, inclusive };
  }

  /**
   * Translates for loops in multiple formats:
   * 1. C-style: converts to for-in-range when the pattern matches, falls back to while loop
   * 2. Iterator-based: for var in iterable with optional tuple unpacking
   */
  visitFor(stmt: For): void {
    if (stmt.init && stmt.condition && stmt.update) {
      const range = this.tryExtractRangeArgs(stmt);
      if (range) {
        const { variable, start, end, step, inclusive } = range;
        const endExpr = inclusive ? `${end} + 1` : end;
        let rangeCall: string;
        if (start === '0' && step === '1') {
          rangeCall = `range(${endExpr})`;
        } else if (step === '1') {
          rangeCall = `range(${start}, ${endExpr})`;
        } else {
          rangeCall = `range(${start}, ${endExpr}, ${step})`;
        }
        this.emit(`for ${variable} in ${rangeCall}:`, stmt.id);
        this.indent();
        this.visitBlock(stmt.body);
        this.dedent();
      } else {
        this.context.symbolTable.enterScope();
        this.visitStatement(stmt.init);
        this.emit(`while ${this.generateExpression(stmt.condition, 0)}:`, stmt.id);
        this.indent();
        this.visitBlock(stmt.body);
        this.visitStatement(stmt.update);
        this.dedent();
        this.context.symbolTable.exitScope();
      }
    } else if (
      stmt.iterable?.type === 'BinaryExpression' &&
      (stmt.iterable as any).operator === '..'
    ) {
      // Praxis range operator: for x in start..end  (inclusive) → range(start, end + 1)
      const iter = stmt.iterable as any;
      const start = this.generateExpression(iter.left, 0);
      const end = this.generateExpression(iter.right, 0);
      const startIsZero = start === '0';
      const rangeCall = startIsZero ? `range(${end} + 1)` : `range(${start}, ${end} + 1)`;
      this.emit(`for ${stmt.variable} in ${rangeCall}:`, stmt.id);
      this.indent();
      this.visitBlock(stmt.body);
      this.dedent();
    } else {
      this.emit(`for ${stmt.variable} in ${this.generateExpression(stmt.iterable, 0)}:`, stmt.id);
      this.indent();
      this.visitBlock(stmt.body);
      this.dedent();
    }
  }

  /**
   * Translates function declaration with optional default parameters.
   */
  visitFunctionDeclaration(stmt: any): void {
    const params = stmt.params.map((p: any) => this.formatParameter(p)).join(', ');
    this.emit(`def ${stmt.name}(${params}):`);
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
  }

  /**
   * Emits return statement with optional return value.
   */
  visitReturn(stmt: any): void {
    this.emit(`return ${stmt.value ? this.generateExpression(stmt.value, 0) : ''}`, stmt.id);
  }

  /**
   * Emits a standalone expression statement.
   */
  visitExpressionStatement(stmt: any): void {
    // A bare `i++;` / `i--;` becomes a clean augmenting assignment statement.
    if (stmt.expression?.type === 'UpdateExpression') {
      const argStr = this.generateExpression(stmt.expression.argument, Precedence.Unary);
      const op = stmt.expression.operator === '++' ? '+' : '-';
      this.emit(`${argStr} = ${argStr} ${op} 1`, stmt.id);
      return;
    }
    this.emit(this.generateExpression(stmt.expression, 0), stmt.id);
  }

  /**
   * Translates try-except-finally statement with exception type binding.
   * Supports multiple except blocks and optional finally cleanup block.
   */
  visitTry(stmt: any): void {
    this.emit('try:');
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();

    stmt.handlers.forEach((handler: any) => {
      if (handler.exceptionType) {
        if (handler.varName) {
          this.emit(`except ${handler.exceptionType} as ${handler.varName}:`);
        } else {
          this.emit(`except ${handler.exceptionType}:`);
        }
      } else if (handler.varName) {
        // Binding a name requires a type in Python (`except as e:` is invalid).
        this.emit(`except Exception as ${handler.varName}:`);
      } else {
        this.emit(`except:`);
      }
      this.indent();
      this.visitBlock(handler.body);
      this.dedent();
    });

    if (stmt.finallyBlock) {
      this.emit('finally:');
      this.indent();
      this.visitBlock(stmt.finallyBlock);
      this.dedent();
    }
  }

  private isIntegerType(type?: string): boolean {
    if (!type) return false;
    return ['int', 'byte', 'short', 'long'].includes(type.replace(/\[\]/g, ''));
  }

  /**
   * True when `/` should be integer division. Mirrors the interpreter: only
   * operands that are *explicitly declared* integer variables count (Java/Praxis
   * `int x`). Bare int literals and untyped vars (Python/JS/CSP) do NOT — those
   * keep float division.
   */
  private isIntegerExpr(expr: any): boolean {
    return expr.type === 'Identifier' && this.declaredIntVars.has(expr.name);
  }

  /**
   * Converts AST expression nodes to Python code with proper operator precedence.
   * Handles literals, identifiers, operators, function calls, and Python-specific syntax.
   * Tracks class fields to properly prefix with self.
   */
  generateExpression(expr: Expression, parentPrecedence: number): string {
    let output = '';
    let currentPrecedence = 99;

    switch (expr.type) {
      case 'Literal':
        if (expr.value === null || expr.raw === 'None' || expr.raw === '"None"') output = 'None';
        else if (typeof expr.value === 'string') {
          const hasPyPrefix =
            expr.raw?.startsWith('f"') || expr.raw?.startsWith('r"') || expr.raw?.startsWith('b"');
          const strVal = hasPyPrefix ? expr.value.substring(1) : expr.value;
          output = `"${strVal}"`;
        } else if (typeof expr.value === 'boolean') output = expr.value ? 'True' : 'False';
        else {
          // Preserve float literals like 0.0, 3.14 — raw keeps the original token text
          const raw = expr.raw;
          output = raw && raw.includes('.') ? raw : String(expr.value);
        }
        break;
      case 'Identifier':
        if (expr.name === 'this') {
          output = 'self';
        }
        // Prefer local/parameter variables over implicit field access.
        // This prevents Java constructor params like `x` from becoming `self.x`.
        else if (this.context.symbolTable.get(expr.name) !== undefined) {
          output = expr.name;
        } else if (this.currentClassFields.has(expr.name)) {
          output = `self.${expr.name}`;
        } else {
          output = expr.name;
        }
        break;
      case 'ThisExpression':
        output = 'self';
        break;
      case 'Placeholder':
        output = '0'; // Praxis /* ... */ hole -> default value
        break;
      case 'NewExpression':
        currentPrecedence = Precedence.Instantiation;
        const args = expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ');
        output = `${expr.className}(${args})`;
        break;
      case 'IndexExpression':
        currentPrecedence = Precedence.Member;
        const objE = this.generateExpression(expr.object, currentPrecedence);
        const idxE = this.generateExpression(expr.index, 0);
        output = `${objE}[${idxE}]`;
        break;
      case 'MemberExpression':
        currentPrecedence = Precedence.Member;
        output = `${this.generateExpression(expr.object, currentPrecedence)}.${expr.property.name}`;
        break;
      case 'ConditionalExpression':
        currentPrecedence = Precedence.Conditional;
        output =
          `${this.generateExpression((expr as any).consequent, currentPrecedence)} if ` +
          `${this.generateExpression((expr as any).test, currentPrecedence)} else ` +
          `${this.generateExpression((expr as any).alternate, currentPrecedence)}`;
        break;
      case 'BinaryExpression':
        const opMap: Record<string, { op: string; prec: number }> = {
          or: { op: 'or', prec: Precedence.LogicalOr },
          and: { op: 'and', prec: Precedence.LogicalAnd },
          '==': { op: '==', prec: Precedence.Equality },
          '!=': { op: '!=', prec: Precedence.Equality },
          '<': { op: '<', prec: Precedence.Relational },
          '>': { op: '>', prec: Precedence.Relational },
          '<=': { op: '<=', prec: Precedence.Relational },
          '>=': { op: '>=', prec: Precedence.Relational },
          '+': { op: '+', prec: Precedence.Additive },
          '-': { op: '-', prec: Precedence.Additive },
          '*': { op: '*', prec: Precedence.Multiplicative },
          '/': { op: '/', prec: Precedence.Multiplicative },
          '%': { op: '%', prec: Precedence.Multiplicative },
          '**': { op: '**', prec: Precedence.Multiplicative },
          '^': { op: '**', prec: Precedence.Multiplicative },
          // '..': { op: '..', prec: Precedence.Relational }
        };
        const opData = opMap[expr.operator] || { op: expr.operator, prec: 0 };
        currentPrecedence = opData.prec;
        const leftStr = this.generateExpression(expr.left, currentPrecedence);
        const rightStr = this.generateExpression(expr.right, currentPrecedence);
        if (
          expr.operator === '/' &&
          this.isIntegerExpr(expr.left) &&
          this.isIntegerExpr(expr.right)
        ) {
          // Integer-typed operands: preserve the source's integer-division
          // semantics (truncate toward zero) rather than Python float division.
          output = `int(${leftStr} / ${rightStr})`;
          currentPrecedence = Precedence.Call;
        } else {
          output = `${leftStr} ${opData.op} ${rightStr}`;
        }
        break;
      case 'UnaryExpression':
        currentPrecedence = Precedence.Unary;
        let op = expr.operator === '!' || expr.operator === 'not' ? 'not ' : expr.operator;
        output = `${op}${this.generateExpression(expr.argument, currentPrecedence)}`;
        break;
      case 'UpdateExpression': {
        // Python has no ++/--, so lower an expression-position update to a
        // hoisted statement and yield the appropriate value. (A standalone
        // `i++;` statement is handled directly in visitExpressionStatement.)
        const argStr = this.generateExpression((expr as any).argument, Precedence.Unary);
        const op = (expr as any).operator === '++' ? '+' : '-';
        if ((expr as any).prefix) {
          this.preludeLines.push(`${argStr} = ${argStr} ${op} 1`);
          output = argStr;
        } else {
          const tmp = `_upd${this.tempCounter++}`;
          this.preludeLines.push(`${tmp} = ${argStr}`);
          this.preludeLines.push(`${argStr} = ${argStr} ${op} 1`);
          output = tmp;
        }
        currentPrecedence = Precedence.Member;
        break;
      }
      case 'CallExpression':
        currentPrecedence = Precedence.Call;
        let calleeStrPy = '';
        if ((expr.callee as any).type === 'MemberExpression') {
          calleeStrPy = this.generateExpression(expr.callee as any, 0);
        } else {
          calleeStrPy = (expr.callee as any).name;
        }

        // Handle builtins
        if ((calleeStrPy === 'len' || calleeStrPy === 'LENGTH') && expr.arguments.length === 1) {
          output = `len(${this.generateExpression(expr.arguments[0], 0)})`;
          break;
        }
        if (calleeStrPy === 'LENGTH' && expr.arguments.length === 1) {
          output = `len(${this.generateExpression(expr.arguments[0], 0)})`;
          break;
        }
        // Handle INPUT() from CSP - map to Python input()
        if (calleeStrPy === 'INPUT') {
          const argsPy = expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ');
          output = `input(${argsPy})`;
          break;
        }
        if (calleeStrPy === 'APPEND' && expr.arguments.length === 2) {
          output = `${this.generateExpression(expr.arguments[0], 0)}.append(${this.generateExpression(expr.arguments[1], 0)})`;
          break;
        }
        if (calleeStrPy === 'INSERT' && expr.arguments.length === 3) {
          output = `${this.generateExpression(expr.arguments[0], 0)}.insert(${this.generateExpression(expr.arguments[1], 0)}, ${this.generateExpression(expr.arguments[2], 0)})`;
          break;
        }
        if (calleeStrPy === 'REMOVE' && expr.arguments.length === 2) {
          output = `${this.generateExpression(expr.arguments[0], 0)}.pop(${this.generateExpression(expr.arguments[1], 0)})`;
          break;
        }

        // Java super(args) → Python super().__init__(args)
        if (calleeStrPy === 'super') {
          const superArgs = expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ');
          output = `super().__init__(${superArgs})`;
          break;
        }

        const args2Py = expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ');
        output = `${calleeStrPy}(${args2Py})`;
        break;
      case 'ArrayLiteral':
        const elems = expr.elements.map((e) => this.generateExpression(e, 0)).join(', ');
        output = `[${elems}]`;
        break;
      case 'CompoundAssignment':
        const target = (expr as any).name;
        const value = this.generateExpression((expr as any).value, 0);
        const operator = (expr as any).operator;
        output = `${target} ${operator}= ${value}`;
        break;
    }
    return currentPrecedence < parentPrecedence ? `(${output})` : output;
  }
}
