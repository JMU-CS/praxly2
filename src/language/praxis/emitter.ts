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

export class PraxisEmitter extends ASTVisitor {
  // Statements hoisted ahead of the current one (Praxis has no expression-level
  // ternary/slice/list-comprehension, so each lowers to a temp + preceding block).
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

  // Builds a Praxis `for` header for a comprehension/loop over `iterable`.
  // A range(...) call becomes a C-style counter loop; anything else a for-in.
  private comprehensionForHeader(variable: string, iterable: any): string {
    if (iterable?.type === 'CallExpression' && iterable.callee?.name === 'range') {
      const args = iterable.arguments;
      let start = '0',
        end = '0',
        step = '1';
      if (args.length === 1) end = this.generateExpression(args[0], 0);
      else if (args.length >= 2) {
        start = this.generateExpression(args[0], 0);
        end = this.generateExpression(args[1], 0);
      }
      if (args.length === 3) step = this.generateExpression(args[2], 0);
      return `for (int ${variable} <- ${start}; ${variable} < ${end}; ${variable} <- ${variable} + ${step})`;
    }
    return `for ${variable} in ${this.generateExpression(iterable, 0)}`;
  }

  protected inferType(expr: Expression): string {
    // A comprehension yields a list; type it by its element so the assignment
    // doesn't fall back to a scalar `int`.
    if ((expr as any).type === 'ListComprehension') {
      return this.inferType((expr as any).element) + '[]';
    }
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
        const me =
          node.target?.type === 'MemberExpression'
            ? node.target
            : node.memberExpr?.type === 'MemberExpression'
              ? node.memberExpr
              : undefined;
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
    if (stmt.separator === '') notes.push('no separator');
    if (stmt.appendLineFeed === false) notes.push('no line feed');
    const comment = notes.length ? `  // ${notes.join(', ')}` : '';
    if (args.length === 1) {
      this.emit(`print ${args[0]}${comment}`, stmt.id);
    } else {
      // Texas dialect: print(arg1, arg2, ...)
      this.emit(`print (${args.join(', ')})${comment}`, stmt.id);
    }
  }

  visitAssignment(stmt: any): void {
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

    if (stmt.isMemberAssignment && stmt.memberExpr) {
      this.emit(`${this.generateExpression(stmt.memberExpr, 0)} <- ${rVal}`, stmt.id);
      return;
    }

    const targetStr = stmt.target ? this.generateExpression(stmt.target, 0) : stmt.name;

    if (stmt.varType) {
      let type = stmt.varType;
      if (type === 'auto' || type === 'var') {
        type = this.inferType(stmt.value);
        if (type === 'var') type = 'int';
        // A dynamically-typed source (JS `let`/`const`/`var` all lower to
        // `auto`) has float numbers, so an inferred `int` becomes `double` to
        // keep `/` as float division after translation.
        if (type === 'int') type = 'double';
      }
      this.emit(`${type} ${targetStr} <- ${initVal}`, stmt.id);
      this.context.symbolTable.set(stmt.name, type);
    } else if (stmt.target && stmt.target.type !== 'Identifier') {
      this.emit(`${targetStr} <- ${rVal}`, stmt.id);
    } else if (this.context.symbolTable.get(stmt.name) !== undefined) {
      this.emit(`${targetStr} <- ${rVal}`, stmt.id);
    } else {
      let type = this.inferType(stmt.value);
      if (type === 'var') type = 'int';
      this.emit(`${type} ${targetStr} <- ${initVal}`, stmt.id);
      this.context.symbolTable.set(stmt.name, type);
    }
  }

