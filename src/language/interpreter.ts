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
import { lvalueName } from './ast';
// Optional memory-diagram hook: the interpreter only reports events into it when
// a caller has attached one via setMemdia(); all diagram logic lives in memdia.ts.
import { Memdia } from './memdia';

export class Environment {
  public values: Record<string, any> = {};
  public types: Record<string, string> = {}; // Track declared types
  public declarationOrigins: Record<string, number> = {}; // Track declaration token positions
  public hiddenNames: Set<string> = new Set(); // Names to omit from the debugger's variable table (e.g. main's synthetic args param)
  public parent?: Environment;
  /**
   * Creates a new instance.
   */
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
  /**
   * Creates a new instance.
   */
  constructor(value: any) {
    super('Return');
    this.value = value;
  }
}

// Loop control-flow signals, thrown by `break`/`continue` and caught by the
// nearest enclosing loop (or, for break, an enclosing switch).
class BreakException extends Error {
  constructor() {
    super('Break');
  }
}

class ContinueException extends Error {
  constructor() {
    super('Continue');
  }
}

/**
 * Marks a declared-but-unassigned variable/field (`int x;`, an unassigned
 * Praxis placeholder hole). Reading one is a runtime error — Praxly has no
 * static definite-assignment check, so this is enforced dynamically at first
 * use instead. Distinct from `Undefined variable`/`Undefined field` (which
 * mean "this name doesn't exist at all").
 */
class UninitializedValue {
  toString(): string {
    return '<uninitialized>';
  }
}
const UNINITIALIZED = new UninitializedValue();

// Thrown when code reads a variable/field holding UNINITIALIZED. Kept distinct
// from a plain lookup-failure Error so callers that tolerate "not found" (e.g.
// the bare-identifier-might-be-a-field fallback) don't silently swallow a real
// "you used this before assigning it" error.
class UninitializedAccessError extends Error {}

export class InputPrompt extends Error {
  prompt: string;
  /**
   * Creates a new instance.
   */
  constructor(prompt: string = '') {
    super('InputPrompt');
    this.prompt = prompt;
  }
}

/** One entry of the debugger's call stack: a function/method invocation and the
 *  variables local to it. The bottom entry is always the global scope. */
export interface StackFrame {
  name: string;
  variables: Record<string, any>;
}

/** What the step-through generator yields to the debugger after each step. */
export interface DebugStepEvent {
  nodeId: string;
  nodeType: string;
  loc: { start: number; end: number } | null;
  /** Flat "visible right now" view: globals shadowed by the current frame's locals. */
  variables: Record<string, any>;
  /** Global scope first, innermost call last. */
  callStack: StackFrame[];
  prompt?: string;
}

/** A user-written callable the debugger can step into. */
interface ResolvedCallable {
  name: string;
  decl: FunctionDeclaration | MethodDeclaration;
  thisInstance?: JavaInstance;
}

// Call names the identifier-call ladder in `evaluate` dispatches as built-ins
// BEFORE looking up user functions. The debugger's resolveUserCallable must skip
// them so debug-mode dispatch matches run mode. Keep in sync with that ladder.
const BUILTIN_CALL_NAMES = new Set([
  'Scanner',
  'Random',
  'super',
  'input',
  'INPUT',
  'len',
  'LENGTH',
  'range',
  'APPEND',
  'INSERT',
  'REMOVE',
  'int',
  'INT',
  'float',
  'FLOAT',
  'str',
  'String',
  'STRING',
  'bool',
  'BOOL',
  'boolean',
  'parseInt',
  'parseFloat',
  'Number',
  'Boolean',
  'random',
  'RANDOM',
  'randomInt',
  'RANDOMINT',
  'randomSeed',
  'RANDOMSEED',
  'setSeed',
  'ArrayList',
  'List',
  'Array',
]);

// Numeric built-ins that `evaluate` resolves after user functions but before
// sibling methods — a sibling method with one of these names is never reached.
const NUMERIC_BUILTIN_NAMES = new Set(['min', 'max', 'abs', 'sqrt', 'log']);

// OOP Classes
class JavaClass {
  name: string;
  methods: Map<string, MethodDeclaration> = new Map();
  ctorDecl: Constructor | undefined;
  fields: Map<string, any> = new Map();
  fieldTypes: Map<string, string> = new Map(); // declared type per field, for display (MemDia)
  superClass?: JavaClass;

  /**
   * Creates a new instance.
   */
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

/** Wraps a declared byte/short/long/float/double value from a debug snapshot so
 *  display code (variable table, MemDia) can tell it apart from a plain int even
 *  when the value happens to be a whole number — a bare JS number can't (12 === 12.0,
 *  and there's nothing distinguishing a JS number that came from a short vs an int).
 *  Only float/double ever get a trailing .0; the others print as plain integers,
 *  same as int. Only ever appears in snapshotFrameVariables' output; never touches
 *  live execution. */
class TypedNumber {
  constructor(
    public readonly value: number,
    public readonly declaredType: 'byte' | 'short' | 'long' | 'float' | 'double'
  ) {}
  toString(): string {
    const isFloating = this.declaredType === 'float' || this.declaredType === 'double';
    return isFloating && Number.isInteger(this.value) ? `${this.value}.0` : String(this.value);
  }
}

/** Wraps a declared char value from a debug snapshot — char is a plain JS string
 *  internally (see stringify's `'${val}'` vs `"${val}"` split), indistinguishable from
 *  a real String without its declared type. MemDia needs this to render it inline as a
 *  primitive (single-quoted) instead of a heap-boxed String reference. Only ever
 *  appears in snapshotFrameVariables' output; never touches live execution. */
class TypedChar {
  readonly declaredType = 'char' as const;
  constructor(public readonly value: string) {}
  toString(): string {
    return `'${this.value}'`;
  }
}

class JavaInstance {
  klass: JavaClass;
  fields: Map<string, any> = new Map();

  /**
   * Creates a new instance.
   */
  constructor(klass: JavaClass) {
    this.klass = klass;
  }

  getField(name: string): any {
    if (this.fields.has(name)) return this.checkInitializedField(name, this.fields.get(name));
    // Check class fields, walking up the superclass chain for inherited fields
    let klass: JavaClass | undefined = this.klass;
    while (klass) {
      if (klass.fields.has(name)) return this.checkInitializedField(name, klass.fields.get(name));
      klass = klass.superClass;
    }
    throw new Error(`Undefined field '${name}'`);
  }

  private checkInitializedField(name: string, value: any): any {
    if (value === UNINITIALIZED) {
      throw new UninitializedAccessError(`Uninitialized field '${name}'`);
    }
    return value;
  }

  setField(name: string, value: any) {
    this.fields.set(name, value);
  }

