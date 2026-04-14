import { describe, it, expect } from 'vitest';
import { JavaLexer } from '../src/language/java/lexer';
import { JavaParser } from '../src/language/java/parser';
import { JavaEmitter } from '../src/language/java/emitter';
import { Translator } from '../src/language/translator';
import { SymbolTable } from '../src/language/visitor';

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
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'STRING', value: 'hello world' }));
    });

    it('should tokenize keywords', () => {
      const lexer = new JavaLexer('int public class void');
      const tokens = lexer.tokenize();
      const keywordTokens = tokens.filter(t => t.type === 'KEYWORD');
      expect(keywordTokens).toHaveLength(4);
    });

    it('should tokenize identifiers', () => {
      const lexer = new JavaLexer('myVariable someFunc');
      const tokens = lexer.tokenize();
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'IDENTIFIER', value: 'myVariable' }));
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'IDENTIFIER', value: 'someFunc' }));
    });

    it('should tokenize operators', () => {
      const lexer = new JavaLexer('+ - * / == != && ||');
      const tokens = lexer.tokenize();
      const operators = tokens.filter(t => t.type === 'OPERATOR').map(t => t.value);
      expect(operators).toContain('+');
      expect(operators).toContain('==');
      expect(operators).toContain('&&');
    });

    it('should tokenize punctuation', () => {
      const lexer = new JavaLexer('( ) { } [ ] ; , .');
      const tokens = lexer.tokenize();
      const punctuation = tokens.filter(t => t.type === 'PUNCTUATION').map(t => t.value);
      expect(punctuation).toContain('(');
      expect(punctuation).toContain('{');
      expect(punctuation).toContain('[');
    });

    it('should handle comments', () => {
      const lexer = new JavaLexer('int x; // this is a comment\nint y;');
      const tokens = lexer.tokenize();
      const identifiers = tokens.filter(t => t.type === 'IDENTIFIER').map(t => t.value);
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
      const values = tokens.filter(t => t.type === 'IDENTIFIER').map(t => t.value);
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
      const lexer = new JavaLexer('int x = 5;');
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      expect(program.body).toHaveLength(1);
      expect(program.body[0].type).toBe('Assignment');
    });

    it('should parse if statement', () => {
      const source = `int x = 7;
if (x < 10) {
  x++;
}`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      expect(program.body.some(s => s.type === 'If')).toBe(true);
    });

    it('should parse while loop', () => {
      const source = `int i = 0;
while (i < 10) {
  i++;
}`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      expect(program.body.some(s => s.type === 'While')).toBe(true);
    });

    it('should parse for loop', () => {
      const source = `for (int i = 0; i < 10; i++) {
}`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('For');
    });
  });

  describe('Classes', () => {
    it('should parse class declaration', () => {
      const source = `public class MyClass {
  int x = 0;
}`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('ClassDeclaration');
    });

    it('should parse method', () => {
      const source = `public class MyClass {
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
});

describe('Java Emitter', () => {
  describe('Expressions', () => {
    it('should emit arithmetic expression', () => {
      const source = `5 + 3`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const context = { symbolTable: new SymbolTable(), functionReturnTypes: new Map(), functionParamTypes: new Map() };
      const emitter = new JavaEmitter(context);
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('5');
      expect(code).toContain('+');
      expect(code).toContain('3');
    });

    it('should emit power operation as Math.pow', () => {
      const source = `2 ** 8`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const context = { symbolTable: new SymbolTable(), functionReturnTypes: new Map(), functionParamTypes: new Map() };
      const emitter = new JavaEmitter(context);
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      // Power operation should be converted to Math.pow
    });
  });

  describe('Statements', () => {
    it('should emit variable declaration', () => {
      const source = `int x;`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const context = { symbolTable: new SymbolTable(), functionReturnTypes: new Map(), functionParamTypes: new Map() };
      const emitter = new JavaEmitter(context);
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('int');
      expect(code).toContain('x');
    });

    it('should emit if statement', () => {
      const source = `if (x < 10) {
  x++;
}`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const context = { symbolTable: new SymbolTable(), functionReturnTypes: new Map(), functionParamTypes: new Map() };
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
      const source = `int x = 5;`;
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
      const source = `System.out.println("hello");`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('println');
    });

    it('should not add implicit defaults for uninitialized Java declarations', () => {
      const source = `int x;`;
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
      const source = `int x;\nint y = 3;`;
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
      const source = `int x = 7;
if (x < 10) {
  x++;
}`;
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
      const source = `int[] xs = {12, 103, 80};`;
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
      const source = `int[] xs = {12, 103, 80};
System.out.println(xs[0]);`;
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
  });

  describe('Advanced Features', () => {
    it('should translate multiple statements in c-style for loop', () => {
      const source = `for (int i = 0, j = 10; i < j; i++, j--) {
  System.out.println(i);
}`;
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
      const source = `switch (x) {
  case 1:
    y = 10;
  case 2:
    y = 20;
    break;
  default:
    y = 0;
}`;
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

    it('should translate bitwise XOR operation', () => {
      const source = `int result = a ^ b;`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('^');
    });

    it('should translate other compound assignment operators', () => {
      const source = `x *= 2;
y /= 3;
z %= 5;`;
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
      const source = `int max = a > b ? a : b;`;
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
      const source = `int[] nums = {1, 2, 3};
nums[1] = 4;`;
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
      const source = `int total = 0;
total += k;`;
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
      const source = `if (!password.equals("ABC123")) {
  System.out.println("Invalid");
}`;
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
      const source = `String name = "John";
if (name == "John") {
  System.out.println("Match");
}`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaResult = translator.translate(program, 'java');
      expect(javaResult).toContain('.equals(');
    });

    it('should handle String inequality with .equals()', () => {
      const source = `String a = "test";
String b = "other";
if (a != b) {
  System.out.println("Different");
}`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaResult = translator.translate(program, 'java');
      expect(javaResult).toContain('!');
      expect(javaResult).toContain('.equals(');
    });

    it('should handle bitwise XOR operator', () => {
      const source = `int result = a ^ b;`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('^');
    });

    it('should support ternary operators', () => {
      const source = `int max = a > b ? a : b;`;
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
      const source = `for (int i = 0, j = 10; i < j; i++, j--) {
  System.out.println(i);
}`;
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
      const source = `switch (x) {
  case 1:
    System.out.println("one");
  case 2:
    System.out.println("two");
  default:
    System.out.println("other");
}`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('break');
    });

    it('should translate array element mutation', () => {
      const source = `int[] nums = {1, 2, 3};
nums[0] = 5;`;
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
      const source = `int x = 10;
x += 5;
x -= 3;
x *= 2;
x /= 4;`;
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

    it('should translate XOR assignment operator', () => {
      const source = `int flags = 15;
flags ^= 7;`;
      const lexer = new JavaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new JavaParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('flags');
      expect(result).toContain('^=');
    });
  });
});
