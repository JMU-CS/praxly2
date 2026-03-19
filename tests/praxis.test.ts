import { describe, it, expect } from 'vitest';
import { PraxisLexer } from '../src/language/praxis/lexer';
import { PraxisParser } from '../src/language/praxis/parser';
import { PraxisEmitter } from '../src/language/praxis/emitter';
import { Translator } from '../src/language/translator';
import { SymbolTable } from '../src/language/visitor';

describe('Praxis Lexer', () => {
  describe('Basic Tokens', () => {
    it('should tokenize numbers', () => {
      const lexer = new PraxisLexer('42 3.14');
      const tokens = lexer.tokenize();
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'NUMBER', value: '42' }));
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'NUMBER', value: '3.14' }));
    });

    it('should tokenize strings with quotes', () => {
      const lexer = new PraxisLexer('"hello" \'world\'');
      const tokens = lexer.tokenize();
      const strings = tokens.filter(t => t.type === 'STRING');
      expect(strings).toHaveLength(2);
      expect(strings[0].value).toBe('hello');
      expect(strings[1].value).toBe('world');
    });

    it('should tokenize boolean literals', () => {
      const lexer = new PraxisLexer('true false');
      const tokens = lexer.tokenize();
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'BOOLEAN', value: 'true' }));
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'BOOLEAN', value: 'false' }));
    });

    it('should tokenize keywords', () => {
      const lexer = new PraxisLexer('if else while for class');
      const tokens = lexer.tokenize();
      const keywords = tokens.filter(t => t.type === 'KEYWORD');
      expect(keywords.length).toBeGreaterThanOrEqual(5);
    });

    it('should tokenize assignment operator', () => {
      const lexer = new PraxisLexer('x <- 5');
      const tokens = lexer.tokenize();
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'OPERATOR', value: '<-' }));
    });

    it('should tokenize comparison operators', () => {
      const lexer = new PraxisLexer('x <> y x <= y x >= y');
      const tokens = lexer.tokenize();
      const operators = tokens.filter(t => t.type === 'OPERATOR').map(t => t.value);
      expect(operators).toContain('<>');
      expect(operators).toContain('<=');
      expect(operators).toContain('>=');
    });

    it('should skip comments', () => {
      const lexer = new PraxisLexer('int x // comment\nint y');
      const tokens = lexer.tokenize();
      const identifiers = tokens.filter(t => t.type === 'IDENTIFIER').map(t => t.value);
      expect(identifiers).toContain('x');
      expect(identifiers).toContain('y');
    });

    it('should handle block comments', () => {
      const lexer = new PraxisLexer('int x /* comment */ int y');
      const tokens = lexer.tokenize();
      const identifiers = tokens.filter(t => t.type === 'IDENTIFIER').map(t => t.value);
      expect(identifiers).toEqual(['x', 'y']);
    });

    it('should tokenize unicode math operators', () => {
      const lexer = new PraxisLexer('x ← 5');
      const tokens = lexer.tokenize();
      const operators = tokens.filter(t => t.type === 'OPERATOR' || t.type === 'KEYWORD');
      expect(operators.some(t => ['<-', '←'].includes(t.value))).toBe(true);
    });
  });

  describe('Complex Expressions', () => {
    it('should tokenize arithmetic expression', () => {
      const lexer = new PraxisLexer('x + y * z');
      const tokens = lexer.tokenize();
      const operators = tokens.filter(t => t.type === 'OPERATOR').map(t => t.value);
      expect(operators).toContain('+');
      expect(operators).toContain('*');
    });

    it('should tokenize logical expression', () => {
      const lexer = new PraxisLexer('x and y or not z');
      const tokens = lexer.tokenize();
      const keywords = tokens.filter(t => t.type === 'KEYWORD').map(t => t.value);
      expect(keywords).toContain('and');
      expect(keywords).toContain('or');
      expect(keywords).toContain('not');
    });
  });
});

describe('Praxis Parser', () => {
  describe('Declarations', () => {
    it('should parse function declaration', () => {
      const source = `int max_num(int a, int b)
  if (a > b)
    return a
  else
    return b
  end if
end max_num`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('FunctionDeclaration');
      expect((program.body[0] as any).name).toBe('max_num');
    });

    it('should parse class declaration', () => {
      const source = `class Counter
  int count <- 0
  procedure increment()
    count <- count + 1
  end increment
end class`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('ClassDeclaration');
    });
  });

  describe('Statements', () => {
    it('should parse assignment', () => {
      const source = `int x <- 5`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('Assignment');
    });

    it('should parse if statement', () => {
      const source = `if (x > 5)
  print(x)
else
  print(0)
end if`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('If');
    });

    it('should parse while loop', () => {
      const source = `while (x < 10)
  x <- x + 1
end while`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('While');
    });

    it('should parse for loop', () => {
      const source = `for i <- 0; i < 10; i <- i + 1
  print(i)
end for`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('For');
    });

    it('should parse for-in loop', () => {
      const source = `for x in array
  print(x)
end for`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('For');
    });

    it('should parse print statement', () => {
      const source = `print("hello")`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('Print');
    });

    it('should parse return statement', () => {
      const source = `return x`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('Return');
    });
  });

  describe('Expressions', () => {
    it('should parse boolean expression with and/or', () => {
      const source = `boolean result <- true and false or not true`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('Assignment');
    });
  });
});