  callMethod(methodName: string, args: any[], interpreter: Interpreter, env: Environment): any {
    const method = this.klass.getMethod(methodName);
    if (!method) {
      // Default Object methods when the class doesn't override them (AP CSA).
      if (methodName === 'toString' && args.length === 0) return `${this.klass.name} instance`;
      if (methodName === 'equals' && args.length === 1) return this === args[0];
      throw new Error(`Undefined method '${methodName}'`);
    }

    const methodEnv = new Environment(env);
    methodEnv.define('this', this);
    methodEnv.define('self', this); // Python compatibility

    // Bind parameters (no default values; argument count must match exactly)
    interpreter.bindParams(method.params, args, methodEnv);

    try {
      interpreter.executeBlock(method.body.body, methodEnv);
    } catch (e) {
      if (e instanceof ReturnException) return e.value;
      throw e;
    }
    return null;
  }
}

// Java Scanner over System.in. Reads whitespace-delimited tokens (next/nextInt/…)
// with a small buffer, and whole lines (nextLine) — both drawn from the shared
// input queue. The interpreter dispatches its methods (see the Scanner branch in
// evaluate) where it can reuse readInputLine().
class JavaScanner {
  tokenBuffer: string[] = [];
}

// Java Random: each instance owns its PRNG state (seedable via setSeed); nextInt/
// nextDouble/nextBoolean route through it. Modeled on JavaScanner — the interpreter
// dispatches its methods (see the Random branch in evaluate). An unseeded instance
// uses Math.random; a setSeed(s) instance uses the same Mulberry32 as the procedural
// randomSeed(s), so a seeded Java Random matches a seeded randomInt with the same seed.
class JavaRandom {
  rng: (() => number) | null = null;
  next(): number {
    return this.rng ? this.rng() : Math.random();
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

  // --- Debug-mode state (only used on the stepThroughWithState path) ---
  /** Active user-function invocations, innermost last. */
  private debugCallStack: Array<{ name: string; env: Environment }> = [];
  /** Stack of per-expression caches of stepped-through call results, keyed by
   *  CallExpression node id (see resolveUserCalls). `evaluate` consults the top
   *  cache so a call whose body was already stepped through isn't run twice. */
  private debugCallResults: Array<Map<string, any>> = [];

  // --- Memory-diagram (Memdia) connection state ---
  /** Diagram to report declaration/assignment/call/return events to; unset means no diagram is attached. */
  private memdia?: Memdia;
  /** Names of plain function calls currently executing, so functionReturn can be
   *  labeled correctly whether the call ends via an explicit `return` (case 'Return')
   *  or by falling off the end of the function body (the plain-call branch in evaluate). */
  private memdiaCallNames: string[] = [];

  setInputQueue(inputs: string[]) {
    this.inputQueue = [...inputs];
  }

  addInput(input: string) {
    // console.log('addInput called with:', input, 'Queue length before:', this.inputQueue.length);
    this.inputQueue.push(input);
    // console.log('Queue length after:', this.inputQueue.length);
  }

  hasInput(): boolean {
    return this.inputQueue.length > 0;
  }

  getNextInput(): string | null {
    // console.log('getNextInput called, queue length:', this.inputQueue.length);
    const result = this.inputQueue.length > 0 ? this.inputQueue.shift()! : null;
    // console.log('getNextInput returning:', result);
    return result;
  }

  // Reads and echoes one line of input, or (when the queue is empty) prompts via
  // the input handler / throws InputPrompt for the UI. Shared by input() and Scanner.
  private readInputLine(prompt: string): string {
    const nextInput = this.getNextInput();
    if (nextInput !== null) {
      this.flushOutputBuffer();
      this.output.push(`> ${nextInput}`);
      return nextInput;
    }
    if (this.inputHandler && !this.isDebugging) return this.inputHandler(prompt);
    throw new InputPrompt(prompt);
  }

  setDebugging(isDebugging: boolean) {
    this.isDebugging = isDebugging;
  }

  setInputHandler(handler: (prompt: string) => string) {
    this.inputHandler = handler;
  }

  // Attaches a memory-diagram panel; until called, all this.memdia?.* hooks below are no-ops.
  setMemdia(memdia: Memdia) {
    this.memdia = memdia;
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
          // `random()` / `RANDOM()` yield a float; CSP `RANDOM(a, b)` (2 args)
          // yields an inclusive integer.
          if (callee === 'random') return call.arguments?.length === 2 ? 'int' : 'double';
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
        if (['==', '!=', '>', '<', '>=', '<=', 'and', 'or', 'in', 'not in'].includes(operator)) {
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
    // A `\n` inside the text is a line break: everything before it completes the
    // current output line. This keeps the output array one-entry-per-line even
    // when a printed value (or a terminator baked into it) contains a newline —
    // essential for faithful cross-language print/DISPLAY round-tripping.
    const combined = this.outputLineBuffer + text;
    const parts = combined.split('\n');
    for (let i = 0; i < parts.length - 1; i++) this.output.push(parts[i]);
    this.outputLineBuffer = parts[parts.length - 1];
    if (appendLineFeed) {
      this.output.push(this.outputLineBuffer);
      this.outputLineBuffer = '';
    }
  }

  private flushOutputBuffer() {
    if (this.outputLineBuffer.length > 0) {
      this.output.push(this.outputLineBuffer);
      this.outputLineBuffer = '';
    }
  }

  /**
   * Interprets and executes the provided program.
   */
  interpret(program: Program, sourceCode: string = ''): string[] {
    this.sourceCode = sourceCode;
    this.output = [];
    this.outputLineBuffer = '';
    this.globalEnv = new Environment();
    this.classes = new Map();
    this.isDebugging = false; // Not in debug mode for normal execution
    this.seededRandom = null;
    this.debugCallStack = [];
    this.debugCallResults = [];
    this.memdiaCallNames = []; // reset in-flight call names so a reused Interpreter starts clean

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
          // Java's `main(String[] args)` receives an empty argument array.
          const mainArgs = mainMethod.params.length > 0 ? [[]] : [];
          mainInstance.callMethod('main', mainArgs, this, this.globalEnv);
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
  ): Generator<DebugStepEvent, string[], void> {
    this.sourceCode = sourceCode;
    this.output = [];
    this.outputLineBuffer = '';
    this.globalEnv = new Environment();
    this.currentEnv = this.globalEnv;
    this.isDebugging = true; // We're in debug mode for step-through execution
    this.seededRandom = null;
    this.debugCallStack = [];
    this.debugCallResults = [];

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

      // Third pass: if there's a Main class, execute its main() method. Mirror
      // the normal-run path (callMethod): bind `this` so bare calls to sibling
      // static methods resolve, and give main its own stack frame.
      if (this.classes.has('Main')) {
        const mainClass = this.classes.get('Main')!;
        const mainMethod = mainClass.getMethod('main');
        if (mainMethod) {
          const mainInstance = new JavaInstance(mainClass);
          const mainEnv = new Environment(this.globalEnv);
          mainEnv.define('this', mainInstance);
          mainEnv.define('self', mainInstance);
          // Java's `main(String[] args)` receives an empty argument array.
          if (mainMethod.params.length > 0) {
            this.bindParams(mainMethod.params, [[]], mainEnv);
            mainEnv.hiddenNames.add(mainMethod.params[0].name); // synthetic — never real input, whatever the student named it
          }
          this.debugCallStack.push({ name: 'main', env: mainEnv });
          try {
            yield* this.executeBlockGeneratorWithState(mainMethod.body.body, mainEnv);
          } catch (e) {
            if (!(e instanceof ReturnException)) throw e; // `return` from main just ends it
          } finally {
            this.debugCallStack.pop();
          }
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

  /** Snapshot of the call stack for the debugger: global scope first, then one
   *  frame per active user-function call, innermost last. */
  getStackFrames(): StackFrame[] {
    const frames: StackFrame[] = [
      { name: 'global', variables: this.snapshotFrameVariables(this.globalEnv) },
    ];
    for (const frame of this.debugCallStack) {
      frames.push({ name: frame.name, variables: this.snapshotFrameVariables(frame.env) });
    }
    return frames;
  }

  /** An environment's own variables, minus runtime bookkeeping (function/class
   *  declarations, the bound `this`/`self`) that would clutter a variable table. */
  private snapshotFrameVariables(env: Environment): Record<string, any> {
    const variables: Record<string, any> = {};
    for (const [name, value] of Object.entries(env.values)) {
      if (name === 'this' || name === 'self') continue;
      if (env.hiddenNames.has(name)) continue;
      if (value && typeof value === 'object' && value.type === 'FunctionDeclaration') continue;
      if (value instanceof JavaClass) continue;
      variables[name] = this.tagFloatingValue(value, env.types[name]);
    }
    return variables;
  }

  /** See TypedNumber — wraps a declared byte/short/long/float/double scalar with its
   *  type (int is left alone; it's already the default display guess). For an array,
   *  tags the array object itself (never a copy) with a hidden, non-enumerable
   *  property instead — an aliased array (e.g. also reachable through an object field)
   *  must stay the exact same object, or memdia.ts's identity-based dedup would draw
   *  it as two separate heap boxes. The tag is invisible to anything that iterates or
   *  serializes the array (for...of, .map(), JSON.stringify, Object.keys). */
  private tagFloatingValue(value: any, declaredType?: string): any {
    const base = declaredType?.replace(/\[\]$/, '');
    if (base === 'char') {
      if (Array.isArray(value)) {
        Object.defineProperty(value, '__declaredElementType', {
          value: 'char',
          enumerable: false,
          configurable: true,
        });
        return value;
      }
      return typeof value === 'string' ? new TypedChar(value) : value;
    }
    const needsTag =
      this.isFloatType(declaredType) || (this.isIntegerType(declaredType) && base !== 'int');
    if (!needsTag) return value;
    const type = base as 'byte' | 'short' | 'long' | 'float' | 'double';
    if (Array.isArray(value)) {
      Object.defineProperty(value, '__declaredElementType', {
        value: type,
        enumerable: false,
        configurable: true,
      });
      return value;
    }
    return typeof value === 'number' ? new TypedNumber(value, type) : value;
  }

  /** Builds the event yielded to the debugger for one step at `stmt`. */
  private debugEvent(stmt: Statement, overrides: Partial<DebugStepEvent> = {}): DebugStepEvent {
    const callStack = this.getStackFrames();
    const globals = callStack[0].variables;
    const locals = callStack[callStack.length - 1].variables;
    return {
      nodeId: stmt.id,
      nodeType: stmt.type,
      loc: stmt.loc || null,
      variables: callStack.length > 1 ? { ...globals, ...locals } : globals,
      callStack,
      ...overrides,
    };
  }

  private *executeBlockGeneratorWithState(
    statements: Statement[],
    env: Environment
  ): Generator<DebugStepEvent, void, void> {
    const MAX_ITERATIONS = 10000; // Safety limit to prevent truly infinite loops

    for (const stmt of statements) {
      this.currentEnv = env;

      switch (stmt.type) {
        case 'If': {
          // Announce the `if` line, then evaluate the condition (stepping into
          // any user function calls it contains) and walk the taken branch.
          yield this.debugEvent(stmt);
          const condition = yield* this.evaluateForDebug(stmt.condition, env, stmt, false);
          if (condition) {
            yield* this.executeBlockGeneratorWithState(stmt.thenBranch.body, env);
          } else if (stmt.elseBranch) {
            yield* this.executeBlockGeneratorWithState(stmt.elseBranch.body, env);
          }
          break;
        }

        case 'While': {
          // The infinite-loop heuristic compares condition variables across the
          // first iteration; a condition that calls functions can change without
          // any variable changing (and re-evaluating it here would repeat the
          // call's side effects), so it only applies to call-free conditions.
          const heuristicApplies = !this.expressionContainsCall(stmt.condition);
          let isFirstIteration = true;
          let iterationCount = 0;

          while (true) {
            iterationCount++;
            if (iterationCount > MAX_ITERATIONS) throw this.infiniteLoopError(stmt.loc);

            // Announce the `while` line for each condition check.
            yield this.debugEvent(stmt);
            const condition = yield* this.evaluateForDebug(stmt.condition, env, stmt, false);
            if (!condition) break;

            let conditionVars: Set<string> | null = null;
            let oldValues: Record<string, any> | null = null;
            if (isFirstIteration && heuristicApplies) {
              conditionVars = this.extractVariablesFromExpression(stmt.condition);
              oldValues = {};
              for (const varName of conditionVars) {
                try {
                  oldValues[varName] = env.get(varName);
                } catch {
                  // Variable doesn't exist yet
                }
              }
            }

            const signal = yield* this.runIterationGenerator(stmt.body.body, env);
            if (signal === 'break') break;

            if (isFirstIteration) {
              isFirstIteration = false;
              // Run the heuristic only when the body ran to completion (a
              // continue iteration is inconclusive).
              if (signal === 'normal' && conditionVars && oldValues && conditionVars.size > 0) {
                const conditionStillTrue = this.evaluate(stmt.condition, env);
                const varsChanged = this.hasVariablesChanged(conditionVars, oldValues, env);
                if (
                  conditionStillTrue &&
                  !varsChanged &&
                  !this.blockModifiesVariables(stmt.body.body, conditionVars, env)
                ) {
                  throw this.infiniteLoopError(stmt.loc);
                }
              }
            }
          }
          break;
        }

        case 'For': {
          // C-style for loop; any clause may be absent (`for (;;)`).
          if (stmt.init) this.execute(stmt.init, env);
          let iterationCount = 0;
          while (true) {
            iterationCount++;
            if (iterationCount > MAX_ITERATIONS) throw this.infiniteLoopError(stmt.loc);

            yield this.debugEvent(stmt);
            if (stmt.condition) {
              const condition = yield* this.evaluateForDebug(stmt.condition, env, stmt, false);
              if (!condition) break;
            }
            const signal = yield* this.runIterationGenerator(stmt.body.body, env);
            if (signal === 'break') break;
            // `continue` still runs the update clause (C semantics).
            if (stmt.update) this.execute(stmt.update, env);
          }
          break;
        }

        case 'ForEach': {
          const iterable = yield* this.evaluateForDebug(stmt.iterable, env, stmt);
          if (!Array.isArray(iterable) && typeof iterable !== 'string') {
            throw new Error('For-each loop requires array or string');
          }
          for (const item of iterable) {
            env.define(stmt.variable, item);
            yield this.debugEvent(stmt);
            if ((yield* this.runIterationGenerator(stmt.body.body, env)) === 'break') break;
          }
          break;
        }

        case 'DoWhile': {
          let iterationCount = 0;
          while (true) {
            iterationCount++;
            if (iterationCount > MAX_ITERATIONS) throw this.infiniteLoopError(stmt.loc);

            yield this.debugEvent(stmt);
            if ((yield* this.runIterationGenerator(stmt.body.body, env)) === 'break') break;
            const condition = yield* this.evaluateForDebug(stmt.condition, env, stmt, false);
            if (!condition) break;
          }
          break;
        }

        case 'RepeatUntil': {
          // Post-condition loop: body runs first, stops when condition becomes TRUE.
          let iterationCount = 0;
          while (true) {
            iterationCount++;
            if (iterationCount > MAX_ITERATIONS) throw this.infiniteLoopError(stmt.loc);

            yield this.debugEvent(stmt);
            if ((yield* this.runIterationGenerator(stmt.body.body, env)) === 'break') break;
            const condition = yield* this.evaluateForDebug(stmt.condition, env, stmt, false);
            if (condition) break;
          }
          break;
        }

        case 'Return': {
          const value = yield* this.evaluateForDebug(stmt.value, env, stmt);
          // Show the `return` line while the function's locals are still alive;
          // the next step lands back at the call site with this frame gone.
          yield this.debugEvent(stmt);
          throw new ReturnException(value);
        }

        case 'Break':
          yield this.debugEvent(stmt);
          throw new BreakException();

        case 'Continue':
          yield this.debugEvent(stmt);
          throw new ContinueException();

        case 'BlankLine':
          break; // no runtime effect — not worth a debugger step

        default: {
          // Step into any user function calls in the statement's expressions
          // first; their results are cached so executing the statement below
          // doesn't run them a second time.
          const cache = new Map<string, any>();
          this.debugCallResults.push(cache);
          try {
            for (const expr of this.statementExpressions(stmt)) {
              yield* this.resolveUserCalls(expr, env, stmt, cache, true);
            }
            // Execute, pausing (and later retrying) when console input is needed.
            while (true) {
              try {
                this.execute(stmt, env);
                break;
              } catch (e) {
                if (!(e instanceof InputPrompt)) throw e;
                yield this.debugEvent(stmt, { nodeType: 'InputPrompt', prompt: e.prompt });
              }
            }
          } finally {
            this.debugCallResults.pop();
          }
          yield this.debugEvent(stmt);
        }
      }
    }
  }

  /** Runs one loop-body iteration in debug mode, translating break/continue
   *  signals into a return code (the generator twin of runIteration). */
  private *runIterationGenerator(
    body: Statement[],
    env: Environment
  ): Generator<DebugStepEvent, 'normal' | 'continue' | 'break', void> {
    try {
      yield* this.executeBlockGeneratorWithState(body, env);
      return 'normal';
    } catch (e) {
      if (e instanceof ContinueException) return 'continue';
      if (e instanceof BreakException) return 'break';
      throw e;
    }
  }

  /** The expressions a statement evaluates directly — the places a user function
   *  call the debugger should step into can appear. */
  private statementExpressions(stmt: Statement): Expression[] {
    switch (stmt.type) {
      case 'Print':
        return stmt.expressions;
      case 'Assignment':
        // Value first, then the target (matching execute's evaluation order —
        // the target only holds expressions for member/index assignments).
        return [stmt.value, stmt.target as Expression];
      case 'ExpressionStatement':
        return [stmt.expression];
      case 'Switch':
        return [(stmt as any).discriminant];
      default:
        return [];
    }
  }

  /**
   * Evaluates an expression during debugging: first steps through any user
   * function calls inside it (caching their results so the final evaluation
   * doesn't re-run them), then evaluates the whole expression, pausing and
   * retrying when it needs console input. `announceCallSites` yields an extra
   * step at `stmt` before entering each call — control-flow statements that
   * already announced their own line pass false.
   */
  private *evaluateForDebug(
    expr: Expression | undefined,
    env: Environment,
    stmt: Statement,
    announceCallSites = true
  ): Generator<DebugStepEvent, any, void> {
    if (!expr) return null;
    const cache = new Map<string, any>();
    this.debugCallResults.push(cache);
    try {
      yield* this.resolveUserCalls(expr, env, stmt, cache, announceCallSites);
      return yield* this.evaluateWithInputRetry(expr, env, stmt);
    } finally {
      this.debugCallResults.pop();
    }
  }

  /** Evaluates during debugging, yielding an input-prompt step and retrying
   *  whenever the expression asks for console input that isn't queued yet. */
  private *evaluateWithInputRetry(
    expr: Expression,
    env: Environment,
    stmt: Statement
  ): Generator<DebugStepEvent, any, void> {
    while (true) {
      try {
        return this.evaluate(expr, env);
      } catch (e) {
        if (!(e instanceof InputPrompt)) throw e;
        yield this.debugEvent(stmt, { nodeType: 'InputPrompt', prompt: e.prompt });
      }
    }
  }

  /**
   * Walks an expression in evaluation order and steps through every user-written
   * function/method call in it, caching each call's result by node id so the
   * later "real" evaluation (which consults the cache via debugCallResults)
   * reuses the results instead of running the calls again.
   */
  private *resolveUserCalls(
    expr: any,
    env: Environment,
    stmt: Statement,
    cache: Map<string, any>,
    announceCallSites: boolean
  ): Generator<DebugStepEvent, void, void> {
    if (!expr || typeof expr !== 'object') return;

    switch (expr.type) {
      case 'CallExpression': {
        // Arguments evaluate first, so calls inside them are stepped first.
        for (const arg of expr.arguments ?? []) {
          yield* this.resolveUserCalls(arg, env, stmt, cache, announceCallSites);
        }
        const target = this.resolveUserCallable(expr, env);
        if (!target) return; // built-in or unresolvable — evaluate runs it normally
        if (announceCallSites) yield this.debugEvent(stmt);
        const args: any[] = [];
        for (const arg of expr.arguments ?? []) {
          args.push(yield* this.evaluateWithInputRetry(arg, env, stmt));
        }
        cache.set(expr.id, yield* this.stepIntoCall(target, args, env));
        return;
      }
      case 'ConditionalExpression': {
        // Mirror evaluate's laziness: only the taken branch runs.
        yield* this.resolveUserCalls(expr.test, env, stmt, cache, announceCallSites);
        const test = yield* this.evaluateWithInputRetry(expr.test, env, stmt);
        const branch = test ? expr.consequent : expr.alternate;
        yield* this.resolveUserCalls(branch, env, stmt, cache, announceCallSites);
        return;
      }
      case 'Assignment': // expression-position assignment (e.g. a for-update `x = f(y)`)
      case 'CompoundAssignment':
        yield* this.resolveUserCalls(expr.value ?? expr.right, env, stmt, cache, announceCallSites);
        return;
      case 'BinaryExpression': // `and`/`or` are eager in evaluate, so both sides always run
        yield* this.resolveUserCalls(expr.left, env, stmt, cache, announceCallSites);
        yield* this.resolveUserCalls(expr.right, env, stmt, cache, announceCallSites);
        return;
      case 'UnaryExpression':
        yield* this.resolveUserCalls(expr.argument, env, stmt, cache, announceCallSites);
        return;
      case 'IndexExpression':
        yield* this.resolveUserCalls(expr.object, env, stmt, cache, announceCallSites);
        yield* this.resolveUserCalls(expr.index, env, stmt, cache, announceCallSites);
        return;
      case 'MemberExpression':
        yield* this.resolveUserCalls(expr.object, env, stmt, cache, announceCallSites);
        return;
      case 'ArrayLiteral':
        for (const element of expr.elements ?? []) {
          yield* this.resolveUserCalls(element, env, stmt, cache, announceCallSites);
        }
        return;
      case 'NewExpression': // constructor bodies run without stepping, but their args may call
        for (const arg of expr.arguments ?? []) {
          yield* this.resolveUserCalls(arg, env, stmt, cache, announceCallSites);
        }
        return;
      default:
        return; // leaves (Literal, Identifier, ...) — nothing to step into
    }
  }

  /**
   * Resolves a CallExpression to a user-written function or method the debugger
   * can step into. Returns null for built-ins and for anything that can't be
   * identified without side effects — those calls run normally in `evaluate`.
   * Dispatch order deliberately mirrors evaluate's CallExpression handling.
   */
  private resolveUserCallable(expr: any, env: Environment): ResolvedCallable | null {
    const callee = expr.callee;

    if (callee?.type === 'Identifier') {
      if (BUILTIN_CALL_NAMES.has(callee.name)) return null;
      let target: any;
      try {
        target = env.get(callee.name);
      } catch {
        target = undefined;
      }
      if (target && target.type === 'FunctionDeclaration') {
        return { name: callee.name, decl: target as FunctionDeclaration };
      }
      if (NUMERIC_BUILTIN_NAMES.has(callee.name)) return null;
      // Bare call to a sibling method, e.g. a Main static method called from main().
      const instance = this.boundInstance(env);
      const method = instance?.klass.getMethod(callee.name);
      if (instance && method) return { name: callee.name, decl: method, thisInstance: instance };
      return null;
    }

    // obj.method(...) — only for side-effect-free receivers (a bare name or
    // this/self), since detecting the method requires evaluating the receiver.
    if (
      callee?.type === 'MemberExpression' &&
      (callee.object?.type === 'Identifier' || callee.object?.type === 'ThisExpression')
    ) {
      let receiver: any;
      try {
        receiver = this.evaluate(callee.object, env);
      } catch {
        return null; // e.g. `Math.floor(...)` — Math isn't a variable
      }
      if (!(receiver instanceof JavaInstance)) return null;
      const method = receiver.klass.getMethod(callee.property?.name);
      if (!method) return null;
      return { name: callee.property.name, decl: method, thisInstance: receiver };
    }

    return null;
  }

  /**
   * Steps through the body of a user-written function or method, giving it its
   * own stack frame, and returns the call's return value.
   */
  private *stepIntoCall(
    target: ResolvedCallable,
    args: any[],
    callerEnv: Environment
  ): Generator<DebugStepEvent, any, void> {
    const fnEnv = new Environment(callerEnv);
    if (target.thisInstance) {
      fnEnv.define('this', target.thisInstance);
      fnEnv.define('self', target.thisInstance);
    }
    this.bindParams(target.decl.params, args, fnEnv);
    this.debugCallStack.push({ name: target.name, env: fnEnv });
    try {
      yield* this.executeBlockGeneratorWithState(target.decl.body.body, fnEnv);
      return null;
    } catch (e) {
      if (e instanceof ReturnException) return e.value;
      throw e;
    } finally {
      this.debugCallStack.pop();
    }
  }

  private infiniteLoopError(loc: any): Error {
    const lineNum = this.getLineFromLocation(loc);
    return new Error(
      `runtime error occurred on line ${lineNum}:\nThis is probably an infinite loop.`
    );
  }

  /** True when the expression contains any call or instantiation. */
  private expressionContainsCall(expr: any): boolean {
    if (!expr || typeof expr !== 'object') return false;
    if (expr.type === 'CallExpression' || expr.type === 'NewExpression') return true;
    for (const key of Object.keys(expr)) {
      if (key === 'loc') continue;
      const child = expr[key];
      if (Array.isArray(child)) {
        if (child.some((c) => this.expressionContainsCall(c))) return true;
      } else if (this.expressionContainsCall(child)) {
        return true;
      }
    }
    return false;
  }

  private registerClass(classDecl: ClassDeclaration) {
    const superClass = classDecl.superClass
      ? this.classes.get(classDecl.superClass.name)
      : undefined;
    const javaClass = new JavaClass(classDecl.name, superClass);

    for (const member of classDecl.body) {
      if (member.type === 'MethodDeclaration') {
        javaClass.addMethod(member);
      } else if (member.type === 'Constructor') {
        javaClass.setConstructor(member);
      } else if (member.type === 'FieldDeclaration') {
        const isUnspecified =
          (member as any).declaredWithoutInitializer || member.initializer?.type === 'Placeholder';
        javaClass.fields.set(
          member.name,
          isUnspecified
            ? UNINITIALIZED
            : member.initializer
              ? this.evaluate(member.initializer, this.globalEnv)
              : null
        );
        javaClass.fieldTypes.set(member.name, member.fieldType);
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
        return targetVars.has(lvalueName(node) ?? '');
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
      } else if (
        node.type === 'While' ||
        node.type === 'For' ||
        node.type === 'DoWhile' ||
        node.type === 'RepeatUntil'
      ) {
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

    // Other types (custom classes, Object, ArrayList/List, boxed types)
    if (baseType && baseType[0] === baseType[0].toUpperCase()) {
      if (value === null) return null; // null assignable to any reference type
      if (baseType === 'Object') return null; // everything is an Object
      // Collections (ArrayList/List) hold array values.
      if (Array.isArray(value)) return null;
      if (value instanceof JavaInstance) {
        // Accept an exact match or any subclass (walk the superclass chain).
        let k: JavaClass | undefined = value.klass;
        while (k) {
          if (k.name === baseType) return null;
          k = k.superClass;
        }
        return `incompatible types: ${value.klass.name} cannot be converted to ${baseType}`;
      }
      // Primitives assigned to a boxed/reference type (Integer, Double, ...).
      return null;
    }

    return null; // Default compatible
  }

  executeBlock(statements: Statement[], env: Environment) {
    for (const stmt of statements) {
      this.execute(stmt, env);
    }
  }

  // Runs one loop-body iteration, translating break/continue signals into a
  // return code so each loop can react (continue → next iteration, break → stop).
  private runIteration(body: Statement[], env: Environment): 'normal' | 'continue' | 'break' {
    try {
      this.executeBlock(body, env);
      return 'normal';
    } catch (e) {
      if (e instanceof ContinueException) return 'continue';
      if (e instanceof BreakException) return 'break';
      throw e;
    }
  }

  // Binds call arguments to parameters (no default parameters in any dialect,
  // so the argument count must match exactly).
  bindParams(params: any[], args: any[], targetEnv: Environment) {
    if (args.length !== params.length) {
      throw new Error(`Expected ${params.length} arguments but got ${args.length}`);
    }
    params.forEach((param, i) => targetEnv.define(param.name, args[i]));
  }

  private instantiateClass(klass: JavaClass, args: any[], env: Environment): JavaInstance {
    const instance = new JavaInstance(klass);

    if (klass.ctorDecl) {
      const ctorEnv = new Environment(env);
      ctorEnv.define('this', instance);
      ctorEnv.define('self', instance);
      this.bindParams(klass.ctorDecl.params, args, ctorEnv);

      try {
        this.executeBlock(klass.ctorDecl.body.body, ctorEnv);
      } catch (e) {
        if (!(e instanceof ReturnException)) throw e;
      }
    }

    return instance;
  }

  /** Returns the bound `this`/`self` instance for the current scope, if any. */
  private boundInstance(env: Environment): JavaInstance | undefined {
    for (const key of ['this', 'self']) {
      try {
        const v = env.get(key);
        if (v instanceof JavaInstance) return v;
      } catch {
        /* not bound */
      }
    }
    return undefined;
  }

  /** True when `name` is a field declared on the instance's class hierarchy. */
  private instanceHasField(inst: JavaInstance, name: string): boolean {
    if (inst.fields.has(name)) return true;
    let klass: JavaClass | undefined = inst.klass;
    while (klass) {
      if (klass.fields.has(name)) return true;
      klass = klass.superClass;
    }
    return false;
  }

  /**
   * Assigns a bare (untyped, non-member) name. Praxis has no `this`, so inside a
   * method/constructor a name that is a field of the bound instance — and not a
   * local/parameter — writes that field; otherwise it is an ordinary variable.
   */
  private assignBareName(
    env: Environment,
    name: string,
    value: any,
    varType: string | undefined,
    origin: number | undefined
  ): void {
    if (!varType && !this.hasVariable(env, name)) {
      const inst = this.boundInstance(env);
      if (inst && this.instanceHasField(inst, name)) {
        inst.setField(name, value);
        return;
      }
    }
    env.define(name, value, varType, origin);
  }

  /** True when `name` resolves to a variable/parameter in the scope chain. */
  private hasVariable(env: Environment, name: string): boolean {
    try {
      env.get(name);
      return true;
    } catch {
      return false;
    }
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
          // A single-expression print carries its terminator in `separator`
          // (e.g. CSP DISPLAY appends a space). Suppress that space when the
          // value already ends in a newline, so `DISPLAY(x + "\n")` yields
          // exactly `x\n` (see faithful print-terminator semantics).
          let trailingText =
            typeof (stmt as any).separator === 'string' && vals.length === 1
              ? (stmt as any).separator
              : '';
          if (rendered.endsWith('\n')) trailingText = '';
          this.appendOutputText(rendered + trailingText, false);
        }
        break;
      case 'Assignment': {
        // Plain-variable name (undefined for member/index targets, which are
        // never declarations — so the varType guards below never see undefined).
        const varName = lvalueName(stmt);

        // Prefer explicit declaration type, otherwise use existing variable type when reassigning.
        const assignmentType =
          (stmt as any).varType || (varName ? env.getType(varName) : undefined);
        // A bare declaration (`int x;`) or a Praxis placeholder hole (`x <- /* ... */`)
        // has no real value yet — store the uninitialized sentinel instead of
        // evaluating the parser-synthesized default/placeholder.
        const isUnspecified =
          Boolean((stmt as any).declaredWithoutInitializer) || stmt.value.type === 'Placeholder';
        const value = isUnspecified
          ? UNINITIALIZED
          : this.evaluate(stmt.value, env, assignmentType);
        const declarationOrigin = stmt.loc?.start;

        // Typed assignments act as declarations and cannot redeclare in the same scope.
        if (
          (stmt as any).varType &&
          varName != null &&
          Object.prototype.hasOwnProperty.call(env.values, varName)
        ) {
          const existingOrigin = env.declarationOrigins[varName];
          if (existingOrigin !== declarationOrigin) {
            const line = this.getLineFromLocation(stmt.loc);
            throw new Error(
              `runtime error occurred on line ${line}: variable ${varName} has already been declared in this scope.`
            );
          }
        }

        // Type checking for typed assignments (skipped for a bare declaration —
        // there's no real value yet to check).
        if ((stmt as any).varType && !isUnspecified) {
          const typeError = this.checkTypeCompatibility(value, (stmt as any).varType);
          if (typeError) {
            const line = this.getLineFromLocation(stmt.loc);
            throw new Error(`runtime error occurred on line ${line}:\n${typeError}`);
          }
        }

        const target = stmt.target;
        if (target.type === 'MemberExpression') {
          const obj = this.evaluate((target as any).object, env);
          const fieldName = (target as any).property.name;
          if (obj instanceof JavaInstance) {
            obj.setField(fieldName, value);
          } else {
            obj[fieldName] = value;
          }
        } else if (target.type === 'IndexExpression') {
          const obj = this.evaluate((target as any).object, env);
          const idx = this.evaluate((target as any).index, env);
          obj[idx] = value;
        } else if (varName) {
          // Identifier target — define the variable with type info. May target an
          // instance field (Praxis) via assignBareName.
          // Own-property check (not the full scope chain) so shadowing in a nested
          // scope reports as a new declaration, matching how a memory diagram draws it.
          const isNewInScope = !Object.prototype.hasOwnProperty.call(env.values, varName);
          this.assignBareName(env, varName, value, (stmt as any).varType, declarationOrigin);
          // Report to the attached memory diagram, if any (see setMemdia).
          if ((stmt as any).varType || isNewInScope) {
            this.memdia?.declaration(varName, value, (stmt as any).varType);
          } else {
            this.memdia?.assignment(varName, value, (stmt as any).varType);
          }
        }
        break;
      }
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
            const signal = this.runIteration(stmt.body.body, env);
            if (signal === 'break') {
              break;
            }

            // Run the infinite-loop heuristic only when the body ran to
            // completion (a continue/break iteration is inconclusive).
            if (signal === 'normal') {
              const conditionStillTrue = this.evaluate(stmt.condition, env);
              const varsChanged = this.hasVariablesChanged(conditionVars, oldValues, env);
              if (conditionStillTrue && !varsChanged && conditionVars.size > 0) {
                if (!this.blockModifiesVariables(stmt.body.body, conditionVars, env)) {
                  const lineNum = this.getLineFromLocation(stmt.loc);
                  throw new Error(
                    `runtime error occurred on line ${lineNum}:\nThis is probably an infinite loop.`
                  );
                }
              }
            }
          } else {
            if (this.runIteration(stmt.body.body, env) === 'break') {
              break;
            }
          }
        }
        break;
      }
      case 'For': {
        // C-style three-clause loop; any clause may be absent (`for (;;)`).
        if (stmt.init) this.execute(stmt.init, env);
        let iterationCount = 0;
        const MAX_ITERATIONS = 10000;
        while (stmt.condition ? this.evaluate(stmt.condition, env) : true) {
          iterationCount++;
          if (iterationCount > MAX_ITERATIONS) {
            const lineNum = this.getLineFromLocation(stmt.loc);
            throw new Error(
              `runtime error occurred on line ${lineNum}:\nThis is probably an infinite loop.`
            );
          }
          const signal = this.runIteration(stmt.body.body, env);
          if (signal === 'break') {
            break;
          }
          // `continue` still runs the update clause (C semantics).
          if (stmt.update) this.execute(stmt.update, env);
        }
        break;
      }
      case 'ForEach': {
        const iterable = this.evaluate(stmt.iterable, env);
        if (!Array.isArray(iterable) && typeof iterable !== 'string')
          throw new Error('For-each loop requires array or string');
        for (const item of iterable) {
          env.define(stmt.variable, item);
          if (this.runIteration(stmt.body.body, env) === 'break') {
            break;
          }
        }
        break;
      }
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
          if (this.runIteration(stmt.body.body, env) === 'break') break;
        } while (this.evaluate(stmt.condition, env));
        break;
      }
      case 'RepeatUntil': {
        // Post-condition loop: body runs first, stops when condition is TRUE.
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
          if (this.runIteration(stmt.body.body, env) === 'break') break;
        } while (!this.evaluate(stmt.condition, env));
        break;
      }
      case 'FunctionDeclaration':
        env.define(stmt.name, stmt);
        break;
      case 'Return':
        const retVal = stmt.value ? this.evaluate(stmt.value, env) : null;
        // Every explicit return, in any language, passes through here — report it
        // to the memory diagram (see setMemdia) before unwinding via the exception.
        if (this.memdiaCallNames.length > 0)
          this.memdia?.functionReturn(this.memdiaCallNames.pop()!, retVal);
        throw new ReturnException(retVal);
      case 'ExpressionStatement':
        // A bare `/* ... */` placeholder standing alone as a statement (e.g. a
        // missing loop body line) represents a whole missing statement, not a
        // missing value — a no-op, same as BlankLine. Using a placeholder as
        // part of a real expression (an operand, a condition, an assigned
        // value) still reaches evaluate()'s Placeholder case and errors.
        if (stmt.expression.type !== 'Placeholder') {
          this.evaluate(stmt.expression, env);
        }
        break;
      case 'Break':
        throw new BreakException();
      case 'Continue':
        throw new ContinueException();
      case 'BlankLine':
        break; // preserved source blank line — no-op at runtime

      case 'Switch': {
        const disc = this.evaluate((stmt as any).discriminant, env);
        const cases = (stmt as any).cases as any[];
        try {
          // Find the first matching case, then fall through executing every
          // case body from there until a `break` (C-style semantics).
          let matched = false;
          for (const c of cases) {
            if (!matched && c.test !== undefined && this.evaluate(c.test, env) === disc) {
              matched = true;
            }
            if (matched) this.executeBlock(c.consequent, env);
          }
          // No case matched: start at `default` (if any) and fall through.
          if (!matched) {
            let inDefault = false;
            for (const c of cases) {
              if (c.test === undefined) inDefault = true;
              if (inDefault) this.executeBlock(c.consequent, env);
            }
          }
        } catch (e) {
          if (!(e instanceof BreakException)) throw e;
        }
        break;
      }
      case 'Try': {
        const handlers = (stmt as any).handlers as any[] | undefined;
        const finallyBlock = (stmt as any).finallyBlock;
        try {
          try {
            this.executeBlock(stmt.body.body, env);
          } catch (e) {
            // Never intercept control-flow / input signals with a catch clause.
            if (
              e instanceof ReturnException ||
              e instanceof BreakException ||
              e instanceof ContinueException ||
              e instanceof InputPrompt
            ) {
              throw e;
            }
            const handler = handlers && handlers.length > 0 ? handlers[0] : undefined;
            if (!handler) throw e;
            const handlerEnv = new Environment(env);
            if (handler.varName) {
              handlerEnv.define(handler.varName, (e as any).message ?? String(e));
            }
            this.executeBlock(handler.body.body, handlerEnv);
          }
        } finally {
          if (finallyBlock) this.executeBlock(finallyBlock.body, env);
        }
        break;
      }
    }
  }

