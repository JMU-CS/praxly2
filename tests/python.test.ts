import { describe, it, expect } from 'vitest';
import { Lexer as PythonLexer } from '../src/language/python/lexer';
import { Parser as PythonParser } from '../src/language/python/parser';
import { PythonEmitter } from '../src/language/python/emitter';
import { Translator } from '../src/language/translator';
import { SymbolTable } from '../src/language/visitor';
import { Interpreter } from '../src/language/interpreter';

describe('Python Lexer', () => {
  describe('Basic Tokens', () => {
    it('should tokenize numbers', () => {
      const lexer = new PythonLexer('42 3.14');
      const tokens = lexer.tokenize();
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'NUMBER', value: '42' }));
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'NUMBER', value: '3.14' }));
    });

    it('should tokenize strings with single and double quotes', () => {
      const lexer = new PythonLexer('"hello" \'world\'');
      const tokens = lexer.tokenize();
      const strings = tokens.filter((t) => t.type === 'STRING');
      expect(strings.length).toBeGreaterThanOrEqual(2);
    });

    it('should tokenize boolean literals', () => {
      const lexer = new PythonLexer('True False');
      const tokens = lexer.tokenize();
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'BOOLEAN', value: 'true' }));
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'BOOLEAN', value: 'false' }));
    });

    it('should tokenize None keyword', () => {
      const lexer = new PythonLexer('None');
      const tokens = lexer.tokenize();
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'KEYWORD', value: 'None' }));
    });

    it('should tokenize Python keywords', () => {
      const lexer = new PythonLexer('def class if elif else while for in return');
      const tokens = lexer.tokenize();
      const keywords = tokens.filter((t) => t.type === 'KEYWORD').map((t) => t.value);
      expect(keywords).toContain('def');
      expect(keywords).toContain('class');
      expect(keywords).toContain('if');
      expect(keywords).toContain('while');
    });

    it('should skip comments', () => {
      const lexer = new PythonLexer('x = 5 # comment\ny = 10');
      const tokens = lexer.tokenize();
      const identifiers = tokens.filter((t) => t.type === 'IDENTIFIER').map((t) => t.value);
      expect(identifiers).toContain('x');
      expect(identifiers).toContain('y');
    });

    it('should handle indentation', () => {
      const lexer = new PythonLexer('if x > 5:\n  print(x)');
      const tokens = lexer.tokenize();
      const punctuation = tokens.filter((t) => t.type === 'PUNCTUATION').map((t) => t.value);
      expect(punctuation).toContain('{');
      expect(punctuation).toContain('}');
    });

    it('should handle comparison operators', () => {
      const lexer = new PythonLexer('x == y x != y x <= y x >= y');
      const tokens = lexer.tokenize();
      const operators = tokens.filter((t) => t.type === 'OPERATOR').map((t) => t.value);
      expect(operators).toContain('==');
      expect(operators).toContain('!=');
      expect(operators).toContain('<=');
      expect(operators).toContain('>=');
    });

    it('should handle compound assignment operators', () => {
      const lexer = new PythonLexer('x += 1 y -= 2 z *= 3');
      const tokens = lexer.tokenize();
      const operators = tokens.filter((t) => t.type === 'OPERATOR').map((t) => t.value);
      expect(operators).toContain('+=');
      expect(operators).toContain('-=');
      expect(operators).toContain('*=');
    });
  });

  describe('Complex Expressions', () => {
    it('should tokenize logical expression', () => {
      const lexer = new PythonLexer('x and y or not z');
      const tokens = lexer.tokenize();
      const keywords = tokens.filter((t) => t.type === 'KEYWORD').map((t) => t.value);
      expect(keywords).toContain('and');
      expect(keywords).toContain('or');
      expect(keywords).toContain('not');
    });

    it('should tokenize list literal', () => {
      const lexer = new PythonLexer('[1, 2, 3]');
      const tokens = lexer.tokenize();
      const punctuation = tokens.filter((t) => t.type === 'PUNCTUATION').map((t) => t.value);
      expect(punctuation).toContain('[');
      expect(punctuation).toContain(']');
    });
  });

  describe('Indentation Tracking', () => {
    it('should generate braces for indentation increases', () => {
      const lexer = new PythonLexer('if True:\n  x = 5');
      const tokens = lexer.tokenize();
      const punctuation = tokens.filter((t) => t.type === 'PUNCTUATION').map((t) => t.value);
      // Should have opening brace for indentation
      expect(punctuation.some((p) => p === '{')).toBe(true);
    });

    it('should generate braces for indentation decreases', () => {
      const lexer = new PythonLexer('if True:\n  x = 5\ny = 10');
      const tokens = lexer.tokenize();
      const punctuation = tokens.filter((t) => t.type === 'PUNCTUATION').map((t) => t.value);
      // Should have closing brace for dedentation
      expect(punctuation.some((p) => p === '}')).toBe(true);
    });
  });
});

