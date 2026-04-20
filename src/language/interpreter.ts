/**
 * AST interpreter that executes programs directly without compilation.
 * Implements environment-based variable scoping and object-oriented programming features.
 */

import type {
  Program,
  Statement,
  Expression,
  FunctionDeclaration,
  ClassDeclaration,
  MethodDeclaration,
  Constructor,
} from './ast';

export class Environment {
  public values: Record<string, any> = {};
  public types: Record<string, string> = {}; // Track declared types
  public declarationOrigins: Record<string, number> = {}; // Track declaration token positions
  public parent?: Environment;
  constructor(parent?: Environment) {
    this.parent = parent;
  }
  define(name: string, value: any, type?: string, declarationOrigin?: number) {
    this.values[name] = value;
    if (type) {
      this.types[name] = type;
      if (declarationOrigin !== undefined) {
        this.declarationOrigins[name] = declarationOrigin;
      }
    }
  }
  assign(name: string, value: any) {
    if (name in this.values) {
      this.values[name] = value;
      return;
    }
    if (this.parent) {
      this.parent.assign(name, value);
      return;
    }
    throw new Error(`Undefined variable '${name}'`);
  }
  get(name: string): any {
    if (name in this.values) return this.values[name];
    if (this.parent) return this.parent.get(name);
    throw new Error(`Undefined variable '${name}'`);
  }
  getType(name: string): string | undefined {
    if (name in this.types) return this.types[name];
    if (this.parent) return this.parent.getType(name);
    return undefined;
  }
  getAllVariables(): Record<string, any> {
    const vars: Record<string, any> = { ...this.values };
    if (this.parent) {
      return { ...this.parent.getAllVariables(), ...vars };
    }
    return vars;
  }
}

class ReturnException extends Error {
  value: any;
  constructor(value: any) {
    super('Return');
    this.value = value;
  }
}

export class InputPrompt extends Error {
  prompt: string;
  constructor(prompt: string = '') {
    super('InputPrompt');
    this.prompt = prompt;
  }
}

// OOP Classes
class JavaClass {
  name: string;
  methods: Map<string, MethodDeclaration> = new Map();
  ctorDecl: Constructor | undefined;
  fields: Map<string, any> = new Map();
  superClass?: JavaClass;

  constructor(name: string, superClass?: JavaClass) {
    this.name = name;
    this.superClass = superClass;
  }

  addMethod(method: MethodDeclaration) {
    this.methods.set(method.name, method);
  }

  setConstructor(ctor: Constructor) {
    this.ctorDecl = ctor;
  }

  getMethod(name: string): MethodDeclaration | undefined {
    if (this.methods.has(name)) return this.methods.get(name);
    if (this.superClass) return this.superClass.getMethod(name);
    return undefined;
  }
}

class JavaInstance {
  klass: JavaClass;
  fields: Map<string, any> = new Map();

  constructor(klass: JavaClass) {
    this.klass = klass;
  }

  getField(name: string): any {
    if (this.fields.has(name)) return this.fields.get(name);
    // Check class fields
    if (this.klass.fields.has(name)) return this.klass.fields.get(name);
    throw new Error(`Undefined field '${name}'`);
  }

  setField(name: string, value: any) {
    this.fields.set(name, value);
  }

  callMethod(methodName: string, args: any[], interpreter: Interpreter, env: Environment): any {
    const method = this.klass.getMethod(methodName);
    if (!method) throw new Error(`Undefined method '${methodName}'`);

    const methodEnv = new Environment(env);
    methodEnv.define('this', this);
    methodEnv.define('self', this); // Python compatibility

    // Bind parameters
    method.params.forEach((param, i) => {
      methodEnv.define(param.name, args[i] || null);
    });

    try {
      interpreter.executeBlock(method.body.body, methodEnv);
    } catch (e) {
      if (e instanceof ReturnException) return e.value;
      throw e;
    }
    return null;
  }
}

export class Interpreter {
  private globalEnv = new Environment();
  private output: string[] = [];
  private outputLineBuffer: string = '';
  private classes: Map<string, JavaClass> = new Map();
  private currentEnv: Environment = this.globalEnv;
  private sourceCode: string = ''; // Store source code for line number extraction
  private inputQueue: string[] = []; // Queue of pending inputs
  private isDebugging: boolean = false; // Flag to track if we're in debug mode
  private inputHandler?: (prompt: string) => string; // Callback for collecting input in normal mode
  private seededRandom: (() => number) | null = null;

  setInputQueue(inputs: string[]) {
    this.inputQueue = [...inputs];
  }

  addInput(input: string) {
    console.log('addInput called with:', input, 'Queue length before:', this.inputQueue.length);
    this.inputQueue.push(input);
    console.log('Queue length after:', this.inputQueue.length);
  }

  hasInput(): boolean {
    return this.inputQueue.length > 0;
  }

  getNextInput(): string | null {
    console.log('getNextInput called, queue length:', this.inputQueue.length);
    const result = this.inputQueue.length > 0 ? this.inputQueue.shift()! : null;
    console.log('getNextInput returning:', result);
    return result;
  }

  setDebugging(isDebugging: boolean) {
    this.isDebugging = isDebugging;
  }

  setInputHandler(handler: (prompt: string) => string) {
    this.inputHandler = handler;
  }

  // Mulberry32 PRNG provides deterministic pseudo-random values for randomSeed().
  private createSeededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private normalizeSeed(seedValue: any): number {
    const seed = Number(seedValue);
    if (!Number.isFinite(seed)) return 0;
    return Math.trunc(seed) >>> 0;
  }

  private getRandomValue(): number {
    return this.seededRandom ? this.seededRandom() : Math.random();
  }

  private isIntegerType(typeName?: string): boolean {
    if (!typeName) return false;
    const baseType = typeName.replace(/\[\]/g, '');
    return ['int', 'byte', 'short', 'long'].includes(baseType);
  }

