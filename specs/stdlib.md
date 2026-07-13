# Shared Standard Library

All five Praxly languages (Praxis, CSP, Java, JavaScript, Python) run on **one interpreter**
over a shared Universal AST. Built-in functions and methods are dispatched by name, so a given
capability exists once and is spelled the way each language spells it. When translating between
languages, Praxly maps each spelling to the target's idiomatic form.

The tables below list every supported built-in and how it is written in each language. `—`
means the language has no supported spelling for that operation. See **Notes on differences**
at the end for the important semantic differences (random ranges, 1-based vs 0-based indexing,
exponent operators, integer division, etc.).

## Input / output

| Operation           | Praxis                | CSP           | Java                                       | JavaScript                | Python             |
| ------------------- | --------------------- | ------------- | ------------------------------------------ | ------------------------- | ------------------ |
| Print with newline  | `print(x)`            | `DISPLAY(x)`¹ | `System.out.println(x)`                    | `console.log(x)`          | `print(x)`         |
| Print, no newline   | `print(x)` + comment¹ | `DISPLAY(x)`¹ | `System.out.print(x)`                      | `process.stdout.write(x)` | `print(x, end="")` |
| Read a line of text | `input()`             | `INPUT()`     | `new Scanner(System.in)` → `sc.nextLine()` | `input()`                 | `input()`          |

¹ See the print/terminator note below — Praxis marks the terminator with a trailing comment;
CSP `DISPLAY` always appends a **space** (not a newline).

## Type conversion

| Operation  | Praxis     | CSP        | Java                           | JavaScript      | Python     |
| ---------- | ---------- | ---------- | ------------------------------ | --------------- | ---------- |
| To integer | `int(x)`   | `int(x)`   | `Integer.parseInt(x)`          | `parseInt(x)`   | `int(x)`   |
| To float   | `float(x)` | `float(x)` | `Double.parseDouble(x)`        | `parseFloat(x)` | `float(x)` |
| To string  | `str(x)`   | `str(x)`   | `String.valueOf(x)` / `"" + x` | `String(x)`     | `str(x)`   |
| To boolean | `bool(x)`  | `bool(x)`  | —                              | `Boolean(x)`    | `bool(x)`  |

## Math

| Operation      | Praxis      | CSP         | Java            | JavaScript      | Python      |
| -------------- | ----------- | ----------- | --------------- | --------------- | ----------- |
| Absolute value | `abs(x)`    | `abs(x)`    | `Math.abs(x)`   | `Math.abs(x)`   | `abs(x)`    |
| Minimum        | `min(a, b)` | `min(a, b)` | `Math.min(a,b)` | `Math.min(a,b)` | `min(a, b)` |
| Maximum        | `max(a, b)` | `max(a, b)` | `Math.max(a,b)` | `Math.max(a,b)` | `max(a, b)` |
| Square root    | `sqrt(x)`   | `sqrt(x)`   | `Math.sqrt(x)`  | `Math.sqrt(x)`  | `sqrt(x)`   |
| Natural log    | `log(x)`    | `log(x)`    | `Math.log(x)`   | `Math.log(x)`   | `log(x)`    |
| Power          | `a ^ b`     | `a ^ b`     | `Math.pow(a,b)` | `a ** b`        | `a ** b`    |

The bare functions (`abs`, `min`, `max`, `sqrt`, `log`) are Praxly built-ins available in every
language without any import (in Python this replaces `import math`).

## Random

| Operation                | Praxis          | CSP                               | Java                             | JavaScript                     | Python          |
| ------------------------ | --------------- | --------------------------------- | -------------------------------- | ------------------------------ | --------------- |
| Random float in `[0, 1)` | `random()`      | `random()`                        | `Math.random()`                  | `Math.random()`                | `random()`      |
| Random integer           | `randomInt(n)`² | `RANDOM(a, b)`³ / `randomInt(n)`² | `new Random()` → `r.nextInt(n)`² | `Math.floor(Math.random()*n)`² | `randomInt(n)`² |
| Seed the generator       | `randomSeed(s)` | `randomSeed(s)`                   | `r.setSeed(s)`                   | `randomSeed(s)`                | `randomSeed(s)` |

² `randomInt(n)` / `nextInt(n)` return an integer in `[0, n)` — the upper bound is **exclusive**.
³ CSP `RANDOM(a, b)` returns an integer in `[a, b]` — **both endpoints inclusive**.

Only Java models random as an object (`new Random()` with `nextInt`/`nextDouble`/`nextBoolean`/
`setSeed`); the other languages use bare procedural functions. All share one seeded generator,
so the same seed reproduces the same sequence across languages.

## Length

| Operation        | Praxis       | CSP         | Java                     | JavaScript | Python   |
| ---------------- | ------------ | ----------- | ------------------------ | ---------- | -------- |
| Length of string | `s.length()` | `len(s)`    | `s.length()`             | `s.length` | `len(s)` |
| Length of list   | `a.length`   | `LENGTH(a)` | `a.length` / `a.size()`⁴ | `a.length` | `len(a)` |

⁴ Fixed arrays use `.length`; a mutable `ArrayList` uses `.size()`.

## String operations

Indices are **0-based** everywhere **except CSP, which is 1-based** (see notes).