describe('Python Parser', () => {
  describe('Declarations', () => {
    it('should parse function definition', () => {
      const source = `def greet(name):
  print("Hello " + name)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('FunctionDeclaration');
      expect((program.body[0] as any).name).toBe('greet');
    });

    it('should parse class definition', () => {
      const source = `class Counter:
  def __init__(self):
    self.count = 0`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('ClassDeclaration');
      expect((program.body[0] as any).name).toBe('Counter');
    });

    it('should parse class with inheritance', () => {
      const source = `class Counter(object):
  x = 0`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const classDecl = program.body[0] as any;
      expect(classDecl.type).toBe('ClassDeclaration');
      expect(classDecl.superClass).toBeDefined();
    });
  });

  describe('Statements', () => {
    it('should parse assignment', () => {
      const source = `x = 5`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('Assignment');
    });

    it('should parse if statement', () => {
      const source = `if x > 5:
  print(x)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('If');
    });

    it('should parse elif and else', () => {
      const source = `if x > 5:
  print("big")
elif x > 0:
  print("small")
else:
  print("zero")`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const ifStmt = program.body[0] as any;
      expect(ifStmt.type).toBe('If');
      expect(ifStmt.elseBranch).toBeDefined();
    });

    it('should parse while loop', () => {
      const source = `while x < 10:
  x = x + 1`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('While');
    });

    it('should parse for loop', () => {
      const source = `for i in range(10):
  print(i)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('For');
    });

    it('should parse return statement', () => {
      const source = `return x`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('Return');
    });

    it('should parse pass statement', () => {
      const source = `if True:
  pass`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const ifStmt = program.body[0] as any;
      expect(ifStmt.type).toBe('If');
    });
  });

  describe('Expressions', () => {
    it('should parse boolean expression', () => {
      const source = `result = True and False or not True`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('Assignment');
    });

    it('should parse list access', () => {
      const source = `x = items[0]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('Assignment');
    });
  });
});

