/**
 * Blocks "parser": converts a Blockly workspace serialization (JSON string)
 * into the Universal AST. The inverse of fromAst.ts.
 *
 * Incomplete workspaces (an if-block with no condition, an empty operand
 * slot, …) throw descriptive errors, which the editor surfaces exactly like
 * a syntax error in a text language.
 */

import type { Block, Expression, Program, Statement, Parameter, If } from '../ast';
import { generateId, makeIdentifier } from '../ast';
import { inputBlock, type BlockState, type WorkspaceState } from './serialization';

const COMPARE_OPS: Record<string, string> = {
  EQ: '==',
  NEQ: '!=',
  LT: '<',
  LTE: '<=',
  GT: '>',
  GTE: '>=',
};

const ARITHMETIC_OPS: Record<string, string> = {
  ADD: '+',
  MINUS: '-',
  MULTIPLY: '*',
  DIVIDE: '/',
  POWER: '**',
};

/** Parses the JSON produced by Blockly (and by fromAst.ts) into a Program. */
export function blocksToProgram(source: string): Program {
  if (!source.trim()) {
    return { id: generateId(), type: 'Program', body: [] };
  }

  let state: WorkspaceState;
  try {
    state = JSON.parse(source);
  } catch {
    throw new Error('Blocks source is not valid workspace JSON.');
  }

  return new BlocksReader(state).read();
}

class BlocksReader {
  /** Blockly variable id → variable name. */
  private varNames = new Map<string, string>();

  constructor(private state: WorkspaceState) {
    for (const v of state.variables ?? []) {
      this.varNames.set(v.id, v.name);
    }
  }

  read(): Program {
    // Top-level chains execute top-to-bottom, so order them by workspace y.
    const topBlocks = [...(this.state.blocks?.blocks ?? [])].sort(
      (a, b) => (a.y ?? 0) - (b.y ?? 0)
    );

    // Function definitions first, then the main statement chains — matching
    // how the text parsers order declarations for the interpreter.
    const body: Statement[] = [];
    for (const block of topBlocks) {
      if (block.type.startsWith('procedures_def')) {
        body.push(this.functionDeclaration(block));
      }
    }
    for (const block of topBlocks) {
      if (!block.type.startsWith('procedures_def')) {
        body.push(...this.statementChain(block));
      }
    }

    return { id: generateId(), type: 'Program', body };
  }

  /** Follows `next` connections, converting each block to a statement. */
  private statementChain(start: BlockState | undefined): Statement[] {
    const statements: Statement[] = [];
    for (let block = start; block; block = block.next?.block) {
      statements.push(this.statement(block));
    }
    return statements;
  }

  private block(start: BlockState | undefined): Block {
    return { id: generateId(), type: 'Block', body: this.statementChain(start) };
  }

