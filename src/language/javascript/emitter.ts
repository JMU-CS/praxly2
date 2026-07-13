/**
 * JavaScript Language Emitter
 * Converts AST nodes into JavaScript source code.
 * Generates modern JS (let/const, arrow-friendly, console.log).
 * Handles Java-style class/OOP translation to JS class syntax.
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
  ForEach,
  Expression,
} from '../ast';
import { lvalueName } from '../ast';

export class JavaScriptEmitter extends ASTVisitor {
  // Track declared variable names so we only emit `let` on first assignment
  private declaredVars = new Set<string>();
  private inClass = false;
  private currentClassFields = new Set<string>();
  // Names declared with an integer type (drives Math.trunc integer division).
  private declaredIntVars = new Set<string>();

  private isIntegerType(type?: string): boolean {
    if (!type) return false;
    return ['int', 'byte', 'short', 'long'].includes(type.replace(/\[\]/g, ''));
  }

  private isIntegerExpr(expr: any): boolean {
    return expr.type === 'Identifier' && this.declaredIntVars.has(expr.name);
  }

  // If `iterable` is a range(...) call, return a C-style `for (...)` header for
  // `variable`; otherwise null (caller falls back to for-of).
  private rangeForHeader(variable: string, iterable: any): string | null {
    if (iterable?.type !== 'CallExpression' || (iterable.callee as any)?.name !== 'range') {
      return null;
    }
    const a = iterable.arguments;
    let start = '0';
    let end = '0';
    let step = '1';
    if (a.length === 1) {
      end = this.generateExpression(a[0], 0);
    } else if (a.length === 2) {
      start = this.generateExpression(a[0], 0);
      end = this.generateExpression(a[1], 0);
    } else if (a.length >= 3) {
      start = this.generateExpression(a[0], 0);
      end = this.generateExpression(a[1], 0);
      step = this.generateExpression(a[2], 0);
    }
    const update = step === '1' ? `${variable}++` : `${variable} += ${step}`;
    return `for (let ${variable} = ${start}; ${variable} < ${end}; ${update})`;
  }

  visitProgram(program: Program): void {
    const classes = program.body.filter((s) => s.type === 'ClassDeclaration');
    const nonClasses = program.body.filter((s) => s.type !== 'ClassDeclaration');

    const mainClass = classes.find((c) => this.isJavaMainClass(c as ClassDeclaration));
    const otherClasses = classes.filter((c) => !this.isJavaMainClass(c as ClassDeclaration));

    otherClasses.forEach((c) => {
      this.visitClassDeclaration(c as ClassDeclaration);
      this.emit('');
    });

    const functions = nonClasses.filter((s) => s.type === 'FunctionDeclaration');
    const mainBody = nonClasses.filter((s) => s.type !== 'FunctionDeclaration');

    functions.forEach((f) => {
      this.visitStatement(f);
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

  private isJavaMainClass(c: ClassDeclaration): boolean {
    return (
      c.name === 'Main' &&
      c.body.some(
        (m) =>
          m.type === 'MethodDeclaration' &&
          (m as MethodDeclaration).name === 'main' &&
          (m as MethodDeclaration).isStatic
      )
    );
  }

  visitClassDeclaration(classDecl: ClassDeclaration): void {
    const base = classDecl.superClass ? ` extends ${classDecl.superClass.name}` : '';
    this.emit(`class ${classDecl.name}${base} {`);
    this.indent();

    // collect field names for `this.` prefixing
    this.currentClassFields = new Set(
      classDecl.body
        .filter((m) => m.type === 'FieldDeclaration')
        .map((m) => (m as FieldDeclaration).name)
    );
    this.inClass = true;

    classDecl.body.forEach((member) => {
      this.visitStatement(member);
      this.emit('');
    });

    this.inClass = false;
    this.currentClassFields = new Set();
    this.dedent();
    this.emit('}');
  }

  visitFieldDeclaration(field: FieldDeclaration): void {
    // JS class fields (stage-3 syntax)
    if (field.initializer) {
      this.emit(`${field.name} = ${this.generateExpression(field.initializer, 0)};`);
    } else {
      this.emit(`${field.name};`);
    }
  }

  visitConstructor(ctor: Constructor): void {
    const params = ctor.params
      .filter((p) => p.name !== 'self')
      .map((p) => p.name)
      .join(', ');
    this.emit(`constructor(${params}) {`);
    this.indent();
    this.context.symbolTable.enterScope();
    ctor.params.forEach((p) => this.context.symbolTable.set(p.name, 'auto'));
    this.visitBlock(ctor.body);
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit('}');
  }

  visitMethodDeclaration(method: MethodDeclaration): void {
    const params = method.params
      .filter((p) => p.name !== 'self')
      .map((p) => p.name)
      .join(', ');
    const prefix = method.isStatic ? 'static ' : '';
    this.emit(`${prefix}${method.name}(${params}) {`);
    this.indent();
    this.context.symbolTable.enterScope();
    method.params.forEach((p) => this.context.symbolTable.set(p.name, 'auto'));
    this.visitBlock(method.body);
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit('}');
  }

  visitBlock(block: Block): void {
    block.body.forEach((stmt) => this.visitStatement(stmt));
  }

  visitPrint(stmt: any): void {
    const hasSep = typeof stmt.separator === 'string';
    const sep = hasSep ? stmt.separator : ' ';
    const suppressNewline = stmt.appendLineFeed === false;

    // Default separator + newline: idiomatic console.log with comma args.
    if (!hasSep && !suppressNewline) {
      const args = stmt.expressions
        .map((e: Expression) => this.generateExpression(e, 0))
        .join(', ');
      this.emit(`console.log(${args});`, stmt.id);
      return;
    }

    // Custom separator and/or newline suppression: build one joined string
    // (console.log has no sep=/end=). Newline suppression uses stdout.write.
    const parts = stmt.expressions.map((e: Expression) =>
      this.generateExpression(e, Precedence.Additive)
    );
    let joined = parts.length === 0 ? '""' : parts.join(` + ${JSON.stringify(sep)} + `);
    if (suppressNewline) {
      // A single argument with an explicit separator emits it as trailing text.
      if (hasSep && parts.length === 1) joined = `${joined} + ${JSON.stringify(sep)}`;
      this.emit(`process.stdout.write(${joined});`, stmt.id);
    } else {
      this.emit(`console.log(${joined});`, stmt.id);
    }
  }

  visitAssignment(stmt: any): void {
    const name = lvalueName(stmt);

    if (this.isIntegerType(stmt.varType) && name) {
      this.declaredIntVars.add(name);
    }

    // Member/index target (e.g. `arr[i] = v`, `obj.field = v`) — always an
    // assignment, never a `let` declaration.
    if (name === undefined) {
      const t = this.generateExpression(stmt.target, 0);
      this.emit(`${t} = ${this.generateExpression(stmt.value, 0)};`, stmt.id);
      return;
    }

    let target = name;
    // Prefix `this.` for class fields
    if (
      this.inClass &&
      this.currentClassFields.has(target) &&
      !this.context.symbolTable.get(target)
    ) {
      target = `this.${target}`;
    }

    if (stmt.declaredWithoutInitializer) {
      if (!this.declaredVars.has(target)) {
        this.declaredVars.add(target);
        this.emit(`let ${target};`, stmt.id);
      }
      return;
    }

    const value = this.generateExpression(stmt.value, 0);

    // First declaration of a local variable
    const isNewLocal = !this.inClass && !this.declaredVars.has(target) && !target.includes('.');
    if (isNewLocal) {
      this.declaredVars.add(target);
      this.emit(`let ${target} = ${value};`, stmt.id);
    } else {
      this.emit(`${target} = ${value};`, stmt.id);
    }
  }

  visitIf(stmt: any): void {
    this.emit(`if (${this.generateExpression(stmt.condition, 0)}) {`, stmt.id);
    this.indent();
    this.visitBlock(stmt.thenBranch);
    this.dedent();

    let current = stmt.elseBranch;
    while (current && current.body.length === 1 && current.body[0].type === 'If') {
      const elif = current.body[0];
      this.emit(`} else if (${this.generateExpression(elif.condition, 0)}) {`);
      this.indent();
      this.visitBlock(elif.thenBranch);
      this.dedent();
      current = elif.elseBranch;
    }

    if (current) {
      this.emit('} else {');
      this.indent();
      this.visitBlock(current);
      this.dedent();
    }

    this.emit('}');
  }

  visitWhile(stmt: any): void {
    this.emit(`while (${this.generateExpression(stmt.condition, 0)}) {`, stmt.id);
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit('}');
  }

  visitDoWhile(stmt: any): void {
    this.emit('do {');
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit(`} while (${this.generateExpression(stmt.condition, 0)});`);
  }

  visitRepeatUntil(stmt: any): void {
    this.emit('do {', stmt.id);
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit(`} while (!(${this.generateExpression(stmt.condition, 0)}));`);
  }

  visitSwitch(stmt: any): void {
    this.emit(`switch (${this.generateExpression(stmt.discriminant, 0)}) {`, stmt.id);
    this.indent();
    stmt.cases.forEach((c: any) => {
      if (c.test) {
        this.emit(`case ${this.generateExpression(c.test, 0)}:`);
      } else {
        this.emit('default:');
      }
      this.indent();
      c.consequent.forEach((s: any) => this.visitStatement(s));
      this.dedent();
    });
    this.dedent();
    this.emit('}');
  }

  visitBreak(_stmt: any): void {
    this.emit('break;');
  }
  visitContinue(_stmt: any): void {
    this.emit('continue;');
  }

  visitFor(stmt: For): void {
    // C-style for
    const savedDeclared = new Set(this.declaredVars);
    const initParts: string[] = [];

    const collectInit = (s: any) => {
      if (s.type === 'Assignment') {
        const name = lvalueName(s) ?? '';
        this.declaredVars.add(name);
        initParts.push(`let ${name} = ${this.generateExpression(s.value, 0)}`);
      } else if (s.type === 'ExpressionStatement') {
        initParts.push(this.generateExpression(s.expression, 0));
      } else if (Array.isArray(s)) {
        s.forEach(collectInit);
      }
    };
    collectInit(stmt.init);

    const cond = stmt.condition ? this.generateExpression(stmt.condition, 0) : '';
    const renderUpdate = (s: any): string => {
      if (!s) return '';
      if (s.type === 'ExpressionStatement') return this.generateExpression(s.expression, 0);
      if (s.type === 'Assignment') {
        const name = lvalueName(s);
        const t = this.generateExpression(s.target, 0);
        const v = s.value;
        // `j = j + 1` -> `j += 1`, because a bare assignment used as a for-update
        // is evaluated (not executed) and would be a no-op.
        if (
          v?.type === 'BinaryExpression' &&
          v.left?.type === 'Identifier' &&
          v.left.name === name &&
          ['+', '-', '*', '/', '%'].includes(v.operator)
        ) {
          return `${t} ${v.operator}= ${this.generateExpression(v.right, 0)}`;
        }
        return `${t} = ${this.generateExpression(v, 0)}`;
      }
      return this.generateExpression(s, 0);
    };
    const upd = renderUpdate(stmt.update);

    this.emit(`for (${initParts.join(', ')}; ${cond}; ${upd}) {`, stmt.id);
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit('}');
    this.declaredVars = savedDeclared;
  }

  visitForEach(stmt: ForEach): void {
    if (stmt.iterable?.type === 'BinaryExpression' && (stmt.iterable as any).operator === '..') {
      // Praxis range: for x in start..end → regular for
      const iter = stmt.iterable as any;
      const start = this.generateExpression(iter.left, 0);
      const end = this.generateExpression(iter.right, 0);
      this.declaredVars.add(stmt.variable);
      this.emit(
        `for (let ${stmt.variable} = ${start}; ${stmt.variable} <= ${end}; ${stmt.variable}++) {`,
        stmt.id
      );
      this.indent();
      this.visitBlock(stmt.body);
      this.dedent();
      this.emit('}');
    } else {
      // a range(...) iterable lowers to a C-style for; otherwise for-of
      const rangeHeader = this.rangeForHeader(stmt.variable, stmt.iterable);
      this.declaredVars.add(stmt.variable);
      if (rangeHeader) {
        this.emit(`${rangeHeader} {`, stmt.id);
        this.indent();
        this.visitBlock(stmt.body);
        this.dedent();
        this.emit('}');
      } else {
        const iter = this.generateExpression(stmt.iterable, 0);
        this.emit(`for (const ${stmt.variable} of ${iter}) {`, stmt.id);
        this.indent();
        this.visitBlock(stmt.body);
        this.dedent();
        this.emit('}');
      }
    }
  }

  visitFunctionDeclaration(stmt: any): void {
    const params = stmt.params.map((p: any) => p.name).join(', ');
    this.emit(`function ${stmt.name}(${params}) {`);
    this.indent();
    // function body has its own scope for declared vars
    const savedDeclared = new Set(this.declaredVars);
    this.visitBlock(stmt.body);
    this.declaredVars = savedDeclared;
    this.dedent();
    this.emit('}');
  }

  visitReturn(stmt: any): void {
    const val = stmt.value ? this.generateExpression(stmt.value, 0) : '';
    this.emit(`return${val ? ` ${val}` : ''};`, stmt.id);
  }

  visitExpressionStatement(stmt: any): void {
    this.emit(`${this.generateExpression(stmt.expression, 0)};`, stmt.id);
  }

  visitTry(stmt: any): void {
    this.emit('try {');
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    stmt.handlers.forEach((h: any) => {
      const binding = h.varName ? `(${h.varName})` : '(_e)';
      this.emit(`} catch ${binding} {`);
      this.indent();
      this.visitBlock(h.body);
      this.dedent();
    });
    if (stmt.finallyBlock) {
      this.emit('} finally {');
      this.indent();
      this.visitBlock(stmt.finallyBlock);
      this.dedent();
    }
    this.emit('}');
  }

  generateExpression(expr: Expression, parentPrecedence: number): string {
    let out = '';
    let prec = 99;

    switch (expr.type) {
      case 'Literal':
        if (expr.value === null) out = 'null';
        else if (expr.value === undefined) out = 'undefined';
        else if (typeof expr.value === 'string') out = `"${this.escapeString(expr.value)}"`;
        else if (typeof expr.value === 'boolean') out = String(expr.value);
        else {
          const raw = expr.raw;
          out = raw && raw.includes('.') ? raw : String(expr.value);
        }
        break;

      case 'Identifier':
        if (expr.name === 'this' || expr.name === 'self') {
          out = 'this';
          break;
        }
        // Prefix class fields with this.
        if (
          this.inClass &&
          this.currentClassFields.has(expr.name) &&
          !this.context.symbolTable.get(expr.name)
        ) {
          out = `this.${expr.name}`;
        } else {
          out = expr.name;
        }
        break;

      case 'ThisExpression':
        out = 'this';
        break;
      case 'Placeholder':
        out = '0'; // Praxis /* ... */ hole -> default value
        break;

      case 'NewExpression':
        prec = Precedence.Instantiation;
        out = `new ${expr.className}(${expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ')})`;
        break;

      case 'IndexExpression': {
        prec = Precedence.Member;
        const objStr = this.generateExpression(expr.object, prec);
        out = `${objStr}[${this.generateExpression(expr.index, 0)}]`;
        break;
      }

      case 'MemberExpression':
        prec = Precedence.Member;
        out = `${this.generateExpression(expr.object, prec)}.${expr.property.name}`;
        break;

      case 'BinaryExpression': {
        // String membership (`x in s`) → JS String.includes.
        if (expr.operator === 'in' || expr.operator === 'not in') {
          const needle = this.generateExpression(expr.left, Precedence.Call);
          const hay = this.generateExpression(expr.right, Precedence.Call);
          out =
            expr.operator === 'in' ? `${hay}.includes(${needle})` : `!${hay}.includes(${needle})`;
          prec = expr.operator === 'in' ? Precedence.Call : Precedence.Unary;
          break;
        }
        const opMap: Record<string, { op: string; prec: number }> = {
          or: { op: '||', prec: Precedence.LogicalOr },
          and: { op: '&&', prec: Precedence.LogicalAnd },
          '==': { op: '===', prec: Precedence.Equality },
          '!=': { op: '!==', prec: Precedence.Equality },
          '<': { op: '<', prec: Precedence.Relational },
          '>': { op: '>', prec: Precedence.Relational },
          '<=': { op: '<=', prec: Precedence.Relational },
          '>=': { op: '>=', prec: Precedence.Relational },
          '+': { op: '+', prec: Precedence.Additive },
          '-': { op: '-', prec: Precedence.Additive },
          '*': { op: '*', prec: Precedence.Multiplicative },
          '/': { op: '/', prec: Precedence.Multiplicative },
          '%': { op: '%', prec: Precedence.Multiplicative },
          '**': { op: '**', prec: Precedence.Exponential },
          '^': { op: '**', prec: Precedence.Exponential },
        };
        const d = opMap[expr.operator] ?? { op: expr.operator, prec: 0 };
        prec = d.prec;
        const lft = this.generateExpression(expr.left, prec);
        const rgt = this.generateExpression(expr.right, prec);
        if (
          expr.operator === '/' &&
          this.isIntegerExpr(expr.left) &&
          this.isIntegerExpr(expr.right)
        ) {
          // Declared-int operands: integer division via Math.trunc.
          out = `Math.trunc(${lft} / ${rgt})`;
          prec = Precedence.Call;
        } else {
          out = `${lft} ${d.op} ${rgt}`;
        }
        break;
      }

      case 'UnaryExpression': {
        prec = Precedence.Unary;
        const op = expr.operator === 'not' ? '!' : expr.operator;
        out = `${op}${this.generateExpression(expr.argument, prec)}`;
        break;
      }

      case 'UpdateExpression': {
        prec = Precedence.Postfix;
        const arg = this.generateExpression((expr as any).argument, prec);
        out = (expr as any).prefix ? `${expr.operator}${arg}` : `${arg}${expr.operator}`;
        break;
      }

      case 'CallExpression': {
        prec = Precedence.Call;
        const calleeNode = expr.callee as any;
        const argList = () => expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ');

        // Method calls: map Praxly list methods to standard JS; pass the rest
        // (string methods, user methods, sort, push, slice, ...) through.
        if (calleeNode.type === 'MemberExpression') {
          const objStr = this.generateExpression(calleeNode.object, Precedence.Member);
          const method = calleeNode.property.name;
          const arg = (i: number) => this.generateExpression(expr.arguments[i], 0);
          switch (method) {
            case 'append':
              out = `${objStr}.push(${arg(0)})`;
              break;
            case 'insert':
              out = `${objStr}.splice(${arg(0)}, 0, ${arg(1)})`;
              break;
            case 'remove':
              out = `${objStr}.splice(${objStr}.indexOf(${arg(0)}), 1)`;
              break;
            case 'pop':
              out =
                expr.arguments.length >= 1
                  ? `${objStr}.splice(${arg(0)}, 1)[0]`
                  : `${objStr}.pop()`;
              break;
            default:
              out = `${objStr}.${method}(${argList()})`;
          }
          break;
        }

        const callee = calleeNode.name;

        // Conversions -> standard JavaScript
        if (callee === 'int' || callee === 'INT') {
          out = `parseInt(${argList()})`;
          break;
        }
        if (callee === 'float' || callee === 'FLOAT') {
          out = `parseFloat(${argList()})`;
          break;
        }
        if (callee === 'str' || callee === 'STRING') {
          out = `String(${argList()})`;
          break;
        }
        if (callee === 'bool' || callee === 'BOOL') {
          out = `Boolean(${argList()})`;
          break;
        }

        // Builtins mapping
        if (callee === 'print' || callee === 'DISPLAY') {
          out = `console.log(${argList()})`;
          break;
        }
        if ((callee === 'len' || callee === 'LENGTH') && expr.arguments.length === 1) {
          out = `${this.generateExpression(expr.arguments[0], 0)}.length`;
          break;
        }
        if (callee === 'input' || callee === 'INPUT') {
          out = `prompt(${argList()})`;
          break;
        }
        if (callee === 'APPEND' && expr.arguments.length === 2) {
          out = `${this.generateExpression(expr.arguments[0], 0)}.push(${this.generateExpression(expr.arguments[1], 0)})`;
          break;
        }
        if (callee === 'INSERT' && expr.arguments.length === 3) {
          out = `${this.generateExpression(expr.arguments[0], 0)}.splice(${this.generateExpression(expr.arguments[1], 0)}, 0, ${this.generateExpression(expr.arguments[2], 0)})`;
          break;
        }
        if (callee === 'REMOVE' && expr.arguments.length === 2) {
          out = `${this.generateExpression(expr.arguments[0], 0)}.splice(${this.generateExpression(expr.arguments[1], 0)}, 1)`;
          break;
        }
        if (callee === 'super') {
          out = `super(${argList()})`;
          break;
        }

        out = `${callee}(${argList()})`;
        break;
      }

      case 'ArrayLiteral':
        out = `[${expr.elements.map((e) => this.generateExpression(e, 0)).join(', ')}]`;
        break;

      case 'ArrayCreation': {
        // `new int[n]` -> `new Array(n).fill(default)`.
        const ac = expr as any;
        const base = ac.elementType.replace(/\[\]/g, '');
        const def = ['int', 'byte', 'short', 'long', 'double', 'float'].includes(base)
          ? '0'
          : base === 'boolean'
            ? 'false'
            : 'null';
        out = `Array(${this.generateExpression(ac.size, 0)}).fill(${def})`;
        break;
      }

      case 'CompoundAssignment': {
        const op = (expr as any).operator;
        const name = (expr as any).name;
        const val = this.generateExpression((expr as any).value ?? (expr as any).right, 0);
        out = `${name} ${op}= ${val}`;
        break;
      }

      case 'ConditionalExpression':
        out = `${this.generateExpression((expr as any).test, Precedence.Conditional)} ? ${this.generateExpression((expr as any).consequent, Precedence.Conditional)} : ${this.generateExpression((expr as any).alternate, Precedence.Conditional)}`;
        break;

      default:
        out = '';
    }

    return prec < parentPrecedence ? `(${out})` : out;
  }
}