  visitIf(stmt: any): void {
    this.emit(`if (${this.generateExpression(stmt.condition, 0)})`, stmt.id);
    this.indent();
    this.context.symbolTable.enterScope();
    this.visitBlock(stmt.thenBranch);
    this.context.symbolTable.exitScope();
    this.dedent();

    // Praxis has no `else if`; an else-if chain is written as a nested `if`
    // inside the `else` block (each with its own `end if`). Emitting the
    // elseBranch as an ordinary block yields exactly that nesting.
    if (stmt.elseBranch) {
      this.emit('else');
      this.indent();
      this.context.symbolTable.enterScope();
      this.visitBlock(stmt.elseBranch);
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
    this.emit(`do`);
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
    // Praxis has no switch/case; lower a (break-terminated) switch to a nested
    // if / else { if ... } chain comparing the discriminant to each case's test.
    // A `default` case becomes the innermost `else`.
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
      if (i === 0) {
        this.emit(`if (${cond})`, stmt.id);
      } else {
        this.emit('else');
        this.indent();
        this.emit(`if (${cond})`);
      }
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
    for (let i = 1; i < testable.length; i++) {
      this.dedent();
      this.emit('end if');
    }
  }

  visitBreak(_stmt: any): void {
    this.emit('break');
  }
  visitContinue(_stmt: any): void {
    this.emit('continue');
  }

  visitFor(stmt: any): void {
    if (stmt.init && stmt.condition && stmt.update) {
      this.context.symbolTable.enterScope();
      let initCode = '';
      if (stmt.init.type === 'Assignment') {
        const rVal = this.generateExpression(stmt.init.value, 0);
        let type = stmt.init.varType || this.inferType(stmt.init.value);
        if (type === 'var') type = 'int';
        initCode = `${type} ${stmt.init.name} <- ${rVal}`;
        this.context.symbolTable.set(stmt.init.name, type);
      } else {
        initCode = this.generateExpression(stmt.init.expression, 0);
      }
      const condCode = this.generateExpression(stmt.condition, 0);
      let updateCode = '';
      if (stmt.update.type === 'Assignment') {
        const ut = stmt.update.target
          ? this.generateExpression(stmt.update.target, 0)
          : stmt.update.name;
        updateCode = `${ut} <- ${this.generateExpression(stmt.update.value, 0)}`;
      } else {
        updateCode = this.generateExpression(stmt.update.expression, 0);
      }
      this.emit(`for (${initCode}; ${condCode}; ${updateCode})`, stmt.id);
      this.indent();
      this.visitBlock(stmt.body);
      this.dedent();
      this.emit('end for');
      this.context.symbolTable.exitScope();
    } else if (stmt.iterable?.type === 'CallExpression' && stmt.iterable.callee?.name === 'range') {
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
    } else if (
      stmt.variables?.length > 1 &&
      stmt.iterable?.type === 'CallExpression' &&
      stmt.iterable.callee?.name === 'enumerate'
    ) {
      const arr = this.generateExpression(stmt.iterable.arguments[0], 0);
      const [idx, val] = stmt.variables;
      this.emit(`for (int ${idx} <- 0; ${idx} < ${arr}.length; ${idx} <- ${idx} + 1)`, stmt.id);
      this.indent();
      // Bare assignment (no `var`) so reusing an element name across loops
      // doesn't trip the interpreter's re-declaration check.
      this.emit(`${val} <- ${arr}[${idx}]`);
      this.visitBlock(stmt.body);
      this.dedent();
      this.emit('end for');
    } else {
      this.emit(`for ${stmt.variable} in ${this.generateExpression(stmt.iterable, 0)}`, stmt.id);
      this.indent();
      this.context.symbolTable.enterScope();
      this.context.symbolTable.set(stmt.variable, 'var');
      this.visitBlock(stmt.body);
      this.context.symbolTable.exitScope();
      this.dedent();
      this.emit('end for');
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
    this.emit('try');
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
          output = `"${v}"`;
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
        if (expr.indexEnd || expr.indexStep) {
          // Praxis has no slice syntax; hoist `obj[start:end:step]` into a loop
          // that appends into a fresh list, and yield that list variable.
          const tmp = `_slice${this.tempCounter++}`;
          const iv = `_i${this.tempCounter++}`;
          const start = expr.index ? convertIdx(expr.index) : '0';
          const end = expr.indexEnd ? convertIdx(expr.indexEnd) : `${objExpr}.length`;
          const step = expr.indexStep ? this.generateExpression(expr.indexStep, 0) : '1';
          this.preludeLines.push(`${tmp} <- {}`);
          this.preludeLines.push(
            `for (int ${iv} <- ${start}; ${iv} < ${end}; ${iv} <- ${iv} + ${step})`
          );
          this.preludeLines.push(`  ${tmp}.append(${objExpr}[${iv}])`);
          this.preludeLines.push(`end for`);
          output = tmp;
        } else {
          output = `${objExpr}[${convertIdx(expr.index)}]`;
        }
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
          '..': { op: '..', prec: Precedence.Relational },
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

      case 'ListComprehension': {
        // Praxis has no comprehension; hoist into a loop that appends into a list.
        const comp = expr as any;
        const tmp = `_comp${this.tempCounter++}`;
        this.preludeLines.push(`${tmp} <- {}`);
        const header = this.comprehensionForHeader(comp.variable, comp.iterable);
        this.preludeLines.push(header);
        this.preludeLines.push(`  ${tmp}.append(${this.generateExpression(comp.element, 0)})`);
        this.preludeLines.push(`end for`);
        output = tmp;
        break;
      }

      case 'CallExpression': {
        currentPrecedence = Precedence.Call;
        const calleeStr =
          (expr.callee as any).type === 'MemberExpression'
            ? this.generateExpression(expr.callee as any, 0)
            : (expr.callee as any).name;

        if ((calleeStr === 'len' || calleeStr === 'LENGTH') && expr.arguments.length === 1) {
          output = `${this.generateExpression(expr.arguments[0], 0)}.length`;
          break;
        }
        const argsStr = expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ');
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
    }

    return currentPrecedence < parentPrecedence ? `(${output})` : output;
  }
}