  private statement(block: BlockState): Statement {
    switch (block.type) {
      case 'variables_set':
        return {
          id: generateId(),
          type: 'Assignment',
          target: makeIdentifier(this.variable(block, 'VAR')),
          value: this.expression(block, 'VALUE'),
        };

      case 'math_change': {
        // "change x by n" — modeled as x = x + n so every emitter handles it.
        const name = this.variable(block, 'VAR');
        return {
          id: generateId(),
          type: 'Assignment',
          target: makeIdentifier(name),
          value: {
            id: generateId(),
            type: 'BinaryExpression',
            operator: '+',
            left: { id: generateId(), type: 'Identifier', name },
            right: this.expression(block, 'DELTA'),
          },
        };
      }

      case 'praxly_list_set':
        // set item i of list to v  ->  list[i-1] = v
        return {
          id: generateId(),
          type: 'Assignment',
          target: {
            id: generateId(),
            type: 'IndexExpression',
            object: this.expression(block, 'LIST'),
            index: this.toZeroBasedIndex(this.expression(block, 'INDEX')),
          },
          value: this.expression(block, 'VALUE'),
        };

      case 'praxly_list_append':
        return this.listCallStatement('APPEND', [
          this.expression(block, 'LIST'),
          this.expression(block, 'VALUE'),
        ]);

      case 'praxly_list_insert':
        return this.listCallStatement('INSERT', [
          this.expression(block, 'LIST'),
          this.toZeroBasedIndex(this.expression(block, 'INDEX')),
          this.expression(block, 'VALUE'),
        ]);

      case 'praxly_list_remove':
        return this.listCallStatement('REMOVE', [
          this.expression(block, 'LIST'),
          this.toZeroBasedIndex(this.expression(block, 'INDEX')),
        ]);

      case 'praxly_random_seed':
        return {
          id: generateId(),
          type: 'ExpressionStatement',
          expression: this.freeCall('randomSeed', [this.expression(block, 'SEED')]),
        };

      case 'praxly_print': {
        // NL sets what follows the value: a newline (default), a space (CSP
        // DISPLAY's trailing space), or nothing.
        const nl = String(block.fields?.NL ?? 'NEWLINE');
        const print: Statement = {
          id: generateId(),
          type: 'Print',
          expressions: [this.expression(block, 'VALUE')],
        };
        if (nl === 'SPACE') {
          (print as any).separator = ' ';
          (print as any).appendLineFeed = false;
        } else if (nl === 'NONE') {
          (print as any).separator = '';
          (print as any).appendLineFeed = false;
        }
        return print;
      }

      case 'controls_if':
        return this.ifStatement(block);

      case 'controls_whileUntil': {
        const condition = this.expression(block, 'BOOL');
        return {
          id: generateId(),
          type: 'While',
          condition:
            block.fields?.MODE === 'UNTIL'
              ? { id: generateId(), type: 'UnaryExpression', operator: 'not', argument: condition }
              : condition,
          body: this.block(inputBlock(block, 'DO')),
        };
      }

      case 'praxly_forever':
        // "repeat forever" is while(true); a break inside stops it.
        return {
          id: generateId(),
          type: 'While',
          condition: { id: generateId(), type: 'Literal', value: true, raw: 'true' },
          body: this.block(inputBlock(block, 'DO')),
        };

      case 'praxly_for_each':
        return {
          id: generateId(),
          type: 'ForEach',
          variable: this.variable(block, 'VAR'),
          iterable: this.expression(block, 'LIST'),
          body: this.block(inputBlock(block, 'DO')),
        };

      case 'praxly_repeat_until':
        return {
          id: generateId(),
          type: 'RepeatUntil',
          condition: this.expression(block, 'COND'),
          body: this.block(inputBlock(block, 'DO')),
        };

      case 'controls_repeat_ext':
        // "repeat n times" — a counted for-loop over range(n).
        return {
          id: generateId(),
          type: 'ForEach',
          variable: 'i',
          iterable: this.rangeCall([this.expression(block, 'TIMES')]),
          body: this.block(inputBlock(block, 'DO')),
        };

      case 'praxly_for_range':
        return {
          id: generateId(),
          type: 'ForEach',
          variable: this.variable(block, 'VAR'),
          iterable: this.rangeCall([this.expression(block, 'FROM'), this.expression(block, 'TO')]),
          body: this.block(inputBlock(block, 'DO')),
        };

      case 'controls_flow_statements':
        return block.fields?.FLOW === 'CONTINUE'
          ? { id: generateId(), type: 'Continue' }
          : { id: generateId(), type: 'Break' };

      case 'praxly_return': {
        const value = inputBlock(block, 'VALUE');
        return {
          id: generateId(),
          type: 'Return',
          ...(value ? { value: this.expressionBlock(value) } : {}),
        };
      }

      case 'procedures_callnoreturn':
        return {
          id: generateId(),
          type: 'ExpressionStatement',
          expression: this.procedureCall(block),
        };

      default:
        throw new Error(`The "${block.type}" block can't be used as a statement here.`);
    }
  }

  private ifStatement(block: BlockState): If {
    const extra = (block.extraState ?? {}) as { elseIfCount?: number; hasElse?: boolean };
    const elseIfCount = extra.elseIfCount ?? 0;

    // Build else-if arms from the innermost out: ELSE, then IFn..IF1 wrap it.
    let elseBranch: Block | undefined = extra.hasElse
      ? this.block(inputBlock(block, 'ELSE'))
      : undefined;

    for (let i = elseIfCount; i >= 1; i--) {
      const arm: If = {
        id: generateId(),
        type: 'If',
        condition: this.expression(block, `IF${i}`),
        thenBranch: this.block(inputBlock(block, `DO${i}`)),
        ...(elseBranch ? { elseBranch } : {}),
      };
      elseBranch = { id: generateId(), type: 'Block', body: [arm] };
    }

    return {
      id: generateId(),
      type: 'If',
      condition: this.expression(block, 'IF0'),
      thenBranch: this.block(inputBlock(block, 'DO0')),
      ...(elseBranch ? { elseBranch } : {}),
    };
  }