  private isFloatType(typeName?: string): boolean {
    if (!typeName) return false;
    const baseType = typeName.replace(/\[\]/g, '');
    return baseType === 'float' || baseType === 'double';
  }

  private inferExpressionType(expr: Expression, env: Environment): string | undefined {
    switch (expr.type) {
      case 'Identifier':
        return env.getType((expr as any).name);
      case 'Literal': {
        const literal = expr as any;
        if (typeof literal.value === 'number') {
          return String(literal.raw ?? '').includes('.') ? 'double' : 'int';
        }
        if (typeof literal.value === 'boolean') return 'boolean';
        if (typeof literal.value === 'string')
          return literal.value.length === 1 ? 'char' : 'String';
        return undefined;
      }
      case 'MemberExpression':
        if ((expr as any).property?.name === 'length') return 'int';
        return undefined;
      case 'IndexExpression': {
        const objExpr = (expr as any).object;
        const objType = this.inferExpressionType(objExpr, env);
        if (objType?.endsWith('[]')) return objType.slice(0, -2);
        return undefined;
      }
      case 'CallExpression': {
        const call = expr as any;
        if (call.callee?.type === 'Identifier') {
          const callee = String(call.callee.name || '').toLowerCase();
          if (callee === 'int') return 'int';
          if (callee === 'float') return 'float';
          if (callee === 'bool' || callee === 'boolean') return 'boolean';
          if (callee === 'str' || callee === 'string') return 'String';
          if (callee === 'random') return 'double';
          if (callee === 'randomint') return 'int';
        }
        if (call.callee?.type === 'MemberExpression') {
          const method = call.callee.property?.name;
          if (method === 'length') return 'int';
          if (method === 'substring' || method === 'toLowerCase' || method === 'toUpperCase')
            return 'String';
          if (method === 'charAt') return 'char';
        }
        return undefined;
      }
      case 'UnaryExpression': {
        const op = (expr as any).operator;
        if (op === 'not' || op === '!') return 'boolean';
        return this.inferExpressionType((expr as any).argument, env);
      }
      case 'BinaryExpression': {
        const binary = expr as any;
        const operator = binary.operator;
        if (['==', '!=', '>', '<', '>=', '<=', 'and', 'or'].includes(operator)) {
          return 'boolean';
        }
        const leftType = this.inferExpressionType(binary.left, env);
        const rightType = this.inferExpressionType(binary.right, env);

        if (operator === '/') {
          if (this.isIntegerType(leftType) && this.isIntegerType(rightType)) return 'int';
          if (this.isFloatType(leftType) || this.isFloatType(rightType)) return 'double';
          return undefined;
        }

        if (this.isFloatType(leftType) || this.isFloatType(rightType)) return 'double';
        if (this.isIntegerType(leftType) && this.isIntegerType(rightType)) return 'int';
        if (operator === '+' && (leftType === 'String' || rightType === 'String')) return 'String';
        return undefined;
      }
      default:
        return undefined;
    }
  }

  private appendOutputText(text: string, appendLineFeed: boolean) {
    if (appendLineFeed) {
      this.output.push(this.outputLineBuffer + text);
      this.outputLineBuffer = '';
      return;
    }
    this.outputLineBuffer += text;
  }

  private flushOutputBuffer() {
    if (this.outputLineBuffer.length > 0) {
      this.output.push(this.outputLineBuffer);
      this.outputLineBuffer = '';
    }
  }

  interpret(program: Program, sourceCode: string = ''): string[] {
    this.sourceCode = sourceCode;
    this.output = [];
    this.outputLineBuffer = '';
    this.globalEnv = new Environment();
    this.classes = new Map();
    this.isDebugging = false; // Not in debug mode for normal execution
    this.seededRandom = null;

    try {
      // First pass: register all classes and procedures
      for (const stmt of program.body) {
        if (stmt.type === 'ClassDeclaration') {
          this.registerClass(stmt);
        } else if (stmt.type === 'FunctionDeclaration') {
          this.globalEnv.define(stmt.name, stmt);
        }
      }

      // Second pass: execute all non-class and non-function statements
      const statements = program.body.filter(
        (stmt) => stmt.type !== 'ClassDeclaration' && stmt.type !== 'FunctionDeclaration'
      );
      this.executeBlock(statements, this.globalEnv);

      // Third pass: if there's a Main class, execute its main() method
      if (this.classes.has('Main')) {
        const mainClass = this.classes.get('Main')!;
        const mainMethod = mainClass.getMethod('main');
        if (mainMethod) {
          const mainInstance = new JavaInstance(mainClass);
          mainInstance.callMethod('main', [], this, this.globalEnv);
        }
      }
    } catch (e: any) {
      // InputPrompt in normal run mode should propagate to UI  for console handling
      if (e instanceof InputPrompt) {
        this.flushOutputBuffer();
        throw e;
      }
      const message = e.message || String(e);
      this.flushOutputBuffer();
      // If the error message already starts with "runtime error occurred", don't add prefix
      if (message.startsWith('runtime error occurred')) {
        this.output.push(message);
      } else {
        this.output.push(`Runtime Error: ${message}`);
      }
    }
    this.flushOutputBuffer();
    return this.output;
  }

