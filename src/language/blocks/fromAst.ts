/**
 * Blocks "emitter": converts the Universal AST into a Blockly workspace
 * serialization (JSON). The inverse of toAst.ts.
 *
 * Blockly validates connection type checks when loading, so the generated
 * JSON must be type-correct — e.g. string concatenation becomes a text_join
 * block (whose inputs accept anything) rather than math_arithmetic (whose
 * inputs only accept Number).
 *
 * AST constructs with no block equivalent (classes, try/catch, lists, …)
 * throw, which the translation layer reports as "translation not available".
 */

import type {
  Assignment,
  Block,
  Expression,
  ForEach,
  FunctionDeclaration,
  If,
  Print,
  Program,
  Statement,
} from '../ast';
import { lvalueName } from '../ast';
import type { BlockState, WorkspaceState } from './serialization';

const COMPARE_OPS: Record<string, string> = {
  '==': 'EQ',
  '!=': 'NEQ',
  '<': 'LT',
  '<=': 'LTE',
  '>': 'GT',
  '>=': 'GTE',
};

const ARITHMETIC_OPS: Record<string, string> = {
  '+': 'ADD',
  '-': 'MINUS',
  '*': 'MULTIPLY',
  '/': 'DIVIDE',
  '**': 'POWER',
  '^': 'POWER',
};

/** Converts a Program to Blockly workspace JSON, returned as a string. */
export function programToBlocksJson(program: Program): string {
  return JSON.stringify(new BlocksWriter(program).write());
}

class BlocksWriter {
  /** Variable name → stable Blockly variable id. */
  private variables = new Map<string, string>();
  /** Function name → parameter names, for building caller blocks. */
  private functionParams = new Map<string, string[]>();

  constructor(private program: Program) {
    for (const stmt of program.body) {
      if (stmt.type === 'FunctionDeclaration') {
        this.functionParams.set(
          stmt.name,
          stmt.params.map((p) => p.name)
        );
      }
    }
  }

  write(): WorkspaceState {
    const topBlocks: BlockState[] = [];
    const mainChain: Statement[] = [];

    for (const stmt of this.program.body) {
      if (stmt.type === 'FunctionDeclaration') {
        topBlocks.push(this.functionDefinition(stmt));
      } else {
        mainChain.push(stmt);
      }
    }
    const main = this.chain(mainChain);
    if (main) topBlocks.push(main);

    // Rough vertical spread; the workspace tidies the layout after loading.
    topBlocks.forEach((block, i) => {
      block.x = 24;
      block.y = 24 + i * 160;
    });

    return {
      blocks: { languageVersion: 0, blocks: topBlocks },
      variables: [...this.variables].map(([name, id]) => ({ name, id })),
    };
  }

  /** Links a statement list into one block chain via `next` connections. */
  private chain(statements: Statement[]): BlockState | undefined {
    let head: BlockState | undefined;
    let tail: BlockState | undefined;
    for (const stmt of statements) {
      const block = this.statement(stmt);
      if (tail) tail.next = { block };
      else head = block;
      tail = block;
    }
    return head;
  }

  private statementInput(body: Block): { block: BlockState } | undefined {
    const block = this.chain(body.body);
    return block ? { block } : undefined;
  }

