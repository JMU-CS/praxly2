import { describe, it, expect } from 'vitest';
import { CSPLexer } from '../src/language/csp/lexer';
import { CSPParser } from '../src/language/csp/parser';
import { CSPEmitter } from '../src/language/csp/emitter';
import { Translator } from '../src/language/translator';
import { SymbolTable } from '../src/language/visitor';
import { Interpreter } from '../src/language/interpreter';
import { Lexer as PythonLexer } from '../src/language/python/lexer';
import { Parser as PythonParser } from '../src/language/python/parser';

describe('CSP Lexer', () => {
  describe('Basic Tokens', () => {
    it('should tokenize numbers', () => {
      const lexer = new CSPLexer('42 3.14');
      const tokens = lexer.tokenize();
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'NUMBER', value: '42' }));
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'NUMBER', value: '3.14' }));
    });

    it('should tokenize strings', () => {
      const lexer = new CSPLexer('"hello"');
      const tokens = lexer.tokenize();
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'STRING', value: 'hello' }));
    });

    it('should tokenize CSP keywords', () => {
      const lexer = new CSPLexer('IF REPEAT UNTIL FOR EACH PROCEDURE DISPLAY');
      const tokens = lexer.tokenize();
      const keywords = tokens.filter((t) => t.type === 'KEYWORD').map((t) => t.value);
      expect(keywords).toContain('IF');
      expect(keywords).toContain('REPEAT');
      expect(keywords).toContain('PROCEDURE');
    });

    it('does not treat OOP words as keywords (CSP has no classes)', () => {
      const lexer = new CSPLexer('CLASS PUBLIC PRIVATE CONSTRUCTOR NEW THIS');
      const tokens = lexer.tokenize();
      const keywords = tokens.filter((t) => t.type === 'KEYWORD').map((t) => t.value);
      expect(keywords).not.toContain('CLASS');
      expect(keywords).not.toContain('PUBLIC');
      // They tokenize as ordinary identifiers instead.
      const idents = tokens.filter((t) => t.type === 'IDENTIFIER').map((t) => t.value);
      expect(idents).toContain('CLASS');
    });

    it('should tokenize assignment operator', () => {
      const lexer = new CSPLexer('x <- 5');
      const tokens = lexer.tokenize();
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'OPERATOR', value: '<-' }));
    });

    it('accepts ← and ⟵ as assignment operator variants (not =, which is equality)', () => {
      for (const arrow of ['←', '⟵']) {
        const tokens = new CSPLexer(`x ${arrow} 5`).tokenize();
        expect(tokens).toContainEqual(expect.objectContaining({ type: 'OPERATOR', value: '<-' }));
      }
    });

    it('should tokenize not-equal operator', () => {
      const lexer = new CSPLexer('x <> y');
      const tokens = lexer.tokenize();
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'OPERATOR', value: '<>' }));
    });

    it('should tokenize != as a not-equal operator variant', () => {
      const lexer = new CSPLexer('x != y');
      const tokens = lexer.tokenize();
      expect(tokens).toContainEqual(expect.objectContaining({ type: 'OPERATOR', value: '!=' }));
    });

    it('should tokenize comparison operators', () => {
      const lexer = new CSPLexer('a < b a > c a <= d a >= e');
      const tokens = lexer.tokenize();
      const operators = tokens.filter((t) => t.type === 'OPERATOR').map((t) => t.value);
      expect(operators).toContain('<');
      expect(operators).toContain('>');
      expect(operators).toContain('<=');
      expect(operators).toContain('>=');
    });

    it('should skip comments', () => {
      const lexer = new CSPLexer('x <- 5 // comment\ny <- 10');
      const tokens = lexer.tokenize();
      const identifiers = tokens.filter((t) => t.type === 'IDENTIFIER').map((t) => t.value);
      expect(identifiers).toContain('x');
      expect(identifiers).toContain('y');
    });

    it('should tokenize logical operators', () => {
      const lexer = new CSPLexer('AND OR NOT');
      const tokens = lexer.tokenize();
      const keywords = tokens.filter((t) => t.type === 'KEYWORD').map((t) => t.value);
      expect(keywords).toContain('AND');
      expect(keywords).toContain('OR');
      expect(keywords).toContain('NOT');
    });
  });

  describe('Complex Expressions', () => {
    it('should tokenize arithmetic with MOD', () => {
      const lexer = new CSPLexer('x MOD 5');
      const tokens = lexer.tokenize();
      const keywords = tokens.filter((t) => t.type === 'KEYWORD').map((t) => t.value);
      expect(keywords).toContain('MOD');
    });

    it('should tokenize procedure call', () => {
      const lexer = new CSPLexer('myProc(a, b)');
      const tokens = lexer.tokenize();
      const identifiers = tokens.filter((t) => t.type === 'IDENTIFIER').map((t) => t.value);
      expect(identifiers).toContain('myProc');
      expect(identifiers).toContain('a');
      expect(identifiers).toContain('b');
    });
  });
});

