/**
 * Regression tests for control-flow constructs and optional AST fields that the
 * interpreter previously parsed/translated but did not execute: break, continue,
 * switch, try/catch/finally, the ternary operator, and integer `/=`.
 */
import { describe, it, expect } from 'vitest';

import { JavaLexer } from '../src/language/java/lexer';
import { JavaParser } from '../src/language/java/parser';
import { Lexer as PythonLexer } from '../src/language/python/lexer';
import { Parser as PythonParser } from '../src/language/python/parser';
import { JavaScriptLexer } from '../src/language/javascript/lexer';
import { JavaScriptParser } from '../src/language/javascript/parser';
import { Interpreter } from '../src/language/interpreter';

const java = (src: string): string[] =>
  new Interpreter().interpret(new JavaParser(new JavaLexer(src).tokenize()).parse(), src);
const python = (src: string): string[] =>
  new Interpreter().interpret(new PythonParser(new PythonLexer(src).tokenize()).parse(), src);
const js = (src: string): string[] =>
  new Interpreter().interpret(
    new JavaScriptParser(new JavaScriptLexer(src).tokenize()).parse(),
    src
  );

describe('control flow and optional fields now execute', () => {
  it('break stops the loop', () => {
    expect(
      java('for (int t = 0; t < 5; t++) { if (t == 3) { break; } System.out.println(t); }')
    ).toEqual(['0', '1', '2']);
  });

  it('continue skips to the next iteration', () => {
    expect(
      java('for (int t = 0; t < 4; t++) { if (t == 1) { continue; } System.out.println(t); }')
    ).toEqual(['0', '2', '3']);
  });

  it('switch runs the matching case and stops at break', () => {
    expect(
      java(
        'int x = 2; switch (x) { case 1: System.out.println("a"); break; case 2: System.out.println("b"); break; default: System.out.println("c"); }'
      )
    ).toEqual(['b']);
  });

  it('switch falls through cases until a break', () => {
    expect(
      java(
        'int x = 1; switch (x) { case 1: System.out.println("a"); case 2: System.out.println("b"); break; default: System.out.println("c"); }'
      )
    ).toEqual(['a', 'b']);
  });

  it('switch runs default when nothing matches', () => {
    expect(
      java(
        'int x = 9; switch (x) { case 1: System.out.println("a"); break; default: System.out.println("d"); }'
      )
    ).toEqual(['d']);
  });

  it('ternary evaluates and yields a value', () => {
    expect(java('int a = 5; int b = 3; System.out.println((a > b) ? "big" : "small");')).toEqual([
      'big',
    ]);
  });

  it('integer /= truncates, float /= does not', () => {
    expect(java('int acc = 24; acc /= 5; System.out.println(acc);')).toEqual(['4']);
    expect(js('let acc = 24; acc /= 5; console.log(acc);')).toEqual(['4.8']);
  });

  it('try / catch / finally catches and always runs finally', () => {
    expect(
      python(
        'try:\n    print(missingVar)\nexcept ValueError as e:\n    print("caught")\nfinally:\n    print("fin")'
      )
    ).toEqual(['caught', 'fin']);
  });

  it('loop else is unsupported and raises a parse error', () => {
    expect(() => python('for i in range(2):\n    print(i)\nelse:\n    print("done")')).toThrow(
      "'for ... else' is not supported"
    );
    expect(() =>
      python('i = 0\nwhile i < 3:\n    print(i)\n    i += 1\nelse:\n    print("done")')
    ).toThrow("'while ... else' is not supported");
  });
});
