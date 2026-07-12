/**
 * Tests for the JavaScript language module: lexer, parser, emitter,
 * and round-trip translation to/from all other supported languages.
 */

import { describe, it, expect } from 'vitest';
import { JavaScriptLexer } from '../src/language/javascript/lexer';
import { JavaScriptParser } from '../src/language/javascript/parser';
import { JavaScriptEmitter } from '../src/language/javascript/emitter';
import { Translator } from '../src/language/translator';
import { SymbolTable } from '../src/language/visitor';
import { JavaLexer } from '../src/language/java/lexer';
import { JavaParser } from '../src/language/java/parser';
import { Lexer as PythonLexer } from '../src/language/python/lexer';
import { Parser as PythonParser } from '../src/language/python/parser';
import { CSPLexer } from '../src/language/csp/lexer';
import { CSPParser } from '../src/language/csp/parser';
import { PraxisLexer } from '../src/language/praxis/lexer';
import { PraxisParser } from '../src/language/praxis/parser';
import { Interpreter } from '../src/language/interpreter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsLex(src: string) {
  return new JavaScriptLexer(src).tokenize();
}

function jsParse(src: string) {
  const tokens = jsLex(src);
  return new JavaScriptParser(tokens).parse();
}

function jsEmit(src: string): string {
  const ast = jsParse(src);
  const ctx = {
    symbolTable: new SymbolTable(),
    functionReturnTypes: new Map(),
    functionParamTypes: new Map(),
  };
  const emitter = new JavaScriptEmitter(ctx);
  emitter.visitProgram(ast);
  return emitter.getGeneratedCode();
}

function translateToJS(ast: any): string {
  return new Translator().translate(ast, 'javascript');
}

function translateFromJS(src: string, target: 'python' | 'java' | 'csp' | 'praxis'): string {
  return new Translator().translate(jsParse(src), target);
}

// ─── Lexer ────────────────────────────────────────────────────────────────────

describe('JavaScript Lexer', () => {
  describe('Basic tokens', () => {
    it('tokenises integer literals', () => {
      const toks = jsLex('42');
      expect(toks).toContainEqual(expect.objectContaining({ type: 'NUMBER', value: '42' }));
    });

    it('tokenises float literals', () => {
      const toks = jsLex('3.14');
      expect(toks).toContainEqual(expect.objectContaining({ type: 'NUMBER', value: '3.14' }));
    });

    it('tokenises double-quoted strings', () => {
      const toks = jsLex('"hello"');
      expect(toks).toContainEqual(expect.objectContaining({ type: 'STRING', value: 'hello' }));
    });

    it('tokenises single-quoted strings', () => {
      const toks = jsLex("'world'");
      expect(toks).toContainEqual(expect.objectContaining({ type: 'STRING', value: 'world' }));
    });

    it('does not support template literals (backticks)', () => {
      // Backticks are unsupported; they don't produce a STRING token.
      const toks = jsLex('`hi`');
      expect(toks.some((t) => t.type === 'STRING')).toBe(false);
    });

    it('tokenises boolean literals', () => {
      const toks = jsLex('true false');
      expect(toks).toContainEqual(expect.objectContaining({ type: 'BOOLEAN', value: 'true' }));
      expect(toks).toContainEqual(expect.objectContaining({ type: 'BOOLEAN', value: 'false' }));
    });

    it('tokenises JS keywords', () => {
      const toks = jsLex('let const var function class');
      const kws = toks.filter((t) => t.type === 'KEYWORD').map((t) => t.value);
      expect(kws).toContain('let');
      expect(kws).toContain('const');
      expect(kws).toContain('var');
      expect(kws).toContain('function');
      expect(kws).toContain('class');
    });

    it('tokenises identifiers', () => {
      const toks = jsLex('myVar _private $jquery');
      const ids = toks.filter((t) => t.type === 'IDENTIFIER').map((t) => t.value);
      expect(ids).toContain('myVar');
      expect(ids).toContain('_private');
      expect(ids).toContain('$jquery');
    });

    it('skips single-line comments', () => {
      const toks = jsLex('let x = 1; // this is a comment\nlet y = 2;');
      const ids = toks.filter((t) => t.type === 'IDENTIFIER').map((t) => t.value);
      expect(ids).toContain('x');
      expect(ids).toContain('y');
      expect(ids).not.toContain('this');
    });

    it('does not support block comments (/* */ is reserved for Praxis placeholders)', () => {
      // `/* */` is intentionally unsupported in JavaScript; the `/` lexes as an
      // operator rather than starting a comment.
      const toks = jsLex('/* ignored */ let z = 3;');
      expect(toks.some((t) => t.type === 'OPERATOR' && t.value === '/')).toBe(true);
    });
  });

  describe('Operators', () => {
    it('tokenises === as ==', () => {
      const toks = jsLex('a === b');
      const ops = toks.filter((t) => t.type === 'OPERATOR').map((t) => t.value);
      expect(ops).toContain('==');
    });

    it('tokenises !== as !=', () => {
      const toks = jsLex('a !== b');
      const ops = toks.filter((t) => t.type === 'OPERATOR').map((t) => t.value);
      expect(ops).toContain('!=');
    });

    it('tokenises ** (exponentiation)', () => {
      const toks = jsLex('2 ** 8');
      expect(toks).toContainEqual(expect.objectContaining({ type: 'OPERATOR', value: '**' }));
    });

    it('tokenises compound assignment operators', () => {
      const toks = jsLex('x += 1; y -= 2; z *= 3;');
      const ops = toks.filter((t) => t.type === 'OPERATOR').map((t) => t.value);
      expect(ops).toContain('+=');
      expect(ops).toContain('-=');
      expect(ops).toContain('*=');
    });

    it('tokenises increment/decrement', () => {
      const toks = jsLex('i++ --j');
      const ops = toks.filter((t) => t.type === 'OPERATOR').map((t) => t.value);
      expect(ops).toContain('++');
      expect(ops).toContain('--');
    });
  });
});

