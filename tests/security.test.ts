import { describe, it, expect } from 'vitest';
import { Lexer as PythonLexer } from '../src/language/python/lexer';
import { Parser as PythonParser } from '../src/language/python/parser';
import { Interpreter } from '../src/language/interpreter';

/**
 * The interpreter walks an AST directly over live JS values, so a program that
 * can reach `constructor` / `prototype` / `__proto__` through `obj[key]` or
 * `obj.key` can grab the host `Function` constructor or poison a built-in
 * prototype and run arbitrary JavaScript on the page's origin. Programs can
 * arrive from an untrusted share/embed link, so this is a sandbox escape, not
 * just a footgun. These tests pin the guard that rejects those keys.
 */
describe('Interpreter sandbox — forbidden property access', () => {
  const parse = (src: string) => new PythonParser(new PythonLexer(src).tokenize()).parse();
  const run = (src: string) => new Interpreter().interpret(parse(src), src).join('\n');

  // The interpreter catches runtime errors and surfaces them as a
  // "Runtime Error: …" line in its output rather than throwing.
  it('rejects reading constructor via subscript', () => {
    expect(run(`x = "s"["constructor"]`)).toMatch(
      /Access to property 'constructor' is not allowed/
    );
  });

  it('rejects reading __proto__ via subscript', () => {
    expect(run(`x = []["__proto__"]`)).toMatch(/Access to property '__proto__' is not allowed/);
  });

  it('rejects writing through a forbidden subscript key', () => {
    expect(run(`a = []\na["__proto__"] = 1`)).toMatch(/not allowed/);
  });

  it('rejects writing a forbidden member key', () => {
    expect(run(`a = []\na.constructor = 1`)).toMatch(/not allowed/);
  });

  it('still allows ordinary indexing and member access', () => {
    expect(run(`a = [10, 20, 30]\nprint(a[1])`)).toBe('20');
    expect(run(`s = "hello"\nprint(s[0])`)).toBe('h');
    expect(run(`a = [1, 2]\na[0] = 9\nprint(a[0])`)).toBe('9');
  });
});