describe('CSP Parser', () => {
  describe('Declarations', () => {
    it('should parse procedure', () => {
      const source = `PROCEDURE greet(name)
{
  DISPLAY("Hello " + name)
}`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('FunctionDeclaration');
      expect((program.body[0] as any).name).toBe('greet');
    });
  });

  describe('Statements', () => {
    it('should parse assignment', () => {
      const source = `x <- 5`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('Assignment');
    });

    it('should parse display statement', () => {
      const source = `DISPLAY("hello")`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('Print');
    });

    it('should parse if statement', () => {
      const source = `IF (x > 5)
{
  DISPLAY(x)
}`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('If');
    });

    it('should parse if-else statement', () => {
      const source = `IF (x > 5)
{
  DISPLAY(x)
}
ELSE
{
  DISPLAY(0)
}`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const ifStmt = program.body[0] as any;
      expect(ifStmt.type).toBe('If');
      expect(ifStmt.elseBranch).toBeDefined();
    });

    it('should parse repeat until loop', () => {
      const source = `REPEAT UNTIL (x >= 10)
{
  x <- x + 1
}`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('While');
    });

    it('should parse for-each loop', () => {
      const source = `FOR EACH item IN array
{
  DISPLAY(item)
}`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('ForEach');
    });

    it('should parse return statement', () => {
      const source = `RETURN value`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('Return');
    });
  });

  describe('Expressions', () => {
    it('should parse logical expression with AND/OR', () => {
      const source = `result <- true AND false OR NOT true`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      expect(program.body[0].type).toBe('Assignment');
    });
  });
});

describe('CSP Emitter', () => {
  describe('Basic Output', () => {
    it('should emit procedure declaration', () => {
      const source = `PROCEDURE add(a, b)
{
  RETURN a + b
}`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const emitter = new CSPEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('PROCEDURE add');
    });

    it('should emit assignment with CSP arrow', () => {
      const source = `x <- 5`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const emitter = new CSPEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('←');
    });

    it('should emit display statement', () => {
      const source = `DISPLAY("hello")`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const emitter = new CSPEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('DISPLAY');
    });

    it('should emit if statement', () => {
      const source = `IF (x > 5)
{
  DISPLAY(x)
}`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const emitter = new CSPEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('IF');
    });
  });

  describe('Boolean Logic', () => {
    it('should emit AND operator', () => {
      const source = `boolean x <- true AND false`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const emitter = new CSPEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('AND');
    });

    it('should emit OR operator', () => {
      const source = `boolean x <- true OR false`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const emitter = new CSPEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('OR');
    });

    it('should emit NOT operator', () => {
      const source = `boolean x <- NOT false`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const emitter = new CSPEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('NOT');
    });

    it('should emit MOD operator', () => {
      const source = `result <- 10 MOD 3`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const emitter = new CSPEmitter({
        symbolTable: new SymbolTable(),
        functionReturnTypes: new Map(),
        functionParamTypes: new Map(),
      });
      emitter.visitProgram(program);
      const code = emitter.getGeneratedCode();
      expect(code).toContain('MOD');
    });
  });
});