  private statement(stmt: Statement): BlockState {
    switch (stmt.type) {
      case 'Assignment':
        return this.assignment(stmt);

      case 'Print':
        return this.print(stmt);

      case 'If':
        return this.ifStatement(stmt);

      case 'While': {
        // while (not c) reads better as Blockly's "repeat until c".
        const negated =
          stmt.condition.type === 'UnaryExpression' &&
          (stmt.condition.operator === 'not' || stmt.condition.operator === '!');
        return this.withInputs(
          {
            type: 'controls_whileUntil',
            fields: { MODE: negated ? 'UNTIL' : 'WHILE' },
          },
          {
            BOOL: this.value(negated ? (stmt.condition as any).argument : stmt.condition),
            DO: this.statementInput(stmt.body),
          }
        );
      }

      case 'RepeatUntil':
        return this.withInputs(
          { type: 'praxly_repeat_until' },
          { COND: this.value(stmt.condition), DO: this.statementInput(stmt.body) }
        );

      case 'DoWhile':
        // do { … } while (c)  ≡  repeat { … } until (not c)
        return this.withInputs(
          { type: 'praxly_repeat_until' },
          {
            COND: this.value(this.negate(stmt.condition)),
            DO: this.statementInput(stmt.body),
          }
        );

      case 'ForEach':
        return this.forEachStatement(stmt);

      case 'Break':
        return { type: 'controls_flow_statements', fields: { FLOW: 'BREAK' } };

      case 'Continue':
        return { type: 'controls_flow_statements', fields: { FLOW: 'CONTINUE' } };

      case 'Return': {
        const inputs: BlockState['inputs'] = {};
        if (stmt.value) inputs.VALUE = { block: this.expression(stmt.value) };
        return { type: 'praxly_return', inputs };
      }

      case 'ExpressionStatement': {
        const expr = stmt.expression;
        if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier') {
          return this.procedureCall(expr.callee.name, expr.arguments, false);
        }
        throw new Error(`Blocks view doesn't support this expression statement.`);
      }

      default:
        throw new Error(`Blocks view doesn't support ${stmt.type} statements yet.`);
    }
  }

  private assignment(stmt: Assignment): BlockState {
    const name = lvalueName(stmt);
    if (name === undefined) {
      throw new Error('Blocks view only supports assigning to plain variables.');
    }
    return this.withInputs(
      { type: 'variables_set', fields: { VAR: { id: this.variableId(name) } } },
      { VALUE: this.value(stmt.value) }
    );
  }

  private print(stmt: Print): BlockState {
    // print(a, b) joins its arguments with spaces, mirroring the default
    // Print separator. A single argument prints as-is.
    let value: Expression = stmt.expressions[0] ?? {
      id: 'blocks-empty-print',
      type: 'Literal',
      value: '',
      raw: '""',
    };
    for (const expr of stmt.expressions.slice(1)) {
      const spacer: Expression = {
        id: `blocks-sep-${expr.id}`,
        type: 'Literal',
        value: ' ',
        raw: '" "',
      };
      value = this.join(this.join(value, spacer), expr);
    }
    return this.withInputs({ type: 'praxly_print' }, { VALUE: this.value(value) });
  }

  private join(left: Expression, right: Expression): Expression {
    return {
      id: `blocks-join-${right.id}`,
      type: 'BinaryExpression',
      operator: '+',
      left,
      right,
    };
  }

  private ifStatement(stmt: If): BlockState {
    // Fold "else { if … }" chains into Blockly's else-if mutation so the
    // block reads like the original else-if ladder.
    const conditions = [this.value(stmt.condition)];
    const branches = [this.statementInput(stmt.thenBranch)];
    let elseBranch = stmt.elseBranch;

    while (elseBranch && elseBranch.body.length === 1 && elseBranch.body[0].type === 'If') {
      const arm = elseBranch.body[0] as If;
      conditions.push(this.value(arm.condition));
      branches.push(this.statementInput(arm.thenBranch));
      elseBranch = arm.elseBranch;
    }

    const inputs: BlockState['inputs'] = {};
    conditions.forEach((cond, i) => {
      inputs[`IF${i}`] = cond;
      const branch = branches[i];
      if (branch) inputs[`DO${i}`] = branch;
    });
    if (elseBranch) {
      const chained = this.statementInput(elseBranch);
      if (chained) inputs.ELSE = chained;
    }

    const block: BlockState = { type: 'controls_if', inputs };
    if (conditions.length > 1 || elseBranch) {
      block.extraState = {
        ...(conditions.length > 1 ? { elseIfCount: conditions.length - 1 } : {}),
        ...(elseBranch ? { hasElse: true } : {}),
      };
    }
    return block;
  }

  private forEachStatement(stmt: ForEach): BlockState {
    const iterable = stmt.iterable;
    const isRange =
      iterable?.type === 'CallExpression' &&
      iterable.callee.type === 'Identifier' &&
      iterable.callee.name.toLowerCase() === 'range';
    if (!isRange) {
      throw new Error('Blocks view only supports counted loops over range(…).');
    }

    const args = iterable.arguments;
    if (args.length === 1 && !this.usesIdentifier(stmt.body, stmt.variable)) {
      // range(n) with an unused loop variable is just "repeat n times".
      return this.withInputs(
        { type: 'controls_repeat_ext' },
        { TIMES: this.value(args[0]), DO: this.statementInput(stmt.body) }
      );
    }
    if (args.length > 2) {
      throw new Error('Blocks view supports range(end) and range(start, end), not a step.');
    }

    const from: Expression =
      args.length === 2
        ? args[0]
        : { id: `blocks-from-${stmt.id}`, type: 'Literal', value: 0, raw: '0' };
    const to = args.length === 2 ? args[1] : args[0];

    return this.withInputs(
      {
        type: 'praxly_for_range',
        fields: { VAR: { id: this.variableId(stmt.variable) } },
      },
      { FROM: this.value(from), TO: this.value(to), DO: this.statementInput(stmt.body) }
    );
  }

  private functionDefinition(stmt: FunctionDeclaration): BlockState {
    const body = [...stmt.body.body];
    const hasValueReturn = this.hasValueReturn(stmt.body);

    // A trailing "return x" becomes the definition block's RETURN slot;
    // any earlier returns stay in the stack as praxly_return blocks.
    let returnValue: Expression | undefined;
    const last = body.at(-1);
    if (hasValueReturn && last?.type === 'Return') {
      returnValue = last.value;
      body.pop();
    } else if (!hasValueReturn && last?.type === 'Return') {
      body.pop(); // a bare trailing return is implicit
    }

    const inputs: BlockState['inputs'] = {};
    const stack = this.chain(body);
    if (stack) inputs.STACK = { block: stack };
    if (returnValue) inputs.RETURN = { block: this.expression(returnValue) };

    return {
      type: hasValueReturn ? 'procedures_defreturn' : 'procedures_defnoreturn',
      fields: { NAME: stmt.name },
      extraState:
        stmt.params.length > 0
          ? { params: stmt.params.map((p) => ({ name: p.name, id: this.variableId(p.name) })) }
          : undefined,
      inputs,
    };
  }

  private procedureCall(name: string, args: Expression[], isExpression: boolean): BlockState {
    if (name === 'input' || name === 'INPUT') {
      if (isExpression) return { type: 'praxly_input' };
      throw new Error('input() can only be used as a value in the Blocks view.');
    }
    const params = this.functionParams.get(name);
    if (!params) {
      throw new Error(`Blocks view doesn't support calls to built-in "${name}".`);
    }

    const inputs: BlockState['inputs'] = {};
    args.forEach((arg, i) => {
      inputs[`ARG${i}`] = { block: this.expression(arg) };
    });
    return {
      type: isExpression ? 'procedures_callreturn' : 'procedures_callnoreturn',
      extraState: { name, params },
      inputs,
    };
  }

  private value(expr: Expression): { block: BlockState } {
    return { block: this.expression(expr) };
  }

  private expression(expr: Expression): BlockState {
    switch (expr.type) {
      case 'Literal': {
        if (typeof expr.value === 'boolean') {
          return { type: 'logic_boolean', fields: { BOOL: expr.value ? 'TRUE' : 'FALSE' } };
        }
        if (typeof expr.value === 'number') {
          return { type: 'math_number', fields: { NUM: expr.value } };
        }
        return { type: 'text', fields: { TEXT: String(expr.value ?? '') } };
      }

      case 'Identifier':
        return { type: 'variables_get', fields: { VAR: { id: this.variableId(expr.name) } } };

      case 'BinaryExpression': {
        const { operator } = expr;
        if (operator in COMPARE_OPS) {
          return this.binary('logic_compare', COMPARE_OPS[operator], expr.left, expr.right);
        }
        if (operator === 'and' || operator === '&&' || operator === 'or' || operator === '||') {
          const op = operator === 'and' || operator === '&&' ? 'AND' : 'OR';
          return this.binary('logic_operation', op, expr.left, expr.right);
        }
        if (operator === '%') {
          const a = this.expression(expr.left);
          const b = this.expression(expr.right);
          return {
            type: 'math_modulo',
            inputs: { DIVIDEND: { block: a }, DIVISOR: { block: b } },
          };
        }
        if (operator in ARITHMETIC_OPS) {
          const a = this.expression(expr.left);
          const b = this.expression(expr.right);
          // Strings can't connect to math_arithmetic's Number inputs —
          // string-ish "+" becomes a join block instead.
          if (operator === '+' && (this.isStringy(a) || this.isStringy(b))) {
            return {
              type: 'text_join',
              extraState: { itemCount: 2 },
              inputs: { ADD0: { block: a }, ADD1: { block: b } },
            };
          }
          return {
            type: 'math_arithmetic',
            fields: { OP: ARITHMETIC_OPS[operator] },
            inputs: { A: { block: a }, B: { block: b } },
          };
        }
        throw new Error(`Blocks view doesn't support the "${operator}" operator.`);
      }

      case 'UnaryExpression': {
        if (expr.operator === 'not' || expr.operator === '!') {
          return this.withInputs({ type: 'logic_negate' }, { BOOL: this.value(expr.argument) });
        }
        if (expr.operator === '-') {
          if (expr.argument.type === 'Literal' && typeof expr.argument.value === 'number') {
            return { type: 'math_number', fields: { NUM: -expr.argument.value } };
          }
          return this.binary(
            'math_arithmetic',
            'MINUS',
            { id: `blocks-neg-${expr.id}`, type: 'Literal', value: 0, raw: '0' },
            expr.argument,
            { OP: 'MINUS' }
          );
        }
        if (expr.operator === '+') return this.expression(expr.argument);
        throw new Error(`Blocks view doesn't support unary "${expr.operator}".`);
      }

      case 'CallExpression':
        if (expr.callee.type !== 'Identifier') {
          throw new Error('Blocks view only supports calling named functions.');
        }
        return this.procedureCall(expr.callee.name, expr.arguments, true);

      default:
        throw new Error(`Blocks view doesn't support ${expr.type} expressions yet.`);
    }
  }

  private binary(
    type: string,
    op: string,
    left: Expression,
    right: Expression,
    fields?: Record<string, unknown>
  ): BlockState {
    return {
      type,
      fields: fields ?? { OP: op },
      inputs: { A: { block: this.expression(left) }, B: { block: this.expression(right) } },
    };
  }

  private negate(expr: Expression): Expression {
    // not(not(x)) → x, otherwise wrap in a not.
    if (expr.type === 'UnaryExpression' && (expr.operator === 'not' || expr.operator === '!')) {
      return expr.argument;
    }
    return {
      id: `blocks-not-${expr.id}`,
      type: 'UnaryExpression',
      operator: 'not',
      argument: expr,
    };
  }

  /** True when the generated block outputs a String (join/text literal). */
  private isStringy(state: BlockState): boolean {
    return state.type === 'text' || state.type === 'text_join';
  }

  private hasValueReturn(node: unknown): boolean {
    if (!node || typeof node !== 'object') return false;
    const record = node as Record<string, unknown>;
    if (record.type === 'Return' && record.value) return true;
    // Nested function declarations own their returns.
    if (record.type === 'FunctionDeclaration') return false;
    return Object.values(record).some((value) =>
      Array.isArray(value) ? value.some((v) => this.hasValueReturn(v)) : this.hasValueReturn(value)
    );
  }

  private usesIdentifier(node: unknown, name: string): boolean {
    if (!node || typeof node !== 'object') return false;
    const record = node as Record<string, unknown>;
    if (record.type === 'Identifier' && record.name === name) return true;
    return Object.values(record).some((value) =>
      Array.isArray(value)
        ? value.some((v) => this.usesIdentifier(v, name))
        : this.usesIdentifier(value, name)
    );
  }

  private withInputs(
    block: BlockState,
    inputs: Record<string, { block: BlockState } | undefined>
  ): BlockState {
    const present: BlockState['inputs'] = {};
    for (const [name, input] of Object.entries(inputs)) {
      if (input) present[name] = input;
    }
    return { ...block, inputs: present };
  }

  private variableId(name: string): string {
    let id = this.variables.get(name);
    if (!id) {
      id = `var_${name}`;
      this.variables.set(name, id);
    }
    return id;
  }
}
