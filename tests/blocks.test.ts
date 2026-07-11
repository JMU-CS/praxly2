import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { Lexer as PythonLexer } from '../src/language/python/lexer';
import { Parser as PythonParser } from '../src/language/python/parser';
import { blocksToProgram } from '../src/language/blocks/toAst';
import { programToBlocksJson } from '../src/language/blocks/fromAst';
import { registerPraxlyBlocks } from '../src/language/blocks/blockDefs';
import { Translator } from '../src/language/translator';
import { Interpreter } from '../src/language/interpreter';
import type { Program } from '../src/language/ast';

registerPraxlyBlocks();

/** Parses Python source into a Universal AST program. */
function parsePython(source: string): Program {
  const tokens = new PythonLexer(source).tokenize();
  return new PythonParser(tokens).parse();
}

/**
 * Loads workspace JSON into a headless Blockly workspace and saves it back.
 * Throws if any connection is invalid — the same validation the real editor
 * runs — so it proves the JSON we generate is loadable, not just parseable.
 */
function roundTripThroughBlockly(json: string): string {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(JSON.parse(json), workspace);
    return JSON.stringify(Blockly.serialization.workspaces.save(workspace));
  } finally {
    workspace.dispose();
  }
}

/** python → AST → blocks JSON → Blockly load/save → AST → python */
function fullRoundTrip(source: string): { program: Program; python: string } {
  const original = parsePython(source);
  const json = programToBlocksJson(original);
  const reloaded = roundTripThroughBlockly(json);
  const program = blocksToProgram(reloaded);
  const python = new Translator().translate(program, 'python');
  return { program, python };
}

describe('Blocks emitter (programToBlocksJson)', () => {
  it('emits variables_set and praxly_print for simple statements', () => {
    const json = programToBlocksJson(parsePython('x = 5\nprint(x)'));
    const state = JSON.parse(json);

    expect(state.variables).toEqual([{ name: 'x', id: 'var_x' }]);
    const top = state.blocks.blocks[0];
    expect(top.type).toBe('variables_set');
    expect(top.inputs.VALUE.block).toMatchObject({ type: 'math_number', fields: { NUM: 5 } });
    expect(top.next.block).toMatchObject({ type: 'praxly_print' });
    expect(top.next.block.inputs.VALUE.block.type).toBe('variables_get');
  });

  it('folds else-if ladders into one controls_if mutation', () => {
    const source = [
      'if x > 10:',
      '  print(1)',
      'elif x > 5:',
      '  print(2)',
      'else:',
      '  print(3)',
    ].join('\n');
    const json = programToBlocksJson(parsePython(source));
    const ifBlock = JSON.parse(json).blocks.blocks[0];

    expect(ifBlock.type).toBe('controls_if');
    expect(ifBlock.extraState).toEqual({ elseIfCount: 1, hasElse: true });
    expect(ifBlock.inputs.IF1.block.type).toBe('logic_compare');
    expect(ifBlock.inputs.ELSE.block.type).toBe('praxly_print');
  });

  it('uses text_join (not math_arithmetic) for string concatenation', () => {
    const json = programToBlocksJson(parsePython('print("total: " + x)'));
    const print = JSON.parse(json).blocks.blocks[0];
    expect(print.inputs.VALUE.block.type).toBe('text_join');
  });

  it('maps while not(...) onto the "repeat until" loop mode', () => {
    const json = programToBlocksJson(parsePython('while not done:\n  print(1)'));
    const loop = JSON.parse(json).blocks.blocks[0];
    expect(loop).toMatchObject({ type: 'controls_whileUntil', fields: { MODE: 'UNTIL' } });
    expect(loop.inputs.BOOL.block.type).toBe('variables_get');
  });

  it('maps range loops onto repeat/count blocks', () => {
    const unused = JSON.parse(
      programToBlocksJson(parsePython('for i in range(3):\n  print("hi")'))
    );
    expect(unused.blocks.blocks[0].type).toBe('controls_repeat_ext');

    const used = JSON.parse(programToBlocksJson(parsePython('for i in range(2, 8):\n  print(i)')));
    expect(used.blocks.blocks[0].type).toBe('praxly_for_range');
    expect(used.blocks.blocks[0].inputs.FROM.block.fields.NUM).toBe(2);
  });

  it('emits procedures blocks for function declarations and calls', () => {
    const source = ['def add(a, b):', '  return a + b', 'print(add(1, 2))'].join('\n');
    const state = JSON.parse(programToBlocksJson(parsePython(source)));

    const def = state.blocks.blocks.find((b: any) => b.type === 'procedures_defreturn');
    expect(def.fields.NAME).toBe('add');
    expect(def.extraState.params.map((p: any) => p.name)).toEqual(['a', 'b']);
    expect(def.inputs.RETURN.block.type).toBe('math_arithmetic');
  });

  it('rejects constructs the Blocks view does not support', () => {
    expect(() => programToBlocksJson(parsePython('nums = [1, 2, 3]'))).toThrow(/support/i);
  });
});

