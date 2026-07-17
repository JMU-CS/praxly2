import { describe, it, expect } from 'vitest';
import { JavaLexer } from '../src/language/java/lexer';
import { JavaParser } from '../src/language/java/parser';
import { JavaEmitter } from '../src/language/java/emitter';
import { Translator } from '../src/language/translator';
import { SymbolTable } from '../src/language/visitor';
import { Lexer as PythonLexer } from '../src/language/python/lexer';
import { Parser as PythonParser } from '../src/language/python/parser';
import { PraxisLexer } from '../src/language/praxis/lexer';
import { PraxisParser } from '../src/language/praxis/parser';
import { Interpreter } from '../src/language/interpreter';

// Real Java requires every statement to live inside a method, and the runtime
// entry point must be `public class Main { public static void main(String[] args) { ... } }`.
// Most test sources below are single statements/expressions, so wrap them in that
// boilerplate rather than repeating it inline everywhere.
const wrapMain = (body: string): string =>
  `public class Main {\n  public static void main(String[] args) {\n${body}\n  }\n}`;

// Structural parser assertions used to check `program.body` directly; now that
// top-level statements live inside Main.main, drill into that method's block.
const mainBodyOf = (program: any): any[] => {
  const mainClass = program.body.find(
    (s: any) => s.type === 'ClassDeclaration' && s.name === 'Main'
  );
  const mainMethod = mainClass.body.find(
    (m: any) => m.type === 'MethodDeclaration' && m.name === 'main'
  );
  return mainMethod.body.body;
};

describe('Java Lexer', () => {
  describe('Basic Tokens', () => {
    it('should tokenize numbers', () => {
      const lexer = new JavaLexer('42 3.14');
      const tokens = lexer.tokenize();
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'NUMBER', value: '42' }));
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'NUMBER', value: '3.14' }));
    });

    it('should tokenize strings', () => {
      const lexer = new JavaLexer('"hello world"');
      const tokens = lexer.tokenize();
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: 'STRING', value: 'hello world' })
      );
    });

    it('should tokenize keywords', () => {
      const lexer = new JavaLexer('int public class void');
      const tokens = lexer.tokenize();
      const keywordTokens = tokens.filter((t) => t.type === 'KEYWORD');
      expect(keywordTokens).toHaveLength(4);
    });

    it('should tokenize identifiers', () => {
      const lexer = new JavaLexer('myVariable someFunc');
      const tokens = lexer.tokenize();
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: 'IDENTIFIER', value: 'myVariable' })
      );
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: 'IDENTIFIER', value: 'someFunc' })
      );
    });

    it('should tokenize operators', () => {
      const lexer = new JavaLexer('+ - * / == != && ||');
      const tokens = lexer.tokenize();
      const operators = tokens.filter((t) => t.type === 'OPERATOR').map((t) => t.value);
      expect(operators).toContain('+');
      expect(operators).toContain('==');
      expect(operators).toContain('&&');
    });

    it('should tokenize punctuation', () => {
      const lexer = new JavaLexer('( ) { } [ ] ; , .');
      const tokens = lexer.tokenize();
      const punctuation = tokens.filter((t) => t.type === 'PUNCTUATION').map((t) => t.value);
      expect(punctuation).toContain('(');
      expect(punctuation).toContain('{');
      expect(punctuation).toContain('[');
    });

    it('should handle comments', () => {
      const lexer = new JavaLexer('int x; // this is a comment\nint y;');
      const tokens = lexer.tokenize();
      const identifiers = tokens.filter((t) => t.type === 'IDENTIFIER').map((t) => t.value);
      expect(identifiers).toContain('x');
      expect(identifiers).toContain('y');
    });
  });

  describe('Complex Expressions', () => {
    it('should tokenize binary expression', () => {
      const lexer = new JavaLexer('5 + 3');
      const tokens = lexer.tokenize();
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'NUMBER', value: '5' }));
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'OPERATOR', value: '+' }));
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'NUMBER', value: '3' }));
    });

    it('should tokenize method call', () => {
      const lexer = new JavaLexer('obj.method()');
      const tokens = lexer.tokenize();
      const values = tokens.filter((t) => t.type === 'IDENTIFIER').map((t) => t.value);
      expect(values).toContain('obj');
      expect(values).toContain('method');
    });
  });
});