  *stepThroughWithState(
    program: Program,
    sourceCode: string = ''
  ): Generator<
    { nodeId: string; nodeType: string; loc: any; variables: Record<string, any>; prompt?: string },
    string[],
    void
  > {
    this.sourceCode = sourceCode;
    this.output = [];
    this.outputLineBuffer = '';
    this.globalEnv = new Environment();
    this.currentEnv = this.globalEnv;
    this.isDebugging = true; // We're in debug mode for step-through execution
    this.seededRandom = null;

    try {
      // First pass: register all classes and procedures
      for (const stmt of program.body) {
        if (stmt.type === 'ClassDeclaration') {
          this.registerClass(stmt);
        } else if (stmt.type === 'FunctionDeclaration') {
          this.globalEnv.define(stmt.name, stmt);
        }
      }

      // Second pass: execute all non-class and non-function statements
      const statements = program.body.filter(
        (stmt) => stmt.type !== 'ClassDeclaration' && stmt.type !== 'FunctionDeclaration'
      );
      yield* this.executeBlockGeneratorWithState(statements, this.globalEnv);

      // Third pass: if there's a Main class, execute its main() method
      if (this.classes.has('Main')) {
        const mainClass = this.classes.get('Main')!;
        const mainMethod = mainClass.getMethod('main');
        if (mainMethod) {
          // Execute the main method's body directly instead of synthesizing a call
          yield* this.executeBlockGeneratorWithState(mainMethod.body.body, this.globalEnv);
        }
      }
    } catch (e: any) {
      // InputPrompt should propagate to debugger, not be caught here
      if (e instanceof InputPrompt) {
        this.flushOutputBuffer();
        throw e;
      }
      const message = e.message || String(e);
      this.flushOutputBuffer();
      // If the error message already starts with "runtime error occurred", don't add prefix
      if (message.startsWith('runtime error occurred')) {
        this.output.push(message);
      } else {
        this.output.push(`Runtime Error: ${message}`);
      }
    }
    this.flushOutputBuffer();
    return this.output;
  }

  private *executeBlockGeneratorWithState(
    statements: Statement[],
    env: Environment
  ): Generator<
    { nodeId: string; nodeType: string; loc: any; variables: Record<string, any>; prompt?: string },
    void,
    void
  > {
    console.log('executeBlockGeneratorWithState: Processing', statements.length, 'statements');
    let i = 0;
    while (i < statements.length) {
      const stmt = statements[i];
      console.log('Processing statement type:', stmt.type, 'index:', i);
      this.currentEnv = env;

      // Handle control flow statements specially to yield steps for nested statements
      if (stmt.type === 'If') {
        const ifStmt = stmt as any;
        // Yield the If statement itself (always, for debugging)
        yield {
          nodeId: ifStmt.id,
          nodeType: ifStmt.type,
          loc: ifStmt.loc || null,
          variables: env.getAllVariables(),
        };
        // Evaluate condition and execute appropriate branch
        try {
          const truthy = this.evaluate(ifStmt.condition, env);
          if (truthy) {
            yield* this.executeBlockGeneratorWithState(ifStmt.thenBranch.body, env);
          } else if (ifStmt.elseBranch) {
            yield* this.executeBlockGeneratorWithState(ifStmt.elseBranch.body, env);
          }
        } catch (e) {
          if (e instanceof ReturnException) throw e;
          throw e;
        }
        i++;
      } else if (stmt.type === 'While') {
        const whileStmt = stmt as any;
        let isFirstIteration = true;
        let iterationCount = 0;
        const MAX_ITERATIONS = 10000; // Safety limit to prevent truly infinite loops during testing

        while (true) {
          // Check iteration count to prevent actual infinite loops during execution
          iterationCount++;
          if (iterationCount > MAX_ITERATIONS) {
            const lineNum = this.getLineFromLocation(whileStmt.loc);
            throw new Error(
              `runtime error occurred on line ${lineNum}:\nThis is probably an infinite loop.`
            );
          }

          // Yield the While statement itself for each iteration (always, for debugging)
          yield {
            nodeId: whileStmt.id,
            nodeType: whileStmt.type,
            loc: whileStmt.loc || null,
            variables: env.getAllVariables(),
          };
          try {
            const condition = this.evaluate(whileStmt.condition, env);
            if (!condition) break;

            // On first iteration, prepare for infinite loop detection
            let conditionVars: Set<string> | null = null;
            let oldValues: Record<string, any> | null = null;
            if (isFirstIteration) {
              conditionVars = this.extractVariablesFromExpression(whileStmt.condition);
              oldValues = {};
              for (const varName of conditionVars) {
                try {
                  oldValues[varName] = env.get(varName);
                } catch {
                  // Variable doesn't exist
                }
              }
            }

            // Execute one iteration
            yield* this.executeBlockGeneratorWithState(whileStmt.body.body, env);

            // After first iteration, check if this might be an infinite loop
            if (isFirstIteration && conditionVars !== null && oldValues !== null) {
              isFirstIteration = false;

              // Check if condition is still true and no variables changed
              const conditionStillTrue = this.evaluate(whileStmt.condition, env);
              const varsChanged = this.hasVariablesChanged(conditionVars, oldValues, env);

              // If condition is still true, variables haven't changed, and the body doesn't modify condition vars
              if (conditionStillTrue && !varsChanged && conditionVars.size > 0) {
                // Additional check: does the loop body modify any of these variables?
                if (!this.blockModifiesVariables(whileStmt.body.body, conditionVars, env)) {
                  const lineNum = this.getLineFromLocation(whileStmt.loc);
                  throw new Error(
                    `runtime error occurred on line ${lineNum}:\nThis is probably an infinite loop.`
                  );
                }
              }
            }
          } catch (e) {
            if (e instanceof ReturnException) throw e;
            throw e;
          }
        }
        i++;
      } else if (stmt.type === 'For') {
        const forStmt = stmt as any;
        try {
          if (forStmt.init && forStmt.condition && forStmt.update) {
            // C-Style for loop
            this.execute(forStmt.init, env);
            while (true) {
              // Yield the For statement itself for each iteration (always, for debugging)
              yield {
                nodeId: forStmt.id,
                nodeType: forStmt.type,
                loc: forStmt.loc || null,
                variables: env.getAllVariables(),
              };
              const condition = this.evaluate(forStmt.condition, env);
              if (!condition) break;
              yield* this.executeBlockGeneratorWithState(forStmt.body.body, env);
              this.execute(forStmt.update, env);
            }
          } else {
            // For-each loop
            const iterable = this.evaluate(forStmt.iterable, env);
            if (!Array.isArray(iterable) && typeof iterable !== 'string') {
              throw new Error('For loop requires array or string');
            }
            for (const item of iterable) {
              env.define(forStmt.variable, item);
              // Yield the For statement itself for each iteration (always, for debugging)
              yield {
                nodeId: forStmt.id,
                nodeType: forStmt.type,
                loc: forStmt.loc || null,
                variables: env.getAllVariables(),
              };
              yield* this.executeBlockGeneratorWithState(forStmt.body.body, env);
            }
          }
        } catch (e) {
          if (e instanceof ReturnException) throw e;
          throw e;
        }
        i++;
      } else if (stmt.type === 'DoWhile') {
        const doWhileStmt = stmt as any;
        let iterationCount = 0;
        const MAX_ITERATIONS = 10000;

        do {
          iterationCount++;
          if (iterationCount > MAX_ITERATIONS) {
            const lineNum = this.getLineFromLocation(doWhileStmt.loc);
            throw new Error(
              `runtime error occurred on line ${lineNum}:\nThis is probably an infinite loop.`
            );
          }

          yield {
            nodeId: doWhileStmt.id,
            nodeType: doWhileStmt.type,
            loc: doWhileStmt.loc || null,
            variables: env.getAllVariables(),
          };
          try {
            yield* this.executeBlockGeneratorWithState(doWhileStmt.body.body, env);
          } catch (e) {
            if (e instanceof ReturnException) throw e;
            throw e;
          }
        } while (this.evaluate(doWhileStmt.condition, env));

        i++;
      } else {
        // For all other statements, execute and yield
        let needsRetry = false;
        let lastError: any = null;

        try {
          this.execute(stmt, env);
        } catch (e) {
          if (e instanceof InputPrompt) {
            needsRetry = true;
            lastError = e;
          } else if (e instanceof ReturnException) {
            throw e;
          } else {
            throw e;
          }
        }

        // Yield the result (either success or InputPrompt)
        yield {
          nodeId: stmt.id,
          nodeType: needsRetry ? 'InputPrompt' : stmt.type,
          loc: stmt.loc || null,
          variables: env.getAllVariables(),
          prompt: needsRetry ? lastError?.prompt || '' : undefined,
        };

        // If we need input, don't increment - next iteration will retry
        if (!needsRetry) {
          i++;
        }
        // If InputPrompt, DON'T increment i - next call to generator.next() will re-enter this try block
      }
    }
  }

