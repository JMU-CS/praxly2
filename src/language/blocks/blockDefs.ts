/**
 * Custom Blockly block definitions, toolbox, and theme for the Blocks view.
 *
 * The Blocks language only exposes constructs that exist in every text
 * language in this project (Python, Java, JavaScript, CSP, Praxis):
 * variables, arithmetic/comparison/logic expressions, if/else, while and
 * repeat-until loops, counted loops over a range, print/input, and
 * functions. Anything outside that set has no block, so students can't
 * build a program that fails to translate.
 *
 * Standard Blockly blocks are reused wherever their semantics match the
 * Universal AST; the four `praxly_*` blocks below cover the gaps:
 * print/input (Blockly's text_print has no equivalent AST node shape we
 * want) and the two loop forms whose semantics differ from Blockly's
 * stock loops (post-condition repeat-until, exclusive-end range loop).
 */

import * as Blockly from 'blockly';

let registered = false;

/** Defines the praxly_* blocks. Safe to call more than once. */
export function registerPraxlyBlocks(): void {
  if (registered) return;
  registered = true;

  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'praxly_print',
      message0: 'print %1 %2',
      args0: [
        { type: 'input_value', name: 'VALUE' },
        {
          type: 'field_dropdown',
          name: 'NL',
          // What follows the printed value: a newline (normal print), a space
          // (AP CSP's DISPLAY), or nothing. Round-trips Print.appendLineFeed /
          // Print.separator faithfully.
          options: [
            ['↵ new line', 'NEWLINE'],
            ['␣ space', 'SPACE'],
            ['no break', 'NONE'],
          ],
        },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'text_blocks',
      tooltip:
        'Print a value to the output panel. The dropdown sets what comes after it: ' +
        'a new line, a space (like CSP DISPLAY), or nothing.',
    },
    {
      type: 'praxly_input',
      message0: 'ask for input',
      // No output check: input() results get compared, concatenated, etc.
      output: null,
      style: 'text_blocks',
      tooltip: 'Pause the program and read a line of input from the user.',
    },
    {
      type: 'praxly_repeat_until',
      message0: 'repeat %1 until %2',
      args0: [
        { type: 'input_statement', name: 'DO' },
        { type: 'input_value', name: 'COND', check: 'Boolean' },
      ],
      previousStatement: null,
      nextStatement: null,
      style: 'loop_blocks',
      tooltip:
        'Run the body, then check the condition — the body always runs at least once ' +
        '(like Praxis "repeat … until").',
    },
    {
      type: 'praxly_return',
      message0: 'return %1',
      args0: [{ type: 'input_value', name: 'VALUE' }],
      previousStatement: null,
      nextStatement: null,
      style: 'procedure_blocks',
      tooltip: 'Leave the function, optionally handing back a value. Use inside a function.',
    },
    {
      type: 'praxly_for_range',
      message0: 'count with %1 from %2 up to %3 %4',
      args0: [
        { type: 'field_variable', name: 'VAR', variable: 'i' },
        { type: 'input_value', name: 'FROM' },
        { type: 'input_value', name: 'TO' },
        { type: 'input_statement', name: 'DO' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'loop_blocks',
      tooltip:
        'Count from the first number up to (but not including) the second, ' +
        'like range(from, to).',
    },
    {
      type: 'praxly_forever',
      message0: 'repeat forever %1',
      args0: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      style: 'loop_blocks',
      tooltip: 'Repeat the body forever. Put a "break" inside to stop.',
    },
    {
      type: 'praxly_for_each',
      message0: 'for each %1 in %2 %3',
      args0: [
        { type: 'field_variable', name: 'VAR', variable: 'item' },
        { type: 'input_value', name: 'LIST' },
        { type: 'input_statement', name: 'DO' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'loop_blocks',
      tooltip:
        'Run the body once for each element of the list, with the variable set ' +
        'to each element in turn.',
    },
    // ---- Lists (1-based, matching AP CSP) ---------------------------------
    {
      type: 'praxly_list_get',
      message0: 'item %1 of %2',
      args0: [
        { type: 'input_value', name: 'INDEX' },
        { type: 'input_value', name: 'LIST' },
      ],
      inputsInline: true,
      output: null,
      style: 'list_blocks',
      tooltip: 'Get the element of a list at a position. The first item is at position 1.',
    },
    {
      type: 'praxly_list_set',
      message0: 'set item %1 of %2 to %3',
      args0: [
        { type: 'input_value', name: 'INDEX' },
        { type: 'input_value', name: 'LIST' },
        { type: 'input_value', name: 'VALUE' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'list_blocks',
      tooltip: 'Replace the element of a list at a position. The first item is at position 1.',
    },
    {
      type: 'praxly_list_append',
      message0: 'append %1 to %2',
      args0: [
        { type: 'input_value', name: 'VALUE' },
        { type: 'input_value', name: 'LIST' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'list_blocks',
      tooltip: 'Add a value to the end of a list.',
    },
    {
      type: 'praxly_list_insert',
      message0: 'insert %1 at %2 in %3',
      args0: [
        { type: 'input_value', name: 'VALUE' },
        { type: 'input_value', name: 'INDEX' },
        { type: 'input_value', name: 'LIST' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'list_blocks',
      tooltip: 'Insert a value into a list at a position, shifting later items right.',
    },
    {
      type: 'praxly_list_remove',
      message0: 'remove item %1 from %2',
      args0: [
        { type: 'input_value', name: 'INDEX' },
        { type: 'input_value', name: 'LIST' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: 'list_blocks',
      tooltip: 'Remove the element of a list at a position, shifting later items left.',
    },
    {
      type: 'praxly_length',
      message0: 'length of %1',
      args0: [{ type: 'input_value', name: 'VALUE' }],
      output: null,
      style: 'list_blocks',
      tooltip: 'The number of elements in a list, or characters in a string.',
    },
    // ---- Strings (1-based positions, matching AP CSP) ---------------------
    {
      type: 'praxly_str_substring',
      message0: 'substring of %1 from %2 to %3',
      args0: [
        { type: 'input_value', name: 'STR' },
        { type: 'input_value', name: 'START' },
        { type: 'input_value', name: 'END' },
      ],
      inputsInline: true,
      output: null,
      style: 'text_blocks',
      tooltip: 'The characters from the start position to the end position, inclusive (1-based).',
    },
    {
      type: 'praxly_str_charat',
      message0: 'character %1 of %2',
      args0: [
        { type: 'input_value', name: 'INDEX' },
        { type: 'input_value', name: 'STR' },
      ],
      inputsInline: true,
      output: null,
      style: 'text_blocks',
      tooltip: 'The single character at a position. The first character is at position 1.',
    },
    {
      type: 'praxly_str_upper',
      message0: '%1 in upper case',
      args0: [{ type: 'input_value', name: 'STR' }],
      output: null,
      style: 'text_blocks',
      tooltip: 'A copy of the string with every letter in upper case.',
    },
    {
      type: 'praxly_str_lower',
      message0: '%1 in lower case',
      args0: [{ type: 'input_value', name: 'STR' }],
      output: null,
      style: 'text_blocks',
      tooltip: 'A copy of the string with every letter in lower case.',
    },
    {
      type: 'praxly_str_contains',
      message0: '%1 contains %2',
      args0: [
        { type: 'input_value', name: 'STR' },
        { type: 'input_value', name: 'SEARCH' },
      ],
      inputsInline: true,
      output: 'Boolean',
      style: 'text_blocks',
      tooltip: 'True if the first string contains the second string.',
    },
    // ---- Math functions --------------------------------------------------
    {
      type: 'praxly_abs',
      message0: 'absolute value of %1',
      args0: [{ type: 'input_value', name: 'X' }],
      output: null,
      style: 'math_blocks',
      tooltip: 'The distance of a number from zero (its value without a sign).',
    },
    {
      type: 'praxly_sqrt',
      message0: 'square root of %1',
      args0: [{ type: 'input_value', name: 'X' }],
      output: null,
      style: 'math_blocks',
      tooltip: 'The square root of a number.',
    },
    {
      type: 'praxly_min',
      message0: 'smaller of %1 and %2',
      args0: [
        { type: 'input_value', name: 'A' },
        { type: 'input_value', name: 'B' },
      ],
      inputsInline: true,
      output: null,
      style: 'math_blocks',
      tooltip: 'The smaller of two numbers.',
    },
    {
      type: 'praxly_max',
      message0: 'larger of %1 and %2',
      args0: [
        { type: 'input_value', name: 'A' },
        { type: 'input_value', name: 'B' },
      ],
      inputsInline: true,
      output: null,
      style: 'math_blocks',
      tooltip: 'The larger of two numbers.',
    },
    // ---- Random ----------------------------------------------------------
    {
      type: 'praxly_random',
      message0: 'random number',
      output: null,
      style: 'math_blocks',
      tooltip: 'A random decimal from 0 up to (but not including) 1.',
    },
    {
      type: 'praxly_random_int',
      message0: 'random integer below %1',
      args0: [{ type: 'input_value', name: 'N' }],
      output: null,
      style: 'math_blocks',
      tooltip: 'A random integer from 0 up to (but not including) N.',
    },
    {
      type: 'praxly_random_range',
      message0: 'random integer from %1 to %2',
      args0: [
        { type: 'input_value', name: 'A' },
        { type: 'input_value', name: 'B' },
      ],
      inputsInline: true,
      output: null,
      style: 'math_blocks',
      tooltip: 'A random integer from A to B, including both (like CSP RANDOM).',
    },
    {
      type: 'praxly_random_seed',
      message0: 'seed random with %1',
      args0: [{ type: 'input_value', name: 'SEED' }],
      previousStatement: null,
      nextStatement: null,
      style: 'math_blocks',
      tooltip: 'Seed the random generator so it produces a repeatable sequence.',
    },
    // ---- Type conversion -------------------------------------------------
    {
      type: 'praxly_to_int',
      message0: '%1 as an integer',
      args0: [{ type: 'input_value', name: 'X' }],
      output: null,
      style: 'math_blocks',
      tooltip: 'Convert a value to a whole number.',
    },
    {
      type: 'praxly_to_float',
      message0: '%1 as a decimal',
      args0: [{ type: 'input_value', name: 'X' }],
      output: null,
      style: 'math_blocks',
      tooltip: 'Convert a value to a decimal number.',
    },
    {
      type: 'praxly_to_str',
      message0: '%1 as text',
      args0: [{ type: 'input_value', name: 'X' }],
      output: null,
      style: 'text_blocks',
      tooltip: 'Convert a value to a string of text.',
    },
  ]);
}

/** Category toolbox shown on the left edge of the Blocks editor. */
export const PRAXLY_TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Logic',
      categorystyle: 'logic_category',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
      ],
    },
    {
      kind: 'category',
      name: 'Loops',
      categorystyle: 'loop_category',
      contents: [
        {
          kind: 'block',
          type: 'controls_repeat_ext',
          inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 10 } } } },
        },
        { kind: 'block', type: 'praxly_forever' },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'praxly_repeat_until' },
        {
          kind: 'block',
          type: 'praxly_for_range',
          inputs: {
            FROM: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
            TO: { shadow: { type: 'math_number', fields: { NUM: 10 } } },
          },
        },
        { kind: 'block', type: 'praxly_for_each' },
        { kind: 'block', type: 'controls_flow_statements' },
      ],
    },
    {
      kind: 'category',
      name: 'Math',
      categorystyle: 'math_category',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_modulo' },
        { kind: 'block', type: 'praxly_abs' },
        { kind: 'block', type: 'praxly_sqrt' },
        { kind: 'block', type: 'praxly_min' },
        { kind: 'block', type: 'praxly_max' },
        { kind: 'block', type: 'praxly_random' },
        {
          kind: 'block',
          type: 'praxly_random_int',
          inputs: { N: { shadow: { type: 'math_number', fields: { NUM: 10 } } } },
        },
        {
          kind: 'block',
          type: 'praxly_random_range',
          inputs: {
            A: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
            B: { shadow: { type: 'math_number', fields: { NUM: 6 } } },
          },
        },
        { kind: 'block', type: 'praxly_random_seed' },
        { kind: 'block', type: 'praxly_to_int' },
        { kind: 'block', type: 'praxly_to_float' },
      ],
    },
    {
      kind: 'category',
      name: 'Text',
      categorystyle: 'text_category',
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'praxly_print' },
        { kind: 'block', type: 'praxly_input' },
        {
          kind: 'block',
          type: 'praxly_str_substring',
          inputs: {
            START: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
            END: { shadow: { type: 'math_number', fields: { NUM: 3 } } },
          },
        },
        {
          kind: 'block',
          type: 'praxly_str_charat',
          inputs: { INDEX: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
        },
        { kind: 'block', type: 'praxly_str_upper' },
        { kind: 'block', type: 'praxly_str_lower' },
        { kind: 'block', type: 'praxly_str_contains' },
        { kind: 'block', type: 'praxly_to_str' },
      ],
    },
    {
      kind: 'category',
      name: 'Lists',
      categorystyle: 'list_category',
      contents: [
        { kind: 'block', type: 'lists_create_with' },
        {
          kind: 'block',
          type: 'praxly_list_get',
          inputs: { INDEX: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
        },
        {
          kind: 'block',
          type: 'praxly_list_set',
          inputs: { INDEX: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
        },
        { kind: 'block', type: 'praxly_list_append' },
        {
          kind: 'block',
          type: 'praxly_list_insert',
          inputs: { INDEX: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
        },
        {
          kind: 'block',
          type: 'praxly_list_remove',
          inputs: { INDEX: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
        },
        { kind: 'block', type: 'praxly_length' },
      ],
    },
    // Dynamic categories: Blockly fills these flyouts itself (variable
    // create/get/set blocks, function definition + call blocks).
    { kind: 'category', name: 'Variables', categorystyle: 'variable_category', custom: 'VARIABLE' },
    {
      kind: 'category',
      name: 'Functions',
      categorystyle: 'procedure_category',
      custom: 'PROCEDURE',
    },
  ],
};

/** The app's sans stack (Tailwind `font-sans`), reused for block text. */
export const PRAXLY_BLOCKLY_FONT = 'ui-sans-serif, system-ui, sans-serif';

const PRAXLY_COMPONENT_STYLES = {
  workspaceBackgroundColour: '#020617', // slate-950
  toolboxBackgroundColour: '#0f172a', // slate-900
  toolboxForegroundColour: '#94a3b8', // slate-400
  flyoutBackgroundColour: '#1e293b', // slate-800
  flyoutForegroundColour: '#cbd5e1', // slate-300
  flyoutOpacity: 0.97,
  scrollbarColour: '#334155', // slate-700
  scrollbarOpacity: 0.55,
  insertionMarkerColour: '#818cf8', // indigo-400
  insertionMarkerOpacity: 0.5,
  cursorColour: '#818cf8',
};

/**
 * Dark theme tuned to Praxly's slate/indigo editor palette.
 *
 * Built per font size (instead of a static theme) so the workspace can
 * follow the app's Settings → text size: `fontSizePx` is the same pixel
 * value the code editors use. Blockly's fontStyle.size is in points, hence
 * the 0.75 conversion. Passing a fresh Theme to workspace.setTheme() makes
 * Blockly re-measure and re-render every block at the new size.
 */
export function praxlyTheme(fontSizePx: number): Blockly.Theme {
  // The size is baked into the theme name on purpose: Blockly caches its
  // injected stylesheet per theme-name-derived CSS selector and silently
  // skips re-injection when the name is unchanged, so a same-name theme
  // swap would never update the block font CSS.
  const theme = new Blockly.Theme(
    `praxly-dark-${Math.round(fontSizePx)}`,
    Blockly.Themes.Classic.blockStyles,
    Blockly.Themes.Classic.categoryStyles,
    PRAXLY_COMPONENT_STYLES
  );
  theme.fontStyle = { family: PRAXLY_BLOCKLY_FONT, size: fontSizePx * 0.75 };
  return theme;
}