describe('Praxis Emitter', () => {
  describe('Basic Output', () => {
    it('should emit function declaration', () => {
      const source = `int add(int a, int b)
  return a + b
end add`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const emitter = new PraxisEmitter({ 
        symbolTable: new SymbolTable(), 
        functionReturnTypes: new Map(), 
        functionParamTypes: new Map() 
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('procedure add');
      expect(code).toContain('end add');
    });

    it('should emit assignment with arrow operator', () => {
      const source = `int x <- 5`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const emitter = new PraxisEmitter({ 
        symbolTable: new SymbolTable(), 
        functionReturnTypes: new Map(), 
        functionParamTypes: new Map() 
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('<-');
    });

    it('should emit if statement', () => {
      const source = `if (x > 5)
  print(x)
else
  print(0)
end if`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const emitter = new PraxisEmitter({ 
        symbolTable: new SymbolTable(), 
        functionReturnTypes: new Map(), 
        functionParamTypes: new Map() 
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('if');
      expect(code).toContain('else');
      expect(code).toContain('end if');
    });
  });

  describe('Boolean Logic', () => {
    it('should emit and operator', () => {
      const source = `boolean x <- true and false`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const emitter = new PraxisEmitter({ 
        symbolTable: new SymbolTable(), 
        functionReturnTypes: new Map(), 
        functionParamTypes: new Map() 
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('and');
    });
  });
});

describe('Praxis Translation', () => {
  describe('Basic Programs', () => {
    it('should translate simple assignment', () => {
      const source = `int x <- 5`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'praxis');
      expect(result).toContain('int');
      expect(result).toContain('x');
      expect(result).toContain('<-');
    });

    it('should translate print statement', () => {
      const source = `print("hello")`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'praxis');
      expect(result).toContain('print');
    });

    it('should translate array literal', () => {
      const source = `int[] xs <- {12, 103, 80}`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'praxis');
      expect(result).toContain('int[]');
      expect(result).toContain('xs');
    });
  });

  describe('Control Flow', () => {
    it('should translate if statement', () => {
      const source = `if (x < 10)
  print(x)
end if`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'praxis');
      expect(result).toContain('if');
      expect(result).toContain('end if');
    });

    it('should translate while loop', () => {
      const source = `while (x < 10)
  x <- x + 1
end while`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'praxis');
      expect(result).toContain('while');
      expect(result).toContain('end while');
    });
  });

  describe('Functions', () => {
    it('should translate function declaration', () => {
      const source = `int max(int a, int b)
  if (a > b)
    return a
  else
    return b
  end if
end max`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'praxis');
      expect(result).toContain('procedure');
      expect(result).toContain('max');
      expect(result).toContain('end max');
    });
  });

  describe('Classes', () => {
    it('should translate class declaration', () => {
      const source = `class Counter
  int count <- 0
end class`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'praxis');
      expect(result).toContain('class Counter');
      expect(result).toContain('end class Counter');
    });
  });

  describe('Advanced Features', () => {
    it('should handle 0-based array indexing', () => {
      const source = `int[] xs <- {10, 20, 30}
int first <- xs[0]
int last <- xs[2]
print(last)`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'praxis');
      expect(result).toContain('xs');
      expect(result).toContain('[0]');
      expect(result).toContain('[2]');
    });

    it('should access last element with 0-based indexing', () => {
      const source = `int[] data <- {5, 10, 15}
int lastValue <- data[2]
print(lastValue)`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'praxis');
      // Should be able to access the last element at index 2
      expect(result).toContain('data');
      expect(result).toContain('[2]');
    });

    it('should print array element correctly with 0-based indexing', () => {
      const source = `int[] numbers <- {100, 200, 300}
print(numbers[2])`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'praxis');
      expect(result).toContain('print');
      expect(result).toContain('numbers');
      expect(result).toContain('[2]');
    });

    it('should handle array iteration with 0-based indexing', () => {
      const source = `int[] xs <- {1, 2, 3}
for i <- 0; i < 3; i <- i + 1
  print(xs[i])
end for`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'praxis');
      expect(result).toContain('for');
      expect(result).toContain('xs[i]');
    });

    it('should parse range literals', () => {
      const source = `x <- 1..10`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      expect(program.body.length).toBeGreaterThan(0);
    });

    it('should correctly translate range literal to other languages', () => {
      const source = `x <- 1..5
print(x)`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const pythonResult = translator.translate(program, 'python');
      expect(pythonResult).toContain('x');
    });

    it('should correctly handle 0-based array access in for loops', () => {
      const source = `int[] items <- {10, 20, 30}
for i <- 0; i < 3; i <- i + 1
  print(items[i])
end for`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'praxis');
      // Praxis emitter should output 0-based indices
      expect(result).toContain('items[i]');
    });

    it('should translate 0-based Praxis indexing to Java', () => {
      const source = `int[] arr <- {5, 10, 15}
int first <- arr[0]`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaResult = translator.translate(program, 'java');
      // Java should use 0-based indexing
      expect(javaResult).toContain('arr[');
    });

    it('should translate 0-based Praxis indexing to Python', () => {
      const source = `arr = [5, 10, 15]
first = arr[0]`;
      const lexer = new PraxisLexer(source);
      const tokens = lexer.tokenize();
      const parser = new PraxisParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const pythonResult = translator.translate(program, 'python');
      // Python should use 0-based indexing
      expect(pythonResult).toContain('arr[');
    });
  });
});