  private registerClass(classDecl: ClassDeclaration) {
    const javaClass = new JavaClass(classDecl.name);

    for (const member of classDecl.body) {
      if (member.type === 'MethodDeclaration') {
        javaClass.addMethod(member);
      } else if (member.type === 'Constructor') {
        javaClass.setConstructor(member);
      } else if (member.type === 'FieldDeclaration') {
        javaClass.fields.set(
          member.name,
          member.initializer ? this.evaluate(member.initializer, this.globalEnv) : null
        );
      }
    }

    this.classes.set(classDecl.name, javaClass);
    this.globalEnv.define(classDecl.name, javaClass);
  }

  /**
   * Get line number from location info (character position in source code)
   */
  private getLineFromLocation(loc: any): number {
    if (!loc || !loc.start || !this.sourceCode) return 1;
    const precedingCode = this.sourceCode.substring(0, loc.start);
    return precedingCode.split('\n').length;
  }

  /**
   * Extract all variable names referenced in an expression
   */
  private extractVariablesFromExpression(expr: Expression): Set<string> {
    const vars = new Set<string>();

    if (!expr) return vars;

    const traverse = (node: any) => {
      if (!node) return;

      if (node.type === 'Identifier') {
        vars.add(node.name);
      } else if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
        traverse(node.left);
        traverse(node.right);
      } else if (node.type === 'UnaryExpression' || node.type === 'UpdateExpression') {
        traverse(node.argument);
      } else if (node.type === 'CallExpression') {
        traverse(node.callee);
        if (node.arguments) {
          node.arguments.forEach((arg: any) => traverse(arg));
        }
      } else if (node.type === 'MemberExpression') {
        traverse(node.object);
      } else if (node.type === 'ArrayLiteral') {
        if (node.elements) {
          node.elements.forEach((elem: any) => traverse(elem));
        }
      } else if (node.type === 'ConditionalExpression') {
        traverse(node.test);
        traverse(node.consequent);
        traverse(node.alternate);
      }
    };