describe('Blocks parser (blocksToProgram)', () => {
  it('returns an empty program for empty source', () => {
    expect(blocksToProgram('').body).toEqual([]);
    expect(blocksToProgram('{}').body).toEqual([]);
  });

  it('rejects invalid JSON like a syntax error', () => {
    expect(() => blocksToProgram('not json')).toThrow(/workspace JSON/);
  });

  it('errors descriptively on incomplete blocks', () => {
    const json = JSON.stringify({
      blocks: { languageVersion: 0, blocks: [{ type: 'praxly_print' }] },
    });
    expect(() => blocksToProgram(json)).toThrow(/missing/);
  });

  it('converts a hand-built workspace into the expected AST', () => {
    const json = JSON.stringify({
      variables: [{ name: 'n', id: 'v1' }],
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'variables_set',
            fields: { VAR: { id: 'v1' } },
            inputs: { VALUE: { block: { type: 'math_number', fields: { NUM: 7 } } } },
          },
        ],
      },
    });
    const program = blocksToProgram(json);
    expect(program.body[0]).toMatchObject({
      type: 'Assignment',
      target: { type: 'Identifier', name: 'n' },
      value: { type: 'Literal', value: 7 },
    });
  });
});

describe('Blocks round trips', () => {
  const PROGRAMS = [
    'x = 5\ny = x * 2 + 1\nprint(y)',
    'if x > 10:\n  print("big")\nelse:\n  print("small")',
    'i = 0\nwhile i < 5:\n  print(i)\n  i = i + 1',
    'for i in range(1, 4):\n  print(i * i)',
    'def greet(name):\n  print("hello " + name)\ngreet("world")',
    'def double(n):\n  return n * 2\nprint(double(21))',
    'name = input()\nprint("hi " + name)',
  ];

  for (const source of PROGRAMS) {
    it(`survives python → blocks → python: ${source.split('\n')[0]}…`, () => {
      const { python } = fullRoundTrip(source);
      const expected = new Translator().translate(parsePython(source), 'python');
      expect(python).toBe(expected);
    });
  }

  it('generates JSON that Blockly loads without connection errors', () => {
    // Would throw inside roundTripThroughBlockly on any type-check failure.
    const { program } = fullRoundTrip(
      'total = 0\nfor i in range(10):\n  total = total + i\nprint("sum: " + total)'
    );
    expect(program.body.length).toBe(3);
  });

  it('produces programs the interpreter can execute', () => {
    const source =
      'def square(n):\n  return n * n\ntotal = 0\nfor i in range(1, 4):\n  total = total + square(i)\nprint(total)';
    const { program } = fullRoundTrip(source);
    const output = new Interpreter().interpret(program, '');
    expect(output).toContain('14');
  });

  it('keeps repeat-until loops post-conditional through the round trip', () => {
    const json = JSON.stringify({
      variables: [{ name: 'x', id: 'v1' }],
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'variables_set',
            fields: { VAR: { id: 'v1' } },
            inputs: { VALUE: { block: { type: 'math_number', fields: { NUM: 0 } } } },
            next: {
              block: {
                type: 'praxly_repeat_until',
                inputs: {
                  DO: {
                    block: {
                      type: 'variables_set',
                      fields: { VAR: { id: 'v1' } },
                      inputs: {
                        VALUE: {
                          block: {
                            type: 'math_arithmetic',
                            fields: { OP: 'ADD' },
                            inputs: {
                              A: {
                                block: { type: 'variables_get', fields: { VAR: { id: 'v1' } } },
                              },
                              B: { block: { type: 'math_number', fields: { NUM: 1 } } },
                            },
                          },
                        },
                      },
                    },
                  },
                  COND: {
                    block: {
                      type: 'logic_compare',
                      fields: { OP: 'GTE' },
                      inputs: {
                        A: { block: { type: 'variables_get', fields: { VAR: { id: 'v1' } } } },
                        B: { block: { type: 'math_number', fields: { NUM: 3 } } },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    });

    const program = blocksToProgram(json);
    expect(program.body[1].type).toBe('RepeatUntil');

    // AST → blocks → AST keeps the same loop shape.
    const again = blocksToProgram(roundTripThroughBlockly(programToBlocksJson(program)));
    expect(again.body[1].type).toBe('RepeatUntil');
  });
});
