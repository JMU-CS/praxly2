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
      message0: 'print %1',
      args0: [{ type: 'input_value', name: 'VALUE' }],
      previousStatement: null,
      nextStatement: null,
      style: 'text_blocks',
      tooltip: 'Print a value to the output panel.',
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