  evaluate(expr: Expression, env: Environment, expectedType?: string): any {
    // Assignment used in expression position (e.g. a C-style `for` update
    // `j = j + 1`, or `x = y = 0`). Mutates the target and yields the value.
    // Handled before the switch because Assignment is a Statement, not an
    // Expression, in the AST type union.
    if ((expr as any).type === 'Assignment') {
      const a = expr as any;
      const value = this.evaluate(a.value, env);
      const target = a.target;
      if (target.type === 'MemberExpression') {
        const obj = this.evaluate(target.object, env);
        const fieldName = target.property.name;
        if (obj instanceof JavaInstance) obj.setField(fieldName, value);
        else obj[fieldName] = value;
      } else if (target.type === 'IndexExpression') {
        const obj = this.evaluate(target.object, env);
        const idx = this.evaluate(target.index, env);
        obj[idx] = value;
      } else {
        // Mirror the statement-position Identifier branch: define-if-new (and
        // instance-field aware) rather than plain `env.assign`, so a chained
        // `x = y = z = v` can introduce brand-new inner targets (y, z) instead
        // of throwing "Undefined variable".
        this.assignBareName(env, target.name, value, undefined, a.loc?.start);
      }
      return value;
    }
    switch (expr.type) {
      case 'Placeholder':
        // A `/* ... */` hole has no value. Assigning it to a variable is handled
        // in execute()'s Assignment case (stores UNINITIALIZED without evaluating
        // this node); any other direct use (a condition, an operand, a print
        // argument, ...) reaches here and is a runtime error, same as reading an
        // uninitialized variable.
        throw new UninitializedAccessError(
          `Uninitialized value: placeholder '/* ${(expr as any).text} */' was never given a value`
        );
      case 'Literal':
        return expr.value;
      case 'ArrayLiteral':
        return expr.elements.map((e) => this.evaluate(e, env));
      case 'ArrayCreation': {
        // `new int[n]` — an array of n type-appropriate default values.
        const size = Math.max(0, Math.floor(Number(this.evaluate(expr.size, env))));
        const base = expr.elementType.replace(/\[\]/g, '');
        let def: any = null;
        if (['int', 'byte', 'short', 'long', 'float', 'double'].includes(base)) def = 0;
        else if (base === 'boolean') def = false;
        else if (base === 'char') def = String.fromCharCode(0);
        return new Array(size).fill(def);
      }
      case 'Identifier': {
        try {
          const value = env.get(expr.name);
          if (value === UNINITIALIZED) {
            throw new UninitializedAccessError(`Uninitialized variable '${expr.name}'`);
          }
          return value;
        } catch (e) {
          if (e instanceof UninitializedAccessError) throw e;
          // Bare field access inside a method: implicitly means this.fieldName
          let instance: any;
          try {
            instance = env.get('this');
          } catch {
            /* no this */
          }
          if (instance === undefined)
            try {
              instance = env.get('self');
            } catch {
              /* no self */
            }
          if (instance instanceof JavaInstance) {
            try {
              // getField() itself throws UninitializedAccessError for a field
              // that exists but was never assigned — let that propagate; only
              // "field doesn't exist at all" should fall through below.
              return instance.getField(expr.name);
            } catch (fieldErr) {
              if (fieldErr instanceof UninitializedAccessError) throw fieldErr;
              /* fall through */
            }
          }
          // Re-throw original "Undefined variable" error
          return env.get(expr.name);
        }
      }
      case 'ThisExpression':
        try {
          return env.get('this');
        } catch {
          return env.get('self');
        }
      case 'UpdateExpression': {
        const argName = (expr.argument as any).name;
        const oldVal = env.get(argName);
        if (oldVal === UNINITIALIZED) {
          throw new UninitializedAccessError(`Uninitialized variable '${argName}'`);
        }
        const newVal = expr.operator === '++' ? oldVal + 1 : oldVal - 1;
        env.assign(argName, newVal);
        return expr.prefix ? newVal : oldVal;
      }
      case 'CompoundAssignment': {
        const compName = (expr as any).name;
        const compLeft = env.get(compName);
        if (compLeft === UNINITIALIZED) {
          throw new UninitializedAccessError(`Uninitialized variable '${compName}'`);
        }
        const compRight = this.evaluate((expr as any).right, env);
        let compResult: any;
        switch ((expr as any).operator) {
          case '+':
            compResult = compLeft + compRight;
            break;
          case '-':
            compResult = compLeft - compRight;
            break;
          case '*':
            compResult = compLeft * compRight;
            break;
          case '/':
            // Match the `/` operator: an integer-typed target uses integer division.
            compResult =
              this.isIntegerType(env.getType(compName)) && compRight !== 0
                ? Math.trunc(compLeft / compRight)
                : compLeft / compRight;
            break;
          case '%':
            compResult = compLeft % compRight;
            break;
          default:
            compResult = compLeft + compRight;
        }
        env.assign(compName, compResult);
        return compResult;
      }
      case 'ConditionalExpression':
        return this.evaluate((expr as any).test, env)
          ? this.evaluate((expr as any).consequent, env)
          : this.evaluate((expr as any).alternate, env);
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
          case '+': {
            // A char is a plain JS string internally, but Java promotes it to its
            // character code for arithmetic ('A' + 1 -> 66), not concatenation —
            // concatenation only happens when the *other* operand is a real String.
            const leftIsChar = leftType.replace(/\[\]/g, '') === 'char';
            const rightIsChar = rightType.replace(/\[\]/g, '') === 'char';
            const leftIsRealString = typeof l === 'string' && !leftIsChar;
            const rightIsRealString = typeof r === 'string' && !rightIsChar;
            // String concatenation uses the interpreter's own formatting so it
            // matches print output (null -> None, lists -> {..}, true/false).
            if (leftIsRealString || rightIsRealString) {
              return this.stringify(l) + this.stringify(r);
            }
            const lNum = leftIsChar ? l.charCodeAt(0) : l;
            const rNum = rightIsChar ? r.charCodeAt(0) : r;
            return lNum + rNum;
          }
          case '-':
            return l - r;
          case '*':
            // List repetition: `[x] * n` or `n * [x]` (Python/JS idiom).
            if (Array.isArray(l) && typeof r === 'number') {
              const out: any[] = [];
              for (let k = 0; k < r; k++) out.push(...l);
              return out;
            }
            if (Array.isArray(r) && typeof l === 'number') {
              const out: any[] = [];
              for (let k = 0; k < l; k++) out.push(...r);
              return out;
            }
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
          case '//':
            return Math.floor(l / r);
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
          case 'in':
          case 'not in': {
            // Membership is string-only (`x in str`). List membership is
            // deliberately unsupported (no clean mapping to CSP/Praxis).
            if (typeof r !== 'string') {
              throw new Error("membership 'in' is only supported for strings, not lists");
            }
            const contained = r.includes(String(l));
            return expr.operator === 'in' ? contained : !contained;
          }
          default:
            throw new Error(`Unknown operator ${expr.operator}`);
        }
        break;
      case 'NewExpression': {
        // Java ArrayList: `new ArrayList<>()` / `new ArrayList<>(Arrays.asList(...))`.
        // Lists are represented as plain arrays.
        if (expr.className === 'ArrayList' || expr.className === 'List') {
          if (expr.arguments.length === 0) return [];
          const init = this.evaluate(expr.arguments[0], env);
          return Array.isArray(init) ? [...init] : [];
        }
        // JS `new Array(n)` -> an n-length array; `new Array(a, b, ...)` -> a list.
        if (expr.className === 'Array') {
          const args = expr.arguments.map((a) => this.evaluate(a, env));
          if (args.length === 1 && typeof args[0] === 'number') return new Array(args[0]);
          return args;
        }
        // `new Scanner(System.in)` — bound to the shared input queue. Args are not
        // evaluated (System.in has no interpreter value).
        if (expr.className === 'Scanner') {
          return new JavaScanner();
        }
        const klass = env.get(expr.className);
        if (!klass || !(klass instanceof JavaClass)) {
          throw new Error(`Undefined class '${expr.className}'`);
        }
        const args = expr.arguments.map((a) => this.evaluate(a, env));
        return this.instantiateClass(klass, args, env);
      }

      case 'IndexExpression': {
        const indexObj = this.evaluate(expr.object, env);
        const idxValue = this.evaluate(expr.index, env);
        return indexObj[idxValue];
      }

      case 'MemberExpression':
        // Java constants: Integer.MIN_VALUE / Integer.MAX_VALUE.
        if ((expr.object as any).type === 'Identifier' && (expr.object as any).name === 'Integer') {
          if (expr.property.name === 'MIN_VALUE') return -2147483648;
          if (expr.property.name === 'MAX_VALUE') return 2147483647;
        }
        const obj = this.evaluate(expr.object, env);
        if (obj instanceof JavaInstance) {
          return obj.getField(expr.property.name);
        }
        if ((typeof obj === 'string' || Array.isArray(obj)) && expr.property.name === 'length') {
          return obj.length;
        }
        throw new Error(`Cannot access member on non-object`);

      case 'CallExpression':
        // Debug stepping may already have run this call (stepping through its
        // body) and cached the result — reuse it instead of calling twice.
        const steppedCalls = this.debugCallResults[this.debugCallResults.length - 1];
        if (steppedCalls?.has(expr.id)) {
          return steppedCalls.get(expr.id);
        }

        if ((expr.callee as any).type === 'MemberExpression') {
          const memberExpr = expr.callee as any;

          // Math.<fn>(args) — standard-JS math (also usable from any language).
          if (memberExpr.object?.type === 'Identifier' && memberExpr.object.name === 'Math') {
            const mathArgs = expr.arguments.map((a) => Number(this.evaluate(a, env)));
            const fn = memberExpr.property.name;
            const mathFns: Record<string, (...n: number[]) => number> = {
              trunc: Math.trunc,
              floor: Math.floor,
              ceil: Math.ceil,
              round: Math.round,
              abs: Math.abs,
              sqrt: Math.sqrt,
              pow: Math.pow,
              log: Math.log,
              max: Math.max,
              min: Math.min,
              // Uses the seeded PRNG so randomSeed() makes Math.random() deterministic.
              random: () => this.getRandomValue(),
            };
            if (mathFns[fn]) return mathFns[fn](...mathArgs);
            throw new Error(`Unknown Math function '${fn}'`);
          }

          // Arrays.asList(...) / Arrays.copyOfRange(arr, from, to) — Java arrays helper.
          if (memberExpr.object?.type === 'Identifier' && memberExpr.object.name === 'Arrays') {
            const a = expr.arguments.map((x) => this.evaluate(x, env));
            if (memberExpr.property.name === 'asList') return [...a];
            if (memberExpr.property.name === 'copyOfRange') {
              return (a[0] as any[]).slice(Number(a[1]), Number(a[2]));
            }
            throw new Error(`Unknown Arrays function '${memberExpr.property.name}'`);
          }

          // Integer.parseInt(s) / Double.parseDouble(s).
          if (
            memberExpr.object?.type === 'Identifier' &&
            (memberExpr.object.name === 'Integer' || memberExpr.object.name === 'Double')
          ) {
            const val = this.evaluate(expr.arguments[0], env);
            if (memberExpr.property.name === 'parseInt') return parseInt(String(val), 10);
            if (memberExpr.property.name === 'parseDouble') return parseFloat(String(val));
          }

          // String.valueOf(x) — string conversion.
          if (
            memberExpr.object?.type === 'Identifier' &&
            memberExpr.object.name === 'String' &&
            memberExpr.property.name === 'valueOf'
          ) {
            return this.stringify(this.evaluate(expr.arguments[0], env));
          }

          // process.stdout.write(x) — print without a trailing newline.
          if (
            memberExpr.property.name === 'write' &&
            memberExpr.object?.type === 'MemberExpression' &&
            memberExpr.object.property?.name === 'stdout' &&
            memberExpr.object.object?.name === 'process'
          ) {
            const text = this.stringify(this.evaluate(expr.arguments[0], env), false);
            this.appendOutputText(text, false);
            return null;
          }

          // Python-style `super().__init__(args)` / `super().method(args)`:
          // the object is a `super()` call. Run it against the parent class.
          if (
            memberExpr.object?.type === 'CallExpression' &&
            (memberExpr.object.callee as any)?.name === 'super'
          ) {
            let self: any;
            try {
              self = env.get('this');
            } catch {
              try {
                self = env.get('self');
              } catch {
                /* none */
              }
            }
            const superArgs = expr.arguments.map((a) => this.evaluate(a, env));
            if (self instanceof JavaInstance && self.klass.superClass) {
              const superClass = self.klass.superClass;
              if (memberExpr.property.name === '__init__' && superClass.ctorDecl) {
                const superEnv = new Environment(env);
                superEnv.define('this', self);
                superEnv.define('self', self);
                superClass.ctorDecl.params.forEach((param: any, i: number) => {
                  superEnv.define(param.name, superArgs[i] ?? null);
                });
                try {
                  this.executeBlock(superClass.ctorDecl.body.body, superEnv);
                } catch (e) {
                  if (!(e instanceof ReturnException)) throw e;
                }
                return null;
              }
              const method = superClass.getMethod(memberExpr.property.name);
              if (method) return self.callMethod(memberExpr.property.name, superArgs, this, env);
            }
            return null;
          }

          const obj = this.evaluate(memberExpr.object, env);
          const methodName = memberExpr.property.name;
          const args = expr.arguments.map((a) => this.evaluate(a, env));

          if (obj instanceof JavaInstance) {
            return obj.callMethod(methodName, args, this, env);
          }

          if (obj instanceof JavaScanner) {
            // Refill the token buffer from input lines when empty (skipping blank
            // lines); a missing input propagates InputPrompt like input() does.
            const fillTokens = () => {
              while (obj.tokenBuffer.length === 0) {
                obj.tokenBuffer = this.readInputLine('')
                  .split(/\s+/)
                  .filter((t) => t.length > 0);
              }
            };
            switch (methodName) {
              case 'next':
                fillTokens();
                return obj.tokenBuffer.shift();
              case 'nextInt':
                fillTokens();
                return parseInt(obj.tokenBuffer.shift()!, 10);
              case 'nextDouble':
                fillTokens();
                return parseFloat(obj.tokenBuffer.shift()!);
              case 'nextBoolean':
                fillTokens();
                return obj.tokenBuffer.shift()!.toLowerCase() === 'true';
              case 'nextLine':
                // Rest of the current line if tokens are buffered, else a fresh line.
                if (obj.tokenBuffer.length > 0) {
                  const rest = obj.tokenBuffer.join(' ');
                  obj.tokenBuffer = [];
                  return rest;
                }
                return this.readInputLine('');
              case 'hasNext':
                return obj.tokenBuffer.length > 0 || this.hasInput();
              case 'close':
                return null;
              default:
                throw new Error(`Unknown Scanner method '${methodName}'`);
            }
          }

          if (obj instanceof JavaRandom) {
            switch (methodName) {
              case 'nextInt':
                // nextInt(n) -> integer in [0, n); nextInt() -> any non-negative int.
                if (args.length >= 1) return Math.floor(obj.next() * Number(args[0]));
                return Math.floor(obj.next() * 0x100000000);
              case 'nextDouble':
                return obj.next();
              case 'nextBoolean':
                return obj.next() < 0.5;
              case 'setSeed':
                obj.rng = this.createSeededRandom(this.normalizeSeed(args[0] ?? 0));
                return null;
              default:
                throw new Error(`Unknown Random method '${methodName}'`);
            }
          }

          if (typeof obj === 'string') {
            switch (methodName) {
              case 'substring':
                if (args.length >= 2) return obj.substring(Number(args[0]), Number(args[1]));
                if (args.length === 1) return obj.substring(Number(args[0]));
                return obj;
              case 'toLowerCase':
              case 'lower': // Python spelling
                return obj.toLowerCase();
              case 'toUpperCase':
              case 'upper': // Python spelling
                return obj.toUpperCase();
              case 'charAt':
                return obj.charAt(Number(args[0] ?? 0));
              case 'length':
                return obj.length;
              // AP CS A String methods
              case 'indexOf':
              case 'find': // Python spelling
                return obj.indexOf(String(args[0]));
              case 'replace': // replaces ALL occurrences (Python/Java semantics)
              case 'replaceAll': // JS spelling (emitted by the JS emitter)
                return obj.split(String(args[0])).join(String(args[1]));
              case 'contains':
              case 'includes': // JS spelling (emitted for `x in s` membership)
                return obj.includes(String(args[0]));
              case 'equals':
                return obj === args[0];
              case 'compareTo': {
                const other = String(args[0]);
                return obj < other ? -1 : obj > other ? 1 : 0;
              }
              case 'split':
                return obj.split(String(args[0]));
            }
          }

          if (Array.isArray(obj)) {
            switch (methodName) {
              case 'append':
              case 'push':
                obj.push(args[0]);
                return null;
              case 'fill':
                obj.fill(args[0]);
                return obj;
              case 'splice': {
                const start = Number(args[0] ?? 0);
                const deleteCount = args.length >= 2 ? Number(args[1]) : obj.length - start;
                const inserted = args.slice(2);
                return obj.splice(start, deleteCount, ...inserted);
              }
              case 'slice': {
                const s = args.length >= 1 ? Number(args[0]) : undefined;
                const e = args.length >= 2 ? Number(args[1]) : undefined;
                return obj.slice(s, e);
              }
              case 'indexOf':
                return obj.indexOf(args[0]);
              case 'insert': {
                const idx = Number(args[0] ?? 0);
                const normalized = Number.isFinite(idx)
                  ? idx < 0
                    ? Math.max(0, obj.length + idx)
                    : idx
                  : obj.length;
                obj.splice(normalized, 0, args[1]);
                return null;
              }
              case 'extend': {
                const iterable = args[0];
                if (Array.isArray(iterable)) obj.push(...iterable);
                else if (typeof iterable === 'string') obj.push(...iterable.split(''));
                else if (iterable != null) obj.push(iterable);
                return null;
              }
              case 'pop': {
                if (args.length === 0) return obj.pop();
                const idx = Number(args[0]);
                const normalized = idx < 0 ? obj.length + idx : idx;
                if (normalized < 0 || normalized >= obj.length) {
                  throw new Error('pop index out of range');
                }
                return obj.splice(normalized, 1)[0];
              }
              case 'remove': {
                // Java/AP ArrayList.remove(int index): remove by index.
                const i = Number(args[0]);
                const normalized = i < 0 ? obj.length + i : i;
                if (normalized < 0 || normalized >= obj.length) {
                  throw new Error('remove index out of range');
                }
                return obj.splice(normalized, 1)[0];
              }
              // Java/AP ArrayList methods (lists are represented as arrays).
              case 'add': {
                if (args.length >= 2) {
                  obj.splice(Number(args[0]), 0, args[1]); // add(index, obj)
                  return true;
                }
                obj.push(args[0]); // add(obj)
                return true;
              }
              case 'get':
                return obj[Number(args[0])];
              case 'set': {
                const i = Number(args[0]);
                const old = obj[i];
                obj[i] = args[1];
                return old;
              }
              case 'size':
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

        // `new Scanner(System.in)` is encoded as a bare call to `Scanner`; bind it
        // to the input queue without evaluating its arg (System.in has no value).
        if (calleeName === 'Scanner') {
          return new JavaScanner();
        }

        // `new Random()` is encoded as a bare call to `Random` — an OOP Random
        // instance whose methods (nextInt/nextDouble/nextBoolean/setSeed) are
        // dispatched in the member-call handling above.
        if (calleeName === 'Random') {
          return new JavaRandom();
        }

        // super(args) — run the parent class constructor on the current instance
        if (calleeName === 'super') {
          let instance: any;
          try {
            instance = env.get('this');
          } catch {
            /* no this */
          }
          if (instance === undefined)
            try {
              instance = env.get('self');
            } catch {
              /* no self */
            }
          if (instance instanceof JavaInstance && instance.klass.superClass) {
            const superClass = instance.klass.superClass;
            if (superClass.ctorDecl) {
              const superArgs = expr.arguments.map((a) => this.evaluate(a, env));
              const superEnv = new Environment(env);
              superEnv.define('this', instance);
              superEnv.define('self', instance);
              superClass.ctorDecl.params.forEach((param, i) => {
                superEnv.define(param.name, superArgs[i] ?? null);
              });
              try {
                this.executeBlock(superClass.ctorDecl.body.body, superEnv);
              } catch (e) {
                if (!(e instanceof ReturnException)) throw e;
              }
            }
          }
          return null;
        }

        // Handle input() function - get prompt from arguments (CSP style)
        if (calleeName === 'input' || calleeName === 'INPUT') {
          const promptStr =
            expr.arguments.length > 0 ? this.stringify(this.evaluate(expr.arguments[0], env)) : '';
          return this.readInputLine(promptStr);
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

        // Standard JavaScript conversions
        if (calleeName === 'parseInt') {
          return parseInt(String(this.evaluate(expr.arguments[0], env)), 10);
        }
        if (calleeName === 'parseFloat') {
          return parseFloat(String(this.evaluate(expr.arguments[0], env)));
        }
        if (calleeName === 'Number') {
          return Number(this.evaluate(expr.arguments[0], env));
        }
        if (calleeName === 'Boolean') {
          return Boolean(this.evaluate(expr.arguments[0], env));
        }

        // Random functions
        if (calleeName === 'random' || calleeName === 'RANDOM') {
          // CSP `RANDOM(a, b)`: inclusive random integer in [a, b]. The 0-arg
          // form is a float in [0, 1) (Java Math.random / Praxis random()).
          if (expr.arguments.length === 2) {
            const a = Math.trunc(Number(this.evaluate(expr.arguments[0], env)));
            const b = Math.trunc(Number(this.evaluate(expr.arguments[1], env)));
            const lo = Math.min(a, b);
            const hi = Math.max(a, b);
            return lo + Math.floor(this.getRandomValue() * (hi - lo + 1));
          }
          return this.getRandomValue();
        }
        if (calleeName === 'randomInt' || calleeName === 'RANDOMINT') {
          const max = this.evaluate(expr.arguments[0], env);
          return Math.floor(this.getRandomValue() * max);
        }
        // `setSeed` is the Java-spec bare spelling; `randomSeed` is Praxis/CSP.
        if (
          calleeName === 'randomSeed' ||
          calleeName === 'RANDOMSEED' ||
          calleeName === 'setSeed'
        ) {
          const seedValue = expr.arguments.length > 0 ? this.evaluate(expr.arguments[0], env) : 0;
          this.seededRandom = this.createSeededRandom(this.normalizeSeed(seedValue));
          return null;
        }

        // Java `new ArrayList<>(...)` parses as a call to `ArrayList` — a list
        // is a plain array (optionally seeded from an Arrays.asList argument).
        if (calleeName === 'ArrayList' || calleeName === 'List') {
          if (expr.arguments.length === 0) return [];
          const init = this.evaluate(expr.arguments[0], env);
          return Array.isArray(init) ? [...init] : [];
        }
        // JS `Array(n)` -> n-length array; `Array(a, b, ...)` -> a list.
        if (calleeName === 'Array') {
          const args = expr.arguments.map((a) => this.evaluate(a, env));
          if (args.length === 1 && typeof args[0] === 'number') return new Array(args[0]);
          return args;
        }

        let callee: any;
        try {
          callee = env.get(calleeName);
        } catch {
          callee = undefined; // fall through to sibling-method / undefined handling
        }

        // Class constructor call (e.g., Meow(10) in translated Python)
        if (callee instanceof JavaClass) {
          const args = expr.arguments.map((a) => this.evaluate(a, env));
          return this.instantiateClass(callee, args, env);
        }

        if (callee && callee.type === 'FunctionDeclaration') {
          const func = callee as FunctionDeclaration;
          const args = expr.arguments.map((a) => this.evaluate(a, env));
          const fnEnv = new Environment(env);
          this.bindParams(func.params, args, fnEnv);
          // Report the call to the attached memory diagram, if any (see setMemdia),
          // and remember its name so the matching functionReturn can be labeled.
          this.memdia?.functionCall(
            calleeName,
            func.params.map((p, i) => ({ name: p.name, value: args[i] }))
          );
          this.memdiaCallNames.push(calleeName);
          try {
            this.executeBlock(func.body.body, fnEnv);
          } catch (e) {
            if (e instanceof ReturnException) return e.value;
            throw e;
          }
          // No explicit `return` ran (case 'Return' never fired for this call), so
          // report the implicit return here instead — keeps every call balanced.
          if (this.memdiaCallNames.length > 0)
            this.memdia?.functionReturn(this.memdiaCallNames.pop()!, null);
          return null;
        }

        // Numeric built-ins (Java Math methods, also callable bare in pseudocode).
        // Resolved AFTER user functions above so a user-defined `min`/`max`/etc.
        // takes precedence over the built-in.
        switch (calleeName) {
          case 'min': {
            const nums = expr.arguments.map((a) => Number(this.evaluate(a, env)));
            return Math.min(...nums);
          }
          case 'max': {
            const nums = expr.arguments.map((a) => Number(this.evaluate(a, env)));
            return Math.max(...nums);
          }
          case 'abs':
            return Math.abs(Number(this.evaluate(expr.arguments[0], env)));
          case 'sqrt':
            return Math.sqrt(Number(this.evaluate(expr.arguments[0], env)));
          case 'log':
            return Math.log(Number(this.evaluate(expr.arguments[0], env)));
        }

        // Bare call to a sibling method: e.g. a free function translated to a
        // Main static method and called unqualified from within main().
        let selfInstance: any;
        try {
          selfInstance = env.get('this');
        } catch {
          try {
            selfInstance = env.get('self');
          } catch {
            /* none */
          }
        }
        if (selfInstance instanceof JavaInstance && selfInstance.klass.getMethod(calleeName)) {
          const args = expr.arguments.map((a) => this.evaluate(a, env));
          return selfInstance.callMethod(calleeName, args, this, env);
        }

        throw new Error(`Undefined function ${calleeName}`);
    }
  }

  private stringify(val: any, inArray: boolean = false, type?: string): string {
    if (val === null) return 'None';
    if (val === true) return 'true';
    if (val === false) return 'false';
    if (val instanceof JavaInstance) return `${val.klass.name} instance`;

    // Integer-valued numbers print without a decimal, regardless of declared
    // type, so a value formats the same whether a source calls it int or double
    // (keeps cross-language output parity, e.g. untyped `6` vs Java `double` 6).

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

    // A value whose declared type is float/double prints with a decimal point,
    // matching Java/Praxis semantics: `float y = 1` prints `1.0`, not `1`.
    if (typeof val === 'number' && Number.isInteger(val) && this.isFloatType(type)) {
      return `${val}.0`;
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
