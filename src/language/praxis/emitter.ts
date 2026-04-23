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

    classDecl.body.forEach((m) => {
      this.visitStatement(m);
      this.emit('');
    });
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit(`end class ${classDecl.name}`);
  }

  visitFieldDeclaration(field: FieldDeclaration): void {
    let type =
      field.fieldType === 'auto' && field.initializer
        ? this.inferType(field.initializer)
        : field.fieldType;
    if (type === 'auto') type = 'var';

    let line = `${type} ${field.name}`;
    if (field.initializer) line += ` <- ${this.generateExpression(field.initializer, 0)}`;
    this.emit(line);
  }

  visitConstructor(ctor: Constructor): void {
    const params = ctor.params
      .map((p) => `${p.paramType !== 'auto' ? p.paramType + ' ' : ''}${p.name}`)
      .join(', ');
    this.emit(`procedure new(${params})`);
    this.indent();
    this.context.symbolTable.enterScope();
    ctor.params.forEach((p) => this.context.symbolTable.set(p.name, p.paramType || 'auto'));
    this.visitBlock(ctor.body);
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit(`end new`);
  }

  visitMethodDeclaration(method: MethodDeclaration): void {
    let returnType = method.returnType === 'auto' ? 'procedure' : method.returnType;
    if (returnType === 'void') returnType = 'procedure';

    // Attempt to infer return type from body if still unknown
    if (returnType === 'auto' || returnType === 'procedure') {
      const inferred = this.inferBodyReturnType(method.body);
      if (inferred && inferred !== 'void' && inferred !== 'var') returnType = inferred;
      else returnType = 'procedure';
    }

    const params = method.params
      .map((p) => {
        const t = p.paramType && p.paramType !== 'auto' ? `${p.paramType} ` : '';
        return `${t}${p.name}`.trim();
      })
      .join(', ');

    this.emit(`${returnType} ${method.name}(${params})`);
    this.indent();
    this.context.symbolTable.enterScope();
    method.params.forEach((p) => this.context.symbolTable.set(p.name, p.paramType || 'auto'));
    this.visitBlock(method.body);
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit(`end ${method.name}`);
  }

  visitBlock(block: Block): void {
    block.body.forEach((s) => this.visitStatement(s));
  }

  visitPrint(stmt: any): void {
    const args = stmt.expressions.map((e: any) => this.generateExpression(e, 0));
    // Praxis: `print expr` — no parentheses; multiple expressions concatenated with +
    this.emit(`print ${args.join(' + ')}`, stmt.id);
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
      this.emit(`${stmt.varType} ${targetStr} <- ${initVal}`, stmt.id);
      this.context.symbolTable.set(stmt.name, stmt.varType);
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

    let currentElse = stmt.elseBranch;
    while (currentElse?.body.length === 1 && currentElse.body[0].type === 'If') {
      const elifStmt = currentElse.body[0];
      this.emit(`else if (${this.generateExpression(elifStmt.condition, 0)})`);
      this.indent();
      this.context.symbolTable.enterScope();
      this.visitBlock(elifStmt.thenBranch);
      this.context.symbolTable.exitScope();
      this.dedent();
      currentElse = elifStmt.elseBranch;
    }

    if (currentElse) {
      this.emit('else');
      this.indent();
      this.context.symbolTable.enterScope();
      this.visitBlock(currentElse);
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
    this.emit(`switch (${this.generateExpression(stmt.discriminant, 0)})`);
    this.indent();
    stmt.cases.forEach((c: any) => {
      this.emit(c.test ? `case ${this.generateExpression(c.test, 0)}:` : 'default:');
      this.indent();
      c.consequent.forEach((s: any) => this.visitStatement(s));
      this.dedent();
    });
    this.dedent();
    this.emit('end switch');
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
      this.emit(`var ${val} <- ${arr}[${idx}]`);
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
    this.emit(this.generateExpression(stmt.expression, 0), stmt.id);
  }

  visitTry(stmt: any): void {
    this.emit('try');
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    stmt.handlers.forEach((h: any) => {
      this.emit(
        h.exceptionType ? `catch ${h.exceptionType}${h.varName ? ` as ${h.varName}` : ''}` : 'catch'
      );
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
        output = 'this';
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
        if (expr.indexEnd) {
          output = `${objExpr}.SLICE(${convertIdx(expr.index)}, ${convertIdx(expr.indexEnd)})`;
        } else {
          output = `${objExpr}[${convertIdx(expr.index)}]`;
        }
        break;
      }

      case 'MemberExpression':
        currentPrecedence = Precedence.Member;
        output = `${this.generateExpression(expr.object, currentPrecedence)}.${expr.property.name}`;
        break;

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
        output = (expr as any).operator === '++' ? `${argStr}++` : `${argStr}--`;
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
        output = `${calleeStr}(${argsStr})`;
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
