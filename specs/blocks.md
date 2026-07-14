# Blocks

Blocks is Praxly's visual, drag-and-drop language, built on [Blockly](https://developers.google.com/blockly).
Unlike the text languages it has no lexer/parser: its "source" is a Blockly **workspace JSON**
document, converted to and from the shared Universal AST by `src/language/blocks/fromAst.ts`
(`programToBlocksJson`) and `src/language/blocks/toAst.ts` (`blocksToProgram`). Once it is an AST,
Blockly programs run and translate exactly like any other language.

## Scope: a procedural, untyped subset

Blocks is aimed at **middle-school programming and AP CSP** — introductory, non–object-oriented
courses. It therefore implements a deliberate **subset** of the AST, the same procedural, untyped
surface that [CSP](csp.md) exposes. Everything outside that subset simply has no block, so a
student can never assemble a program that fails to run or translate. This mirrors how CSP marks
object-oriented features as unsupported.

Because Blocks is untyped, arithmetic follows the same rules as CSP: `/` is ordinary
(floating-point) division and numbers carry no declared `int`/`double` distinction.

## Supported features

| Area | Blocks |
| --- | --- |
| Values | number, string, and boolean literals; variables (untyped) |
| Operators | `+ - * /`, `MOD`/`%`, `^` (power); `= ≠ < ≤ > ≥`; `AND` / `OR` / `NOT` |
| Selection | `if` / `else if` / `else` |
| Iteration | `while`, repeat-until, **repeat _n_ times**, count-with-variable, **repeat forever**, **for each** element of a list, `break` / `continue` |
| Procedures | define with (untyped) parameters, `return`, and call |
| Input / output | `print` (with a newline / space / no-break terminator) and `input` |
| Lists | list literal, get/set an item, append, insert, remove, length |
| Strings | substring, character at, in upper/lower case, contains, length, concatenation (`+`) |
| Math | absolute value, square root, smaller/larger of two |
| Random | random number, random integer below _n_, random integer in a range (`RANDOM`), seed |
| Conversion | to integer, to decimal, to text |
| Layout | **blank line** — an inert spacer that preserves a source blank line across translation |

### Positions are 1-based

List and string positions are **1-based**, matching AP CSP and beginner intuition — "item 1 of
the list" is the first element, and `substring … from 1 to 3` starts at the first character. The
Universal AST is 0-based, so the blocks fold positions the same way the CSP front end does
(`csp/parser.ts` `toZeroBased`, `csp/emitter.ts` on the way out).

### Toolbox

Blocks are grouped into **Common, Logic, Loops, Math, Text, Lists, Variables, and Functions**
categories, each with a distinct hue in the dark editor theme (`praxlyTheme()` in
`blockDefs.ts`). The Common category collects the most-used blocks so beginners don't have to hunt.

## Intentional omissions

Blocks does **not** provide (and its converters deliberately reject) anything outside the
procedural subset:

- Object-orientation: classes, fields, constructors, methods, `this`, `new`, and object
  member/method access.
- Typed declarations (`int x`, typed parameters/fields) — Blocks is untyped.
- `try` / `catch` / `finally`, `switch` / `case`.
- The ternary conditional (`?:`), `++` / `--`, and compound assignment (`+=`). "Change a variable
  by _n_" is expressed as a plain `set x to x + n`.
- `null`, and the Praxis `/* … */` placeholder.

`indexOf` is not yet offered: unlike the other 1-based string operations, the base convention for
its **returned** position isn't fixed by the CSP reference, so it awaits a separate decision.

## Testing

Blocks fidelity is verified by interpreting: a program must produce the **same output** when run
directly and when run after a full AST → blocks JSON → (real headless Blockly load/save) → AST
round trip. `tests/blocks.test.ts` applies this to the whole [demo.csp](../examples/demo.csp)
(the exact subset) plus focused per-feature programs, and loads the discoverable
[demo.blocks.json](../examples/demo.blocks.json) sample the same way. Real Blockly serialization
validates that every block's connections are type-correct.
