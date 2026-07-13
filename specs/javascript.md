# JavaScript

JavaScript is not tied to a standardized exam the way Praxis, AP CSP, and AP CSA Java are.
Praxly therefore supports a **pragmatic subset of standard JavaScript** — the everyday
constructs that map cleanly onto the shared Universal AST and translate faithfully to the
other languages. Code that Praxly emits is standard JavaScript (no Praxly-isms), and the
subset deliberately omits features that don't translate well (see _Not supported_).

Assume standard JavaScript semantics unless stated otherwise.

## Basics

- Comments: `// single-line comment` only. Block comments (`/* ... */`) are **not** supported.
- Print:
    - `console.log(arg1, arg2, ...)` — prints the arguments separated by spaces, then a newline.
    - `process.stdout.write(arg)` — prints without a trailing newline.
- Statements may end with `;` (recommended) but it is not required.

## Variables

- Declarations: `let`, `const`, `var` (all treated the same; block/function scoping is not
  modeled — the interpreter uses a flat scope like the other languages).
- A bare `let x;` declares `x` with no initializer.
- JavaScript is dynamically typed; no type annotations.
- Literals: `true`, `false`, `null`, `undefined`.

## Operators

- Arithmetic: `+`, `-`, `*`, `/`, `%`, `**` (exponent, right-associative).
- Relational: `<`, `>`, `<=`, `>=`.
- Equality: `==`, `!=`, `===`, `!==`. Strict forms `===`/`!==` are **normalized to** `==`/`!=`
  in the AST (Praxly does not model loose-vs-strict equality).
- Logical: `&&`, `||`, `!`.
- Increment / decrement: `++`, `--` (prefix and postfix).
- Compound assignment: `+=`, `-=`, `*=`, `/=`, `%=`.
- String concatenation: `+`.

## Control flow

- `if` / `else if` / `else`
- `while`
- `do { ... } while (cond)`
- C-style `for (let i = 0; i < n; i++)`
- `for (const x of iterable)` — iterates values (a for-each loop)
- `for (const x in iterable)` — **lowered to index iteration**: it iterates the values of
  `range(iterable.length)`, i.e. `x` takes each index `0 .. length-1`. (This matches array
  index iteration; it does not enumerate object keys.)
- `switch` / `case` / `default` with `break`
- `break`, `continue`
- `try { ... } catch (e) { ... } finally { ... }`

## Functions

- `function name(a, b) { ... }` with `return`.
- Recursion is supported.
- Parameters are positional; no default values and no rest/spread parameters.

## Classes

- `class Name { ... }` with `extends` for single inheritance.
- `constructor(...)`, instance methods, and instance fields (`x = 0;`).
- `static` fields and methods.
- `this` and `super`; instantiate with `new ClassName(args)`.

## Values and literals

- Numbers: integers and floats, including hex (`0xFF`) and scientific notation (`1e3`).
- Strings: single- or double-quoted, with escape sequences `\n`, `\t`, `\r` (and `\<char>`
  for any other escaped character).
- Array literals: `[1, 2, 3]`; element access and assignment with `arr[i]` (0-based).

## Not supported

These are recognized as out-of-subset and either fail to parse or are intentionally absent:

- **Template literals** (backtick strings) and interpolation — use `"..."` with `+`.
- **Arrow functions** (`=>`).
- **Object literals** (`{ key: value }`) and object/property shorthand.
- **Nullish coalescing** (`??`), optional chaining (`?.`).
- **`throw`** and custom exception objects (use `try`/`catch` only around code that may error).
- **`typeof`**, **`instanceof`**.
- **Bitwise / shift operators** (`& | ^ ~ << >> >>>`) — not part of the subset (consistent
  with the AP CSA Java subset). Note the interpreter treats `^` as exponentiation, not XOR.
- **Spread / rest** (`...`), destructuring.
- **Modules**: `import` / `export` / `from`.
- **`async` / `await`**, generators, `yield`.
- **Regular expressions** (`/pattern/`); `String.split` uses a **literal** delimiter.
- **Block comments** (`/* ... */`).

## Standard library

Built-in functions and methods (e.g. `Math.*`, string/array methods, `parseInt`) are shared
across all Praxly languages. See [stdlib.md](stdlib.md) for the full cross-language table.
