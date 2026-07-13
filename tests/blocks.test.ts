import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { Lexer as PythonLexer } from '../src/language/python/lexer';
import { Parser as PythonParser } from '../src/language/python/parser';
import { CSPLexer } from '../src/language/csp/lexer';
import { CSPParser } from '../src/language/csp/parser';
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

/** Parses AP CSP source into a Universal AST program. */
function parseCsp(source: string): Program {
  const tokens = new CSPLexer(source).tokenize();
  return new CSPParser(tokens).parse();
}

/**
 * Option B fidelity check: interpreting a program directly must produce the
 * same output as interpreting it after a full AST → blocks JSON → (real
 * Blockly load/save) → AST round trip. Proves the blocks mapping is lossless
 * for what the program actually computes, without dragging in any text-emitter
 * display nuances.
 */
function assertInterpretsIdentically(program: Program): void {
  const direct = new Interpreter().interpret(program, '');
  const roundTripped = blocksToProgram(roundTripThroughBlockly(programToBlocksJson(program)));
  const viaBlocks = new Interpreter().interpret(roundTripped, '');
  expect(viaBlocks).toEqual(direct);
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
    // Ternary (ConditionalExpression) is an intentional omission of the subset.
    expect(() => programToBlocksJson(parsePython('x = 1 if y > 0 else 2'))).toThrow(/support/i);
  });

  it('emits a list literal as lists_create_with', () => {
    const state = JSON.parse(programToBlocksJson(parsePython('nums = [1, 2, 3]')));
    const list = state.blocks.blocks[0].inputs.VALUE.block;
    expect(list.type).toBe('lists_create_with');
    expect(list.extraState).toEqual({ itemCount: 3 });
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

describe('Blocks Option B (interpret round trip)', () => {
  it('interprets a CSP subset program identically through blocks', () => {
    // Uses only the procedural, non-list/string subset supported so far:
    // assignment, if/else, DISPLAY (space terminator), REPEAT n TIMES (counting
    // For), REPEAT UNTIL (While NOT), procedures, calls.
    const source = [
      'x <- 5',
      'IF (x > 3) { DISPLAY("big") } ELSE { DISPLAY("small") }',
      'REPEAT 3 TIMES { DISPLAY("tick") }',
      'i <- 0',
      'REPEAT UNTIL (i >= 3) { DISPLAY(i) i <- i + 1 }',
      'PROCEDURE add(a, b) { RETURN a + b }',
      'DISPLAY(add(4, 5))',
    ].join('\n');

    const program = parseCsp(source);
    // Sanity: the direct run produces the expected single space-separated line.
    expect(new Interpreter().interpret(program, '')).toEqual(['big tick tick tick 0 1 2 9 ']);
    assertInterpretsIdentically(program);
  });

  it('maps CSP REPEAT n TIMES onto the "repeat n times" block', () => {
    const json = programToBlocksJson(parseCsp('REPEAT 3 TIMES { DISPLAY("hi") }'));
    expect(JSON.parse(json).blocks.blocks[0].type).toBe('controls_repeat_ext');
  });

  it('round-trips DISPLAY as a space-terminated print', () => {
    const json = JSON.parse(programToBlocksJson(parseCsp('DISPLAY("hi")')));
    expect(json.blocks.blocks[0]).toMatchObject({ type: 'praxly_print', fields: { NL: 'SPACE' } });
  });

  it('maps while True + break onto the forever block and halts', () => {
    const source = 'i = 0\nwhile True:\n  print(i)\n  i = i + 1\n  if i >= 3:\n    break';
    const program = parsePython(source);
    // Top chain is `i = 0` → the forever loop.
    const top = JSON.parse(programToBlocksJson(program)).blocks.blocks[0];
    expect(top.next.block.type).toBe('praxly_forever');
    assertInterpretsIdentically(program);
  });

  it('interprets a CSP list program identically through blocks', () => {
    const source = [
      'nums <- [10, 20, 30]',
      'DISPLAY(nums[1])',
      'nums[2] <- 99',
      'DISPLAY(nums[2])',
      'APPEND(nums, 40)',
      'INSERT(nums, 1, 5)',
      'REMOVE(nums, 2)',
      'DISPLAY(LENGTH(nums))',
      'DISPLAY(nums[1])',
      'FOR EACH item IN nums { DISPLAY(item) }',
    ].join('\n');
    const program = parseCsp(source);
    // Ground-truth output: 1-based indexing, list mutation, for-each.
    expect(new Interpreter().interpret(program, '')).toEqual(['10 99 4 5 5 99 30 40 ']);
    assertInterpretsIdentically(program);
  });

  it('keeps list indexing 1-based across the round trip', () => {
    // nums[1] is the first element -> AST index 0 -> block shadow index 1.
    const state = JSON.parse(programToBlocksJson(parseCsp('nums <- [7, 8]\nDISPLAY(nums[1])')));
    const get = state.blocks.blocks[0].next.block.inputs.VALUE.block;
    expect(get.type).toBe('praxly_list_get');
    expect(get.inputs.INDEX.block).toMatchObject({ type: 'math_number', fields: { NUM: 1 } });
  });

  it('interprets a CSP string program identically through blocks', () => {
    const source = [
      'word <- "algorithm"',
      'DISPLAY(CONCAT("al", "go"))',
      'DISPLAY(SUBSTRING(word, 1, 4))',
      'DISPLAY(CHARAT(word, 1))',
      'DISPLAY(len(word))',
    ].join('\n');
    const program = parseCsp(source);
    // algo | algo | a | 9, all space-terminated.
    expect(new Interpreter().interpret(program, '')).toEqual(['algo algo a 9 ']);
    assertInterpretsIdentically(program);
  });

  it('keeps substring/charAt positions 1-based across the round trip', () => {
    const json = JSON.parse(
      programToBlocksJson(parseCsp('word <- "hi"\nDISPLAY(CHARAT(word, 1))'))
    );
    const charat = json.blocks.blocks[0].next.block.inputs.VALUE.block;
    expect(charat.type).toBe('praxly_str_charat');
    expect(charat.inputs.INDEX.block).toMatchObject({ type: 'math_number', fields: { NUM: 1 } });
  });

  it('round-trips upper/lower/contains string blocks', () => {
    // Praxis-style string methods also map onto the blocks.
    const program = parsePython(
      's = "Hi"\nprint(s.upper())\nprint(s.lower())\nprint("hello".contains("ell"))'
    );
    assertInterpretsIdentically(program);
  });

  it('interprets math, random, and conversion builtins identically', () => {
    // randomSeed makes the random calls deterministic, so both the direct and
    // round-tripped runs produce the same sequence.
    const source = [
      'randomSeed(42)',
      'DISPLAY(abs(0 - 7))',
      'DISPLAY(sqrt(16))',
      'DISPLAY(max(3, 8))',
      'DISPLAY(min(3, 8))',
      'DISPLAY(RANDOM(1, 6))',
      'DISPLAY(randomInt(100))',
      'DISPLAY(int("7") + 1)',
      'DISPLAY(float("2.5"))',
      'DISPLAY(str(42))',
    ].join('\n');
    const program = parseCsp(source);
    assertInterpretsIdentically(program);
    // The non-random parts are stable regardless of seed.
    const out = new Interpreter().interpret(program, '')[0];
    expect(out.startsWith('7 4 8 3 ')).toBe(true);
    expect(out.endsWith(' 8 2.5 42 ')).toBe(true);
  });

  it('maps abs/RANDOM/int onto dedicated builtin blocks', () => {
    const state = JSON.parse(
      programToBlocksJson(parseCsp('DISPLAY(abs(0 - 3))\nDISPLAY(RANDOM(1, 6))\nDISPLAY(int("5"))'))
    );
    const first = state.blocks.blocks[0];
    expect(first.inputs.VALUE.block.type).toBe('praxly_abs');
    expect(first.next.block.inputs.VALUE.block.type).toBe('praxly_random_range');
    expect(first.next.block.next.block.inputs.VALUE.block.type).toBe('praxly_to_int');
  });

  it('does not treat a user function named min as a builtin', () => {
    // The interpreter prefers a user-defined min, so blocks must emit a call.
    const source = 'PROCEDURE min(a, b) { RETURN a } DISPLAY(min(2, 9))';
    const state = JSON.parse(programToBlocksJson(parseCsp(source)));
    const display = state.blocks.blocks.find((b: any) => b.type === 'praxly_print');
    expect(display.inputs.VALUE.block.type).toBe('procedures_callreturn');
  });

  it('round-trips a for-each loop over a list value', () => {
    // No list-literal block yet (Commit 2), so drive the LIST socket from a
    // variable and assert the AST shape survives real Blockly load/save.
    const json = JSON.stringify({
      variables: [
        { name: 'items', id: 'v1' },
        { name: 'item', id: 'v2' },
      ],
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'praxly_for_each',
            fields: { VAR: { id: 'v2' } },
            inputs: {
              LIST: { block: { type: 'variables_get', fields: { VAR: { id: 'v1' } } } },
              DO: {
                block: {
                  type: 'praxly_print',
                  fields: { NL: 'NEWLINE' },
                  inputs: {
                    VALUE: { block: { type: 'variables_get', fields: { VAR: { id: 'v2' } } } },
                  },
                },
              },
            },
          },
        ],
      },
    });
    const program = blocksToProgram(roundTripThroughBlockly(json));
    expect(program.body[0]).toMatchObject({
      type: 'ForEach',
      variable: 'item',
      iterable: { type: 'Identifier', name: 'items' },
    });
  });
});