// ─── Parser ───────────────────────────────────────────────────────────────────

describe('JavaScript Parser', () => {
  describe('Variable declarations', () => {
    it('parses let declaration', () => {
      const ast = jsParse('let x = 5;');
      expect(ast.body[0]).toMatchObject({
        type: 'Assignment',
        target: { type: 'Identifier', name: 'x' },
      });
    });

    it('parses const declaration', () => {
      const ast = jsParse('const PI = 3.14;');
      expect(ast.body[0]).toMatchObject({
        type: 'Assignment',
        target: { type: 'Identifier', name: 'PI' },
      });
    });

    it('parses var declaration', () => {
      const ast = jsParse('var y = "hello";');
      expect(ast.body[0]).toMatchObject({
        type: 'Assignment',
        target: { type: 'Identifier', name: 'y' },
      });
    });

    it('parses uninitialized declaration', () => {
      const ast = jsParse('let z;');
      expect(ast.body[0]).toMatchObject({
        type: 'Assignment',
        target: { type: 'Identifier', name: 'z' },
        declaredWithoutInitializer: true,
      });
    });
  });

  describe('console.log → Print', () => {
    it('maps console.log to Print node', () => {
      const ast = jsParse('console.log(42);');
      expect(ast.body[0]).toMatchObject({ type: 'Print' });
    });

    it('handles multiple arguments', () => {
      const ast = jsParse('console.log("a", "b", "c");');
      const print = ast.body[0] as any;
      expect(print.type).toBe('Print');
      expect(print.expressions).toHaveLength(3);
    });
  });

  describe('Function declarations', () => {
    it('parses function declaration', () => {
      const ast = jsParse('function add(a, b) { return a + b; }');
      expect(ast.body[0]).toMatchObject({ type: 'FunctionDeclaration', name: 'add' });
    });

    it('parses return statement', () => {
      const ast = jsParse('function f() { return 42; }');
      const fn = ast.body[0] as any;
      const ret = fn.body.body[0];
      expect(ret).toMatchObject({ type: 'Return' });
    });
  });

  describe('Control flow', () => {
    it('parses if / else if / else', () => {
      const ast = jsParse(
        'if (x > 0) { console.log("pos"); } else if (x < 0) { console.log("neg"); } else { console.log("zero"); }'
      );
      expect(ast.body[0]).toMatchObject({ type: 'If' });
    });

    it('parses while loop', () => {
      const ast = jsParse('while (i < 10) { i++; }');
      expect(ast.body[0]).toMatchObject({ type: 'While' });
    });

    it('parses do-while loop', () => {
      const ast = jsParse('do { x++; } while (x < 5);');
      expect(ast.body[0]).toMatchObject({ type: 'DoWhile' });
    });

    it('parses C-style for loop', () => {
      const ast = jsParse('for (let i = 0; i < 5; i++) { console.log(i); }');
      const forNode = ast.body[0] as any;
      expect(forNode.type).toBe('For');
      expect(forNode.init).toBeTruthy();
      expect(forNode.condition).toBeTruthy();
      expect(forNode.update).toBeTruthy();
    });

    it('parses for-of loop', () => {
      const ast = jsParse('for (const x of nums) { console.log(x); }');
      const forNode = ast.body[0] as any;
      expect(forNode.type).toBe('ForEach');
      expect(forNode.variable).toBe('x');
    });

    it('lowers for-in to index iteration over range(x.length)', () => {
      const ast = jsParse('for (let i in nums) { console.log(i); }');
      const forNode = ast.body[0] as any;
      expect(forNode.type).toBe('ForEach');
      expect(forNode.iterable.type).toBe('CallExpression');
      expect(forNode.iterable.callee.name).toBe('range');
      expect(forNode.iterable.arguments[0].type).toBe('MemberExpression');
    });

    it('parses process.stdout.write as a no-newline Print', () => {
      const ast = jsParse('process.stdout.write("x");');
      const node = ast.body[0] as any;
      expect(node.type).toBe('Print');
      expect(node.appendLineFeed).toBe(false);
    });

    it('parses switch statement', () => {
      const ast = jsParse('switch (v) { case 1: break; default: break; }');
      expect(ast.body[0]).toMatchObject({ type: 'Switch' });
    });

    it('parses break and continue', () => {
      const ast = jsParse('while (true) { break; continue; }');
      const body = (ast.body[0] as any).body.body;
      expect(body[0]).toMatchObject({ type: 'Break' });
      expect(body[1]).toMatchObject({ type: 'Continue' });
    });

    it('parses try / catch / finally', () => {
      const ast = jsParse('try { foo(); } catch (e) { console.log(e); } finally { cleanup(); }');
      expect(ast.body[0]).toMatchObject({ type: 'Try' });
    });
  });

  describe('Expressions', () => {
    it('parses binary expression', () => {
      const ast = jsParse('let r = 3 + 4;');
      const rhs = (ast.body[0] as any).value;
      expect(rhs).toMatchObject({ type: 'BinaryExpression', operator: '+' });
    });

    it('parses logical operators (|| → or, && → and)', () => {
      const ast = jsParse('let r = a || b;');
      expect((ast.body[0] as any).value).toMatchObject({
        type: 'BinaryExpression',
        operator: 'or',
      });
    });

    it('parses array literal', () => {
      const ast = jsParse('let arr = [1, 2, 3];');
      expect((ast.body[0] as any).value).toMatchObject({ type: 'ArrayLiteral' });
    });

    it('parses member access', () => {
      const ast = jsParse('let n = arr.length;');
      expect((ast.body[0] as any).value).toMatchObject({ type: 'MemberExpression' });
    });

    it('parses index expression', () => {
      const ast = jsParse('let v = arr[0];');
      expect((ast.body[0] as any).value).toMatchObject({ type: 'IndexExpression' });
    });

    it('parses new expression', () => {
      const ast = jsParse('let obj = new Foo(1, 2);');
      expect((ast.body[0] as any).value).toMatchObject({ type: 'NewExpression', className: 'Foo' });
    });

    it('parses ternary expression', () => {
      const ast = jsParse('let x = a > b ? a : b;');
      expect((ast.body[0] as any).value).toMatchObject({ type: 'ConditionalExpression' });
    });

    it('parses compound assignment', () => {
      const ast = jsParse('x += 5;');
      expect(ast.body[0] as any).toMatchObject({ type: 'ExpressionStatement' });
    });
  });

  describe('Class declarations', () => {
    it('parses class with constructor and method', () => {
      const src = `
        class Animal {
          constructor(name) { this.name = name; }
          speak() { console.log(this.name); }
        }
      `;
      const ast = jsParse(src);
      const cls = ast.body[0] as any;
      expect(cls.type).toBe('ClassDeclaration');
      expect(cls.name).toBe('Animal');
      const ctor = cls.body.find((m: any) => m.type === 'Constructor');
      expect(ctor).toBeTruthy();
    });

    it('parses class inheritance', () => {
      const ast = jsParse('class Dog extends Animal { bark() { console.log("woof"); } }');
      const cls = ast.body[0] as any;
      expect(cls.superClass?.name).toBe('Animal');
    });
  });

  describe('Chained assignment', () => {
    const run = (src: string): string[] =>
      new Interpreter().interpret(new JavaScriptParser(jsLex(src)).parse(), src);

    it('runs a chain that reassigns existing variables', () => {
      const src = 'let i;\nlet j;\ni = j = 5;\nconsole.log(i);\nconsole.log(j);';
      expect(run(src)).toEqual(['5', '5']);
    });

    it('runs a chain that introduces new variables', () => {
      expect(run('i = j = 9;\nconsole.log(i);\nconsole.log(j);')).toEqual(['9', '9']);
    });
  });
});