    traverse(expr);
    return vars;
  }

  /**
   * Check if a statement modifies any of the given variables
   */
  private statementModifiesVariables(
    stmt: Statement,
    targetVars: Set<string>,
    env: Environment
  ): boolean {
    if (!stmt) return false;

    const check = (node: any): boolean => {
      if (!node) return false;

      if (node.type === 'Assignment') {
        return targetVars.has(node.name);
      } else if (node.type === 'VariableDeclaration') {
        return targetVars.has(node.name);
      } else if (node.type === 'UpdateExpression') {
        if (node.argument?.type === 'Identifier') {
          return targetVars.has(node.argument.name);
        }
      } else if (node.type === 'ExpressionStatement') {
        return check(node.expression);
      } else if (node.type === 'If') {
        // Check both branches
        if (node.thenBranch) {
          if (node.thenBranch.type === 'Block') {
            for (const stmt of node.thenBranch.body) {
              if (this.statementModifiesVariables(stmt, targetVars, env)) return true;
            }
          } else if (this.statementModifiesVariables(node.thenBranch, targetVars, env)) {
            return true;
          }
        }
        if (node.elseBranch) {
          if (node.elseBranch.type === 'Block') {
            for (const stmt of node.elseBranch.body) {
              if (this.statementModifiesVariables(stmt, targetVars, env)) return true;
            }
          } else if (this.statementModifiesVariables(node.elseBranch, targetVars, env)) {
            return true;
          }
        }
        return false;
      } else if (node.type === 'Block') {
        for (const stmt of node.body || []) {
          if (this.statementModifiesVariables(stmt, targetVars, env)) return true;
        }
        return false;
      } else if (node.type === 'While' || node.type === 'For' || node.type === 'DoWhile') {
        // Nested loops might modify variables
        // For safety, we could assume they might modify condition variables
        // But for now, we'll check the body just to be thorough
        if (node.body?.body) {
          for (const stmt of node.body.body) {
            if (this.statementModifiesVariables(stmt, targetVars, env)) return true;
          }
        }
        return false;
      }

      return false;
    };

    return check(stmt);
  }

  /**
   * Check if a block of statements might modify any of the given variables
   */
  private blockModifiesVariables(
    statements: Statement[],
    targetVars: Set<string>,
    env: Environment
  ): boolean {
    for (const stmt of statements) {
      if (this.statementModifiesVariables(stmt, targetVars, env)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a value equals another value deeply
   */
  private deepEquals(a: any, b: any): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((v, i) => this.deepEquals(v, b[i]));
    }
    return false;
  }

  /**
   * Check if a value has changed in the environment
   */
  private hasVariablesChanged(
    variables: Set<string>,
    oldValues: Record<string, any>,
    env: Environment
  ): boolean {
    for (const varName of variables) {
      try {
        const oldVal = oldValues[varName];
        const newVal = env.get(varName);
        if (!this.deepEquals(oldVal, newVal)) {
          return true;
        }
      } catch {
        // Variable doesn't exist, skip
      }
    }
    return false;
  }

  /**
   * Check if a value can be assigned to a declared type
   * Returns error message if incompatible, or null if compatible
   */
  private checkTypeCompatibility(value: any, declaredType: string): string | null {
    // Handle array types
    if (declaredType.includes('[]')) {
      // Check if value is an array
      if (!Array.isArray(value)) {
        return `incompatible types: ${typeof value} cannot be converted to ${declaredType}`;
      }

      // Get element type by removing []
      const elementType = declaredType.replace(/\[\]/g, '');

      // Check compatibility of array elements
      for (let i = 0; i < value.length; i++) {
        const elementError = this.checkTypeCompatibility(value[i], elementType);
        if (elementError) {
          return `incompatible types in array: element at index ${i} - ${elementError}`;
        }
      }

      return null; // All elements are compatible
    }

    const baseType = declaredType;

    // Numeric types
    const numericTypes = ['int', 'byte', 'short', 'long', 'float', 'double'];
    const lossyNumericTypes = ['int', 'byte', 'short', 'long']; // Types that lose precision with float/double

    if (numericTypes.includes(baseType)) {
      // Assigning to numeric type
      if (typeof value === 'number') {
        // Check for lossy conversion
        if (lossyNumericTypes.includes(baseType) && !Number.isInteger(value)) {
          // Assigning float/double to lossy type
          const valueType = value % 1 !== 0 ? 'double' : 'int';
          return `incompatible types: possible lossy conversion from ${valueType} to ${baseType}`;
        }
        return null; // Compatible
      } else if (value === null) {
        return `incompatible types: cannot assign null to primitive type ${baseType}`;
      } else {
        // Non-numeric value to numeric type
        const valueType = typeof value === 'string' ? 'String' : typeof value;
        return `incompatible types: ${valueType} cannot be converted to ${baseType}`;
      }
    }

    // String type
    if (baseType === 'String') {
      if (typeof value === 'string') {
        return null; // Compatible
      } else if (value === null) {
        return null; // null can be assigned to String
      } else if (typeof value === 'number') {
        return `incompatible types: int cannot be converted to String`;
      } else {
        const valueType = typeof value;
        return `incompatible types: ${valueType} cannot be converted to String`;
      }
    }

    // Other types (custom classes)
    if (baseType && baseType[0] === baseType[0].toUpperCase()) {
      // Custom class type
      if (value === null) {
        return null; // null can be assigned to object types
      }
      if (value instanceof JavaInstance && value.klass.name === baseType) {
        return null; // Compatible
      }
      const valueType = value instanceof JavaInstance ? value.klass.name : typeof value;
      return `incompatible types: ${valueType} cannot be converted to ${baseType}`;
    }

    return null; // Default compatible
  }

  executeBlock(statements: Statement[], env: Environment) {
    for (const stmt of statements) {
      this.execute(stmt, env);
    }
  }

  private instantiateClass(klass: JavaClass, args: any[], env: Environment): JavaInstance {
    const instance = new JavaInstance(klass);

    if (klass.ctorDecl) {
      const ctorEnv = new Environment(env);
      ctorEnv.define('this', instance);
      ctorEnv.define('self', instance);
      klass.ctorDecl.params.forEach((param, i) => {
        ctorEnv.define(param.name, args[i] || null);
      });

      try {
        this.executeBlock(klass.ctorDecl.body.body, ctorEnv);
      } catch (e) {
        if (!(e instanceof ReturnException)) throw e;
      }
    }

    return instance;
  }

  private execute(stmt: Statement, env: Environment) {
    switch (stmt.type) {
      case 'ClassDeclaration':
        break;
      case 'Print':
        const vals = stmt.expressions.map((e) => {
          const val = this.evaluate(e, env);
          const type = this.inferExpressionType(e, env);
          return this.stringify(val, false, type);
        });
        const separator =
          typeof (stmt as any).separator === 'string' ? (stmt as any).separator : ' ';
        const appendLineFeed = (stmt as any).appendLineFeed !== false;
        const rendered = vals.join(separator);

        if (appendLineFeed) {
          this.appendOutputText(rendered, true);
        } else {
          const trailingText =
            typeof (stmt as any).separator === 'string' && vals.length === 1
              ? (stmt as any).separator
              : '';
          this.appendOutputText(rendered + trailingText, false);
        }
        break;
      case 'Assignment':
        let varName = stmt.name;

        // Extract variable name from target if it's an Identifier
        if (stmt.target && stmt.target.type === 'Identifier') {
          varName = (stmt.target as any).name;
        }

        // Prefer explicit declaration type, otherwise use existing variable type when reassigning.
        const assignmentType =
          (stmt as any).varType || (varName ? env.getType(varName) : undefined);
        const value = this.evaluate(stmt.value, env, assignmentType);
        const declarationOrigin = stmt.loc?.start;

        // Typed assignments act as declarations and cannot redeclare in the same scope.
        if ((stmt as any).varType && Object.prototype.hasOwnProperty.call(env.values, varName)) {
          const existingOrigin = env.declarationOrigins[varName];
          if (existingOrigin !== declarationOrigin) {
            const line = this.getLineFromLocation(stmt.loc);
            throw new Error(
              `runtime error occurred on line ${line}: variable ${varName} has already been declared in this scope.`
            );
          }
        }

        // Type checking for typed assignments
        if ((stmt as any).varType) {
          const typeError = this.checkTypeCompatibility(value, (stmt as any).varType);
          if (typeError) {
            const line = this.getLineFromLocation(stmt.loc);
            throw new Error(`runtime error occurred on line ${line}:\n${typeError}`);
          }
        }

        if (stmt.target) {
          if (stmt.target.type === 'MemberExpression') {
            const obj = this.evaluate((stmt.target as any).object, env);
            const fieldName = (stmt.target as any).property.name;
            if (obj instanceof JavaInstance) {
              obj.setField(fieldName, value);
            } else {
              obj[fieldName] = value;
            }
          } else if (stmt.target.type === 'IndexExpression') {
            const obj = this.evaluate((stmt.target as any).object, env);
            const idx = this.evaluate((stmt.target as any).index, env);
            obj[idx] = value;
          } else if (stmt.target.type === 'Identifier') {
            // Identifier target - define the variable with type info
            env.define(varName, value, (stmt as any).varType, declarationOrigin);
          } else {
            // For other target types, try to use stmt.name as fallback
            if (varName) {
              env.define(varName, value, (stmt as any).varType, declarationOrigin);
            }
          }
        } else if (stmt.name.includes('.')) {
          const parts = stmt.name.split('.');
          const objName = parts[0];
          const fieldName = parts.slice(1).join('.');
          const obj = env.get(objName);
          if (obj instanceof JavaInstance) {
            obj.setField(fieldName, value);
          } else {
            throw new Error(`Cannot assign to field on non-object`);
          }
        } else if (varName) {
          // Standard case: define the variable with type info
          env.define(varName, value, (stmt as any).varType, declarationOrigin);
        }
        break;
      case 'If':
        const truthy = this.evaluate(stmt.condition, env);
        if (truthy) {
          this.executeBlock(stmt.thenBranch.body, env);
        } else if (stmt.elseBranch) {
          this.executeBlock(stmt.elseBranch.body, env);
        }
        break;
      case 'While': {
        let isFirstIteration = true;
        let iterationCount = 0;
        const MAX_ITERATIONS = 10000; // Safety limit to prevent truly infinite loops

        while (this.evaluate(stmt.condition, env)) {
          // Check iteration count to prevent actual infinite loops
          iterationCount++;
          if (iterationCount > MAX_ITERATIONS) {
            const lineNum = this.getLineFromLocation(stmt.loc);
            throw new Error(
              `runtime error occurred on line ${lineNum}:\nThis is probably an infinite loop.`
            );
          }

          // After first iteration, check if this might be an infinite loop
          if (isFirstIteration) {
            isFirstIteration = false;

            // Extract variables from the condition
            const conditionVars = this.extractVariablesFromExpression(stmt.condition);

            // Save current variable values
            const oldValues: Record<string, any> = {};
            for (const varName of conditionVars) {
              try {
                oldValues[varName] = env.get(varName);
              } catch {
                // Variable doesn't exist
              }
            }

            // Execute one iteration
            this.executeBlock(stmt.body.body, env);

            // Check if condition is still true and no variables changed
            const conditionStillTrue = this.evaluate(stmt.condition, env);
            const varsChanged = this.hasVariablesChanged(conditionVars, oldValues, env);

            // If condition is still true, variables haven't changed, and the body doesn't modify condition vars
            if (conditionStillTrue && !varsChanged && conditionVars.size > 0) {
              // Additional check: does the loop body modify any of these variables?
              if (!this.blockModifiesVariables(stmt.body.body, conditionVars, env)) {
                const lineNum = this.getLineFromLocation(stmt.loc);
                throw new Error(
                  `runtime error occurred on line ${lineNum}:\nThis is probably an infinite loop.`
                );
              }
            }
          } else {
            this.executeBlock(stmt.body.body, env);
          }
        }
        break;
      }
      case 'For':
        if (stmt.init && stmt.condition && stmt.update) {
          // C-Style evaluation mappings
          this.execute(stmt.init, env);
          let iterationCount = 0;
          const MAX_ITERATIONS = 10000;
          while (this.evaluate(stmt.condition, env)) {
            iterationCount++;
            if (iterationCount > MAX_ITERATIONS) {
              const lineNum = this.getLineFromLocation(stmt.loc);
              throw new Error(
                `runtime error occurred on line ${lineNum}:\nThis is probably an infinite loop.`
              );
            }
            this.executeBlock(stmt.body.body, env);
            this.execute(stmt.update, env);
          }
        } else {
          const iterable = this.evaluate(stmt.iterable, env);
          if (!Array.isArray(iterable) && typeof iterable !== 'string')
            throw new Error('For loop requires array or string');
          for (const item of iterable) {
            env.define(stmt.variable, item);
            this.executeBlock(stmt.body.body, env);
          }
        }
        break;
      case 'DoWhile': {
        let iterationCount = 0;
        const MAX_ITERATIONS = 10000;
        do {
          iterationCount++;
          if (iterationCount > MAX_ITERATIONS) {
            const lineNum = this.getLineFromLocation(stmt.loc);
            throw new Error(
              `runtime error occurred on line ${lineNum}:\nThis is probably an infinite loop.`
            );
          }
          this.executeBlock(stmt.body.body, env);
        } while (this.evaluate(stmt.condition, env));
        break;
      }
      case 'FunctionDeclaration':
        env.define(stmt.name, stmt);
        break;
      case 'Return':
        const retVal = stmt.value ? this.evaluate(stmt.value, env) : null;
        throw new ReturnException(retVal);
      case 'ExpressionStatement':
        this.evaluate(stmt.expression, env);
        break;
    }
  }

  evaluate(expr: Expression, env: Environment, expectedType?: string): any {
    switch (expr.type) {
      case 'Literal':
        return expr.value;
      case 'ArrayLiteral':
        return expr.elements.map((e) => this.evaluate(e, env));
      case 'Identifier':
        return env.get(expr.name);
      case 'ThisExpression':
        try {
          return env.get('this');
        } catch {
          return env.get('self');
        }
      case 'UnaryExpression':
        const right = this.evaluate(expr.argument, env, expectedType);
        if (expr.operator === '-') return -right;
        if (expr.operator === '!' || expr.operator === 'not') return !right;
        break;
      case 'BinaryExpression':
        const l = this.evaluate(expr.left, env, expectedType);
        const r = this.evaluate(expr.right, env, expectedType);

        // Helper to get declared type of an expression
        const getDeclaredType = (exprNode: Expression): string => {
          if (exprNode.type === 'Identifier') {
            return env.getType((exprNode as any).name) || '';
          }
          return '';
        };

        const integerTypes = ['int', 'byte', 'short', 'long'];
        const leftType = getDeclaredType(expr.left);
        const rightType = getDeclaredType(expr.right);

        switch (expr.operator) {
          case '+':
            return l + r;
          case '-':
            return l - r;
          case '*':
            return l * r;
          case '/':
            // Assignment to an integer variable uses integer division by default.
            if (this.isIntegerType(expectedType) && r !== 0) {
              return Math.trunc(l / r);
            }
            // Integer division: if both operands are integer types, truncate result
            const leftIsInt = integerTypes.some((t) => leftType.replace(/\[\]/g, '') === t);
            const rightIsInt = integerTypes.some((t) => rightType.replace(/\[\]/g, '') === t);
            if (leftIsInt && rightIsInt && r !== 0) {
              return Math.trunc(l / r);
            }
            return l / r;
          case '%':
            return l % r;
          case '**':
            return Math.pow(l, r);
          case '^':
            return Math.pow(l, r); // Exponentiation (same as **)
          case '>':
            return l > r;
          case '<':
            return l < r;
          case '>=':
            return l >= r;
          case '<=':
            return l <= r;
          case '==':
            return l === r;
          case '!=':
            return l !== r;
          case 'and':
            return l && r;
          case 'or':
            return l || r;
          default:
            throw new Error(`Unknown operator ${expr.operator}`);
        }
        break;
      case 'NewExpression':
        const klass = env.get(expr.className);
        if (!klass || !(klass instanceof JavaClass)) {
          throw new Error(`Undefined class '${expr.className}'`);
        }
        const args = expr.arguments.map((a) => this.evaluate(a, env));
        return this.instantiateClass(klass, args, env);

      case 'IndexExpression':
        const indexObj = this.evaluate(expr.object, env);
        const idxValue = this.evaluate(expr.index, env);
        return indexObj[idxValue];

      case 'MemberExpression':
        const obj = this.evaluate(expr.object, env);
        if (obj instanceof JavaInstance) {
          return obj.getField(expr.property.name);
        }
        if ((typeof obj === 'string' || Array.isArray(obj)) && expr.property.name === 'length') {
          return obj.length;
        }
        throw new Error(`Cannot access member on non-object`);

      case 'CallExpression':
        if ((expr.callee as any).type === 'MemberExpression') {
          const memberExpr = expr.callee as any;
          const obj = this.evaluate(memberExpr.object, env);
          const methodName = memberExpr.property.name;
          const args = expr.arguments.map((a) => this.evaluate(a, env));

          if (obj instanceof JavaInstance) {
            return obj.callMethod(methodName, args, this, env);
          }

          if (typeof obj === 'string') {
            switch (methodName) {
              case 'substring':
                if (args.length >= 2) return obj.substring(Number(args[0]), Number(args[1]));
                if (args.length === 1) return obj.substring(Number(args[0]));
                return obj;
              case 'toLowerCase':
                return obj.toLowerCase();
              case 'toUpperCase':
                return obj.toUpperCase();
              case 'charAt':
                return obj.charAt(Number(args[0] ?? 0));
              case 'length':
                return obj.length;
            }
          }

          if (Array.isArray(obj) && methodName === 'length') {
            return obj.length;
          }

          throw new Error(`Cannot call method on non-object`);
        }

        const calleeName = (expr.callee as any).name;

        // Handle input() function - get prompt from arguments (CSP style)
        if (calleeName === 'input' || calleeName === 'INPUT') {
          const promptStr =
            expr.arguments.length > 0 ? this.stringify(this.evaluate(expr.arguments[0], env)) : '';
          console.log('input() called, checking for queued input...');
          const nextInput = this.getNextInput();
          if (nextInput !== null) {
            console.log('Found input in queue, returning:', nextInput);
            // Add echo to output to ensure correct order
            this.flushOutputBuffer();
            this.output.push(`> ${nextInput}`);
            return nextInput;
          }
          // No input available
          console.log('No input in queue, throwing InputPrompt with prompt:', promptStr);
          if (this.isDebugging) {
            // In debug mode, throw InputPrompt so debugger can handle it
            throw new InputPrompt(promptStr);
          } else if (this.inputHandler) {
            // In normal run mode with a handler, use it to prompt user
            return this.inputHandler(promptStr);
          } else {
            // Both debug and normal mode: throw InputPrompt to let UI handle it
            throw new InputPrompt(promptStr);
          }
        }

        // Built-in functions
        if (calleeName === 'len' || calleeName === 'LENGTH') {
          const arg = this.evaluate(expr.arguments[0], env);
          return arg ? arg.length : 0;
        }
        if (calleeName === 'range') {
          const args = expr.arguments.map((a) => this.evaluate(a, env));
          let start = 0,
            end = 0,
            step = 1;
          if (args.length === 1) {
            end = args[0];
          } else if (args.length === 2) {
            start = args[0];
            end = args[1];
          } else if (args.length === 3) {
            start = args[0];
            end = args[1];
            step = args[2];
          }

          const result: number[] = [];
          if (step > 0) {
            for (let i = start; i < end; i += step) result.push(i);
          } else {
            for (let i = start; i > end; i += step) result.push(i);
          }
          return result;
        }
        if (calleeName === 'enumerate') {
          const iterable = this.evaluate(expr.arguments[0], env);
          if (Array.isArray(iterable)) {
            return iterable.map((val, idx) => [idx, val]);
          }
          return [];
        }
        if (calleeName === 'APPEND') {
          const list = this.evaluate(expr.arguments[0], env);
          const val = this.evaluate(expr.arguments[1], env);
          if (Array.isArray(list)) list.push(val);
          return null;
        }
        if (calleeName === 'INSERT') {
          const list = this.evaluate(expr.arguments[0], env);
          const idx = this.evaluate(expr.arguments[1], env); // 0-based indexing
          const val = this.evaluate(expr.arguments[2], env);
          if (Array.isArray(list)) list.splice(idx, 0, val);
          return null;
        }
        if (calleeName === 'REMOVE') {
          const list = this.evaluate(expr.arguments[0], env);
          const idx = this.evaluate(expr.arguments[1], env); // 0-based indexing
          if (Array.isArray(list)) list.splice(idx, 1);
          return null;
        }

        // Type conversion functions
        if (calleeName === 'int' || calleeName === 'INT') {
          const val = this.evaluate(expr.arguments[0], env);
          if (typeof val === 'number') return Math.floor(val);
          if (typeof val === 'string') return parseInt(val, 10);
          if (typeof val === 'boolean') return val ? 1 : 0;
          return 0;
        }
        if (calleeName === 'float' || calleeName === 'FLOAT') {
          const val = this.evaluate(expr.arguments[0], env);
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return parseFloat(val);
          if (typeof val === 'boolean') return val ? 1.0 : 0.0;
          return 0.0;
        }
        if (calleeName === 'str' || calleeName === 'String' || calleeName === 'STRING') {
          const val = this.evaluate(expr.arguments[0], env);
          return this.stringify(val, false);
        }
        if (calleeName === 'bool' || calleeName === 'BOOL' || calleeName === 'boolean') {
          const val = this.evaluate(expr.arguments[0], env);
          return Boolean(val);
        }

        // Random functions
        if (calleeName === 'random' || calleeName === 'RANDOM') {
          return this.getRandomValue();
        }
        if (calleeName === 'randomInt' || calleeName === 'RANDOMINT') {
          const max = this.evaluate(expr.arguments[0], env);
          return Math.floor(this.getRandomValue() * max);
        }
        if (calleeName === 'randomSeed' || calleeName === 'RANDOMSEED') {
          const seedValue = expr.arguments.length > 0 ? this.evaluate(expr.arguments[0], env) : 0;
          this.seededRandom = this.createSeededRandom(this.normalizeSeed(seedValue));
          return null;
        }

        const callee = env.get(calleeName);

        // Class constructor call (e.g., Meow(10) in translated Python)
        if (callee instanceof JavaClass) {
          const args = expr.arguments.map((a) => this.evaluate(a, env));
          return this.instantiateClass(callee, args, env);
        }

        if (callee && callee.type === 'FunctionDeclaration') {
          const func = callee as FunctionDeclaration;
          const args = expr.arguments.map((a) => this.evaluate(a, env));
          if (args.length !== func.params.length)
            throw new Error(`Expected ${func.params.length} arguments but got ${args.length}`);
          const fnEnv = new Environment(env);
          func.params.forEach((param, i) => fnEnv.define(param.name, args[i]));
          try {
            this.executeBlock(func.body.body, fnEnv);
          } catch (e) {
            if (e instanceof ReturnException) return e.value;
            throw e;
          }
          return null;
        }
        throw new Error(`Undefined function ${calleeName}`);
    }
  }

  private stringify(val: any, inArray: boolean = false, type?: string): string {
    if (val === null) return 'None';
    if (val === true) return 'true';
    if (val === false) return 'false';
    if (val instanceof JavaInstance) return `${val.klass.name} instance`;

    if (typeof val === 'number') {
      const isFloatType = type === 'double' || type === 'float';
      if (isFloatType && Number.isInteger(val)) {
        return `${val}.0`;
      }
    }

    if (Array.isArray(val)) {
      // Arrays use braces and comma separation
      const elemType = type ? type.replace('[]', '') : undefined;
      return `{${val.map((v) => this.stringify(v, true, elemType)).join(', ')}}`;
    }

    if (inArray && typeof val === 'string') {
      // Apply quotes for strings inside arrays
      // Check specific types first
      if (type === 'char') return `'${val}'`;
      if (type === 'String') return `"${val}"`;

      // Heuristic fallback: length 1 -> single quotes (char), otherwise double quotes (String)
      if (val.length === 1) return `'${val}'`;
      return `"${val}"`;
    }

    return String(val);
  }

  getOutput(): string[] {
    return this.output;
  }

  getCurrentEnv(): Environment {
    return this.currentEnv;
  }

  getGlobalEnv(): Environment {
    return this.globalEnv;
  }
}