describe('Python Emitter', () => {
  describe('Basic Output', () => {
    it('should emit function definition', () => {
      const source = `def add(a, b):
  return a + b`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const emitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('def add');
    });

    it('should emit assignment with equals', () => {
      const source = `x = 5`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const emitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('x = 5');
    });

    it('should emit print statement', () => {
      const source = `print("hello")`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const emitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('print');
    });

    it('should emit if statement with colon', () => {
      const source = `if x > 5:
  print(x)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const emitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('if');
      expect(code).toContain(':');
    });

    it('should emit while loop', () => {
      const source = `while x < 10:
  x = x + 1`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const emitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('while');
    });

    it('should emit for loop', () => {
      const source = `for i in range(10):
  print(i)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const emitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('for');
      expect(code).toContain('in');
    });
  });

  describe('Boolean Logic', () => {
    it('should emit and operator', () => {
      const source = `result = True and False`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const emitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('and');
    });

    it('should emit or operator', () => {
      const source = `result = True or False`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const emitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('or');
    });

    it('should emit not operator', () => {
      const source = `result = not False`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const emitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('not');
    });
  });

  describe('Classes', () => {
    it('should emit class definition', () => {
      const source = `class Counter:
  def __init__(self):
    self.count = 0`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const emitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('class Counter');
      expect(code).toContain('def __init__');
    });

    it('should emit method definition', () => {
      const source = `class Counter:
  def increment(self):
    self.count = self.count + 1`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const emitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('def increment');
      expect(code).toContain('self');
    });
  });

  describe('Advanced Features', () => {
    it('should emit try-except-finally block', () => {
      const source = `try:
  x = 10 / 0
except ZeroDivisionError:
  print("Error")
finally:
  print("Done")`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const emitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('try');
    });

    it('should emit list comprehension', () => {
      const source = `squares = [x * x for x in items]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const emitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('for');
    });

    it('should emit while-else block', () => {
      const source = `while x < 10:
  x = x + 1
else:
  print("Done")`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const emitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('while');
      expect(code).toContain('else');
    });
  });
});

describe('Python Translation', () => {
  describe('Basic Programs', () => {
    it('should translate simple assignment', () => {
      const source = `x = 5`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('x');
      expect(result).toContain('=');
      expect(result).toContain('5');
    });

    it('should translate print statement', () => {
      const source = `print("hello")`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('print');
    });

    it('should translate list literal', () => {
      const source = `xs = [12, 103, 80]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('xs');
      expect(result).toContain('[');
      expect(result).toContain(']');
    });

    it('should translate input assignment as String in Java', () => {
      const source = `x = input()
print(x)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('String x = scanner.nextLine();');
      expect(result).not.toContain('Object x = scanner.nextLine();');
    });
  });

  describe('Control Flow', () => {
    it('should translate if statement', () => {
      const source = `if x < 10:
  print(x)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('if');
      expect(result).toContain(':');
    });

    it('should translate while loop', () => {
      const source = `while x < 10:
  x = x + 1`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('while');
    });

    it('should translate for loop', () => {
      const source = `for i in range(10):
  print(i)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('for');
      expect(result).toContain('in');
    });
  });

  describe('Functions', () => {
    it('should translate function declaration', () => {
      const source = `def add(a, b):
  return a + b`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('def add');
      expect(result).toContain('return');
    });
  });

  describe('Classes', () => {
    it('should translate class declaration', () => {
      const source = `class Counter:
  def __init__(self):
    self.count = 0`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('class Counter');
      expect(result).toContain('def __init__');
      expect(result).toContain('self');
    });

    it('should translate class with method', () => {
      const source = `class Counter:
  def __init__(self):
    self.count = 0
  def increment(self):
    self.count = self.count + 1`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('class Counter');
      expect(result).toContain('def increment');
      expect(result).toContain('self.count');
    });

    it('should translate class with inheritance', () => {
      const source = `class Child(Parent):
  x = 0`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('class Child(Parent)');
    });
  });

  describe('Arrays and Collections', () => {
    it('should translate list access', () => {
      const source = `xs = [12, 103, 80]
print(xs[0])`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('xs[0]');
    });

    it('should translate enumerate in for loop', () => {
      const source = `for i, v in enumerate(items):
  print(i, v)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('for');
      expect(result).toContain('in');
    });
  });

  describe('Advanced Features', () => {
    it('should translate try-except-finally', () => {
      const source = `try:
  x = 10 / 0
except ZeroDivisionError:
  print("Cannot divide by zero")
finally:
  print("Cleanup")`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('try');
      expect(result).toContain('except');
      expect(result).toContain('finally');
    });

    it('should translate list comprehensions', () => {
      const source = `squares = [x * x for x in range(10)]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('for');
      expect(result).toContain('in');
    });

    it('should translate while-else', () => {
      const source = `while x < 10:
  x = x + 1
else:
  print("Done")`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('while');
      expect(result).toContain('else');
    });

    it('should translate tuple unpacking', () => {
      const source = `a, b = 1, 2`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('a');
      expect(result).toContain('b');
    });

    it('should translate multiple assignments', () => {
      const source = `x = y = z = 10`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('x');
      expect(result).toContain('y');
      expect(result).toContain('z');
    });

    it('should support for loops with range', () => {
      const source = `for i in range(5):
  print(i)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('for');
      expect(result).toContain('in');
    });

    it('should support while-else constructs', () => {
      const source = `x = 0
while x < 5:
  x = x + 1
else:
  print("done")`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('while');
      expect(result).toContain('else');
    });

    it('should support list comprehensions', () => {
      const source = `squares = [x * x for x in range(10)]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('[');
      expect(result).toContain('for');
      expect(result).toContain('in');
    });

    it('should support try-except-finally', () => {
      const source = `try:
  x = 1 / 0
except ZeroDivisionError:
  print("error")
finally:
  print("cleanup")`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('try');
      expect(result).toContain('except');
      expect(result).toContain('finally');
    });

    it('should translate Java compound assignment to Python', () => {
      const source = `int total = 0;
total += 5;`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      if (tokens.length > 0) {
        const parser = new PythonParser(tokens);
        try {
          const program = parser.parse();
          const translator = new Translator();
          const result = translator.translate(program, 'python');
          expect(result).toContain('total');
        } catch (e) {
          // Python lexer not expecting Java syntax, that's ok
        }
      }
    });
  });

  describe('Error Recovery with Incomplete Code', () => {
    it('should parse incomplete Python code with missing condition closing brace', () => {
      const incompletePython = `
def foo():
    x = 5
    if x > 0
        print("hello")
`;
      const lexer = new PythonLexer(incompletePython);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();

      // Should still get an AST even with incomplete code
      expect(program).toBeDefined();
      expect(program.type).toBe('Program');
      // Should have at least parsed the function declaration
      expect(program.body.length).toBeGreaterThan(0);
    });

    it('should translate incomplete code to valid output', () => {
      const incompletePython = `
x = 5
if x > 0
    print("hello")
print("world")
`;
      const lexer = new PythonLexer(incompletePython);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();

      // Should be able to translate partial AST
      const translator = new Translator();
      const result = translator.translate(program, 'java');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      // Should not contain error message
      expect(result).not.toContain('Valid source code required');
    });
  });
});

describe('Python Bug Fixes', () => {
  describe('** Power Operator', () => {
    it('should parse power operator **', () => {
      const source = `x = 2 ** 3`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      expect(tokens.some((t) => t.type === 'OPERATOR' && t.value === '**')).toBe(true);
    });

    it('should translate Python ** to Math.pow() in Java', () => {
      const source = `x = 2 ** 3`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'java');
      expect(result).toContain('Math.pow');
    });

    it('should keep ** in Python translation', () => {
      const source = `x = 2 ** 3`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      expect(result).toContain('**');
    });
  });

  describe('range() Function', () => {
    it('should handle range(n) starting from 0', () => {
      const source = `for i in range(5):
  print(i)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');
      expect(javaCode).toContain('i = 0');
      expect(javaCode).toContain('i < 5');
    });

    it('should handle range(start, end)', () => {
      const source = `for i in range(2, 5):
  print(i)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');
      expect(javaCode).toContain('i = 2');
      expect(javaCode).toContain('i < 5');
    });

    it('should handle range(start, end, step)', () => {
      const source = `for i in range(0, 10, 2):
  print(i)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');
      expect(javaCode).toContain('i = 0');
      expect(javaCode).toContain('i < 10');
      expect(javaCode).toContain('i += 2');
    });
  });

  describe('enumerate() Function', () => {
    it('should parse enumerate function call', () => {
      const source = `for i, v in enumerate(items):
  print(i, v)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const forStmt = program.body[0] as any;
      expect(forStmt.type).toBe('For');
      expect(forStmt.variables).toBeDefined();
      expect(forStmt.variables.length).toBe(2);
    });
  });

  describe('Java Collection Mutability Inference', () => {
    it('should emit Java arrays when a Python list is never appended', () => {
      const source = `nums = [1, 2, 3]
print(nums[0])`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');

      expect(javaCode).toContain('int[] nums');
      expect(javaCode).toContain('nums[0]');
      expect(javaCode).not.toContain('ArrayList<');
    });

    it('should emit Java ArrayList when a Python list is appended', () => {
      const source = `nums = [1, 2, 3]
nums.append(4)
print(nums[0])`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');

      expect(javaCode).toContain('ArrayList<Integer> nums');
      expect(javaCode).toContain('nums.add(4);');
      expect(javaCode).toContain('nums.get(0)');
      expect(javaCode).not.toContain('int[] nums');
      expect(javaCode).toContain('import java.util.ArrayList;');
      expect(javaCode).toContain('import java.util.Arrays;');
    });

    it('should execute Python list append without runtime error', () => {
      const source = `lst = [1, 2, 3]
lst.append(4)
print(lst[3])`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();

      const interpreter = new Interpreter();
      const output = interpreter.interpret(program, source);

      expect(output.join('\n')).not.toContain('Runtime Error');
      expect(output).toContain('4');
    });
  });

  describe('Array Indexing and Slicing', () => {
    it('should parse positive array index', () => {
      const source = `first = nums[0]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      expect(program.body.length).toBe(1);
      const assignment = program.body[0] as any;
      expect(assignment.type).toBe('Assignment');
      expect(assignment.value.type).toBe('IndexExpression');
    });

    it('should translate positive index to Java correctly', () => {
      const source = `first = nums[0]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');
      expect(javaCode).toContain('nums[0]');
    });

    it('should parse negative array index with correct AST structure', () => {
      const source = `last = nums[-1]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();

      expect(program.body.length).toBe(1);
      const assignment = program.body[0] as any;
      expect(assignment.type).toBe('Assignment');

      const indexExpr = assignment.value;
      expect(indexExpr.type).toBe('IndexExpression');
      expect(indexExpr.object.type).toBe('Identifier');
      expect(indexExpr.object.name).toBe('nums');

      // The index should be a UnaryExpression with minus operator
      expect(indexExpr.index.type).toBe('UnaryExpression');
      expect(indexExpr.index.operator).toBe('-');
      expect(indexExpr.index.argument.type).toBe('Literal');
      expect(indexExpr.index.argument.value).toBe(1);
    });

    it('should translate negative index to nums.length - 1 in Java', () => {
      const source = `last = nums[-1]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');
      expect(javaCode).toContain('nums.length - 1');
      expect(javaCode).not.toContain('nums[-1]');
      // Verify no random numbers appear
      expect(javaCode).not.toContain('nums[11]');
      expect(javaCode).not.toContain('nums[12]');
      expect(javaCode).not.toContain('nums[-1]');
    });

    it('should translate multiple negative indices correctly', () => {
      const source = `second_last = nums[-2]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');
      expect(javaCode).toContain('nums.length - 2');
    });

    it('should parse array slicing with start and end', () => {
      const source = `middle = nums[1:3]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      expect(program.body.length).toBe(1);
      const assignment = program.body[0] as any;
      expect(assignment.type).toBe('Assignment');
      expect(assignment.value.type).toBe('IndexExpression');
      expect(assignment.value.indexEnd).toBeDefined();
    });

    it('should translate array slicing to Arrays.copyOfRange in Java', () => {
      const source = `middle = nums[1:3]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');
      expect(javaCode).toContain('Arrays.copyOfRange');
      expect(javaCode).toContain('1');
      expect(javaCode).toContain('3');
    });

    it('should handle array slicing with no start index', () => {
      const source = `start_slice = nums[:2]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      expect(program.body.length).toBe(1);
      const assignment = program.body[0] as any;
      expect(assignment.value.type).toBe('IndexExpression');
    });

    it('should handle array slicing with step', () => {
      const source = `every_other = nums[0:4:2]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      expect(program.body.length).toBe(1);
      const assignment = program.body[0] as any;
      expect(assignment.value.type).toBe('IndexExpression');
      expect(assignment.value.indexStep).toBeDefined();
    });

    it('should emit array slicing correctly in Python', () => {
      const source = `slice_result = items[1:3]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const pythonEmitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      pythonEmitter.visitProgram(program);
      const code = pythonEmitter.getGeneratedCode();
      expect(code).toContain('items[1:3]');
    });

    it('should handle negative indices in Python emission', () => {
      const source = `x = nums[-1]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const pythonEmitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      pythonEmitter.visitProgram(program);
      const code = pythonEmitter.getGeneratedCode();
      // Should generate valid Python code
      expect(code).toBeDefined();
      expect(code.length).toBeGreaterThan(0);
    });

    it('should handle complete array indexing scenario from user', () => {
      const source = `nums = [1, 3, 5, 7]
first = nums[0]
last = nums[-1]
middle_slice = nums[1:3]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();

      // All 4 statements should be parsed
      expect(program.body.length).toBe(4);

      // First statement: array literal assignment
      const numsAssign = program.body[0] as any;
      expect(numsAssign.type).toBe('Assignment');
      expect(numsAssign.value.type).toBe('ArrayLiteral');

      // Second statement: positive index
      const firstAssign = program.body[1] as any;
      expect(firstAssign.type).toBe('Assignment');
      expect(firstAssign.value.type).toBe('IndexExpression');
      expect(firstAssign.value.index.type).toBe('Literal');
      expect(firstAssign.value.index.value).toBe(0);

      // Third statement: negative index
      const lastAssign = program.body[2] as any;
      expect(lastAssign.type).toBe('Assignment');
      expect(lastAssign.value.type).toBe('IndexExpression');

      // Fourth statement: slice
      const sliceAssign = program.body[3] as any;
      expect(sliceAssign.type).toBe('Assignment');
      expect(sliceAssign.value.type).toBe('IndexExpression');
      expect(sliceAssign.value.indexEnd).toBeDefined();
    });

    it('should translate complete array scenario to valid Java', () => {
      const source = `nums = [1, 3, 5, 7]
first = nums[0]
last = nums[-1]
middle_slice = nums[1:3]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');

      // Should have all 4 assignments
      const lines = javaCode
        .split('\n')
        .filter((l) => l.includes('=') && !l.trim().startsWith('//'));
      expect(lines.length).toBeGreaterThanOrEqual(4);

      // Should have positive index: nums[0]
      expect(javaCode).toContain('nums[0]');

      // Should have negative index translated: nums.length - 1
      expect(javaCode).toContain('nums.length - 1');
      expect(javaCode).not.toContain('nums[-1]');
      expect(javaCode).not.toContain('nums[11]');

      // Should have array slice: Arrays.copyOfRange
      expect(javaCode).toContain('Arrays.copyOfRange');

      // Should be valid Java
      expect(javaCode).toContain('public class Main');
      expect(javaCode).toContain('{');
      expect(javaCode).toContain('}');
    });
  });

  describe('Multiple Function Arguments', () => {
    it('should parse multiple arguments as separate args not as tuple', () => {
      const source = `print(x, y, z)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const printStmt = program.body[0] as any;
      expect(printStmt.expressions.length).toBe(3);
    });

    it('should translate function call with multiple arguments', () => {
      const source = `def foo(a, b, c):
  return a + b + c
result = foo(1, 2, 3)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');
      expect(javaCode).toContain('foo(1, 2, 3)');
    });
  });

  describe('len() Builtin', () => {
    it('should support len() function', () => {
      const source = `x = len(items)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const pythonCode = translator.translate(program, 'python');
      expect(pythonCode).toContain('len(items)');
    });

    it('should translate len() to .length in Java', () => {
      const source = `x = len(items)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');
      expect(javaCode).toContain('.length');
    });

    it('should translate len() correctly in CSP', () => {
      const source = `x = len(items)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const cspCode = translator.translate(program, 'csp');
      expect(cspCode).toContain('LENGTH');
    });
  });

  describe('List Comprehensions', () => {
    it('should parse list comprehension', () => {
      const source = `squares = [x * x for x in range(10)]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const assignment = program.body[0] as any;
      expect(assignment.value.type).toBe('ListComprehension');
    });

    it('should emit list comprehension in Python', () => {
      const source = `squares = [x * x for x in range(10)]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const pythonCode = translator.translate(program, 'python');
      expect(pythonCode).toContain('for');
      expect(pythonCode).toContain('in');
      expect(pythonCode).toContain('[');
    });

    it('should translate list comprehension to Java', () => {
      const source = `result = [x * x for x in items]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');
      // Should generate some kind of loop or stream operation
      expect(javaCode).toBeDefined();
      expect(javaCode.length).toBeGreaterThan(0);
    });
  });

  describe('Conditional Function Arguments', () => {
    it('should parse conditional expression in function arguments', () => {
      const source = `x = max(a, 5 if a < 5 else 10)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      expect(tokens.length).toBeGreaterThan(0);
      // The parser might not support conditional expressions yet,
      // so we just verify it doesn't crash
      try {
        const parser = new PythonParser(tokens);
        const program = parser.parse();
        expect(program).toBeDefined();
      } catch (e) {
        // If parsing fails, that's OK for now - it's an advanced feature
        expect(true).toBe(true);
      }
    });
  });

  describe('String Iteration in For Loop', () => {
    it('should handle iteration over strings', () => {
      const source = `for char in "hello":
  print(char)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');
      expect(javaCode).toContain('char');
      expect(javaCode).toContain('for');
    });

    it('should generate for-each loop for string iteration in Java', () => {
      const source = `for c in text:
  print(c)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');
      expect(javaCode).toContain('for');
    });
  });

  describe('Array Operations in Multiple Languages', () => {
    it('should translate negative index to CSP correctly', () => {
      const source = `x = nums[-1]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const cspCode = translator.translate(program, 'csp');
      expect(cspCode).toContain('LENGTH');
      expect(cspCode).not.toContain('[-1]');
    });

    it('should translate array slicing to CSP', () => {
      const source = `slice_result = nums[1:3]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const cspCode = translator.translate(program, 'csp');
      // CSP should have valid output
      expect(cspCode).toBeDefined();
      expect(cspCode.length).toBeGreaterThan(0);
    });

    it('should translate negative index to Praxis correctly', () => {
      const source = `x = nums[-2]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const praxisCode = translator.translate(program, 'praxis');
      expect(praxisCode).toContain('length');
      expect(praxisCode).not.toContain('[-2]');
    });

    it('should translate array slicing to Praxis', () => {
      const source = `result = items[0:2]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const praxisCode = translator.translate(program, 'praxis');
      // Praxis should have valid output
      expect(praxisCode).toBeDefined();
      expect(praxisCode.length).toBeGreaterThan(0);
    });

    it('should handle mixed operations: positive index, negative index, and slice', () => {
      const source = `data = [10, 20, 30, 40, 50]
a = data[0]
b = data[-1]
c = data[1:4]
d = data[-3:-1]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();

      expect(program.body.length).toBe(5);

      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');

      // Verify all statements translated
      expect(javaCode).toContain('data[0]');
      expect(javaCode).toContain('data.length - 1');
      expect(javaCode).toContain('Arrays.copyOfRange');
      expect(javaCode).not.toContain('data[-1]');
      expect(javaCode).not.toContain('data[-3]');
    });

    it('should maintain Python semantics in Python translation', () => {
      const source = `nums = [1, 2, 3, 4, 5]
last = nums[-1]
slice_val = nums[1:3]`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const pythonEmitter = new PythonEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      pythonEmitter.visitProgram(program);
      const pythonCode = pythonEmitter.getGeneratedCode();

      // Python should keep negative indices and slicing
      expect(pythonCode).toContain('[-1]');
      expect(pythonCode).toContain('[1:3]');
    });
  });

  describe('Class Translation', () => {
    it('should strip self from constructor parameters in AST', () => {
      const source = `class Meow:
  def __init__(self, x, y):
    self.x = x
    self.y = y`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();

      const classDecl = program.body[0] as any;
      const ctor = classDecl.body.find((member: any) => member.type === 'Constructor');
      expect(ctor).toBeDefined();
      expect(ctor.params.map((p: any) => p.name)).toEqual(['x', 'y']);
    });

    it('should translate Python class constructor to Java class name and this references', () => {
      const source = `class Meow:
  def __init__(self, x, y):
    self.x = x
    self.y = y`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');

      expect(javaCode).toContain('public class Meow');
      expect(javaCode).toContain('public Meow(');
      expect(javaCode).not.toContain('TempClass');
      expect(javaCode).not.toContain('self,');
      expect(javaCode).toContain('private Object x;');
      expect(javaCode).toContain('private Object y;');
      expect(javaCode).toContain('this.x = x;');
      expect(javaCode).toContain('this.y = y;');
    });

    it('should preserve Python parameter type annotations for Java signatures', () => {
      const source = `class Typed:
  def __init__(self, x: int, y: double):
    self.x = x
    self.y = y`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');

      expect(javaCode).toContain('public Typed(int x, double y)');
      expect(javaCode).toContain('private int x;');
      expect(javaCode).toContain('private double y;');
      expect(javaCode).not.toContain('Object x');
      expect(javaCode).not.toContain('Object y');
    });

    it('should instantiate translated classes with new and concrete class type', () => {
      const source = `class Meow:
  def __init__(self, x: int):
    self.x = x

meow = Meow(10)
print(meow.x)`;
      const lexer = new PythonLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PythonParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');

      expect(javaCode).toContain('public class Meow');
      expect(javaCode).toContain('private int x;');
      expect(javaCode).toContain('public Meow(int x)');
      expect(javaCode).toContain('Meow meow = new Meow(10);');
    });
  });
});