describe('Java Parser', () => {
  describe('Expressions', () => {
    it('should parse simple literal', () => {
      const lexer = new JavaLexer('42');
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      // For expression parsing, we'd need parseExpression method
      // This shows the pattern for testing
    });

    it('should parse binary expression', () => {
      const lexer = new JavaLexer('5 + 3 * 2');
      const tokens = lexer.tokenize();
      // Parser tests verify operator precedence
    });
  });

  describe('Statements', () => {
    it('should parse variable declaration', () => {
      const lexer = new JavaLexer(wrapMain('int x = 5;'));
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const body = mainBodyOf(program);
      expect(body).toHaveLength(1);
      expect(body[0].type).toBe('Assignment');
    });

    it('should parse if statement', () => {
      const source = wrapMain(`int x = 7;
if (x < 10) {
  x++;
}`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      expect(mainBodyOf(program).some((s) => s.type === 'If')).toBe(true);
    });

    it('should parse while loop', () => {
      const source = wrapMain(`int i = 0;
while (i < 10) {
  i++;
}`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      expect(mainBodyOf(program).some((s) => s.type === 'While')).toBe(true);
    });

    it('should parse for loop', () => {
      const source = wrapMain(`for (int i = 0; i < 10; i++) {
}`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      expect(mainBodyOf(program)[0].type).toBe('For');
    });
  });

  describe('Classes', () => {
    it('should parse class declaration', () => {
      const source = `public class Main {
  int x = 0;
  public static void main(String[] args) {}
}`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('ClassDeclaration');
    });

    it('should parse method', () => {
      const source = `public class Main {
  public static void main(String[] args) {}
  public void myMethod() {
    System.out.println("test");
  }
}`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const classDecl = program.body[0] as any;
      expect(classDecl.body.some((m: any) => m.type === 'MethodDeclaration')).toBe(true);
    });
  });

  describe('Entry point requirement', () => {
    it('rejects bare top-level statements', () => {
      const source = `int x = 5;`;
      expect(() => new JavaParser(new JavaLexer(source).tokenize()).parse()).toThrow(
        /class declaration/
      );
    });

    it('rejects a program with no Main class', () => {
      const source = `public class Helper {
  int x = 0;
}`;
      expect(() => new JavaParser(new JavaLexer(source).tokenize()).parse()).toThrow(
        /must define a 'Main' class/
      );
    });

    it('rejects a Main class without a valid main method', () => {
      const source = `public class Main {
  public void main(String[] args) {}
}`;
      expect(() => new JavaParser(new JavaLexer(source).tokenize()).parse()).toThrow(
        /must define an entry point/
      );
    });

    it('accepts a Main class alongside other classes', () => {
      const source = `public class Helper {
  int x;
}
public class Main {
  public static void main(String[] args) {}
}`;
      const program = new JavaParser(new JavaLexer(source).tokenize()).parse();
      expect(program.body.map((s: any) => s.type)).toEqual([
        'ClassDeclaration',
        'ClassDeclaration',
      ]);
    });

    it('accepts and discards import declarations', () => {
      const source = `import java.util.Scanner;
import java.util.ArrayList;

public class Main {
  public static void main(String[] args) {}
}`;
      const program = new JavaParser(new JavaLexer(source).tokenize()).parse();
      expect(program.body).toHaveLength(1);
      expect(program.body[0].type).toBe('ClassDeclaration');
    });
  });
});

describe('Java Emitter', () => {
  describe('Expressions', () => {
    it('should emit arithmetic expression', () => {
      const source = wrapMain(`System.out.println(5 + 3);`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const context = {
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      };
      const emitter = new JavaEmitter(context);
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('5');
      expect(code).toContain('+');
      expect(code).toContain('3');
    });

    it('should emit power operation as Math.pow', () => {
      const source = wrapMain(`System.out.println(2 ** 8);`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const context = {
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      };
      const emitter = new JavaEmitter(context);
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      // Power operation should be converted to Math.pow
    });
  });

  describe('Statements', () => {
    it('should emit variable declaration', () => {
      const source = wrapMain(`int x;`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const context = {
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      };
      const emitter = new JavaEmitter(context);
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('int');
      expect(code).toContain('x');
    });

    it('should emit if statement', () => {
      const source = wrapMain(`if (x < 10) {
  x++;
}`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const context = {
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      };
      const emitter = new JavaEmitter(context);
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('if');
      expect(code).toContain('{');
      expect(code).toContain('}');
    });
  });
});

describe('Java Translation', () => {
  describe('Basic Programs', () => {
    it('should translate simple assignment', () => {
      const source = wrapMain(`int x = 5;`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('int');
      expect(result).toContain('x');
    });

    it('should translate print statement', () => {
      const source = wrapMain(`System.out.println("hello");`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('println');
    });

    it('should not add implicit defaults for uninitialized Java declarations', () => {
      const source = wrapMain(`int x;`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');

      expect(result).toContain('int x;');
      expect(result).not.toContain('int x = 0;');
    });

    it('should emit Python type hint only for uninitialized Java declarations', () => {
      const source = wrapMain(`int x;\nint y = 3;`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');

      expect(result).toContain('x: int');
      expect(result).toContain('y = 3');
      expect(result).not.toContain('y: int = 3');
    });
  });

  describe('Control Flow', () => {
    it('should translate if statement correctly', () => {
      const source = wrapMain(`int x = 7;
if (x < 10) {
  x++;
}`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('if');
      expect(result).toContain('<');
    });
  });

  describe('Arrays', () => {
    it('should translate array declaration', () => {
      const source = wrapMain(`int[] xs = {12, 103, 80};`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('int[]');
      expect(result).toContain('xs');
    });

    it('should translate array access', () => {
      const source = wrapMain(`int[] xs = {12, 103, 80};
System.out.println(xs[0]);`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('xs[0]');
    });
  });

  describe('Classes', () => {
    it('should translate simple class', () => {
      const source = `public class Count {
  public int count = 0;
}
public class Main {
  public static void main(String[] args) {}
}`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('class');
      expect(result).toContain('Count');
      expect(result).toContain('int count');
    });

    it('should translate class with methods', () => {
      const source = `public class Count {
  public int count = 0;
  public void inc() {
    this.count = this.count + 1;
  }
}
public class Main {
  public static void main(String[] args) {}
}`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('void');
      expect(result).toContain('inc');
      expect(result).toContain('this.count');
    });

    it('should translate Java method parameter types to Python annotations', () => {
      const source = `public class MathUtil {
  public int add(int x, double y) {
    return x;
  }
}
public class Main {
  public static void main(String[] args) {}
}`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const pythonCode = translator.translate(program, 'python');

      expect(pythonCode).toContain('class MathUtil');
      expect(pythonCode).toContain('def add(self, x: int, y: float):');
    });

    it('should include non-Main Java classes when translating to Python', () => {
      const source = `public class Meow {
  private int x;

  public Meow(int x) {
    this.x = x;
  }
}

public class Main {
  public static void main(String[] args) {
    Meow meow = new Meow(10);
    System.out.println(meow.x);
  }
}`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const pythonCode = translator.translate(program, 'python');

      expect(pythonCode).toContain('class Meow:');
      expect(pythonCode).toContain('def __init__(self, x: int):');
      expect(pythonCode).toContain('self.x = x');
      expect(pythonCode).toContain('meow = Meow(10)');
      expect(pythonCode).toContain('print(meow.x)');
    });

    it('should execute translated Python class constructor calls', () => {
      const source = `public class Meow {
  private int x;

  public Meow(int x) {
    this.x = x;
  }
}

public class Main {
  public static void main(String[] args) {
    Meow meow = new Meow(10);
    System.out.println(meow.x);
  }
}`;
      const javaLexer = new JavaLexer(source);
      const javaTokens = javaLexer.tokenize();
      const javaParser = new JavaParser(javaTokens);
      const javaProgram = javaParser.parse();
      const translator = new Translator();
      const pythonCode = translator.translate(javaProgram, 'python');

      const pythonLexer = new PythonLexer(pythonCode);
      const pythonTokens = pythonLexer.tokenize();
      const pythonParser = new PythonParser(pythonTokens);
      const pythonProgram = pythonParser.parse();

      const interpreter = new Interpreter();
      const output = interpreter.interpret(pythonProgram, pythonCode);

      expect(output.join('\n')).not.toContain('Runtime Error');
      expect(output).toContain('10');
    });
  });

  describe('Advanced Features', () => {
    it('should translate multiple statements in c-style for loop', () => {
      const source = wrapMain(`for (int i = 0, j = 10; i < j; i++, j--) {
  System.out.println(i);
}`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('for');
      expect(result).toContain('i');
      expect(result).toContain('j');
    });

    it('should translate switch-case with fall through', () => {
      const source = wrapMain(`int x = 1;
int y = 0;
switch (x) {
  case 1:
    y = 10;
  case 2:
    y = 20;
    break;
  default:
    y = 0;
}`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('switch');
      expect(result).toContain('case');
      expect(result).toContain('default');
    });

    it('parses and re-emits a char literal', () => {
      const source = wrapMain(`char grade = 'A';`);
      const program = new JavaParser(new JavaLexer(source).tokenize()).parse();
      const result = new Translator().translate(program, 'java');
      expect(result).toContain("char grade = 'A'");
    });

    it('should translate other compound assignment operators', () => {
      const source = wrapMain(`int x = 0;
int y = 10;
int z = 20;
x *= 2;
y /= 3;
z %= 5;`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('*=');
      expect(result).toContain('/=');
      expect(result).toContain('%=');
    });

    it('should translate ternary operator', () => {
      const source = wrapMain(`int a = 1;
int b = 2;
int max = a > b ? a : b;`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('?');
      expect(result).toContain(':');
    });

    it('should translate array element mutation', () => {
      const source = wrapMain(`int[] nums = {1, 2, 3};
nums[1] = 4;`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('nums');
      expect(result).toContain('[1]');
      expect(result).toContain('4');
    });

    it('should translate compound assignment correctly', () => {
      const source = wrapMain(`int total = 0;
int k = 5;
total += k;`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('total');
      expect(result).toContain('+=');
    });

    it('should translate negated method call', () => {
      const source = wrapMain(`String password = "abc";
if (!password.equals("ABC123")) {
  System.out.println("Invalid");
}`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('!');
      expect(result).toContain('equals');
    });

    it('should use .equals() for String equality comparison', () => {
      const source = wrapMain(`String name = "John";
if (name == "John") {
  System.out.println("Match");
}`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaResult = translator.translate(program, 'java');
      expect(javaResult).toContain('.equals(');
    });

    it('should handle String inequality with .equals()', () => {
      const source = wrapMain(`String a = "test";
String b = "other";
if (a != b) {
  System.out.println("Different");
}`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaResult = translator.translate(program, 'java');
      expect(javaResult).toContain('!');
      expect(javaResult).toContain('.equals(');
    });

    it('should support ternary operators', () => {
      const source = wrapMain(`int a = 1;
int b = 2;
int max = a > b ? a : b;`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('?');
      expect(result).toContain(':');
    });

    it('should handle multiple statements in c-style for loop', () => {
      const source = wrapMain(`for (int i = 0, j = 10; i < j; i++, j--) {
  System.out.println(i);
}`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('for');
      expect(result).toContain('i');
      expect(result).toContain('j');
    });

    it('should add break statements in switch cases', () => {
      const source = wrapMain(`int x = 1;
switch (x) {
  case 1:
    System.out.println("one");
  case 2:
    System.out.println("two");
  default:
    System.out.println("other");
}`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('break');
    });

    it('should translate array element mutation (index 0)', () => {
      const source = wrapMain(`int[] nums = {1, 2, 3};
nums[0] = 5;`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('nums[0]');
      expect(result).toContain('5');
    });

    it('should translate compound assignment operators', () => {
      const source = wrapMain(`int x = 10;
x += 5;
x -= 3;
x *= 2;
x /= 4;`);
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('+=');
      expect(result).toContain('-=');
      expect(result).toContain('*=');
      expect(result).toContain('/=');
    });

    it('emits exponentiation as Math.pow, never a bare ^', () => {
      // Praxis `2 ^ 10` (interpreter treats ^ as power) must become Math.pow in Java.
      const program = new PraxisParser(new PraxisLexer('int x <- 2 ^ 10').tokenize()).parse();
      const result = new Translator().translate(program, 'java');
      expect(result).toContain('Math.pow(2, 10)');
      expect(result).not.toContain(' ^ ');
    });
  });

  describe('AP CSA stdlib', () => {
    const runJava = (src: string): string[] =>
      new Interpreter().interpret(new JavaParser(new JavaLexer(src).tokenize()).parse(), src);

    it('supports Math.random() (seeded, in [0,1))', () => {
      const out = runJava(`public class Main {
  public static void main(String[] args) {
    randomSeed(1);
    double r = Math.random();
    System.out.println(r >= 0.0 && r < 1.0);
  }
}`);
      expect(out).toEqual(['true']);
    });

    it('reads input via Scanner (nextInt/nextDouble/nextBoolean/next/nextLine)', () => {
      const src = `public class Main {
  public static void main(String[] args) {
    Scanner sc = new Scanner(System.in);
    int a = sc.nextInt();
    int b = sc.nextInt();
    double d = sc.nextDouble();
    boolean flag = sc.nextBoolean();
    String word = sc.next();
    System.out.println(a + b);
    System.out.println(d);
    System.out.println(flag);
    System.out.println(word);
    sc.close();
  }
}`;
      const interp = new Interpreter();
      interp.addInput('3 4 2.5 true hello');
      const out = interp.interpret(new JavaParser(new JavaLexer(src).tokenize()).parse(), src);
      // Drop the input-echo line; assert the computed values.
      expect(out.filter((l) => !l.startsWith('>'))).toEqual(['7', '2.5', 'true', 'hello']);
    });

    it('provides default Object toString() and equals()', () => {
      const out = runJava(`public class Main {
  public static void main(String[] args) {
    Point p = new Point();
    Point q = new Point();
    System.out.println(p.equals(p));
    System.out.println(p.equals(q));
    System.out.println(p.toString());
  }
}
class Point { }`);
      expect(out).toEqual(['true', 'false', 'Point instance']);
    });
  });
});

describe('Java braceless control-flow bodies', () => {
  const runJava = (src: string): string[] =>
    new Interpreter().interpret(new JavaParser(new JavaLexer(src).tokenize()).parse(), src);
  const parseJava = (src: string) => new JavaParser(new JavaLexer(src).tokenize()).parse();

  it('braceless if does not swallow the following statement (condition false)', () => {
    // Regression: `block()` used to read to EOF when no `{` was present, absorbing
    // the trailing println into the if-body so it was skipped when the guard failed.
    expect(runJava(wrapMain('int x = -1; if (x > 0) x = 5; System.out.println(x);'))).toEqual([
      '-1',
    ]);
  });

  it('braceless if runs its body and the sibling (condition true)', () => {
    expect(runJava(wrapMain('int x = 1; if (x > 0) x = 5; System.out.println(x);'))).toEqual(['5']);
  });

  it('parses a braceless if body as exactly one statement', () => {
    const program = parseJava(wrapMain('int x = 1; if (x > 0) x = 5; System.out.println(x);'));
    // Statements: the declaration, the if, and the println as a sibling (not absorbed).
    const body = mainBodyOf(program);
    expect(body.map((s: any) => s.type)).toEqual(['Assignment', 'If', 'Print']);
    const ifStmt = body[1] as any;
    expect(ifStmt.thenBranch.body).toHaveLength(1);
    expect(ifStmt.thenBranch.body[0].type).toBe('Assignment');
  });

  it('braceless if/else picks the right branch and keeps the sibling', () => {
    const src = wrapMain(
      'int x = -1; if (x > 0) System.out.println("pos"); else System.out.println("neg"); System.out.println("after");'
    );
    expect(runJava(src)).toEqual(['neg', 'after']);
  });

  it('braceless while body does not swallow the following statement', () => {
    expect(runJava(wrapMain('int i = 0; while (i < 3) i++; System.out.println(i);'))).toEqual([
      '3',
    ]);
  });

  it('braceless for body does not swallow the following statement', () => {
    expect(
      runJava(wrapMain('int s = 0; for (int i = 0; i < 3; i++) s += i; System.out.println(s);'))
    ).toEqual(['3']);
  });
});

describe('Java random (seeded, deterministic)', () => {
  const runJava = (src: string): string[] =>
    new Interpreter().interpret(new JavaParser(new JavaLexer(src).tokenize()).parse(), src);

  it('OOP Random.setSeed yields a deterministic sequence', () => {
    const out = runJava(`public class Main {
  public static void main(String[] args) {
    Random r = new Random();
    r.setSeed(42);
    System.out.println(r.nextInt(100));
    System.out.println(r.nextInt(100));
    System.out.println(r.nextBoolean());
  }
}`);
    expect(out).toEqual(['60', '44', 'false']);
  });

  it('Math.random() stays in [0, 1)', () => {
    const out = runJava(`public class Main {
  public static void main(String[] args) {
    double x = Math.random();
    System.out.println(x >= 0.0 && x < 1.0);
  }
}`);
    expect(out).toEqual(['true']);
  });
});
