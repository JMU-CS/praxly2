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
  Expression,
} from '../ast';

export class JavaScriptEmitter extends ASTVisitor {
  // Track declared variable names so we only emit `let` on first assignment
  private declaredVars = new Set<string>();
  private inClass = false;
  private currentClassFields = new Set<string>();

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
    const args = stmt.expressions.map((e: Expression) => this.generateExpression(e, 0)).join(', ');
    this.emit(`console.log(${args});`, stmt.id);
  }

  visitAssignment(stmt: any): void {
    let target: string;

    if (stmt.isMemberAssignment && stmt.memberExpr) {
      target = this.generateExpression(stmt.memberExpr, 0);
      const value = this.generateExpression(stmt.value, 0);
      this.emit(`${target} = ${value};`, stmt.id);
      return;
    }

    if (stmt.target) {
      target = this.generateExpression(stmt.target, 0);
    } else {
      target = stmt.name;
      // Prefix `this.` for class fields
      if (
        this.inClass &&
        this.currentClassFields.has(target) &&
        !this.context.symbolTable.get(target)
      ) {
        target = `this.${target}`;
      }
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
    if (stmt.init && stmt.condition && stmt.update) {
      // C-style for
      const savedDeclared = new Set(this.declaredVars);
      const initParts: string[] = [];

      const collectInit = (s: any) => {
        if (s.type === 'Assignment') {
          this.declaredVars.add(s.name);
          initParts.push(`let ${s.name} = ${this.generateExpression(s.value, 0)}`);
        } else if (s.type === 'ExpressionStatement') {
          initParts.push(this.generateExpression(s.expression, 0));
        } else if (Array.isArray(s)) {
          s.forEach(collectInit);
        }
      };
      collectInit(stmt.init);

      const cond = stmt.condition ? this.generateExpression(stmt.condition, 0) : '';
      const upd = stmt.update
        ? this.generateExpression((stmt.update as any).expression ?? stmt.update, 0)
        : '';

      this.emit(`for (${initParts.join(', ')}; ${cond}; ${upd}) {`, stmt.id);
      this.indent();
      this.visitBlock(stmt.body);
      this.dedent();
      this.emit('}');
      this.declaredVars = savedDeclared;
    } else if (
      stmt.iterable?.type === 'BinaryExpression' &&
      (stmt.iterable as any).operator === '..'
    ) {
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
      // for-of
      const iter = this.generateExpression(stmt.iterable, 0);
      const vars =
        stmt.variables && stmt.variables.length > 1
          ? `[${stmt.variables.join(', ')}]`
          : stmt.variable;
      this.declaredVars.add(stmt.variable);
      this.emit(`for (const ${vars} of ${iter}) {`, stmt.id);
      this.indent();
      this.visitBlock(stmt.body);
      this.dedent();
      this.emit('}');
    }
  }

  visitFunctionDeclaration(stmt: any): void {
    const params = stmt.params
      .map((p: any) => {
        if (p.defaultValue) return `${p.name} = ${this.generateExpression(p.defaultValue, 0)}`;
        return p.name;
      })
      .join(', ');
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
        else if (typeof expr.value === 'string') out = `"${expr.value}"`;
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

      case 'NewExpression':
        prec = Precedence.Instantiation;
        out = `new ${expr.className}(${expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ')})`;
        break;

      case 'IndexExpression':
        prec = Precedence.Member;
        out = `${this.generateExpression(expr.object, prec)}[${this.generateExpression(expr.index, 0)}]`;
        break;

      case 'MemberExpression':
        prec = Precedence.Member;
        out = `${this.generateExpression(expr.object, prec)}.${expr.property.name}`;
        break;

      case 'BinaryExpression': {
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
        };
        const d = opMap[expr.operator] ?? { op: expr.operator, prec: 0 };
        prec = d.prec;
        out = `${this.generateExpression(expr.left, prec)} ${d.op} ${this.generateExpression(expr.right, prec)}`;
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
        let callee: string;
        if ((expr.callee as any).type === 'MemberExpression') {
          callee = this.generateExpression(expr.callee as any, 0);
        } else {
          callee = (expr.callee as any).name;
        }

        // Builtins mapping
        if (callee === 'print' || callee === 'DISPLAY') {
          out = `console.log(${expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ')})`;
          break;
        }
        if ((callee === 'len' || callee === 'LENGTH') && expr.arguments.length === 1) {
          out = `${this.generateExpression(expr.arguments[0], 0)}.length`;
          break;
        }
        if (callee === 'input' || callee === 'INPUT') {
          out = `prompt(${expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ')})`;
          break;
        }
        if (callee === 'APPEND' && expr.arguments.length === 2) {
          out = `${this.generateExpression(expr.arguments[0], 0)}.push(${this.generateExpression(expr.arguments[1], 0)})`;
          break;
        }
        if (callee === 'INSERT' && expr.arguments.length === 3) {
          out = `${this.generateExpression(expr.arguments[0], 0)}.splice(${this.generateExpression(expr.arguments[1], 0)} - 1, 0, ${this.generateExpression(expr.arguments[2], 0)})`;
          break;
        }
        if (callee === 'REMOVE' && expr.arguments.length === 2) {
          out = `${this.generateExpression(expr.arguments[0], 0)}.splice(${this.generateExpression(expr.arguments[1], 0)} - 1, 1)`;
          break;
        }
        if (callee === 'super') {
          out = `super(${expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ')})`;
          break;
        }

        const args = expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ');
        out = `${callee}(${args})`;
        break;
      }

      case 'ArrayLiteral':
        out = `[${expr.elements.map((e) => this.generateExpression(e, 0)).join(', ')}]`;
        break;

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

      case 'ListComprehension': {
        const elem = this.generateExpression((expr as any).element, 0);
        const iter = this.generateExpression((expr as any).iterable, 0);
        out = `Array.from(${iter}, ${(expr as any).variable} => ${elem})`;
        break;
      }

      default:
        out = '';
    }

    return prec < parentPrecedence ? `(${out})` : out;
  }
}
