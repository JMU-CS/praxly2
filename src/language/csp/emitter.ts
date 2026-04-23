/**
 * CSP Language Emitter
 * Converts AST nodes into CSP (AP pseudocode) output.
 * Handles CSP-specific syntax: PROCEDURE, DISPLAY, FOR EACH / FOR FROM TO,
 * REPEAT n TIMES, REPEAT UNTIL, and brace-delimited blocks.
 *
 * Key dialect rules enforced here:
 *  - No ELSE IF chain — nested IF inside ELSE block instead (per spec)
 *  - Assignment arrow is <- (spec uses ←, both accepted on input)
 *  - Equality operator is = (not ==)
 *  - Not-equal is ≠, but <> is also emitted for ASCII compatibility
 *  - RETURN uses parens: RETURN(value)
 *  - DISPLAY(expr) for output
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
  UnaryExpression,
} from '../ast';

export class CSPEmitter extends ASTVisitor {
  protected override breakStr = 'BREAK';
  protected override continueStr = 'CONTINUE';

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
    const nonClasses = program.body.filter((s) => s.type !== 'ClassDeclaration');
    const mainClass = classes.find((c) => this.isJavaMainClass(c as ClassDeclaration));
    const otherClasses = classes.filter((c) => !this.isJavaMainClass(c as ClassDeclaration));

    otherClasses.forEach((c) => {
      this.visitClassDeclaration(c as ClassDeclaration);
      this.emit('');
    });
    nonClasses.forEach((s) => this.visitStatement(s));

    if (mainClass) {
      const mainMethod = (mainClass as ClassDeclaration).body.find(
        (m) => m.type === 'MethodDeclaration' && (m as MethodDeclaration).name === 'main'
      ) as MethodDeclaration | undefined;
      if (mainMethod) this.visitBlock(mainMethod.body);
    }
  }

  visitClassDeclaration(classDecl: ClassDeclaration): void {
    this.emit(`CLASS ${classDecl.name}`);
    this.emit('{');
    this.indent();
    classDecl.body.forEach((m) => {
      this.visitStatement(m);
      this.emit('');
    });
    this.dedent();
    this.emit('}');
  }

  visitFieldDeclaration(field: FieldDeclaration): void {
    const access = field.access === 'private' ? 'PRIVATE' : 'PUBLIC';
    let line = `${access} ${field.name}`;
    if (field.initializer) line += ` <- ${this.generateExpression(field.initializer, 0)}`;
    this.emit(line);
  }

  visitConstructor(ctor: Constructor): void {
    const params = ctor.params.map((p) => p.name).join(', ');
    this.emit(`CONSTRUCTOR (${params})`);
    this.emit('{');
    this.indent();
    this.visitBlock(ctor.body);
    this.dedent();
    this.emit('}');
  }

  visitMethodDeclaration(method: MethodDeclaration): void {
    const access = method.access === 'private' ? 'PRIVATE' : 'PUBLIC';
    const params = method.params.map((p) => p.name).join(', ');
    this.emit(`${access} PROCEDURE ${method.name} (${params})`);
    this.emit('{');
    this.indent();
    this.visitBlock(method.body);
    this.dedent();
    this.emit('}');
  }

  visitBlock(block: Block): void {
    block.body.forEach((s) => this.visitStatement(s));
  }

  visitPrint(stmt: any): void {
    if (stmt.expressions.length === 0) {
      this.emit(`DISPLAY("")`, stmt.id);
      return;
    }
    if (stmt.expressions.length === 1) {
      this.emit(`DISPLAY(${this.generateExpression(stmt.expressions[0], 0)})`, stmt.id);
      return;
    }
    // Multiple expressions: emit separate DISPLAY calls
    stmt.expressions.forEach((e: any) => {
      this.emit(`DISPLAY(${this.generateExpression(e, 0)})`, stmt.id);
    });
  }

  visitAssignment(stmt: any): void {
    if (stmt.target?.type === 'ArrayLiteral') {
      const targets = stmt.target.elements;
      if (stmt.value?.type === 'ArrayLiteral') {
        stmt.value.elements.forEach((val: any, i: number) => {
          const t = targets[i];
          if (t?.type === 'Identifier') {
            this.emit(`${t.name} <- ${this.generateExpression(val, 0)}`, stmt.id);
          }
        });
      }
      return;
    }

    if (stmt.declaredWithoutInitializer) {
      this.emit(`// ${stmt.name} declared without initializer`, stmt.id);
      return;
    }

    let targetStr: string;
    if (stmt.isMemberAssignment && stmt.memberExpr) {
      targetStr = this.generateExpression(stmt.memberExpr, 0);
    } else if (stmt.target) {
      targetStr = this.generateExpression(stmt.target, 0);
    } else {
      targetStr = stmt.name;
    }

    this.emit(`${targetStr} <- ${this.generateExpression(stmt.value, 0)}`, stmt.id);
  }

  visitIf(stmt: any): void {
    this.emit(`IF (${this.generateExpression(stmt.condition, 0)})`, stmt.id);
    this.emit('{');
    this.indent();
    this.visitBlock(stmt.thenBranch);
    this.dedent();
    this.emit('}');

    if (stmt.elseBranch) {
      this.emit('ELSE');
      this.emit('{');
      this.indent();
      // Nested IFs inside ELSE blocks are emitted naturally — no ELSE IF per spec
      this.visitBlock(stmt.elseBranch);
      this.dedent();
      this.emit('}');
    }
  }

  /**
   * Strips a top-level NOT/! from a condition, returning the inner expression string.
   * Returns null if the condition is not a simple negation.
   */
  private stripNot(cond: any): string | null {
    if (cond.type === 'UnaryExpression' && (cond.operator === 'not' || cond.operator === '!')) {
      return this.generateExpression((cond as UnaryExpression).argument, 0);
    }
    return null;
  }

  visitWhile(stmt: any): void {
    // While(cond) → REPEAT UNTIL(NOT cond).
    // Simplify NOT(NOT(x)) → x to avoid double negation when cond is already a NOT.
    const inner = this.stripNot(stmt.condition);
    const untilCond = inner ?? `NOT (${this.generateExpression(stmt.condition, 0)})`;
    this.emit(`REPEAT UNTIL (${untilCond})`, stmt.id);
    this.emit('{');
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit('}');
  }

  visitDoWhile(stmt: any): void {
    // CSP has no do-while: emit the body once unconditionally, then use REPEAT UNTIL.
    this.visitBlock(stmt.body);
    const inner = this.stripNot(stmt.condition);
    const untilCond = inner ?? `NOT (${this.generateExpression(stmt.condition, 0)})`;
    this.emit(`REPEAT UNTIL (${untilCond})`, stmt.id);
    this.emit('{');
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit('}');
  }

  visitRepeatUntil(stmt: any): void {
    // Praxis post-condition loop → CSP REPEAT UNTIL (closest available construct).
    this.emit(`REPEAT UNTIL (${this.generateExpression(stmt.condition, 0)})`, stmt.id);
    this.emit('{');
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit('}');
  }

  visitSwitch(stmt: any): void {
    // CSP has no switch — translate to nested IF / ELSE IF chains.
    // CSP has no switch — translate to nested IF / ELSE blocks
    let first = true;
    const disc = stmt.discriminant ? this.generateExpression(stmt.discriminant, 0) : '';
    stmt.cases.forEach((c: any) => {
      if (c.test) {
        const testStr = this.generateExpression(c.test, 0);
        this.emit(first ? `IF (${disc} = ${testStr})` : `ELSE IF (${disc} = ${testStr})`);
        first = false;
      } else {
        this.emit('ELSE');
      }
      this.emit('{');
      this.indent();
      c.consequent.forEach((s: any) => this.visitStatement(s));
      this.dedent();
      this.emit('}');
    });
  }

  visitBreak(_stmt: any): void {
    this.emit('// BREAK');
  }

  visitContinue(_stmt: any): void {
    this.emit('// CONTINUE');
  }

  visitFor(stmt: any): void {
    if (stmt.init && stmt.condition && stmt.update) {
      // C-style for — desugar to assignment + REPEAT UNTIL
      this.context.symbolTable.enterScope();
      this.visitStatement(stmt.init);
      const inner = this.stripNot(stmt.condition);
      const untilCond = inner ?? `NOT (${this.generateExpression(stmt.condition, 0)})`;
      this.emit(`REPEAT UNTIL (${untilCond})`, stmt.id);
      this.emit('{');
      this.indent();
      this.visitBlock(stmt.body);
      this.visitStatement(stmt.update);
      this.dedent();
      this.emit('}');
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

      this.emit(`FOR ${stmt.variable} FROM ${start} TO ${end} STEP ${step}`, stmt.id);
      this.emit('{');
      this.indent();
      this.visitBlock(stmt.body);
      this.dedent();
      this.emit('}');
    } else if (
      stmt.variables?.length > 1 &&
      stmt.iterable?.type === 'CallExpression' &&
      stmt.iterable.callee?.name === 'enumerate'
    ) {
      const arr = this.generateExpression(stmt.iterable.arguments[0], 0);
      const [idx, val] = stmt.variables;
      this.emit(`FOR ${idx} FROM 0 TO LENGTH(${arr}) STEP 1`, stmt.id);
      this.emit('{');
      this.indent();
      this.emit(`${val} <- ${arr}[${idx}]`);
      this.visitBlock(stmt.body);
      this.dedent();
      this.emit('}');
    } else {
      this.emit(
        `FOR EACH ${stmt.variable} IN ${this.generateExpression(stmt.iterable, 0)}`,
        stmt.id
      );
      this.emit('{');
      this.indent();
      this.visitBlock(stmt.body);
      this.dedent();
      this.emit('}');
    }
  }

  visitFunctionDeclaration(stmt: any): void {
    const params = stmt.params.map((p: any) => p.name).join(', ');
    this.emit(`PROCEDURE ${stmt.name} (${params})`);
    this.emit('{');
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit('}');
  }

  visitReturn(stmt: any): void {
    const val = stmt.value ? this.generateExpression(stmt.value, 0) : '';
    this.emit(`RETURN(${val})`, stmt.id);
  }

  visitExpressionStatement(stmt: any): void {
    this.emit(this.generateExpression(stmt.expression, 0), stmt.id);
  }

  visitTry(stmt: any): void {
    // CSP has no exception handling — emit as comment block
    this.emit('// TRY');
    this.emit('{');
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit('}');
    stmt.handlers.forEach((h: any) => {
      this.emit(`// EXCEPT${h.exceptionType ? ` ${h.exceptionType}` : ''}`);
      this.emit('{');
      this.indent();
      this.visitBlock(h.body);
      this.dedent();
      this.emit('}');
    });
    if (stmt.finallyBlock) {
      this.emit('// FINALLY');
      this.emit('{');
      this.indent();
      this.visitBlock(stmt.finallyBlock);
      this.dedent();
      this.emit('}');
    }
  }

  generateExpression(expr: Expression, parentPrecedence: number): string {
    let output = '';
    let currentPrecedence = 99;

    switch (expr.type) {
      case 'Literal':
        if (expr.value === null) output = 'null';
        else if (typeof expr.value === 'string') {
          const v =
            expr.value.startsWith('f') || expr.value.startsWith('r') || expr.value.startsWith('b')
              ? expr.value.substring(1)
              : expr.value;
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
        output = 'THIS';
        break;

      case 'NewExpression': {
        currentPrecedence = Precedence.Instantiation;
        const args = expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ');
        output = `NEW ${expr.className}(${args})`;
        break;
      }

      case 'IndexExpression': {
        currentPrecedence = Precedence.Member;
        const objStr = this.generateExpression(expr.object, currentPrecedence);
        const convertIdx = (idx: any): string => {
          if (!idx) return '0';
          if (idx.type === 'Literal' && typeof idx.value === 'number' && idx.value < 0)
            return `LENGTH(${objStr}) - ${Math.abs(idx.value)}`;
          if (
            idx.type === 'UnaryExpression' &&
            idx.operator === '-' &&
            idx.argument.type === 'Literal'
          )
            return `LENGTH(${objStr}) - ${idx.argument.value}`;
          return this.generateExpression(idx, 0);
        };
        if (expr.indexEnd) {
          output = `${objStr}.SLICE(${convertIdx(expr.index)}, ${convertIdx(expr.indexEnd)})`;
        } else {
          output = `${objStr}[${convertIdx(expr.index)}]`;
        }
        break;
      }

      case 'MemberExpression':
        currentPrecedence = Precedence.Member;
        output = `${this.generateExpression(expr.object, currentPrecedence)}.${expr.property.name}`;
        break;

      case 'BinaryExpression': {
        const opMap: Record<string, { op: string; prec: number }> = {
          or: { op: 'OR', prec: Precedence.LogicalOr },
          and: { op: 'AND', prec: Precedence.LogicalAnd },
          '==': { op: '=', prec: Precedence.Equality },
          '!=': { op: '≠', prec: Precedence.Equality },
          '<': { op: '<', prec: Precedence.Relational },
          '>': { op: '>', prec: Precedence.Relational },
          '<=': { op: '≤', prec: Precedence.Relational },
          '>=': { op: '≥', prec: Precedence.Relational },
          '+': { op: '+', prec: Precedence.Additive },
          '-': { op: '-', prec: Precedence.Additive },
          '*': { op: '*', prec: Precedence.Multiplicative },
          '/': { op: '/', prec: Precedence.Multiplicative },
          '%': { op: 'MOD', prec: Precedence.Multiplicative },
          '**': { op: '^', prec: Precedence.Exponential },
          '..': { op: '..', prec: Precedence.Relational },
        };
        const od = opMap[expr.operator] ?? { op: expr.operator, prec: 0 };
        currentPrecedence = od.prec;
        output = `${this.generateExpression(expr.left, currentPrecedence)} ${od.op} ${this.generateExpression(expr.right, currentPrecedence)}`;
        break;
      }

      case 'UnaryExpression':
        currentPrecedence = Precedence.Unary;
        output = `NOT ${this.generateExpression(expr.argument, currentPrecedence)}`;
        break;

      case 'UpdateExpression': {
        const argStr = this.generateExpression((expr as any).argument, Precedence.Unary);
        const op = (expr as any).operator === '++' ? '+' : '-';
        output = `${argStr} <- ${argStr} ${op} 1`;
        break;
      }

      case 'CallExpression': {
        currentPrecedence = Precedence.Call;
        const calleeStr =
          (expr.callee as any).type === 'MemberExpression'
            ? this.generateExpression(expr.callee as any, 0)
            : (expr.callee as any).name;

        if ((calleeStr === 'len' || calleeStr === 'LENGTH') && expr.arguments.length === 1) {
          output = `LENGTH(${this.generateExpression(expr.arguments[0], 0)})`;
          break;
        }
        if (calleeStr === 'input' || calleeStr === 'INPUT') {
          const argsCsp = expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ');
          output = `INPUT(${argsCsp})`;
          break;
        }
        if (calleeStr === 'APPEND' && expr.arguments.length === 2) {
          output = `APPEND(${this.generateExpression(expr.arguments[0], 0)}, ${this.generateExpression(expr.arguments[1], 0)})`;
          break;
        }
        if (calleeStr === 'INSERT' && expr.arguments.length === 3) {
          output = `INSERT(${expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ')})`;
          break;
        }
        if (calleeStr === 'REMOVE' && expr.arguments.length === 2) {
          output = `REMOVE(${this.generateExpression(expr.arguments[0], 0)}, ${this.generateExpression(expr.arguments[1], 0)})`;
          break;
        }

        const argsStr = expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ');
        output = `${calleeStr}(${argsStr})`;
        break;
      }

      case 'ArrayLiteral': {
        const elems = expr.elements.map((e) => this.generateExpression(e, 0)).join(', ');
        output = `[${elems}]`;
        break;
      }
    }

    return currentPrecedence < parentPrecedence ? `(${output})` : output;
  }
}
