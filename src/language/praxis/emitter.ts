/**
 * Praxis Language Emitter
 * Converts AST nodes into Praxis pseudo-code.
 *
 * Key dialect rules enforced here:
 *  - `print expr` (no parentheses)
 *  - `==` for equality (not `=`)
 *  - `if (cond) ... end if` block delimiters
 *  - `while (cond) ... end while`
 *  - `repeat ... until (cond)` for post-condition loops
 *  - `for (init; cond; update) ... end for` for C-style loops
 *  - `returnType procName(params) ... end procName`
 *  - `class Name ... end class Name`
 */

import { ASTVisitor, Precedence } from '../visitor';
import type {
  Program,
  ClassDeclaration,
  FieldDeclaration,
  Constructor,
  MethodDeclaration,
  Block,
  Expression,
} from '../ast';
import { lvalueName } from '../ast';

export class PraxisEmitter extends ASTVisitor {
  // Statements hoisted ahead of the current one (Praxis has no expression-level
  // ternary, so it lowers to a temp + preceding block).
  private preludeLines: string[] = [];
  private tempCounter = 0;
  // Name of the class currently being emitted — a constructor is named after it.
  private currentClassName = '';
  // Parameter names of the constructor/method currently being emitted. A field
  // access is qualified with `this.` only when the field name is shadowed by one
  // of these (e.g. `this.name <- name`); otherwise the bare field name is used.
  private currentParams = new Set<string>();
  // Declared class names — used to render a bare constructor call (e.g. Python's
  // `Animal("Rex")`) as a Praxis `new Animal("Rex")` and to type the target.
  private classNames = new Set<string>();

  // If `expr` is a call whose callee is a known class name, returns that name.
  private classConstructorName(expr: any): string | null {
    if (expr?.type === 'CallExpression' && expr.callee?.type === 'Identifier') {
      return this.classNames.has(expr.callee.name) ? expr.callee.name : null;
    }
    return null;
  }

  // Flush hoisted prelude statements (at the current indent) before `line`.
  protected emit(line: string, nodeId?: string): void {
    if (this.preludeLines.length > 0) {
      const pending = this.preludeLines;
      this.preludeLines = [];
      for (const p of pending) super.emit(p);
    }
    super.emit(line, nodeId);
  }

  protected inferType(expr: Expression): string {
    const ctor = this.classConstructorName(expr);
    if (ctor) return ctor;
    return super.inferType(expr);
  }

  private isJavaMainClass(classDecl: ClassDeclaration): boolean {
    if (classDecl.name !== 'Main') return false;
    return classDecl.body.some(
      (m) =>
        m.type === 'MethodDeclaration' &&
        (m as MethodDeclaration).name === 'main' &&
        (m as MethodDeclaration).isStatic
    );
  }

  visitProgram(program: Program): void {
    const classes = program.body.filter((s) => s.type === 'ClassDeclaration');
    const functions = program.body.filter((s) => s.type === 'FunctionDeclaration');
    const mainBody = program.body.filter(
      (s) => s.type !== 'ClassDeclaration' && s.type !== 'FunctionDeclaration'
    );

    this.classNames = new Set(classes.map((c) => (c as ClassDeclaration).name));

    const mainClass = classes.find((c) => this.isJavaMainClass(c as ClassDeclaration));
    const otherClasses = classes.filter((c) => !this.isJavaMainClass(c as ClassDeclaration));

    otherClasses.forEach((c) => {
      this.visitClassDeclaration(c as ClassDeclaration);
      this.emit('');
    });
    functions.forEach((f) => {
      this.visitFunctionDeclaration(f as any);
      this.emit('');
    });
    mainBody.forEach((s) => this.visitStatement(s));

    if (mainClass) {
      const mainMethod = (mainClass as ClassDeclaration).body.find(
        (m) => m.type === 'MethodDeclaration' && (m as MethodDeclaration).name === 'main'
      ) as MethodDeclaration | undefined;
      if (mainMethod) this.visitBlock(mainMethod.body);
    }
  }