// ─── Emitter ──────────────────────────────────────────────────────────────────

describe('JavaScript Emitter', () => {
  it('emits let declarations', () => {
    expect(jsEmit('let x = 5;')).toContain('let x = 5');
  });

  it('emits console.log for Print', () => {
    expect(jsEmit('console.log("hi");')).toContain('console.log("hi")');
  });

  it('emits function declaration', () => {
    const out = jsEmit('function add(a, b) { return a + b; }');
    expect(out).toContain('function add(a, b)');
    expect(out).toContain('return a + b');
  });

  it('emits if / else if / else', () => {
    const out = jsEmit('if (x > 0) { console.log(1); } else { console.log(0); }');
    expect(out).toContain('if (x > 0)');
    expect(out).toContain('} else {');
  });

  it('emits while loop with braces', () => {
    const out = jsEmit('while (i < 5) { i++; }');
    expect(out).toContain('while (i < 5)');
  });

  it('emits C-style for loop', () => {
    const out = jsEmit('for (let i = 0; i < 3; i++) { console.log(i); }');
    expect(out).toContain('for (let i = 0; i < 3; i++)');
  });

  it('emits for-of loop', () => {
    const out = jsEmit('for (const x of arr) { console.log(x); }');
    expect(out).toContain('for (const x of arr)');
  });

  it('emits === for equality', () => {
    const out = jsEmit('let r = a == b;');
    expect(out).toContain('===');
  });

  it('emits !== for inequality', () => {
    const out = jsEmit('let r = a != b;');
    expect(out).toContain('!==');
  });

  it('emits class with constructor and method', () => {
    const src = `
      class Point {
        constructor(x, y) { this.x = x; this.y = y; }
        toString() { console.log(this.x); }
      }
    `;
    const out = jsEmit(src);
    expect(out).toContain('class Point');
    expect(out).toContain('constructor(x, y)');
    expect(out).toContain('toString()');
  });

  it('emits class inheritance', () => {
    const out = jsEmit('class Cat extends Animal { meow() { console.log("meow"); } }');
    expect(out).toContain('class Cat extends Animal');
  });

  it('emits switch statement', () => {
    const out = jsEmit(
      'switch (v) { case 1: console.log(1); break; default: console.log(0); break; }'
    );
    expect(out).toContain('switch (v)');
    expect(out).toContain('case 1:');
    expect(out).toContain('default:');
  });

  it('emits try / catch / finally', () => {
    const out = jsEmit('try { foo(); } catch (e) { console.log(e); } finally { bar(); }');
    expect(out).toContain('try {');
    expect(out).toContain('} catch (e) {');
    expect(out).toContain('} finally {');
  });

  it('only emits let on first assignment of a variable', () => {
    const src = 'let x = 0;\nx = x + 1;\nx = x + 1;';
    const out = jsEmit(src);
    const letCount = (out.match(/\blet\b/g) ?? []).length;
    expect(letCount).toBe(1);
  });
});