| Operation          | Praxis             | CSP                     | Java               | JavaScript          | Python           |
| ------------------ | ------------------ | ----------------------- | ------------------ | ------------------- | ---------------- |
| Substring          | `s.substring(a,b)` | `SUBSTRING(s,a,b)`⁵     | `s.substring(a,b)` | `s.substring(a,b)`  | — (use `s[i]`)   |
| Character at index | `s.charAt(i)`      | `CHARAT(s,i)`           | `s.charAt(i)`      | `s.charAt(i)`       | `s[i]`           |
| Index of substring | `s.indexOf(x)`     | —                       | `s.indexOf(x)`     | `s.indexOf(x)`      | `s.find(x)`      |
| Contains substring | `s.contains(x)`    | —                       | `s.contains(x)`    | `s.includes(x)`     | `x in s`         |
| To upper case      | `s.toUpperCase()`  | —                       | `s.toUpperCase()`  | `s.toUpperCase()`   | `s.upper()`      |
| To lower case      | `s.toLowerCase()`  | —                       | `s.toLowerCase()`  | `s.toLowerCase()`   | `s.lower()`      |
| Replace (all)      | `s.replace(a,b)`   | —                       | `s.replace(a,b)`   | `s.replaceAll(a,b)` | `s.replace(a,b)` |
| Split on delimiter | `s.split(d)`       | —                       | `s.split(d)`       | `s.split(d)`        | `s.split(d)`     |
| Concatenate        | `a + b`            | `CONCAT(a,b)` / `a + b` | `a + b`            | `a + b`             | `a + b`          |

⁵ CSP `SUBSTRING(s, a, b)` is 1-based and the end index `b` is **inclusive**; the other
languages' `substring(from, to)` is 0-based and `to` is **exclusive**. Praxly converts between
these automatically.

## List operations

Indices are **0-based** everywhere **except CSP, which is 1-based**.

| Operation       | Praxis          | CSP               | Java                       | JavaScript          | Python          |
| --------------- | --------------- | ----------------- | -------------------------- | ------------------- | --------------- |
| Append element  | `a.append(x)`   | `APPEND(a, x)`    | `a.add(x)`                 | `a.push(x)`         | `a.append(x)`   |
| Insert at index | `a.insert(i,x)` | `INSERT(a, i, x)` | `a.add(i, x)`              | `a.splice(i, 0, x)` | `a.insert(i,x)` |
| Remove at index | `a.remove(i)`   | `REMOVE(a, i)`    | `a.remove(i)`              | `a.splice(i, 1)`    | `a.pop(i)`      |
| Access element  | `a[i]`          | `a[i]`            | `a.get(i)` / `a[i]`        | `a[i]`              | `a[i]`          |
| Assign element  | `a[i] <- x`     | `a[i] <- x`       | `a.set(i, x)` / `a[i] = x` | `a[i] = x`          | `a[i] = x`      |

`remove` / `REMOVE` / `pop(i)` all remove the element **at a given index** (not by value).

## Notes on differences

- **Random ranges.** `random()` returns a float in `[0, 1)` (upper bound excluded).
  `randomInt(n)` / Java `nextInt(n)` return an integer in `[0, n)` (upper excluded). CSP
  `RANDOM(a, b)` returns an integer in `[a, b]` (**both endpoints included**). This inclusive
  vs. exclusive difference is the main thing to watch when moving between CSP and the others.
- **Shared seeded generator.** Seeding (`randomSeed`/`setSeed`) makes output deterministic, and
  all languages draw from the same generator, so the same seed yields the same sequence
  everywhere. (Unseeded, values are non-deterministic.)
- **Indexing base.** CSP uses **1-based** indexing for both lists and strings; Praxis, Java,
  JavaScript, and Python use **0-based**. Praxly converts indices automatically at the CSP
  boundary (including for `SUBSTRING`/`CHARAT` and `INSERT`/`REMOVE` positions).
- **Substring endpoints.** CSP `SUBSTRING` end index is inclusive; the `substring(from, to)`
  method elsewhere is end-exclusive.
- **Exponentiation.** Written `^` in Praxis and CSP, `Math.pow(a, b)` in Java, and `a ** b` in
  JavaScript and Python. The interpreter treats `^` and `**` identically as exponentiation
  (never bitwise XOR).
- **Integer division.** `/` between two integer-typed operands truncates toward zero in Praxis,
  Java, and CSP. Python's `/` is always floating-point (use `//` for floor division); when both
  operands are declared integers, the translator emits `int(a / b)` (Python) or
  `Math.trunc(a / b)` (JavaScript) to preserve integer-division semantics.
- **`split` is literal.** The split delimiter is treated as a literal string in every language,
  not a regular expression.
- **Print terminators.** `println`/`print(...)` append a newline; CSP `DISPLAY(x)` appends a
  **space** (no newline). Praxly preserves each statement's separator/terminator when
  translating, so output stays identical across languages.
- **Method-name spellings.** The interpreter accepts several spellings of the same string
  method (`upper`/`toUpperCase`, `lower`/`toLowerCase`, `find`/`indexOf`, `contains`/`includes`,
  `replace`/`replaceAll`) so code from any source language runs; emitters normalize each to the
  target language's idiomatic spelling.
- **No imports needed.** Bare built-ins (`abs`, `sqrt`, `log`, `min`, `max`, `int`, `float`,
  `str`, `random`, `randomInt`, …) are always available; Python does not use `import math` /
  `import random` (both are unsupported).