  private functionDeclaration(block: BlockState): Statement {
    const extra = (block.extraState ?? {}) as { params?: Array<{ name: string }> };
    const params: Parameter[] = (extra.params ?? []).map((p) => ({
      id: generateId(),
      type: 'Parameter',
      name: p.name,
      paramType: 'auto',
    }));

    const body = this.block(inputBlock(block, 'STACK'));
    if (block.type === 'procedures_defreturn') {
      const value = inputBlock(block, 'RETURN');
      body.body.push({
        id: generateId(),
        type: 'Return',
        ...(value ? { value: this.expressionBlock(value) } : {}),
      });
    }

    return {
      id: generateId(),
      type: 'FunctionDeclaration',
      name: String(block.fields?.NAME ?? 'function'),
      params,
      body,
    };
  }

  private procedureCall(block: BlockState): Expression {
    const extra = (block.extraState ?? {}) as { name?: string; params?: string[] };
    const args: Expression[] = (extra.params ?? []).map((_, i) => {
      const arg = inputBlock(block, `ARG${i}`);
      if (!arg) throw new Error(`Call to "${extra.name}" is missing argument ${i + 1}.`);
      return this.expressionBlock(arg);
    });
    return {
      id: generateId(),
      type: 'CallExpression',
      callee: { id: generateId(), type: 'Identifier', name: extra.name ?? 'function' },
      arguments: args,
    };
  }

  /** Converts the block connected to `name`, erroring on empty slots. */
  private expression(parent: BlockState, name: string): Expression {
    const block = inputBlock(parent, name);
    if (!block) {
      throw new Error(`The "${parent.type}" block is missing its "${name}" value.`);
    }
    return this.expressionBlock(block);
  }

  private expressionBlock(block: BlockState): Expression {
    switch (block.type) {
      case 'math_number': {
        const value = Number(block.fields?.NUM ?? 0);
        return { id: generateId(), type: 'Literal', value, raw: String(value) };
      }

      case 'text': {
        const value = String(block.fields?.TEXT ?? '');
        return { id: generateId(), type: 'Literal', value, raw: JSON.stringify(value) };
      }

      case 'logic_boolean': {
        const value = block.fields?.BOOL === 'TRUE';
        return { id: generateId(), type: 'Literal', value, raw: String(value) };
      }

      case 'variables_get':
        return { id: generateId(), type: 'Identifier', name: this.variable(block, 'VAR') };

      case 'math_arithmetic':
        return this.binary(block, ARITHMETIC_OPS[String(block.fields?.OP)] ?? '+', 'A', 'B');

      case 'math_modulo':
        return this.binary(block, '%', 'DIVIDEND', 'DIVISOR');

      case 'logic_compare':
        return this.binary(block, COMPARE_OPS[String(block.fields?.OP)] ?? '==', 'A', 'B');

      case 'logic_operation':
        return this.binary(block, block.fields?.OP === 'OR' ? 'or' : 'and', 'A', 'B');

      case 'logic_negate':
        return {
          id: generateId(),
          type: 'UnaryExpression',
          operator: 'not',
          argument: this.expression(block, 'BOOL'),
        };

      case 'text_join': {
        // "join a b c" — string concatenation, folded left as a + b + c.
        const extra = (block.extraState ?? {}) as { itemCount?: number };
        const count = extra.itemCount ?? 2;
        const items: Expression[] = [];
        for (let i = 0; i < count; i++) {
          const item = inputBlock(block, `ADD${i}`);
          if (item) items.push(this.expressionBlock(item));
        }
        if (items.length === 0) {
          return { id: generateId(), type: 'Literal', value: '', raw: '""' };
        }
        return items.reduce((left, right) => ({
          id: generateId(),
          type: 'BinaryExpression',
          operator: '+',
          left,
          right,
        }));
      }

      case 'lists_create_with': {
        const extra = (block.extraState ?? {}) as { itemCount?: number };
        const count = extra.itemCount ?? 0;
        const elements: Expression[] = [];
        for (let i = 0; i < count; i++) {
          const item = inputBlock(block, `ADD${i}`);
          if (item) elements.push(this.expressionBlock(item));
        }
        return { id: generateId(), type: 'ArrayLiteral', elements };
      }

      case 'praxly_list_get':
        // item i of list  ->  list[i-1]
        return {
          id: generateId(),
          type: 'IndexExpression',
          object: this.expression(block, 'LIST'),
          index: this.toZeroBasedIndex(this.expression(block, 'INDEX')),
        };

      case 'praxly_length':
        return {
          id: generateId(),
          type: 'CallExpression',
          callee: { id: generateId(), type: 'Identifier', name: 'len' },
          arguments: [this.expression(block, 'VALUE')],
        };

      case 'praxly_str_substring':
        // substring from a to b (1-based inclusive) -> s.substring(a-1, b).
        return this.methodCall(this.expression(block, 'STR'), 'substring', [
          this.toZeroBasedIndex(this.expression(block, 'START')),
          this.expression(block, 'END'),
        ]);

      case 'praxly_str_charat':
        return this.methodCall(this.expression(block, 'STR'), 'charAt', [
          this.toZeroBasedIndex(this.expression(block, 'INDEX')),
        ]);

      case 'praxly_str_upper':
        return this.methodCall(this.expression(block, 'STR'), 'toUpperCase', []);

      case 'praxly_str_lower':
        return this.methodCall(this.expression(block, 'STR'), 'toLowerCase', []);

      case 'praxly_str_contains':
        return this.methodCall(this.expression(block, 'STR'), 'contains', [
          this.expression(block, 'SEARCH'),
        ]);

      case 'praxly_abs':
        return this.freeCall('abs', [this.expression(block, 'X')]);
      case 'praxly_sqrt':
        return this.freeCall('sqrt', [this.expression(block, 'X')]);
      case 'praxly_min':
        return this.freeCall('min', [this.expression(block, 'A'), this.expression(block, 'B')]);
      case 'praxly_max':
        return this.freeCall('max', [this.expression(block, 'A'), this.expression(block, 'B')]);
      case 'praxly_random':
        return this.freeCall('random', []);
      case 'praxly_random_int':
        return this.freeCall('randomInt', [this.expression(block, 'N')]);
      case 'praxly_random_range':
        // RANDOM(a, b): inclusive integer in [a, b].
        return this.freeCall('RANDOM', [this.expression(block, 'A'), this.expression(block, 'B')]);
      case 'praxly_to_int':
        return this.freeCall('int', [this.expression(block, 'X')]);
      case 'praxly_to_float':
        return this.freeCall('float', [this.expression(block, 'X')]);
      case 'praxly_to_str':
        return this.freeCall('str', [this.expression(block, 'X')]);

      case 'praxly_input':
        return {
          id: generateId(),
          type: 'CallExpression',
          callee: { id: generateId(), type: 'Identifier', name: 'input' },
          arguments: [],
        };

      case 'procedures_callreturn':
        return this.procedureCall(block);

      default:
        throw new Error(`The "${block.type}" block can't be used as a value here.`);
    }
  }