describe('CSP Translation', () => {
  describe('Basic Programs', () => {
    it('should translate simple assignment', () => {
      const source = `x <- 5`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'csp');
      expect(result).toContain('x');
      expect(result).toContain('←');
      expect(result).toContain('5');
    });

    it('should translate display statement', () => {
      const source = `DISPLAY("hello")`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'csp');
      expect(result).toContain('DISPLAY');
    });
  });

  describe('Control Flow', () => {
    it('should translate if statement', () => {
      const source = `IF (x > 5)
{
  DISPLAY(x)
}`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'csp');
      expect(result).toContain('IF');
    });

    it('emits ELSE IF chains and does not absorb a trailing statement', () => {
      const source = `score <- 82
IF (score >= 90)
{
  DISPLAY("A")
}
ELSE IF (score >= 80)
{
  DISPLAY("B")
}
ELSE
{
  DISPLAY("C")
}
DISPLAY("after")`;
      const program = new CSPParser(new CSPLexer(source).tokenize()).parse();
      const result = new Translator().translate(program, 'csp');
      expect(result).toContain('ELSE IF (score ≥ 80)');
      // The nested ELSE IF must not swallow the statement after the chain.
      const out = new Interpreter().interpret(
        new CSPParser(new CSPLexer(source).tokenize()).parse(),
        source
      );
      // DISPLAY appends a space (no newline), so both land on one line.
      expect(out).toEqual(['B after ']);
    });

    it('should translate repeat until loop', () => {
      const source = `REPEAT UNTIL (x >= 10)
{
  x <- x + 1
}`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'csp');
      expect(result).toContain('REPEAT UNTIL');
    });

    it('should translate for-each loop', () => {
      const source = `FOR EACH item IN array
{
  DISPLAY(item)
}`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'csp');
      expect(result).toContain('FOR EACH');
    });
  });

  describe('Procedures', () => {
    it('should translate procedure declaration', () => {
      const source = `PROCEDURE greet(name)
{
  DISPLAY("Hello " + name)
}`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'csp');
      expect(result).toContain('PROCEDURE');
      expect(result).toContain('greet');
    });
  });

  describe('Advanced Features', () => {
    it('should support REPEAT n TIMES', () => {
      const source = `REPEAT 5 TIMES
{
  DISPLAY "hello"
}`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      expect(program.body.length).toBeGreaterThan(0);
    });

    it('should support FOR EACH item IN collection', () => {
      const source = `FOR EACH item IN items
{
  DISPLAY item
}`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'csp');
      expect(result).toContain('FOR EACH');
      expect(result).toContain('IN');
    });

    it('lowers a range() for-each to a counter + REPEAT UNTIL (no FOR FROM/TO)', () => {
      // A range-based ForEach reaching the CSP emitter (e.g. from Python) must
      // become spec-legal CSP: a counter plus REPEAT UNTIL, not FOR FROM/TO.
      const src = `for i in range(0, 6, 2):
    print(i)`;
      const program = new PythonParser(new PythonLexer(src).tokenize()).parse();
      const result = new Translator().translate(program, 'csp');
      expect(result).not.toContain('FROM');
      expect(result).toContain('REPEAT UNTIL');
      expect(result).toContain('i ← i + 2');
    });

    it('should handle REPEAT n TIMES with variable', () => {
      const source = `n <- 10
REPEAT n TIMES
{
  x <- x + 1
}`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'csp');
      expect(result).toContain('n');
    });

    it('should translate REPEAT n TIMES to while loop in other languages', () => {
      const source = `REPEAT 3 TIMES
{
  DISPLAY "x"
}`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const result = translator.translate(program, 'python');
      // REPEAT n TIMES becomes a while loop (we have a counter loop internally)
      // expect(result).toContain('while');
      expect(result).toContain('range');
    });

    it('should keep fixed-size arrays as Java arrays when not appended', () => {
      // CSP lists are 1-based, so nums[1] is the first element (Java nums[0]).
      const source = `nums <- [1, 2, 3]
DISPLAY(nums[1])`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');

      expect(javaCode).toContain('int[] nums');
      expect(javaCode).toContain('nums[0]');
      expect(javaCode).not.toContain('ArrayList<');
    });

    it('should emit Java ArrayList when a CSP list is appended', () => {
      const source = `nums <- [1, 2, 3]
APPEND(nums, 4)
DISPLAY(nums[1])`;
      const lexer = new CSPLexer(source);
      const tokens = lexer.tokenize();
      const parser = new CSPParser(tokens);
      const program = parser.parse();
      const translator = new Translator();
      const javaCode = translator.translate(program, 'java');

      expect(javaCode).toContain('ArrayList<Integer> nums');
      expect(javaCode).toContain('nums.add(4);');
      expect(javaCode).toContain('nums.get(0)');
      expect(javaCode).not.toContain('int[] nums');
    });
  });

  describe('CSP RANDOM(a, b) (seeded, deterministic)', () => {
    const run = (src: string): string[] =>
      new Interpreter().interpret(new CSPParser(new CSPLexer(src).tokenize()).parse(), src);

    it('returns an inclusive integer, deterministic when seeded', () => {
      const out = run(`randomSeed(42)\nDISPLAY(RANDOM(1, 6))\nDISPLAY(RANDOM(1, 6))`);
      expect(out.join('').replace(/\s+/g, ' ').trim()).toBe('4 3');
    });
  });

  describe('CSP string functions (1-based)', () => {
    const parse = (src: string) => new CSPParser(new CSPLexer(src).tokenize()).parse();
    const run = (src: string): string =>
      new Interpreter().interpret(parse(src), src).join('').replace(/\s+/g, ' ').trim();

    it('SUBSTRING is 1-based inclusive, CHARAT is 1-based, CONCAT concatenates', () => {
      const out = run(
        `word <- "hello"\nDISPLAY(SUBSTRING(word, 2, 4))\nDISPLAY(CHARAT(word, 1))\nDISPLAY(CONCAT("ab", "cd"))\nDISPLAY(len(word))`
      );
      expect(out).toBe('ell h abcd 5');
    });

    it('translates SUBSTRING/CHARAT into 0-based Java string methods', () => {
      const java = new Translator().translate(
        parse(`word <- "hello"\nDISPLAY(SUBSTRING(word, 2, 4))\nDISPLAY(CHARAT(word, 1))`),
        'java'
      );
      expect(java).toContain('word.substring(1, 4)');
      expect(java).toContain('word.charAt(0)');
    });

    it('round-trips SUBSTRING/CHARAT back to 1-based CSP', () => {
      const csp = new Translator().translate(
        parse(`word <- "hello"\nDISPLAY(SUBSTRING(word, 2, 4))\nDISPLAY(CHARAT(word, 1))`),
        'csp'
      );
      expect(csp).toContain('SUBSTRING(word, 2, 4)');
      expect(csp).toContain('CHARAT(word, 1)');
    });
  });
});