  visitClassDeclaration(classDecl: ClassDeclaration): void {
    const superClass = classDecl.superClass ? ` extends ${classDecl.superClass.name}` : '';
    this.emit(`class ${classDecl.name}${superClass}`);
    const prevClassName = this.currentClassName;
    this.currentClassName = classDecl.name;
    this.indent();
    this.context.symbolTable.enterScope();

    classDecl.body.forEach((m) => {
      if (m.type === 'FieldDeclaration') {
        let type = (m as any).fieldType;
        if (type === 'auto' && (m as any).initializer)
          type = this.inferType((m as any).initializer);
        this.context.symbolTable.set((m as any).name, type);
      }
    });

    // Praxis fields must be declared. Sources like Python/JS create fields
    // implicitly via `self.x`/`this.x` assignments, so declare those up front.
    const implicit = this.collectImplicitFields(classDecl);
    implicit.forEach((f) => {
      this.context.symbolTable.set(f.name, f.type);
      this.emit(`private ${f.type} ${f.name}`);
    });
    if (implicit.length > 0) this.emit('');

    classDecl.body.forEach((m) => {
      this.visitStatement(m);
      this.emit('');
    });
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit(`end class ${classDecl.name}`);
    this.currentClassName = prevClassName;
  }

  /**
   * Finds fields assigned via the receiver (`this.x`/`self.x`) in constructors
   * and methods but not explicitly declared, so the Praxis output can declare
   * them (Praxis has no implicit fields).
   */
  private collectImplicitFields(classDecl: ClassDeclaration): { name: string; type: string }[] {
    const declared = new Set(
      classDecl.body.filter((m) => m.type === 'FieldDeclaration').map((m: any) => m.name)
    );
    const found = new Map<string, string>();
    const isReceiver = (o: any) =>
      o?.type === 'ThisExpression' ||
      (o?.type === 'Identifier' && (o.name === 'this' || o.name === 'self'));

    const scan = (node: any, paramTypes: Map<string, string>): void => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'Assignment') {
        const me = node.target?.type === 'MemberExpression' ? node.target : undefined;
        const fieldName = me && isReceiver(me.object) ? me.property?.name : undefined;
        if (fieldName && !declared.has(fieldName) && !found.has(fieldName)) {
          // Prefer the type of a parameter the field is assigned from.
          let type =
            node.value?.type === 'Identifier' && paramTypes.get(node.value.name)
              ? paramTypes.get(node.value.name)!
              : this.inferType(node.value);
          if (type === 'var' || type === 'auto') type = 'Object';
          found.set(fieldName, type);
        }
      }
      for (const v of Object.values(node)) {
        if (Array.isArray(v)) v.forEach((x) => scan(x, paramTypes));
        else if (v && typeof v === 'object') scan(v, paramTypes);
      }
    };

    classDecl.body.forEach((m: any) => {
      if (m.type !== 'Constructor' && m.type !== 'MethodDeclaration') return;
      const paramTypes = new Map<string, string>();
      (m.params || []).forEach((p: any) => paramTypes.set(p.name, p.paramType || 'Object'));
      scan(m.body, paramTypes);
    });

    return Array.from(found, ([name, type]) => ({ name, type }));
  }

  visitFieldDeclaration(field: FieldDeclaration): void {
    let type =
      field.fieldType === 'auto' && field.initializer
        ? this.inferType(field.initializer)
        : field.fieldType;
    if (type === 'auto') type = 'var';

    let line = `${field.access} ${type} ${field.name}`;
    if (field.initializer) line += ` <- ${this.generateExpression(field.initializer, 0)}`;
    this.emit(line);
  }

  visitConstructor(ctor: Constructor): void {
    const params = ctor.params
      .map((p) => `${p.paramType !== 'auto' ? p.paramType + ' ' : ''}${p.name}`)
      .join(', ');
    // A constructor is named after its class, with no return type.
    this.emit(`${ctor.access} ${this.currentClassName}(${params})`);
    this.indent();
    this.context.symbolTable.enterScope();
    const prevParams = this.currentParams;
    this.currentParams = new Set(ctor.params.map((p) => p.name));
    ctor.params.forEach((p) => this.context.symbolTable.set(p.name, p.paramType || 'auto'));
    this.visitBlock(ctor.body);
    this.currentParams = prevParams;
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit(`end ${this.currentClassName}`);
  }

  visitMethodDeclaration(method: MethodDeclaration): void {
    let returnType = method.returnType === 'auto' ? '' : method.returnType;

    // Attempt to infer return type from body if still unknown.
    if (returnType === '' || returnType === 'var') {
      const inferred = this.inferBodyReturnType(method.body);
      returnType = inferred && inferred !== 'var' ? inferred : 'void';
    }

    const params = method.params
      .map((p) => {
        const t = p.paramType && p.paramType !== 'auto' ? `${p.paramType} ` : '';
        return `${t}${p.name}`.trim();
      })
      .join(', ');

    this.emit(`${method.access} ${returnType} ${method.name}(${params})`);
    this.indent();
    this.context.symbolTable.enterScope();
    const prevParams = this.currentParams;
    this.currentParams = new Set(method.params.map((p) => p.name));
    method.params.forEach((p) => this.context.symbolTable.set(p.name, p.paramType || 'auto'));
    this.visitBlock(method.body);
    this.currentParams = prevParams;
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit(`end ${method.name}`);
  }

  visitBlock(block: Block): void {
    block.body.forEach((s) => this.visitStatement(s));
  }

  visitPrint(stmt: any): void {
    const args = stmt.expressions.map((e: any) => this.generateExpression(e, 0));
    // Separator / newline control has no dedicated syntax in Praxis; it is carried
    // in a trailing comment that the parser reads back (see parsePrintCommentMetadata).
    const notes: string[] = [];
    if (stmt.appendLineFeed === false && stmt.separator === ' ') {
      // Value followed by a space, no newline (e.g. from CSP DISPLAY). The parser
      // maps "space after" back to separator=' ' + appendLineFeed=false.
      notes.push('space after');
    } else {
      if (stmt.separator === '') notes.push('no separator');
      if (stmt.appendLineFeed === false) notes.push('no line feed');
    }
    const comment = notes.length ? `  // ${notes.join(', ')}` : '';
    if (args.length === 1) {
      this.emit(`print ${args[0]}${comment}`, stmt.id);
    } else {
      // Texas dialect: print(arg1, arg2, ...)
      this.emit(`print (${args.join(', ')})${comment}`, stmt.id);
    }
  }

  visitAssignment(stmt: any): void {
    // Bare declaration (`int x;` / JS `let x;`): emit a typed default declaration
    // when the type is known; for an untyped (auto) one, defer to the first real
    // assignment rather than rendering the placeholder value (e.g. JS `undefined`).
    if (stmt.declaredWithoutInitializer) {
      const declName = lvalueName(stmt);
      const declType =
        stmt.varType && stmt.varType !== 'auto' && stmt.varType !== 'var' ? stmt.varType : '';
      if (declName && declType) {
        this.emit(`${declType} ${declName}`, stmt.id);
        this.context.symbolTable.set(declName, declType);
      } else if (declName) {
        this.emit(`// ${declName} declared without initializer`, stmt.id);
      }
      return;
    }
    if (stmt.target?.type === 'ArrayLiteral') {
      const targets = stmt.target.elements;
      if (stmt.value?.type === 'ArrayLiteral') {
        const values = stmt.value.elements;
        targets.forEach((target: any, i: number) => {
          if (target.type !== 'Identifier') return;
          const varName = target.name;
          const valStr = this.generateExpression(values[i], 0);
          let type = this.inferType(values[i]);
          if (type === 'var') type = 'int';
          if (this.context.symbolTable.get(varName) === undefined) {
            this.emit(`${type} ${varName} <- ${valStr}`, stmt.id);
            this.context.symbolTable.set(varName, type);
          } else {
            this.emit(`${varName} <- ${valStr}`, stmt.id);
          }
        });
      }
      return;
    }

    const rVal = this.generateExpression(stmt.value, 0);
    let initVal = rVal;
    if (stmt.value?.type === 'ArrayLiteral') {
      if (initVal.startsWith('[') && initVal.endsWith(']')) {
        initVal = '{' + initVal.slice(1, -1) + '}';
      }
    }

    const name = lvalueName(stmt);
    const targetStr = this.generateExpression(stmt.target, 0);

    // Member/index mutation (e.g. obj.field <- v, arr[i] <- v) — never a declaration.
    if (name === undefined) {
      this.emit(`${targetStr} <- ${rVal}`, stmt.id);
      return;
    }

    if (stmt.varType) {
      let type = stmt.varType;
      if (type === 'auto' || type === 'var') {
        // A dynamically-typed source (JS `let`/`const`/`var` all lower to
        // `auto`) stays untyped in Praxis: integer values keep their native
        // display (no forced `.0`), and `/` still divides as float because the
        // interpreter does not truncate untyped operands.
        this.emit(`${targetStr} <- ${initVal}`, stmt.id);
        this.context.symbolTable.set(name, 'auto');
      } else {
        this.emit(`${type} ${targetStr} <- ${initVal}`, stmt.id);
        this.context.symbolTable.set(name, type);
      }
    } else if (this.context.symbolTable.get(name) !== undefined) {
      this.emit(`${targetStr} <- ${rVal}`, stmt.id);
    } else {
      let type = this.inferType(stmt.value);
      if (type === 'var') type = 'int';
      this.emit(`${type} ${targetStr} <- ${initVal}`, stmt.id);
      this.context.symbolTable.set(name, type);
    }
  }

  visitIf(stmt: any): void {
    this.emit(`if (${this.generateExpression(stmt.condition, 0)})`, stmt.id);
    this.indent();
    this.context.symbolTable.enterScope();
    this.visitBlock(stmt.thenBranch);
    this.context.symbolTable.exitScope();
    this.dedent();

    // An else branch that is exactly a single nested `if` is an else-if chain;
    // emit it as `else if (...)` rather than a nested `if ... end if`.
    const isElseIf = (b: any) =>
      b && b.type === 'Block' && b.body.length === 1 && b.body[0].type === 'If';
    let elseBranch = stmt.elseBranch;
    while (isElseIf(elseBranch)) {
      const nested = elseBranch.body[0];
      this.emit(`else if (${this.generateExpression(nested.condition, 0)})`, nested.id);
      this.indent();
      this.context.symbolTable.enterScope();
      this.visitBlock(nested.thenBranch);
      this.context.symbolTable.exitScope();
      this.dedent();
      elseBranch = nested.elseBranch;
    }

    if (elseBranch) {
      this.emit('else');
      this.indent();
      this.context.symbolTable.enterScope();
      this.visitBlock(elseBranch);
      this.context.symbolTable.exitScope();
      this.dedent();
    }
    this.emit('end if');
  }

  visitWhile(stmt: any): void {
    this.emit(`while (${this.generateExpression(stmt.condition, 0)})`, stmt.id);
    this.indent();
    this.context.symbolTable.enterScope();
    this.visitBlock(stmt.body);
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit('end while');
  }

  visitDoWhile(stmt: any): void {
    this.emit(`do`, stmt.id);
    this.indent();
    this.context.symbolTable.enterScope();
    this.visitBlock(stmt.body);
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit(`while (${this.generateExpression(stmt.condition, 0)})`);
  }

  visitRepeatUntil(stmt: any): void {
    this.emit('repeat', stmt.id);
    this.indent();
    this.context.symbolTable.enterScope();
    this.visitBlock(stmt.body);
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit(`until (${this.generateExpression(stmt.condition, 0)})`);
  }

  visitSwitch(stmt: any): void {
    // Praxis has no switch/case; lower a (break-terminated) switch to an
    // `if / else if / ... / else` chain comparing the discriminant to each
    // case's test. A `default` case becomes the trailing `else`.
    const disc = this.generateExpression(stmt.discriminant, 0);
    const cases: any[] = stmt.cases;
    const stripBreak = (body: any[]): any[] => body.filter((s) => s.type !== 'Break');
    const testable = cases.filter((c) => c.test);
    const defaultCase = cases.find((c) => !c.test);

    if (testable.length === 0) {
      if (defaultCase) stripBreak(defaultCase.consequent).forEach((s) => this.visitStatement(s));
      return;
    }

    testable.forEach((c, i) => {
      const cond = `${disc} == ${this.generateExpression(c.test, 0)}`;
      this.emit(i === 0 ? `if (${cond})` : `else if (${cond})`, i === 0 ? stmt.id : undefined);
      this.indent();
      stripBreak(c.consequent).forEach((s) => this.visitStatement(s));
      this.dedent();
    });

    if (defaultCase) {
      this.emit('else');
      this.indent();
      stripBreak(defaultCase.consequent).forEach((s) => this.visitStatement(s));
      this.dedent();
    }

    this.emit('end if');
  }

  visitBreak(stmt: any): void {
    this.emit('break', stmt.id);
  }
  visitContinue(stmt: any): void {
    this.emit('continue', stmt.id);
  }

  visitFor(stmt: any): void {
    this.context.symbolTable.enterScope();
    let initCode = '';
    if (stmt.init?.type === 'Assignment') {
      const initName = lvalueName(stmt.init) ?? '';
      const rVal = this.generateExpression(stmt.init.value, 0);
      let type = stmt.init.varType || this.inferType(stmt.init.value);
      if (type === 'var') type = 'int';
      initCode = `${type} ${initName} <- ${rVal}`;
      this.context.symbolTable.set(initName, type);
    } else if (stmt.init) {
      initCode = this.generateExpression(stmt.init.expression, 0);
    }
    const condCode = stmt.condition ? this.generateExpression(stmt.condition, 0) : '';
    let updateCode = '';
    if (stmt.update?.type === 'Assignment') {
      const ut = this.generateExpression(stmt.update.target, 0);
      updateCode = `${ut} <- ${this.generateExpression(stmt.update.value, 0)}`;
    } else if (stmt.update) {
      updateCode = this.generateExpression(stmt.update.expression, 0);
    }
    this.emit(`for (${initCode}; ${condCode}; ${updateCode})`, stmt.id);
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit('end for');
    this.context.symbolTable.exitScope();
  }

  visitForEach(stmt: any): void {
    if (stmt.iterable?.type === 'CallExpression' && stmt.iterable.callee?.name === 'range') {
      const args = stmt.iterable.arguments;
      let start = '0',
        end = '0',
        step = '1';
      if (args.length === 1) end = this.generateExpression(args[0], 0);
      else if (args.length >= 2) {
        start = this.generateExpression(args[0], 0);
        end = this.generateExpression(args[1], 0);
      }
      if (args.length === 3) step = this.generateExpression(args[2], 0);
      this.emit(
        `for (int ${stmt.variable} <- ${start}; ${stmt.variable} < ${end}; ${stmt.variable} <- ${stmt.variable} + ${step})`,
        stmt.id
      );
      this.indent();
      this.visitBlock(stmt.body);
      this.dedent();
      this.emit('end for');
    } else {
      // Praxis has no for-each; lower iterating a collection/string to a C-style
      // index loop. The source is copied into an (untyped) temp so it is only
      // evaluated once, and the loop variable is assigned dynamically so it takes
      // the element's type without a declaration.
      const n = this.tempCounter++;
      const arr = `_arr${n}`;
      const idx = `_i${n}`;
      this.context.symbolTable.enterScope();
      this.emit(`${arr} <- ${this.generateExpression(stmt.iterable, 0)}`, stmt.id);
      this.emit(`for (int ${idx} <- 0; ${idx} < ${arr}.length; ${idx} <- ${idx} + 1)`);
      this.indent();
      this.emit(`${stmt.variable} <- ${arr}[${idx}]`);
      this.context.symbolTable.set(stmt.variable, 'var');
      this.visitBlock(stmt.body);
      this.dedent();
      this.emit('end for');
      this.context.symbolTable.exitScope();
    }
  }

  visitFunctionDeclaration(stmt: any): void {
    this.context.symbolTable.enterScope();

    // Use explicit return type if provided, otherwise infer from body
    let returnType: string = stmt.returnType && stmt.returnType !== 'auto' ? stmt.returnType : '';
    if (!returnType || returnType === 'void') {
      const inferred = this.inferBodyReturnType(stmt.body);
      returnType = inferred && inferred !== 'void' && inferred !== 'var' ? inferred : 'void';
    }

    const params = stmt.params
      .map((p: any) => {
        const t = p.paramType && p.paramType !== 'auto' ? `${p.paramType} ` : '';
        return `${t}${p.name}`;
      })
      .join(', ');

    const keyword = returnType === 'void' ? 'procedure' : returnType;
    this.emit(`${keyword} ${stmt.name}(${params})`);
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit(`end ${stmt.name}`);
    this.context.symbolTable.exitScope();
  }

  visitReturn(stmt: any): void {
    this.emit(`return ${stmt.value ? this.generateExpression(stmt.value, 0) : ''}`, stmt.id);
  }

  visitExpressionStatement(stmt: any): void {
    // A bare `i++` / `--i` statement is ambiguous in Praxis (no statement
    // terminators, so `i++\n--j` would re-associate); lower it to `i <- i ± 1`.
    const e = stmt.expression;
    if (e?.type === 'UpdateExpression') {
      const target = this.generateExpression(e.argument, 0);
      const op = e.operator === '++' ? '+' : '-';
      this.emit(`${target} <- ${target} ${op} 1`, stmt.id);
      return;
    }
    this.emit(this.generateExpression(stmt.expression, 0), stmt.id);
  }

  visitTry(stmt: any): void {
    this.emit('try', stmt.id);
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    stmt.handlers.forEach((h: any) => {
      let head = 'catch';
      if (h.exceptionType) head += ` ${h.exceptionType}`;
      if (h.varName) head += ` as ${h.varName}`;
      this.emit(head);
      this.indent();
      this.visitBlock(h.body);
      this.dedent();
    });
    if (stmt.finallyBlock) {
      this.emit('finally');
      this.indent();
      this.visitBlock(stmt.finallyBlock);
      this.dedent();
    }
    this.emit('end try');
  }

  /** Scans a block for return statements to infer the return type. */
  private inferBodyReturnType(body: Block): string {
    for (const stmt of body.body) {
      if (stmt.type === 'Return') {
        const val = (stmt as any).value;
        if (val) {
          const t = this.inferType(val);
          if (t !== 'var' && t !== 'Object') return t;
        }
        return 'void';
      }
      if (stmt.type === 'If') {
        const t = this.inferBodyReturnType((stmt as any).thenBranch);
        if (t !== 'void') return t;
        if ((stmt as any).elseBranch) {
          const e = this.inferBodyReturnType((stmt as any).elseBranch);
          if (e !== 'void') return e;
        }
      }
      if (
        stmt.type === 'While' ||
        stmt.type === 'For' ||
        stmt.type === 'DoWhile' ||
        stmt.type === 'RepeatUntil'
      ) {
        const t = this.inferBodyReturnType((stmt as any).body);
        if (t !== 'void') return t;
      }
    }
    return 'void';
  }

  generateExpression(expr: Expression, parentPrecedence: number): string {
    let output = '';
    let currentPrecedence = 99;

    switch (expr.type) {
      case 'Literal':
        if (expr.value === null) output = 'null';
        else if (typeof expr.value === 'string') {
          const hasPyPrefix =
            expr.raw?.startsWith('f"') || expr.raw?.startsWith('r"') || expr.raw?.startsWith('b"');
          const v = hasPyPrefix ? expr.value.substring(1) : expr.value;
          // A single-quoted raw marks a char literal; keep the single quotes.
          if (expr.raw?.startsWith("'")) {
            output = `'${this.escapeString(v, "'")}'`;
          } else {
            output = `"${this.escapeString(v)}"`;
          }
        } else if (typeof expr.value === 'boolean') {
          output = expr.value ? 'true' : 'false';
        } else {
          output = String(expr.value);
        }
        break;

      case 'Identifier':
        output = expr.name;
        break;

      case 'ThisExpression':
        output = 'this';
        break;
      case 'Placeholder':
        output = `/* ${(expr as any).text} */`;
        break;

      case 'NewExpression': {
        currentPrecedence = Precedence.Instantiation;
        const args = expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ');
        output = `new ${expr.className}(${args})`;
        break;
      }

      case 'IndexExpression': {
        currentPrecedence = Precedence.Member;
        const objExpr = this.generateExpression(expr.object, currentPrecedence);
        const convertIdx = (idx: any): string => {
          if (!idx) return '0';
          if (idx.type === 'Literal' && typeof idx.value === 'number' && idx.value < 0)
            return `${objExpr}.length - ${Math.abs(idx.value)}`;
          if (
            idx.type === 'UnaryExpression' &&
            idx.operator === '-' &&
            idx.argument.type === 'Literal'
          )
            return `${objExpr}.length - ${idx.argument.value}`;
          return this.generateExpression(idx, 0);
        };
        output = `${objExpr}[${convertIdx(expr.index)}]`;
        break;
      }

      case 'MemberExpression': {
        currentPrecedence = Precedence.Member;
        // A field access on the receiver is normally written as the bare field
        // name (Praxis has no `this`). The optional `this.` prefix — a Praxly
        // extension — is emitted only when a parameter shadows the field name.
        const obj = expr.object as any;
        const isReceiver =
          obj.type === 'ThisExpression' ||
          (obj.type === 'Identifier' && (obj.name === 'this' || obj.name === 'self'));
        if (isReceiver) {
          output = this.currentParams.has(expr.property.name)
            ? `this.${expr.property.name}`
            : expr.property.name;
        } else {
          output = `${this.generateExpression(expr.object, currentPrecedence)}.${expr.property.name}`;
        }
        break;
      }

      case 'BinaryExpression': {
        // String membership (`x in s`) → Praxis String.contains.
        if (expr.operator === 'in' || expr.operator === 'not in') {
          const needle = this.generateExpression(expr.left, Precedence.Call);
          const hay = this.generateExpression(expr.right, Precedence.Call);
          const call = `${hay}.contains(${needle})`;
          output = expr.operator === 'in' ? call : `not ${call}`;
          currentPrecedence = expr.operator === 'in' ? Precedence.Call : Precedence.Unary;
          break;
        }
        const opMap: Record<string, { op: string; prec: number }> = {
          or: { op: 'or', prec: Precedence.LogicalOr },
          and: { op: 'and', prec: Precedence.LogicalAnd },
          '==': { op: '==', prec: Precedence.Equality }, // Praxis uses ==
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
          '**': { op: '^', prec: Precedence.Exponential },
          '^': { op: '^', prec: Precedence.Exponential },
        };
        const od = opMap[expr.operator] ?? { op: expr.operator, prec: 0 };
        currentPrecedence = od.prec;
        output = `${this.generateExpression(expr.left, currentPrecedence)} ${od.op} ${this.generateExpression(expr.right, currentPrecedence)}`;
        break;
      }

      case 'UnaryExpression': {
        currentPrecedence = Precedence.Unary;
        const op = expr.operator === '!' || expr.operator === 'not' ? 'not ' : expr.operator;
        output = `${op}${this.generateExpression(expr.argument, currentPrecedence)}`;
        break;
      }

      case 'UpdateExpression': {
        const argStr = this.generateExpression((expr as any).argument, Precedence.Unary);
        const upOp = (expr as any).operator;
        output = (expr as any).prefix ? `${upOp}${argStr}` : `${argStr}${upOp}`;
        break;
      }

      case 'CompoundAssignment': {
        // Praxis has no `+=`; expand to `target <- target op right`.
        const target = (expr as any).left
          ? this.generateExpression((expr as any).left, 0)
          : (expr as any).name;
        const op = (expr as any).operator;
        output = `${target} <- ${target} ${op} ${this.generateExpression((expr as any).right, 0)}`;
        break;
      }

      case 'ConditionalExpression': {
        // Praxis has no ternary; hoist into an if/else that assigns a temp.
        const tmp = `_tern${this.tempCounter++}`;
        this.preludeLines.push(`if (${this.generateExpression((expr as any).test, 0)})`);
        this.preludeLines.push(
          `  ${tmp} <- ${this.generateExpression((expr as any).consequent, 0)}`
        );
        this.preludeLines.push(`else`);
        this.preludeLines.push(
          `  ${tmp} <- ${this.generateExpression((expr as any).alternate, 0)}`
        );
        this.preludeLines.push(`end if`);
        output = tmp;
        break;
      }

      case 'CallExpression': {
        currentPrecedence = Precedence.Call;
        // Praxis uses the Java-style string-method names; normalize Python
        // spellings (upper/lower/find) to them.
        {
          const mc = expr.callee as any;
          if (mc.type === 'MemberExpression') {
            const pxName = (
              { upper: 'toUpperCase', lower: 'toLowerCase', find: 'indexOf' } as Record<
                string,
                string
              >
            )[mc.property?.name];
            // `typeof === 'string'` guards against inherited Object keys like
            // `toString`/`constructor` (which would otherwise resolve to a function).
            if (typeof pxName === 'string') {
              const objStr = this.generateExpression(mc.object, Precedence.Member);
              const a = expr.arguments.map((x) => this.generateExpression(x, 0)).join(', ');
              output = `${objStr}.${pxName}(${a})`;
              break;
            }
          }
        }
        const calleeStr =
          (expr.callee as any).type === 'MemberExpression'
            ? this.generateExpression(expr.callee as any, 0)
            : (expr.callee as any).name;

        if ((calleeStr === 'len' || calleeStr === 'LENGTH') && expr.arguments.length === 1) {
          output = `${this.generateExpression(expr.arguments[0], 0)}.length`;
          break;
        }
        const argsStr = expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ');
        // Praxis's string-conversion built-in is `str()`; `String`/`STRING` (the
        // type keyword) is not callable, so remap conversion calls onto `str`.
        if (calleeStr === 'String' || calleeStr === 'STRING') {
          output = `str(${argsStr})`;
          break;
        }
        // Java Integer.parseInt / Double.parseDouble → Praxis int()/float(). This
        // is idiomatic and avoids `Double` (which lowercases to the `double`
        // keyword and can't appear in expression position).
        const mcallee = expr.callee as any;
        if (mcallee.type === 'MemberExpression' && mcallee.object?.type === 'Identifier') {
          if (mcallee.object.name === 'Integer' && mcallee.property?.name === 'parseInt') {
            output = `int(${argsStr})`;
            break;
          }
          if (mcallee.object.name === 'Double' && mcallee.property?.name === 'parseDouble') {
            output = `float(${argsStr})`;
            break;
          }
        }
        // A bare call to a class name (e.g. Python's `Animal("Rex")`) is an
        // instantiation; Praxis requires the explicit `new`.
        output = this.classConstructorName(expr)
          ? `new ${calleeStr}(${argsStr})`
          : `${calleeStr}(${argsStr})`;
        break;
      }

      case 'ArrayLiteral': {
        const elems = expr.elements.map((e) => this.generateExpression(e, 0)).join(', ');
        output = `{${elems}}`;
        break;
      }

      case 'ArrayCreation': {
        const ac = expr as any;
        output = `new ${ac.elementType}[${this.generateExpression(ac.size, 0)}]`;
        break;
      }
    }

    return currentPrecedence < parentPrecedence ? `(${output})` : output;
  }
}
