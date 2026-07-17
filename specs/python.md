# Python

Python is not tied to a standardized exam the way Praxis, AP CSP, and AP CSA Java are.
Praxly supports a **subset of real Python** — the everyday constructs that map cleanly onto
the shared Universal AST and translate faithfully to the other languages. Python-only idioms
that translate poorly (comprehensions, slicing, tuples, …) are deliberately rejected with a
clear "not supported" message rather than silently mistranslated.

Assume standard Python semantics unless stated otherwise.

## Basics

- Comments: `# single-line comment`.
- Indentation defines blocks (converted internally to the shared brace-delimited form).
- Print: `print(a, b, ...)` prints the arguments separated by spaces, then a newline.
    - `sep=` and `end=` keyword arguments are honored, e.g. `print(x, end="")`.
- Input: `input(prompt)` reads and returns a line of text.

## Variables

- Dynamically typed. Assignment: `x = value`.
- **Chained assignment**: `x = y = z = 0`.
- **Augmented assignment**: `+=`, `-=`, `*=`, `/=`, `%=`, `//=`.
- **Optional type annotations**: `x: int = 5`, or a bare `x: int` (which declares `x` as
  uninitialized — reading it before assigning a value is a runtime error). Annotations are
  accepted on variables and parameters.
- Literals: `True`, `False`, `None`.

## Operators

- Arithmetic: `+`, `-`, `*`, `/`, `%`, `//` (floor division), `**` (exponent,
  right-associative; binds tighter than unary minus, so `-2 ** 2` is `-4`).
- Relational: `<`, `>`, `<=`, `>=`.
- Equality: `==`, `!=`.
- Logical: `and`, `or`, `not`.
- **Membership**: `x in s`, `x not in s` — supported for **strings only** (substring test).
  List membership (`x in someList`) is rejected.
- String concatenation: `+`.

## Control flow

- `if` / `elif` / `else`
- `while`
- `for x in range(...)`, `for x in aList`, `for ch in aString` (for-each iteration)
- `break`, `continue`, `pass`
- `try` / `except` / `except SomeError as e` / `finally`

## Expressions

- **Conditional (ternary) expression**: `consequent if test else alternate`, e.g.
  `label = "big" if n > 5 else "small"`.

## Functions

- `def name(a, b):` with `return` (a bare `return` yields no value).
- Parameter type annotations: `def clamp(x: int):`.
- Recursion is supported.

## Classes

- `class Name:` and single inheritance `class Dog(Animal):`.
- Constructor `__init__(self, ...)`, instance methods (first parameter `self`), and
  class-level attributes (including type-annotated ones).
- Instances are created by calling the class: `d = Dog("Fido")` (no `new`).
- `self` is used to access fields and methods; `super().__init__(...)` calls the parent
  constructor.

## Not supported

Each of the following raises a clear "not supported" error rather than being mistranslated:

- **List comprehensions** (`[x for x in xs]`) and generator expressions.
- **Slicing** (`a[1:3]`, `a[::2]`).
- **Tuples** and **tuple unpacking** (`a, b = 1, 2`), including multi-variable
  `for` loops (`for i, x in enumerate(...)`).
- **`for ... else`** and **`while ... else`**.
- **Chained comparison** (`a < b < c`).
- **`is` / `is not`** (identity comparison).
- **`lambda`** expressions.
- **`with`** statements.
- **`global`** / **`nonlocal`**.
- **`import`** / **`from ... import`** (the standard library is provided as built-ins — see
  below — so `import math` is unnecessary and unsupported).
- **f-strings** and string prefixes (`f"..."`, `r"..."`, `b"..."`) — use `"..."` with `+`.
- **Dict and set literals** (`{...}`).
- **`*args` / `**kwargs`**, **default parameter values**, and **keyword arguments** in calls.
- **Decorators** (`@decorator`).

## Standard library

Built-in functions and methods (`len`, `range`, `str`/`int`/`float`, string methods, list
methods, `sqrt`/`abs`/`min`/`max`, `random`, …) are shared across all Praxly languages and are
available without `import`. See [stdlib.md](stdlib.md) for the full cross-language table.
Note: Python string methods use their Python spellings (`.upper()`, `.lower()`, `.find()`,
`.replace()`); there is no `.substring()`/`.charAt()` (use indexing `s[i]` for a character).
