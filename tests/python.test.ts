import { describe, it, expect } from 'vitest';
import { Lexer as PythonLexer } from '../src/language/python/lexer';
import { Parser as PythonParser } from '../src/language/python/parser';
import { PythonEmitter } from '../src/language/python/emitter';
import { Translator } from '../src/language/translator';
import { SymbolTable } from '../src/language/visitor';

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
      const strings = tokens.filter(t => t.type === 'STRING');
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
      const keywords = tokens.filter(t => t.type === 'KEYWORD').map(t => t.value);
      expect(keywords).toContain('def');
      expect(keywords).toContain('class');
      expect(keywords).toContain('if');
      expect(keywords).toContain('while');
    });

    it('should skip comments', () => {
      const lexer = new PythonLexer('x = 5 # comment\ny = 10');
      const tokens = lexer.tokenize();
      const identifiers = tokens.filter(t => t.type === 'IDENTIFIER').map(t => t.value);
      expect(identifiers).toContain('x');
      expect(identifiers).toContain('y');
    });

    it('should handle indentation', () => {
      const lexer = new PythonLexer('if x > 5:\n  print(x)');
      const tokens = lexer.tokenize();
      const punctuation = tokens.filter(t => t.type === 'PUNCTUATION').map(t => t.value);
      expect(punctuation).toContain('{');
      expect(punctuation).toContain('}');
    });

    it('should handle comparison operators', () => {
      const lexer = new PythonLexer('x == y x != y x <= y x >= y');
      const tokens = lexer.tokenize();
      const operators = tokens.filter(t => t.type === 'OPERATOR').map(t => t.value);
      expect(operators).toContain('==');
      expect(operators).toContain('!=');
      expect(operators).toContain('<=');
      expect(operators).toContain('>=');
    });

    it('should handle compound assignment operators', () => {
      const lexer = new PythonLexer('x += 1 y -= 2 z *= 3');
      const tokens = lexer.tokenize();
      const operators = tokens.filter(t => t.type === 'OPERATOR').map(t => t.value);
      expect(operators).toContain('+=');
      expect(operators).toContain('-=');
      expect(operators).toContain('*=');
    });
  });

  describe('Complex Expressions', () => {
    it('should tokenize logical expression', () => {
      const lexer = new PythonLexer('x and y or not z');
      const tokens = lexer.tokenize();
      const keywords = tokens.filter(t => t.type === 'KEYWORD').map(t => t.value);
      expect(keywords).toContain('and');
      expect(keywords).toContain('or');
      expect(keywords).toContain('not');
    });

    it('should tokenize list literal', () => {
      const lexer = new PythonLexer('[1, 2, 3]');
      const tokens = lexer.tokenize();
      const punctuation = tokens.filter(t => t.type === 'PUNCTUATION').map(t => t.value);
      expect(punctuation).toContain('[');
      expect(punctuation).toContain(']');
    });
  });

  describe('Indentation Tracking', () => {
    it('should generate braces for indentation increases', () => {
      const lexer = new PythonLexer('if True:\n  x = 5');
      const tokens = lexer.tokenize();
      const punctuation = tokens.filter(t => t.type === 'PUNCTUATION').map(t => t.value);
      // Should have opening brace for indentation
      expect(punctuation.some(p => p === '{')).toBe(true);
    });

    it('should generate braces for indentation decreases', () => {
      const lexer = new PythonLexer('if True:\n  x = 5\ny = 10');
      const tokens = lexer.tokenize();
      const punctuation = tokens.filter(t => t.type === 'PUNCTUATION').map(t => t.value);
      // Should have closing brace for dedentation
      expect(punctuation.some(p => p === '}')).toBe(true);
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
        functionParamTypes: new Map() 
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
        functionParamTypes: new Map() 
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
        functionParamTypes: new Map() 
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
        functionParamTypes: new Map() 
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
        functionParamTypes: new Map() 
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
        functionParamTypes: new Map() 
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
        functionParamTypes: new Map() 
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
        functionParamTypes: new Map() 
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
        functionParamTypes: new Map() 
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
        functionParamTypes: new Map() 
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
        functionParamTypes: new Map() 
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('def increment');
      expect(code).toContain('self');
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
});
