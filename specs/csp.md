# CSP

The _AP Computer Science Principles_ exam uses the pseudocode notation described below.

Notice that:
- Assignment uses `←`, not `=`
    - `<-` and `⟵` are also accepted by the interpreter (`=` is not — it is CSP's equality operator)
- Indexes start at `1`, not `0`
- Output uses `DISPLAY`, not `print`
- Comparison uses `=`, not `==`
- Blocks use curly braces: `{ ... }`
- Input is built-in: `x ← INPUT()`

## Assignment, Display, and Input

`a ← expression`

Evaluates `expression` and then assigns a copy of the result to the variable `a`.

`DISPLAY(expression)`

Displays the value of `expression`, followed by a space.

`INPUT()`

Accepts a value from the user and returns the input value.

## Arithmetic Operators and Numeric Procedures

`a + b`
`a - b`
`a * b`
`a / b`

The arithmetic operators `+`, `-`, `*`, and `/` are used to perform arithmetic on `a` and `b`.
For example, `17 / 5` evaluates to `3.4`.
The order of operations used in mathematics applies when evaluating expressions.

`a MOD b`

Evaluates to the remainder when `a` is divided by `b`.
Assume that `a` is an integer greater than or equal to `0` and `b` is an integer greater than `0`.
For example, `17 MOD 5` evaluates to `2`.
The `MOD` operator has the same precedence as the `*` and `/` operators.

`RANDOM(a, b)`

Generates and returns a random integer from `a` to `b`, including `a` and `b`.
Each result is equally likely to occur.
For example, `RANDOM(1, 3)` could return `1`, `2`, or `3`.

## Relational and Boolean Operators

`a = b`
`a ≠ b`
`a > b`
`a < b`
`a ≥ b`
`a ≤ b`

The relational operators `=`, `≠`, `>`, `<`, `≥`, and `≤` are used to test the relationship between two variables, expressions, or values.
A comparison using relational operators evaluates to a Boolean value.
For example, `a = b` evaluates to `true` if `a` and `b` are equal; otherwise it evaluates to `false`.
The ASCII forms `<>` (or `!=`), `<=`, and `>=` are also accepted for `≠`, `≤`, and `≥`.

`NOT condition`

Evaluates to `true` if `condition` is `false`; otherwise evaluates to `false`.

`condition1 AND condition2`

Evaluates to `true` if both `condition1` and `condition2` are `true`; otherwise evaluates to `false`.

`condition1 OR condition2`

Evaluates to `true` if `condition1` is `true` or if `condition2` is `true` or if both `condition1` and `condition2` are true; otherwise evaluates to `false`.

## Selection

```
IF (condition)
{
    <block of statements>
}
```

The code in `block of statements` is executed if the Boolean expression `condition` evaluates to `true`; no action is taken if `condition` evaluates to `false`.

```
IF (condition)
{
    <first block of statements>
}
ELSE
{
    <second block of statements>
}
```

The code in `first block of statements` is executed if the Boolean expression `condition` evaluates to `true`; otherwise the code in `second block of statements` is executed.

```
IF (condition1)
{
    <first block of statements>
}
ELSE IF (condition2)
{
    <second block of statements>
}
ELSE
{
    <third block of statements>
}
```

The code in `first block of statements` is executed if the Boolean expression `condition1` evaluates to `true`; otherwise the code in `second block of statements` is executed if the Boolean expression `condition2` evaluates to `true`; otherwise the code in `third block of statements` is executed.

## Iteration

```
REPEAT n TIMES
{
    <block of statements>
}
```

The code in `block of statements` is executed `n` times.

```
REPEAT UNTIL (condition)
{
    <block of statements>
}
```

The code in `block of statements` is repeated until the Boolean expression `condition` evaluates to `true`.

## List Operations

For all list operations, if a list index is less than `1` or greater than the length of the list, an error message is produced and the program terminates.

`aList ← [value1, value2, value3, ...]`

Creates a new list that contains the values `value1`, `value2`, `value3`, and `...` at indices `1`, `2`, `3`, and `...` respectively and assigns it to `aList`.

`aList ← []`

Creates an empty list and assigns it to `aList`.

`aList ← bList`

Assigns a _deep copy_ of the list `bList` to the list `aList`.
For example, if `bList` contains `[20, 40, 60]`, then `aList` will also contain `[20, 40, 60]` after the assignment.
Both lists contain the exact same items, but modifications to `aList` do not affect `bList`.

`aList[i]`

Accesses the element of `aList` at index `i`.
The first element of `aList` is at index `1` and is accessed using the notation `aList[1]`.

`x ← aList[i]`

Assigns the value of `aList[i]` to the variable `x`.

`aList[i] ← x`

Assigns the value of `x` to `aList[i]`.

`aList[i] ← aList[j]`

Assigns the value of `aList[j]` to `aList[i]`.

`INSERT(aList, i, value)`

Any values in `aList` at indices greater than or equal to `i` are shifted one position to the right.
The length of the list is increased by 1, and `value` is placed at index `i` in `aList`.

`APPEND(aList, value)`

The length of `aList` is increased by 1, and `value` is placed at the end of `aList`.

`REMOVE(aList, i)`

Removes the item at index `i` in `aList` and shifts to the left any values at indices greater than `i`.
The length of `aList` is decreased by 1.

`LENGTH(aList)`

Evaluates to the number of elements in `aList`.

```
FOR EACH item IN aList
{
    <block of statements>
}
```

The variable `item` is assigned the value of each element of `aList` sequentially, in order, from the first element to the last element.
The code in `block of statements` is executed once for each assignment of `item`.

## Procedures and Procedure Calls

```
PROCEDURE procName(parameter1, parameter2, ...)
{
    <block of statements>
}
```

Defines `procName` as a procedure that takes zero or more arguments.
The procedure contains `block of statements`.

The procedure `procName` can be called using the following notation, where `arg1` is assigned to `parameter1`, `arg2` is assigned to `parameter2`, etc.:
`procName(arg1, arg2, ...)`

```
PROCEDURE procName(parameter1, parameter2, ...)
{
    <block of statements>
    RETURN (expression)
}
```

Defines `procName` as a procedure that takes zero or more arguments.
The procedure contains `block of statements` and returns the value of `expression`.
The `RETURN` statement may appear at any point inside the procedure and causes an immediate return from the procedure back to the calling statement.

The value returned by the procedure `procName` can be assigned to the variable `result` using the following notation:
`result ← procName(arg1, arg2, ...)`

`RETURN (expression)`

Returns the flow of control to the point where the procedure was called and returns the value of `expression`.

## String Operations

String functions are written in uppercase by convention (like `DISPLAY` and
`RANDOM`), but lowercase spellings are also accepted. String positions are
**1-based**, matching CSP lists.

`CONCAT(str1, str2)`

Combine two strings.
Example: `CONCAT("Hello", " World")` returns `"Hello World"`.

`SUBSTRING(str, start, end)`

Extract the characters from position `start` to position `end`, inclusive (1-based).
Example: `SUBSTRING("hello", 2, 4)` returns `"ell"`.

`CHARAT(str, index)`

Return the single character at position `index` (1-based).
Example: `CHARAT("hello", 1)` returns `"h"`.

`len(str)`

Number of characters.
Example: `len("hello")` returns `5`.

`str1 + str2`

Concatenation shorthand.
Example: `"AP" + " CSP"` returns `"AP CSP"`.

## Example Programs

```
valList ← [4, 7, 2, 9, 5]
sum ← 0
i ← 1
REPEAT 5 TIMES
{
    IF (valList[i] MOD 2 = 0)
    {
        sum ← sum + valList[i]
    }
    i ← i + 1
}
DISPLAY(sum)
```

```
PROCEDURE checkValue(n)
{
    IF (n < 0)
    {
        DISPLAY("negative")
        RETURN (0)
    }
    IF (n = 0)
    {
        RETURN (0)
    }
    DISPLAY("positive")
    RETURN (n * 2)
}

DISPLAY(checkValue(-3))
```

## Extensions for Praxly

Unlike the other languages supported by Praxly, CSP does not support classes or other object-oriented features. All operations, including list operations, are performed procedurally or through built-in functions.

Most of the Praxly standard library is available as built-in functions. String operations are implemented as functions rather than methods; for example, `CHARAT("Alan", 1)` returns `'A'`, the first character of the string. Because CSP is not statically typed, all functions use type inference.

In addition to `RANDOM(a, b)`, Praxly exposes the procedural random helpers `randomInt(n)` (a random integer in `[0, n)`) and `randomSeed(s)` (seed the generator for deterministic sequences).
