/**
 * Java Language Emitter
 * Converts AST nodes into Java source code.
 * Handles Java-specific syntax including class declarations, method signatures,
 * access modifiers, and Java library methods like System.out.println, Arrays, etc.
 */

import { ASTVisitor, Precedence, SymbolTable } from '../visitor';
import type {
  Program,
  Statement,
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

/**
 * Emitter for converting AST to Java source code.
 * Implements the ASTVisitor pattern to traverse and translate program structures.
 */
export class JavaEmitter extends ASTVisitor {
  private usesInput: boolean = false;
  private usesArrayList: boolean = false;
  private usesArrays: boolean = false;
  private currentClassName: string | null = null;
  private instanceContextDepth = 0;
  private classNames = new Set<string>();
  // Every variable name ever declared (flat, matching the interpreter's scoping).
  // Used to drop the type on a re-declaration so translated code doesn't trip the
  // interpreter's "already declared" error when loop vars are reused.
  private declaredNames = new Set<string>();

  // Returns `type ` for a first declaration or `` (empty) for a re-declaration.
  private declType(name: string, type: string): string {
    if (this.declaredNames.has(name)) return '';
    this.declaredNames.add(name);
    return `${type} `;
  }

  private normalizeInstanceParams<T extends { name: string }>(params: T[]): T[] {
    if (params.length === 0) return params;
    return params[0].name === 'self' ? params.slice(1) : params;
  }

  private toJavaParamType(paramType: string): string {
    return this.toJavaType(paramType);
  }

  // Normalizes a source type to its Java spelling (Praxis `string` -> `String`,
  // untyped `auto`/`var` -> `Object`).
  private toJavaType(type: string): string {
    if (type === 'auto' || type === 'var') return 'Object';
    if (type === 'string') return 'String';
    if (type === 'string[]') return 'String[]';
    return type;
  }

  /** Returns the concrete type for a constructor/method param, falling back to call-site inference. */
  private resolveCtorParamType(param: any, index: number, callSiteTypes: string[]): string {
    if (param.paramType && param.paramType !== 'auto' && param.paramType !== 'var') {
      return this.toJavaParamType(param.paramType);
    }
    return callSiteTypes[index] || 'Object';
  }

  private toBoxedJavaType(type: string): string {
    switch (type) {
      case 'int':
        return 'Integer';
      case 'double':
        return 'Double';
      case 'boolean':
        return 'Boolean';
      case 'char':
        return 'Character';
      case 'long':
        return 'Long';
      case 'float':
        return 'Float';
      case 'short':
        return 'Short';
      case 'byte':
        return 'Byte';
      default:
        return type;
    }
  }

  private isArrayListType(type?: string | null): boolean {
    return !!type && type.startsWith('ArrayList<') && type.endsWith('>');
  }

  private getArrayListElementType(type: string): string {
    if (type.endsWith('[]')) {
      return this.toBoxedJavaType(type.slice(0, -2));
    }
    if (this.isArrayListType(type)) {
      return type.slice('ArrayList<'.length, -1);
    }
    return 'Object';
  }

  private getTypeForName(name: string): string | undefined {
    return this.context.symbolTable.get(name) || this.context.inferredVariableTypes?.get(name);
  }

  private getExpressionType(expr: Expression): string {
    if (expr.type === 'Identifier') {
      return this.getTypeForName(expr.name) || this.inferType(expr);
    }
    return this.inferType(expr);
  }

  /**
   * Scans a block for return statements to infer the return type.
   * Returns 'void' when no value-producing return is found.
   */
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

  private generateArrayListLiteral(expr: any, elementTypeHint?: string): string {
    this.usesArrayList = true;
    this.usesArrays = true;
    const elementType = this.toBoxedJavaType(
      elementTypeHint || this.getArrayListElementType(this.inferType(expr))
    );
    const renderedElements = expr.elements.map((e: Expression) => this.generateExpression(e, 0));
    return `new ArrayList<${elementType}>(Arrays.asList(${renderedElements.join(', ')}))`;
  }

  /**
   * Check if program uses ArrayList/Arrays helpers in emitted Java.
   */
  private checkForCollectionHelpers(node: any): void {
    if (!node) return;

    if (node.type === 'IndexExpression' && node.indexEnd) {
      this.usesArrays = true;
    }

    for (const key in node) {
      if (typeof node[key] === 'object' && node[key] !== null) {
        if (Array.isArray(node[key]))
          node[key].forEach((n: any) => this.checkForCollectionHelpers(n));
        else this.checkForCollectionHelpers(node[key]);
      }
    }
  }

  private isSelfMemberExpression(expr: any): boolean {
    if (!expr || expr.type !== 'MemberExpression') return false;
    if (expr.object?.type === 'ThisExpression') return true;
    return (
      expr.object?.type === 'Identifier' &&
      (expr.object.name === 'self' || expr.object.name === 'this')
    );
  }

  private resolveFieldTypeFromValue(value: Expression, paramTypes: Map<string, string>): string {
    if (value.type === 'Identifier') {
      const fromParam = paramTypes.get(value.name);
      if (fromParam && fromParam !== 'auto' && fromParam !== 'var') {
        return this.toJavaParamType(fromParam);
      }
    }

    const inferred = this.inferType(value);
    if (inferred === 'var' || inferred === 'auto') {
      // Numeric literals default to int, string literals to String, otherwise Object
      if (value.type === 'Literal') {
        if (typeof (value as any).value === 'number') return 'int';
        if (typeof (value as any).value === 'string') return 'String';
        if (typeof (value as any).value === 'boolean') return 'boolean';
      }
      return 'Object';
    }
    return inferred;
  }

  private collectImplicitFields(classDecl: ClassDeclaration): FieldDeclaration[] {
    const explicitFieldNames = new Set(
      classDecl.body
        .filter((member) => member.type === 'FieldDeclaration')
        .map((member) => (member as FieldDeclaration).name)
    );

    const inferredFieldTypes = new Map<string, string>();

    const scanNode = (node: any, paramTypes: Map<string, string>): void => {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'Assignment') {
        const memberExpr = node.target?.type === 'MemberExpression' ? node.target : undefined;

        if (memberExpr && this.isSelfMemberExpression(memberExpr)) {
          const fieldName = memberExpr.property?.name;
          if (
            fieldName &&
            !explicitFieldNames.has(fieldName) &&
            !inferredFieldTypes.has(fieldName)
          ) {
            inferredFieldTypes.set(
              fieldName,
              this.resolveFieldTypeFromValue(node.value, paramTypes)
            );
          }
        }
      }

      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          value.forEach((item) => scanNode(item, paramTypes));
        } else if (value && typeof value === 'object') {
          scanNode(value, paramTypes);
        }
      }
    };

    classDecl.body.forEach((member) => {
      if (member.type !== 'Constructor' && member.type !== 'MethodDeclaration') return;

      const paramTypes = new Map<string, string>();
      const isConstructor = member.type === 'Constructor';
      const callSiteTypes = isConstructor
        ? this.context.functionParamTypes.get(classDecl.name) || []
        : [];
      const paramsForScope = this.normalizeInstanceParams(member.params);
      paramsForScope.forEach((param, i) => {
        paramTypes.set(param.name, this.resolveCtorParamType(param, i, callSiteTypes));
      });

      scanNode(member.body, paramTypes);
    });

    return Array.from(inferredFieldTypes.entries()).map(([name, fieldType]) => ({
      id: `implicit_field_${name}`,
      type: 'FieldDeclaration',
      name,
      fieldType,
      isStatic: false,
      access: 'private',
      declaredWithoutInitializer: true,
    }));
  }

  private getClassConstructorName(expr: Expression): string | null {
    if (expr.type !== 'CallExpression') return null;
    const callee: any = expr.callee;
    if (callee?.type === 'Identifier' && this.classNames.has(callee.name)) {
      return callee.name;
    }
    return null;
  }

  protected inferType(expr: Expression): string {
    const classCtorName = this.getClassConstructorName(expr);
    if (classCtorName) return classCtorName;
    return super.inferType(expr);
  }

  /**
   * Check if program uses input() calls
   */
  private checkForInput(node: any): void {
    if (!node) return;
    if (node.type === 'CallExpression' && (node.callee as any).name === 'input') {
      this.usesInput = true;
    }
    if (node.type === 'CallExpression' && (node.callee as any).name === 'INPUT') {
      this.usesInput = true;
    }
    for (const key in node) {
      if (typeof node[key] === 'object' && node[key] !== null) {
        if (Array.isArray(node[key])) node[key].forEach((n: any) => this.checkForInput(n));
        else this.checkForInput(node[key]);
      }
    }
  }

  /**
   * Main entry point for translating a complete program.
   * Separates classes from functions and main body statements.
   * Generates a Main class wrapper for functions and top-level code.
   */
  visitProgram(program: Program): void {
    const classes = program.body.filter((s) => s.type === 'ClassDeclaration');
    const functions = program.body.filter((s) => s.type === 'FunctionDeclaration');
    const mainBody = program.body.filter(
      (s) => s.type !== 'ClassDeclaration' && s.type !== 'FunctionDeclaration'
    );

    this.classNames = new Set(classes.map((classDecl) => (classDecl as ClassDeclaration).name));

    // Check if program uses input()
    this.checkForInput(program);

    this.usesArrayList = (this.context.mutableCollections?.size || 0) > 0;
    if (this.usesArrayList) this.usesArrays = true;
    this.checkForCollectionHelpers(program);

    const imports: string[] = [];
    if (this.usesInput) imports.push('import java.util.Scanner;');
    if (this.usesArrayList) imports.push('import java.util.ArrayList;');
    if (this.usesArrays) imports.push('import java.util.Arrays;');

    imports.forEach((line) => this.emit(line));
    if (imports.length > 0) this.emit('');

    classes.forEach((classDecl) => {
      this.visitClassDeclaration(classDecl as ClassDeclaration);
      this.emit('');
    });

    if (functions.length > 0 || mainBody.length > 0) {
      this.context.symbolTable = new SymbolTable();
      this.emit('public class Main {');
      this.indent();

      functions.forEach((func) => {
        this.visitFunctionDeclaration(func as any);
        this.emit('');
      });

      if (mainBody.length > 0) {
        this.emit('public static void main(String[] args) {');
        this.indent();

        // Initialize Scanner if input is used
        if (this.usesInput) {
          this.emit('Scanner scanner = new Scanner(System.in);');
        }

        mainBody.forEach((stmt) => this.visitStatement(stmt));
        this.dedent();
        this.emit('}');
      }

      this.dedent();
      this.emit('}');
    }
  }

  /**
   * Translates a class declaration to Java public class syntax.
   * Registers fields in the symbol table and emits all class members.
   * Handles optional superclass/inheritance.
   */
  visitClassDeclaration(classDecl: ClassDeclaration): void {
    const previousClassName = this.currentClassName;
    this.currentClassName = classDecl.name;
    const implicitFields = this.collectImplicitFields(classDecl);

    const superClass = classDecl.superClass ? ` extends ${classDecl.superClass.name}` : '';
    this.emit(`public class ${classDecl.name}${superClass} {`);
    this.indent();
    this.context.symbolTable.enterScope();

    implicitFields.forEach((field) => {
      this.context.symbolTable.set(field.name, field.fieldType);
    });

    classDecl.body.forEach((member) => {
      if (member.type === 'FieldDeclaration') {
        let type = (member as any).fieldType;
        if (type === 'auto' && (member as any).initializer) {
          type = this.inferType((member as any).initializer);
        }
        this.context.symbolTable.set((member as any).name, type);
      }
    });

    implicitFields.forEach((field) => {
      this.visitFieldDeclaration(field);
      this.emit('');
    });

    classDecl.body.forEach((member) => {
      this.visitStatement(member);
      this.emit('');
    });
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit('}');

    this.currentClassName = previousClassName;
  }

  /**
   * Translates a field declaration with access modifiers.
   * Includes type inference for auto types and optional initialization.
   * Outputs semicolon-terminated field declarations.
   */
  visitFieldDeclaration(field: FieldDeclaration): void {
    let line = `${field.access} `;
    if (field.isStatic) line += 'static ';
    let type = field.fieldType;
    if (type === 'auto') type = field.initializer ? this.inferType(field.initializer) : 'Object';
    type = this.toJavaType(type);
    line += `${type} ${field.name}`;
    if (field.initializer) {
      line += ` = ${this.generateExpression(field.initializer, 0)}`;
    }
    this.emit(`${line};`);
  }

  /**
   * Translates a constructor with parameters and body.
   * Uses the enclosing class name for the Java constructor signature.
   * Registers parameters in a local scope.
   */
  visitConstructor(ctor: Constructor): void {
    const className = this.currentClassName || 'Main';
    const paramsForSignature = this.normalizeInstanceParams(ctor.params);
    const callSiteTypes = this.context.functionParamTypes.get(className) || [];
    const params = paramsForSignature
      .map((p, i) => `${this.resolveCtorParamType(p, i, callSiteTypes)} ${p.name}`)
      .join(', ');
    this.emit(`public ${className}(${params}) {`);
    this.indent();
    this.context.symbolTable.enterScope();
    this.instanceContextDepth++;
    paramsForSignature.forEach((p, i) =>
      this.context.symbolTable.set(p.name, this.resolveCtorParamType(p, i, callSiteTypes))
    );
    this.visitBlock(ctor.body);
    this.instanceContextDepth--;
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit('}');
  }

  /**
   * Translates a method declaration with access modifiers and return type.
   * Handles static and instance methods with proper Java method signatures.
   * Registers method parameters in a local symbol table scope.
   */
  visitMethodDeclaration(method: MethodDeclaration): void {
    const methodParams = method.isStatic
      ? method.params
      : this.normalizeInstanceParams(method.params);

    let line = `${method.access} `;
    if (method.isStatic) line += 'static ';
    let returnType = method.returnType;
    if (!returnType || returnType === 'auto') {
      const inferred = this.inferBodyReturnType(method.body);
      returnType = inferred !== 'void' && inferred !== 'var' ? inferred : 'void';
    }
    returnType = this.toJavaType(returnType);
    line += `${returnType} ${method.name}(`;
    line +=
      methodParams.map((p) => `${this.toJavaParamType(p.paramType)} ${p.name}`).join(', ') + ')';
    this.emit(`${line} {`);
    this.indent();
    this.context.symbolTable.enterScope();
    if (!method.isStatic) this.instanceContextDepth++;
    methodParams.forEach((p) =>
      this.context.symbolTable.set(p.name, this.toJavaParamType(p.paramType))
    );
    this.visitBlock(method.body);
    if (!method.isStatic) this.instanceContextDepth--;
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit('}');
  }

  /**
   * Translates a block of statements.
   * Called for method bodies, constructor bodies, and control flow blocks.
   */
  visitBlock(block: Block): void {
    block.body.forEach((stmt) => this.visitStatement(stmt));
  }

  /**
   * Translates a print statement to System.out.println.
   * Concatenates multiple expressions with string separators.
   */
  visitPrint(stmt: any): void {
    // Multiple values are string-concatenated with `+`, so operands at additive
    // precedence or below (a - b, a && b, a == b, ...) must be parenthesized;
    // Multiplicative binds tighter than the joining `+` and needs no parens.
    const argPrec = stmt.expressions.length > 1 ? Precedence.Multiplicative : 0;
    const args = stmt.expressions.map((e: any) => this.generateExpression(e, argPrec));
    const separator = typeof stmt.separator === 'string' ? stmt.separator : ' ';
    const joiner = ` + ${JSON.stringify(separator)} + `;
    const rendered = args.length === 0 ? '""' : args.join(joiner);
    const suppressLineFeed = stmt.appendLineFeed === false;

    if (suppressLineFeed) {
      if (typeof stmt.separator === 'string' && args.length === 1) {
        // Re-generate at additive precedence so a low-precedence arg (e.g.
        // `a && b`) is parenthesized before the joining `+ " "`.
        const arg = this.generateExpression(stmt.expressions[0], Precedence.Additive);
        this.emit(`System.out.print(${arg} + ${JSON.stringify(stmt.separator)});`, stmt.id);
      } else {
        this.emit(`System.out.print(${rendered});`, stmt.id);
      }
      return;
    }

    this.emit(`System.out.println(${rendered});`, stmt.id);
  }

  /**
   * Translates variable assignments and declarations.
   * Handles tuple unpacking, member assignments, and type inference.
   * Generates proper Java variable declarations with type information.
   */
  visitAssignment(stmt: any): void {
    const name = lvalueName(stmt);
    const targetStr = this.generateExpression(stmt.target, 0);

    // Member/index mutation (e.g. this.count = v, obj.field = v, arr[i] = v).
    // These are never declarations, so they never carry varType.
    if (name === undefined) {
      const rVal = this.generateExpression(stmt.value, 0);
      // ArrayList index assignment must use .set(i, v), not `.get(i) = v`.
      if (stmt.target.type === 'IndexExpression') {
        const obj = stmt.target.object;
        const objStr = this.generateExpression(obj, 0);
        const idxStr = this.generateExpression(stmt.target.index, 0);
        const objType = obj.type === 'Identifier' ? this.getTypeForName(obj.name) : undefined;
        if (objType && this.isArrayListType(objType)) {
          this.emit(`${objStr}.set(${idxStr}, ${rVal});`, stmt.id);
        } else {
          this.emit(`${objStr}[${idxStr}] = ${rVal};`, stmt.id);
        }
      } else {
        this.emit(`${targetStr} = ${rVal};`, stmt.id);
      }
      return;
    }

    const analyzedTypeHint = this.context.inferredVariableTypes?.get(name);

    if (stmt.varType && stmt.declaredWithoutInitializer) {
      let declaredType =
        analyzedTypeHint && this.isArrayListType(analyzedTypeHint)
          ? analyzedTypeHint
          : stmt.varType;
      declaredType = this.toJavaType(declaredType);
      this.emit(`${this.declType(targetStr, declaredType)}${targetStr};`, stmt.id);
      this.context.symbolTable.set(name, declaredType);
      return;
    }

    const rVal = this.generateExpression(stmt.value, 0);
    let initVal = rVal;
    if (stmt.value.type === 'ArrayLiteral') {
      if (analyzedTypeHint && this.isArrayListType(analyzedTypeHint)) {
        initVal = this.generateArrayListLiteral(
          stmt.value,
          this.getArrayListElementType(analyzedTypeHint)
        );
      } else {
        initVal = initVal.replace(/^new \w+\[\] /, '');
      }
    }

    if (stmt.varType) {
      // `var`/`let`/`const`/`auto` mark an untyped source (JS/dynamic): numbers
      // there carry float-division semantics, so resolve them to `double`.
      const untypedSource = ['auto', 'var', 'let', 'const'].includes(stmt.varType);
      let declaredType =
        analyzedTypeHint && this.isArrayListType(analyzedTypeHint)
          ? analyzedTypeHint
          : stmt.varType;
      if (declaredType === 'auto' || declaredType === 'var' || untypedSource) {
        declaredType = this.inferType(stmt.value);
        if (declaredType === 'int') declaredType = 'double';
        if (declaredType === 'var' || declaredType === 'auto') {
          const ctorName = this.getClassConstructorName(stmt.value);
          declaredType = ctorName || 'Object';
        }
      }
      declaredType = this.toJavaType(declaredType);
      this.emit(`${this.declType(targetStr, declaredType)}${targetStr} = ${initVal};`, stmt.id);
      this.context.symbolTable.set(name, declaredType);
    } else if (this.context.symbolTable.get(name) !== undefined) {
      let nextValue = rVal;
      const existingType = this.getTypeForName(name);
      if (
        stmt.value.type === 'ArrayLiteral' &&
        existingType &&
        this.isArrayListType(existingType)
      ) {
        nextValue = this.generateArrayListLiteral(
          stmt.value,
          this.getArrayListElementType(existingType)
        );
      }
      this.emit(`${targetStr} = ${nextValue};`, stmt.id);
    } else {
      let type = analyzedTypeHint || this.inferType(stmt.value);
      // Untyped source (JS/Python/CSP): a bare number carries float-division
      // semantics, so declare it `double` rather than `int` in Java.
      if (type === 'int') type = 'double';
      if (type === 'var') {
        const ctorName = this.getClassConstructorName(stmt.value);
        type = ctorName || 'Object';
      }
      if (stmt.value.type === 'ArrayLiteral' && this.isArrayListType(type)) {
        initVal = this.generateArrayListLiteral(stmt.value, this.getArrayListElementType(type));
      }
      this.emit(`${this.declType(targetStr, type)}${targetStr} = ${initVal};`, stmt.id);
      this.context.symbolTable.set(name, type);
    }
  }

  /**
   * Translates if-else statements with else-if chains.
   * Properly unrolls nested if blocks into else-if syntax.
   * Manages symbol table scopes for each branch.
   */
  visitIf(stmt: any): void {
    this.emit(`if (${this.generateExpression(stmt.condition, 0)}) {`, stmt.id);
    this.indent();
    this.context.symbolTable.enterScope();
    this.visitBlock(stmt.thenBranch);
    this.context.symbolTable.exitScope();
    this.dedent();

    let currentElse = stmt.elseBranch;

    // Unroll nested if blocks into else-if chains for compact syntax
    while (currentElse && currentElse.body.length === 1 && currentElse.body[0].type === 'If') {
      const elifStmt = currentElse.body[0];
      this.emit(`} else if (${this.generateExpression(elifStmt.condition, 0)}) {`, elifStmt.id);
      this.indent();
      this.context.symbolTable.enterScope();
      this.visitBlock(elifStmt.thenBranch);
      this.context.symbolTable.exitScope();
      this.dedent();
      currentElse = elifStmt.elseBranch;
    }

    if (currentElse) {
      this.emit(`} else {`);
      this.indent();
      this.context.symbolTable.enterScope();
      this.visitBlock(currentElse);
      this.context.symbolTable.exitScope();
      this.dedent();
      this.emit(`}`);
    } else {
      this.emit(`}`);
    }
  }

  /**
   * Translates while loop with condition and body.
   * Manages symbol table scope for loop variables.
   */
  visitWhile(stmt: any): void {
    this.emit(`while (${this.generateExpression(stmt.condition, 0)}) {`, stmt.id);
    this.indent();
    this.context.symbolTable.enterScope();
    this.visitBlock(stmt.body);
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit('}');
  }

  /**
   * Translates do-while loop (body executes before condition check).
   * Body guaranteed to execute at least once.
   */
  visitDoWhile(stmt: any): void {
    this.emit(`do {`, stmt.id);
    this.indent();
    this.context.symbolTable.enterScope();
    this.visitBlock(stmt.body);
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit(`} while (${this.generateExpression(stmt.condition, 0)});`);
  }

  /**
   * Translates a post-condition repeat-until loop.
   * Praxis `repeat...until(cond)` → Java `do { } while (!cond)`.
   */
  visitRepeatUntil(stmt: any): void {
    this.emit(`do {`, stmt.id);
    this.indent();
    this.context.symbolTable.enterScope();
    this.visitBlock(stmt.body);
    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit(`} while (!(${this.generateExpression(stmt.condition, 0)}));`);
  }

  /**
   * Translates switch statement with case labels and default clause.
   * Automatically adds break statements to prevent fallthrough.
   * Avoids breaks only when already present or for final case.
   */
  visitSwitch(stmt: any): void {
    this.emit(`switch (${this.generateExpression(stmt.discriminant, 0)}) {`, stmt.id);
    this.indent();
    this.context.symbolTable.enterScope();

    stmt.cases.forEach((caseStmt: any, index: number) => {
      // Emit case label or default clause
      if (caseStmt.test) {
        this.emit(`case ${this.generateExpression(caseStmt.test, 0)}:`);
      } else {
        this.emit(`default:`);
      }
      this.indent();
      // Emit all statements within this case
      caseStmt.consequent.forEach((s: Statement) => this.visitStatement(s));

      // Add break unless case already has one to prevent fallthrough
      if (
        caseStmt.consequent.length > 0 &&
        caseStmt.consequent[caseStmt.consequent.length - 1].type === 'Break'
      ) {
        // Already has break, no need to add
      } else if (index < stmt.cases.length - 1) {
        // Not the last case, add break to prevent fallthrough
        this.emit('break;');
      } else if (caseStmt.test) {
        // Last case but not default, add break anyway for consistency
        this.emit('break;');
      }

      this.dedent();
    });

    this.context.symbolTable.exitScope();
    this.dedent();
    this.emit('}');
  }

  /**
   * Emits break statement to exit loop or switch.
   */
  visitBreak(stmt: any): void {
    this.emit('break;', stmt.id);
  }

  /**
   * Emits continue statement to skip to next loop iteration.
   */
  visitContinue(stmt: any): void {
    this.emit('continue;', stmt.id);
  }

  /**
   * Translates for loops in multiple formats:
   * 1. C-style: for(init; condition; update)
   * 2. Range-based: handles range(start, end, step) calls
   * 3. Iterator-based: for(item : collection)
   */
  visitFor(stmt: For): void {
    // C-style for loop: for(type var = init; condition; update)
    this.context.symbolTable.enterScope();
    let initCode = '';
    let initCodes: string[] = [];

    // Process initialization - can be single assignment or array of assignments
    if (stmt.init?.type === 'Assignment') {
      const initStmt = stmt.init as any;
      const initName = lvalueName(initStmt) ?? '';
      const rVal = this.generateExpression(initStmt.value, 0);
      let type = initStmt.varType || this.inferType(initStmt.value);
      if (type === 'var') type = 'int';
      initCode = `${this.declType(initName, type)}${initName} = ${rVal}`;
      this.context.symbolTable.set(initName, type);
    } else if (Array.isArray(stmt.init)) {
      // Handle multiple initialization statements
      const stmts = stmt.init as any;
      initCodes = stmts.map((s: any) => {
        if (s.type === 'Assignment') {
          const name = lvalueName(s) ?? '';
          const rVal = this.generateExpression(s.value, 0);
          let type = s.varType || this.inferType(s.value);
          if (type === 'var') type = 'int';
          this.context.symbolTable.set(name, type);
          return `${type} ${name} = ${rVal}`;
        }
        return this.generateExpression((s as any).expression, 0);
      });
      initCode = initCodes.join(', ');
    } else if ((stmt.init as any)?.type === 'Block') {
      // Handle Block node as initialization (legacy support)
      const blockStmt = stmt.init as any;
      initCodes = blockStmt.body.map((s: any) => {
        if (s.type === 'Assignment') {
          const name = lvalueName(s) ?? '';
          const rVal = this.generateExpression(s.value, 0);
          let type = s.varType || this.inferType(s.value);
          if (type === 'var') type = 'int';
          this.context.symbolTable.set(name, type);
          return `${type} ${name} = ${rVal}`;
        }
        return this.generateExpression((s as any).expression, 0);
      });
      initCode = initCodes.join(', ');
    } else if (stmt.init) {
      initCode = this.generateExpression((stmt.init as any).expression, 0);
    }

    // Generate condition expression (a C-style loop may omit it)
    const condCode = stmt.condition ? this.generateExpression(stmt.condition, 0) : '';

    // Process update clause - can be single or multiple statements
    let updateCode = '';
    let updateCodes: string[] = [];
    if (stmt.update?.type === 'Assignment') {
      const updateStmt = stmt.update as any;
      const updateTarget = this.generateExpression(updateStmt.target, 0);
      updateCode = `${updateTarget} = ${this.generateExpression(updateStmt.value, 0)}`;
    } else if (Array.isArray(stmt.update)) {
      // Handle multiple update statements
      const stmts = stmt.update as any;
      updateCodes = stmts.map((s: any) => {
        if (s.type === 'ExpressionStatement') {
          return this.generateExpression(s.expression, 0);
        }
        return this.generateExpression((s as any).expression, 0);
      });
      updateCode = updateCodes.join(', ');
    } else if ((stmt.update as any)?.type === 'Block') {
      // Handle Block node as update (legacy support)
      const blockStmt = stmt.update as any;
      updateCodes = blockStmt.body.map((s: any) => {
        if (s.type === 'ExpressionStatement') {
          return this.generateExpression(s.expression, 0);
        }
        return this.generateExpression((s as any).expression, 0);
      });
      updateCode = updateCodes.join(', ');
    } else if (stmt.update) {
      updateCode = this.generateExpression((stmt.update as any).expression, 0);
    }

    this.emit(`for (${initCode}; ${condCode}; ${updateCode}) {`, stmt.id);
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit('}');
    this.context.symbolTable.exitScope();
  }

  visitForEach(stmt: ForEach): void {
    if (stmt.iterable.type === 'CallExpression' && (stmt.iterable as any).callee.name === 'range') {
      // Handle range(start, end, step) - converts to C-style loop
      const args = (stmt.iterable as any).arguments;
      let start = '0',
        end = '0',
        step = '1';
      // Parse range arguments based on argument count
      if (args.length === 1) {
        end = this.generateExpression(args[0], 0);
      } else if (args.length === 2) {
        start = this.generateExpression(args[0], 0);
        end = this.generateExpression(args[1], 0);
      } else if (args.length === 3) {
        start = this.generateExpression(args[0], 0);
        end = this.generateExpression(args[1], 0);
        step = this.generateExpression(args[2], 0);
      }

      // Emit as C-style for loop with integer bounds
      this.emit(
        `for (${this.declType(stmt.variable, 'int')}${stmt.variable} = ${start}; ${stmt.variable} < ${end}; ${stmt.variable} += ${step}) {`,
        stmt.id
      );
      this.indent();
      this.visitBlock(stmt.body);
      this.dedent();
      this.emit('}');
    } else if (
      stmt.iterable.type === 'BinaryExpression' &&
      (stmt.iterable as any).operator === '..'
    ) {
      // Handle Praxis range operator: for x in start..end  (inclusive)
      const iter = stmt.iterable as any;
      const start = this.generateExpression(iter.left, 0);
      const end = this.generateExpression(iter.right, 0);
      const v = stmt.variable;
      this.emit(`for (int ${v} = ${start}; ${v} <= ${end}; ${v}++) {`, stmt.id);
      this.indent();
      this.context.symbolTable.enterScope();
      this.context.symbolTable.set(v, 'int');
      this.visitBlock(stmt.body);
      this.context.symbolTable.exitScope();
      this.dedent();
      this.emit('}');
    } else {
      // Handle iterator-based for loop: for(type var : iterable)
      let varType = 'var';
      const iterType = this.getExpressionType(stmt.iterable);
      // Extract element type from iterable array type
      if (iterType.endsWith('[]')) varType = iterType.slice(0, -2);
      else if (this.isArrayListType(iterType)) varType = this.getArrayListElementType(iterType);

      this.emit(
        `for (${varType} ${stmt.variable} : ${this.generateExpression(stmt.iterable, 0)}) {`,
        stmt.id
      );
      // A for-each header always declares its own variable (Java requires the
      // type), but record it so a later re-declaration drops its type.
      this.declaredNames.add(stmt.variable);
      this.indent();
      this.context.symbolTable.enterScope();
      this.context.symbolTable.set(stmt.variable, varType);
      this.visitBlock(stmt.body);
      this.context.symbolTable.exitScope();
      this.dedent();
      this.emit('}');
    }
  }

  /**
   * Translates function declaration to static method.
   * Uses function metadata (param types, return type) from context.
   * Registers parameters in local scope.
   */
  visitFunctionDeclaration(stmt: any): void {
    this.context.symbolTable.enterScope();
    const paramTypes = this.context.functionParamTypes.get(stmt.name) || [];

    stmt.params.forEach((p: any, i: number) => {
      let type =
        p.paramType && p.paramType !== 'var' && p.paramType !== 'auto'
          ? p.paramType
          : paramTypes[i];
      if (!type || type === 'var' || type === 'auto') type = 'Object';
      this.context.symbolTable.set(p.name, type);
    });

    const params = stmt.params
      .map((p: any, i: number) => {
        let type =
          p.paramType && p.paramType !== 'var' && p.paramType !== 'auto'
            ? p.paramType
            : paramTypes[i];
        if (!type || type === 'var' || type === 'auto') type = 'Object';
        return `${this.toJavaType(type)} ${p.name}`;
      })
      .join(', ');

    let returnType =
      stmt.returnType && stmt.returnType !== 'auto'
        ? stmt.returnType
        : this.context.functionReturnTypes.get(stmt.name) || 'void';
    returnType = this.toJavaType(returnType);
    this.emit(`public static ${returnType} ${stmt.name}(${params}) {`);
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit('}');
    this.context.symbolTable.exitScope();
  }

  /**
   * Emits return statement with optional return value.
   */
  visitReturn(stmt: any): void {
    this.emit(`return ${stmt.value ? this.generateExpression(stmt.value, 0) : ''};`, stmt.id);
  }

  /**
   * Emits a standalone expression statement with terminating semicolon.
   */
  visitExpressionStatement(stmt: any): void {
    this.emit(`${this.generateExpression(stmt.expression, 0)};`, stmt.id);
  }

  /**
   * Translates try-catch-finally statement.
   * Handles multiple catch blocks for different exception types.
   * Supports optional finally block.
   */
  visitTry(stmt: any): void {
    this.emit('try {', stmt.id);
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit('}');

    stmt.handlers.forEach((handler: any) => {
      const exType = handler.exceptionType || 'Exception';
      const varName = handler.varName || 'e';
      this.emit(`catch (${exType} ${varName}) {`);
      this.indent();
      this.visitBlock(handler.body);
      this.dedent();
      this.emit('}');
    });

    if (stmt.finallyBlock) {
      this.emit('finally {');
      this.indent();
      this.visitBlock(stmt.finallyBlock);
      this.dedent();
      this.emit('}');
    }
  }

  /**
   * Converts AST expression nodes to Java code with proper operator precedence.
   * Handles literal values, identifiers, operators, function calls, and type coercions.
   * @param expr - The AST expression to convert
   * @param parentPrecedence - Operator precedence of the parent expression (for parenthesis insertion)
   * @returns Java source code representation of the expression
   */
  generateExpression(expr: Expression, parentPrecedence: number): string {
    let output = '';
    let currentPrecedence = 99;

    switch (expr.type) {
      case 'Literal':
        // Handle null, string, boolean, and numeric literals
        if (expr.value === null || expr.raw === '"None"') output = 'null';
        else if (typeof expr.value === 'string') {
          const hasPyPrefix =
            expr.raw?.startsWith('f"') || expr.raw?.startsWith('r"') || expr.raw?.startsWith('b"');
          const strVal = hasPyPrefix ? expr.value.substring(1) : expr.value;
          // A single-quoted raw marks a char literal; keep the single quotes.
          if (expr.raw?.startsWith("'")) output = `'${this.escapeString(strVal, "'")}'`;
          else output = `"${this.escapeString(strVal)}"`;
        } else if (typeof expr.value === 'boolean') output = expr.value.toString();
        else output = String(expr.value);
        break;
      case 'Identifier':
        // Output variable/field names as-is
        output = expr.name === 'self' && this.instanceContextDepth > 0 ? 'this' : expr.name;
        break;
      case 'ThisExpression':
        // Reference to current object instance
        output = 'this';
        break;
      case 'Placeholder':
        output = '0'; // Praxis /* ... */ hole -> default value
        break;
      case 'NewExpression':
        // Object instantiation with constructor call
        currentPrecedence = Precedence.Instantiation;
        const args = expr.arguments.map((a) => this.generateExpression(a, 0)).join(', ');
        output = `new ${expr.className}(${args})`;
        break;
      case 'IndexExpression':
        // Array/list element access
        currentPrecedence = Precedence.Member;
        const objE = this.generateExpression(expr.object, currentPrecedence);
        const objType = this.getExpressionType(expr.object);
        const isArrayListObject = this.isArrayListType(objType);
        const lengthAccessor = isArrayListObject ? `${objE}.size()` : `${objE}.length`;

        // Convert indices to Java-compatible form, handling negative indices
        const convertIndex = (idx: any): string => {
          if (!idx) return '0';
          if (idx.type === 'Literal' && typeof idx.value === 'number' && idx.value < 0) {
            // Convert negative indices: nums[-1] becomes nums[nums.length - 1]
            const absIdx = Math.abs(idx.value);
            return `${lengthAccessor} - ${absIdx}`;
          } else if (
            idx.type === 'UnaryExpression' &&
            idx.operator === '-' &&
            idx.argument.type === 'Literal'
          ) {
            // Handle unary minus operator: -1 becomes length - 1
            const val = idx.argument.value as number;
            return `${lengthAccessor} - ${val}`;
          } else {
            // Regular index access without negative handling
            return this.generateExpression(idx, 0);
          }
        };

        const indexExpr = convertIndex(expr.index);
        output = isArrayListObject ? `${objE}.get(${indexExpr})` : `${objE}[${indexExpr}]`;
        break;
      case 'MemberExpression':
        // Object property/method access (obj.property)
        currentPrecedence = Precedence.Member;
        output = `${this.generateExpression(expr.object, currentPrecedence)}.${expr.property.name}`;
        break;
      case 'BinaryExpression':
        // Exponentiation (`**` from Python/JS, `^` from Praxis — the interpreter
        // treats `^` as power, never bitwise XOR) → Math.pow. Java has no `^`
        // exponent operator, so never emit a bare `^`.
        if (expr.operator === '**' || expr.operator === '^') {
          currentPrecedence = Precedence.Exponential;
          const base = this.generateExpression(expr.left, currentPrecedence);
          const exponent = this.generateExpression(expr.right, currentPrecedence);
          output = `Math.pow(${base}, ${exponent})`;
          break;
        }

        // String membership (`x in s`) → Java String.contains.
        if (expr.operator === 'in' || expr.operator === 'not in') {
          const needle = this.generateExpression(expr.left, Precedence.Call);
          const hay = this.generateExpression(expr.right, Precedence.Call);
          output =
            expr.operator === 'in' ? `${hay}.contains(${needle})` : `!${hay}.contains(${needle})`;
          currentPrecedence = expr.operator === 'in' ? Precedence.Call : Precedence.Unary;
          break;
        }

        // Operator mapping from source language to Java syntax
        const opMap: Record<string, { op: string; prec: number }> = {
          // Logical operators
          or: { op: '||', prec: Precedence.LogicalOr },
          and: { op: '&&', prec: Precedence.LogicalAnd },
          // Equality operators
          '==': { op: '==', prec: Precedence.Equality },
          '!=': { op: '!=', prec: Precedence.Equality },
          // Relational operators
          '<': { op: '<', prec: Precedence.Relational },
          '>': { op: '>', prec: Precedence.Relational },
          '<=': { op: '<=', prec: Precedence.Relational },
          '>=': { op: '>=', prec: Precedence.Relational },
          // Arithmetic operators
          '+': { op: '+', prec: Precedence.Additive },
          '-': { op: '-', prec: Precedence.Additive },
          '*': { op: '*', prec: Precedence.Multiplicative },
          '/': { op: '/', prec: Precedence.Multiplicative },
          '%': { op: '%', prec: Precedence.Multiplicative },
          // Other operators
          '..': { op: '..', prec: Precedence.Relational },
        };

        // Special handling for string comparison using .equals() method
        if (expr.operator === '==' || expr.operator === '!=') {
          const leftType = this.inferType(expr.left);
          const rightType = this.inferType(expr.right);

          // Use .equals() for string comparison instead of == operator
          if (leftType === 'String' || rightType === 'String') {
            const leftStr = this.generateExpression(expr.left, Precedence.Call);
            const rightStr = this.generateExpression(expr.right, Precedence.Call);

            // Generate string equality check method call
            if (expr.operator === '==') {
              output = `${leftStr}.equals(${rightStr})`;
            } else {
              output = `!${leftStr}.equals(${rightStr})`;
            }
            currentPrecedence = Precedence.Equality;
            break;
          }
        }

        // Lookup operator and generate binary expression
        const opData = opMap[expr.operator] || { op: expr.operator, prec: 0 };
        currentPrecedence = opData.prec;
        // Generate expression with both operands
        output = `${this.generateExpression(expr.left, currentPrecedence)} ${opData.op} ${this.generateExpression(expr.right, currentPrecedence)}`;
        break;
      case 'UnaryExpression':
        // Unary prefix operators (!, not, -, +)
        currentPrecedence = Precedence.Unary;
        // Map source language not operator to Java !
        let op = expr.operator === 'not' ? '!' : expr.operator;
        output = `${op}${this.generateExpression(expr.argument, currentPrecedence)}`;
        break;
      case 'UpdateExpression':
        // Pre/post increment (++) and decrement (--) operators
        currentPrecedence = Precedence.Unary;
        const argStr = this.generateExpression((expr as any).argument, currentPrecedence);
        // Handle prefix vs postfix operators
        if ((expr as any).prefix) {
          output = `${(expr as any).operator}${argStr}`;
        } else {
          output = `${argStr}${(expr as any).operator}`;
        }
        break;
      case 'CallExpression':
        // Function/method calls with argument substitution
        currentPrecedence = Precedence.Call;
        // Collect argument expressions
        let calleeStr = '';
        const argsF = expr.arguments.map((a) => this.generateExpression(a, 0));

        // Handle method calls (obj.method()) vs function calls (func())
        if ((expr.callee as any).type === 'MemberExpression') {
          const memberExpr = expr.callee as any;
          const obj = this.generateExpression(memberExpr.object, 0);
          const method = memberExpr.property.name;

          // Map source language methods to Java ArrayList/String methods
          if (method === 'append') output = `${obj}.add(${argsF[0]})`;
          else if (method === 'insert') output = `${obj}.add(${argsF[0]}, ${argsF[1]})`;
          // The interpreter's list remove is by index (Java ArrayList.remove(int));
          // emit a plain remove(i) — no `(Object)` cast (the Java parser has no casts).
          else if (method === 'remove') output = `${obj}.remove(${argsF[0]})`;
          else if (method === 'pop')
            output =
              argsF.length > 0 ? `${obj}.remove(${argsF[0]})` : `${obj}.remove(${obj}.size() - 1)`;
          else if (method === 'extend') output = `${obj}.addAll(${argsF[0]})`;
          else if (method === 'sort') output = `java.util.Collections.sort(${obj})`;
          else if (method === 'lower') output = `${obj}.toLowerCase()`;
          else if (method === 'upper') output = `${obj}.toUpperCase()`;
          else if (method === 'find')
            output = `${obj}.indexOf(${argsF[0]})`; // Python spelling
          else if (method === 'replace') output = `${obj}.replace(${argsF[0]}, ${argsF[1]})`;
          // Default method call
          else output = `${obj}.${method}(${argsF.join(', ')})`;
          break;
        } else {
          // Function call (not method)
          calleeStr = (expr.callee as any).name;
        }

        // Handle global/builtin function calls with special mapping
        if (calleeStr === 'LENGTH' || calleeStr === 'len') {
          // Length-of maps to `.size()` (ArrayList), `.length()` (String — it's a
          // method in Java), or `.length` (array property).
          const lengthTargetExpr = expr.arguments[0];
          const lengthTarget = this.generateExpression(lengthTargetExpr, 0);
          const lengthTargetType = this.getExpressionType(lengthTargetExpr);
          output = this.isArrayListType(lengthTargetType)
            ? `${lengthTarget}.size()`
            : lengthTargetType === 'String'
              ? `${lengthTarget}.length()`
              : `${lengthTarget}.length`;
          break;
        }
        // Handle input() function - map to Scanner.nextLine()
        if (calleeStr === 'input' || calleeStr === 'INPUT') {
          // Print prompt if provided
          if (argsF.length > 0) {
            output = `(System.out.print(${argsF[0]}), scanner.nextLine()).substring(0)`;
          } else {
            output = `scanner.nextLine()`;
          }
          break;
        }
        // Conversions -> Java (String/int/double). `String(x)` can't stay as-is
        // because `String` is a keyword and won't parse as a call.
        if (['int', 'INT', 'parseInt'].includes(calleeStr) && argsF.length === 1) {
          output = `Integer.parseInt(${argsF[0]})`;
          break;
        }
        if (['float', 'FLOAT', 'parseFloat'].includes(calleeStr) && argsF.length === 1) {
          output = `Double.parseDouble(${argsF[0]})`;
          break;
        }
        if (['str', 'STRING', 'String'].includes(calleeStr) && argsF.length === 1) {
          // `String` is a keyword (can't be a call target); use string concat.
          output = `("" + (${argsF[0]}))`;
          break;
        }
        // Map uppercase method names (from other languages) to Java equivalents
        if (calleeStr === 'APPEND' && argsF.length === 2) {
          output = `${argsF[0]}.add(${argsF[1]})`;
          break;
        }
        if (calleeStr === 'INSERT' && argsF.length === 3) {
          output = `${argsF[0]}.add(${argsF[1]}, ${argsF[2]})`;
          break;
        }
        if (calleeStr === 'REMOVE' && argsF.length === 2) {
          output = `${argsF[0]}.remove(${argsF[1]})`;
          break;
        }

        const constructorName = this.classNames.has(calleeStr) ? calleeStr : null;
        if (constructorName) {
          output = `new ${constructorName}(${argsF.join(', ')})`;
          break;
        }

        // Default function call
        output = `${calleeStr}(${argsF.join(', ')})`;
        break;
      case 'ArrayLiteral':
        // Array literal with Java array initialization syntax
        const type = this.inferType(expr);
        if (this.isArrayListType(type)) {
          output = this.generateArrayListLiteral(expr, this.getArrayListElementType(type));
          break;
        }
        // Extract base type from array type (remove [] suffix)
        const baseType = type.endsWith('[]') ? type.slice(0, -2) : 'Object';
        // Generate array elements and wrap in new Type[] { ... }
        const elems = expr.elements.map((e) => this.generateExpression(e, 0)).join(', ');
        output = `new ${baseType}[] {${elems}}`;
        break;
      case 'ArrayCreation': {
        const ac = expr as any;
        output = `new ${ac.elementType}[${this.generateExpression(ac.size, 0)}]`;
        break;
      }
      case 'ConditionalExpression':
        // Ternary operator: condition ? consequent : alternate
        currentPrecedence = Precedence.Conditional;
        const test = this.generateExpression((expr as any).test, currentPrecedence);
        const consequent = this.generateExpression((expr as any).consequent, currentPrecedence);
        const alternate = this.generateExpression((expr as any).alternate, currentPrecedence);
        output = `${test} ? ${consequent} : ${alternate}`;
        break;
      case 'CompoundAssignment':
        // Compound assignment: +=, -=, *=, /=, etc.
        const target = (expr as any).name;
        const value = this.generateExpression((expr as any).value, 0);
        output = `${target} ${(expr as any).operator}= ${value}`;
        break;
    }
    // Wrap in parentheses if precedence is lower than parent to ensure correct evaluation order
    return currentPrecedence < parentPrecedence ? `(${output})` : output;
  }
}