// ─── Translation: JS → other languages ───────────────────────────────────────

describe('Translation from JavaScript', () => {
  const simpleAssign = 'let x = 10;\nconsole.log(x);';
  const sumLoop =
    'let total = 0;\nfor (let i = 1; i <= 5; i++) { total = total + i; }\nconsole.log(total);';
  const funcSrc = 'function max(a, b) { if (a > b) { return a; } else { return b; } }';

  describe('to Python', () => {
    it('translates simple assignment and print', () => {
      const out = translateFromJS(simpleAssign, 'python');
      expect(out).toContain('x = 10');
      expect(out).toContain('print(x)');
    });

    it('translates for loop to range', () => {
      const out = translateFromJS(sumLoop, 'python');
      expect(out).toMatch(/for\s+i\s+in\s+range/);
    });

    it('translates function to def', () => {
      const out = translateFromJS(funcSrc, 'python');
      expect(out).toContain('def max(a, b)');
    });
  });

  describe('to Java', () => {
    it('translates simple assignment and print', () => {
      const out = translateFromJS(simpleAssign, 'java');
      expect(out).toContain('System.out.println');
    });

    it('translates for loop', () => {
      const out = translateFromJS(sumLoop, 'java');
      expect(out).toContain('for');
    });

    it('translates function to method/class', () => {
      const out = translateFromJS(funcSrc, 'java');
      // Java wraps top-level functions in a Main class
      expect(out).toMatch(/max\s*\(/);
    });
  });

  describe('to CSP', () => {
    it('translates print to DISPLAY', () => {
      const out = translateFromJS(simpleAssign, 'csp');
      expect(out).toContain('DISPLAY');
    });

    it('translates assignment', () => {
      const out = translateFromJS(simpleAssign, 'csp');
      expect(out).toContain('x');
    });
  });

  describe('to Praxis', () => {
    it('translates print', () => {
      const out = translateFromJS(simpleAssign, 'praxis');
      expect(out).toContain('print');
    });

    it('translates function declaration', () => {
      const out = translateFromJS(funcSrc, 'praxis');
      expect(out).toContain('max');
    });
  });
});

// ─── Translation: other languages → JS ───────────────────────────────────────

describe('Translation to JavaScript', () => {
  describe('from Python', () => {
    function pyToJS(src: string): string {
      const tokens = new PythonLexer(src).tokenize();
      const ast = new PythonParser(tokens).parse();
      return translateToJS(ast);
    }

    it('translates print() to console.log()', () => {
      const out = pyToJS('print("hello")');
      expect(out).toContain('console.log("hello")');
    });

    it('translates assignment', () => {
      const out = pyToJS('x = 42');
      expect(out).toContain('42');
    });

    it('translates if / elif / else', () => {
      const out = pyToJS('if x > 0:\n  print(1)\nelif x < 0:\n  print(-1)\nelse:\n  print(0)');
      expect(out).toContain('if (x > 0)');
      expect(out).toContain('} else if (x < 0)');
    });

    it('translates while loop', () => {
      const out = pyToJS('while i < 10:\n  i = i + 1');
      expect(out).toContain('while (i < 10)');
    });

    it('translates function definition', () => {
      const out = pyToJS('def square(n):\n  return n * n');
      expect(out).toContain('function square(n)');
    });
  });

  describe('from Java', () => {
    function javaToJS(src: string): string {
      const tokens = new JavaLexer(src).tokenize();
      const ast = new JavaParser(tokens).parse();
      return translateToJS(ast);
    }

    it('translates System.out.println to console.log', () => {
      const out = javaToJS('System.out.println("hi");');
      expect(out).toContain('console.log("hi")');
    });

    it('translates typed variable declaration', () => {
      const out = javaToJS('int x = 5;');
      expect(out).toContain('5');
    });

    it('translates for loop', () => {
      const out = javaToJS('for (int i = 0; i < 3; i++) { System.out.println(i); }');
      expect(out).toContain('for (');
      expect(out).toContain('console.log(i)');
    });

    it('translates if / else', () => {
      const out = javaToJS(
        'if (x > 0) { System.out.println("pos"); } else { System.out.println("neg"); }'
      );
      expect(out).toContain('if (x > 0)');
    });

    it('translates function inside a class', () => {
      const src = `
        public class Main {
          public static int add(int a, int b) { return a + b; }
        }
      `;
      const out = javaToJS(src);
      expect(out).toMatch(/add\s*\(/);
    });
  });

  describe('from CSP', () => {
    function cspToJS(src: string): string {
      const tokens = new CSPLexer(src).tokenize();
      const ast = new CSPParser(tokens).parse();
      return translateToJS(ast);
    }

    it('translates DISPLAY (space terminator) to process.stdout.write', () => {
      // CSP DISPLAY appends a space with no newline, so it maps to a no-newline
      // write with the space preserved, not console.log.
      const out = cspToJS('DISPLAY("hello")');
      expect(out).toContain('process.stdout.write("hello" + " ")');
    });

    it('translates REPEAT UNTIL loop', () => {
      const out = cspToJS('x <- 0\nREPEAT UNTIL (x >= 5)\n{\n  x <- x + 1\n}');
      // RepeatUntil → do-while or while with negated condition
      expect(out).toMatch(/do\s*\{|while\s*\(/);
      expect(out).toContain('x >= 5');
    });

    it('translates procedure to function', () => {
      const out = cspToJS('PROCEDURE greet(name)\n{\n  DISPLAY("Hello " + name)\n}\ngreet("JS")');
      expect(out).toContain('function greet(name)');
    });
  });

  describe('from Praxis', () => {
    function praxisToJS(src: string): string {
      const tokens = new PraxisLexer(src).tokenize();
      const ast = new PraxisParser(tokens).parse();
      return translateToJS(ast);
    }

    it('translates print to console.log', () => {
      const out = praxisToJS('print("hello")');
      expect(out).toContain('console.log("hello")');
    });

    it('translates function with return', () => {
      const out = praxisToJS(`int add ( int a, int b )
  return a + b
end add`);
      expect(out).toContain('function add(a, b)');
      expect(out).toContain('return a + b');
    });

    it('translates while loop', () => {
      const out = praxisToJS('while (x < 5)\n  x = x + 1\nend while');
      expect(out).toContain('while (x < 5)');
    });
  });
});

// ─── Round-trip: JS → other → JS (structural equivalence) ────────────────────

describe('Round-trip structural equivalence', () => {
  const programs: [string, string][] = [
    ['assignment + print', 'let x = 7;\nconsole.log(x);'],
    ['for loop sum', 'let s = 0;\nfor (let i = 1; i <= 3; i++) { s = s + i; }\nconsole.log(s);'],
    ['function', 'function double(n) { return n * 2; }'],
    ['if / else', 'if (x > 0) { console.log("yes"); } else { console.log("no"); }'],
  ];

  for (const [label, src] of programs) {
    it(`JS → Python → JS preserves structure: ${label}`, () => {
      const ast1 = jsParse(src);
      const py = translateToJS(ast1); // we already have a JS emitter, but let's go through Python
      const pyAst = (() => {
        const toks = new PythonLexer(translateFromJS(src, 'python')).tokenize();
        return new PythonParser(toks).parse();
      })();
      const jsBack = translateToJS(pyAst);
      // Both should produce console.log
      if (src.includes('console.log')) {
        expect(jsBack).toContain('console.log');
      }
      // Both should produce function if original had one
      if (src.includes('function ')) {
        expect(jsBack).toContain('function ');
      }
    });
  }
});