  private binary(block: BlockState, operator: string, leftName: string, rightName: string) {
    return {
      id: generateId(),
      type: 'BinaryExpression' as const,
      operator,
      left: this.expression(block, leftName),
      right: this.expression(block, rightName),
    };
  }

  /** Builds an `obj.method(args)` call node for a string-method block. */
  private methodCall(object: Expression, method: string, args: Expression[]): Expression {
    return {
      id: generateId(),
      type: 'CallExpression',
      callee: {
        id: generateId(),
        type: 'MemberExpression',
        object,
        property: { id: generateId(), type: 'Identifier', name: method },
        isMethod: true,
      },
      arguments: args,
    };
  }

  /** Wraps a CSP-style list builtin (APPEND/INSERT/REMOVE) as a statement. */
  private listCallStatement(name: string, args: Expression[]): Statement {
    return {
      id: generateId(),
      type: 'ExpressionStatement',
      expression: {
        id: generateId(),
        type: 'CallExpression',
        callee: { id: generateId(), type: 'Identifier', name },
        arguments: args,
      },
    };
  }

  /** Converts a 1-based block index to a 0-based AST index (mirrors the CSP
   *  parser's toZeroBased: decrement a literal, else wrap in `x - 1`). */
  private toZeroBasedIndex(index: Expression): Expression {
    if (index.type === 'Literal' && typeof index.value === 'number') {
      const v = index.value - 1;
      return { id: generateId(), type: 'Literal', value: v, raw: String(v) };
    }
    return {
      id: generateId(),
      type: 'BinaryExpression',
      operator: '-',
      left: index,
      right: { id: generateId(), type: 'Literal', value: 1, raw: '1' },
    };
  }

  /** Builds a free-function call node (Identifier callee). */
  private freeCall(name: string, args: Expression[]): Expression {
    return {
      id: generateId(),
      type: 'CallExpression',
      callee: { id: generateId(), type: 'Identifier', name },
      arguments: args,
    };
  }

  private rangeCall(args: Expression[]): Expression {
    return {
      id: generateId(),
      type: 'CallExpression',
      callee: { id: generateId(), type: 'Identifier', name: 'range' },
      arguments: args,
    };
  }

  /** Resolves a field_variable field ({ id }) to the variable's name. */
  private variable(block: BlockState, field: string): string {
    const ref = block.fields?.[field] as { id?: string } | undefined;
    const name = ref?.id ? this.varNames.get(ref.id) : undefined;
    if (!name) {
      throw new Error(`The "${block.type}" block references an unknown variable.`);
    }
    return name;
  }
}
