# Java

The _AP Computer Science A_ exam may use the following methods from the Java library.

## Program Structure

Every Java program must define a class named `Main` with a runnable entry point:

```java
public class Main {
  public static void main(String[] args) {
    // your code here
  }
}
```

There is no bare-statement/script mode — top-level statements outside a class are
a parse error, and a `Main` class without a matching `public static void main(String[] args)`
method is also a parse error. This mirrors standard Java so that code written in Praxly
compiles as-is in any other Java toolchain. Additional classes may be declared alongside
`Main` (see `Extensions for Praxly` below for OOP support), and `import` declarations are
accepted and ignored (Praxly's stdlib is always available without an explicit import).

A variable or field declared without an initializer (`int x;`) is **uninitialized, not
defaulted to `0`/`false`/`null`** — reading it before assigning a value is a runtime error.
This mirrors Java's compile-time "variable might not have been initialized" check, enforced
dynamically here since Praxly has no static definite-assignment pass.

When a Java program is translated to a language with free functions, the `Main` wrapper
is unwrapped rather than emitted as a class: `main`'s body becomes the top-level program,
each other **static method** of `Main` becomes a free function (e.g. a Python `def`, a CSP
`PROCEDURE`), and each **static field** of `Main` becomes a top-level variable declaration.
Classes other than `Main` translate as classes (where the target supports them).

## String Class

- `String(String str)` – Constructs a new `String` object that represents the same sequence of characters as `str`
- `int length()` – Returns the number of characters in a `String` object
- `String substring(int from, int to)` – Returns the substring beginning at index `from` and ending at index `to - 1`
- `String substring(int from)` – Returns `substring(from, length())`
- `int indexOf(String str)` – Returns the index of the first occurrence of `str`; returns `-1` if not found
- `boolean equals(Object other)` – Returns `true` if `this` corresponds to the same sequence of characters as `other`; returns `false` otherwise
- `int compareTo(String other)` – Returns a value < 0 if `this` is less than `other`; returns zero if `this` is equal to `other`; returns a value > 0 if `this` is greater than `other`. Strings are ordered based upon the alphabet.
- `String[] split(String del)` – Returns a `String` array where each element is a substring of `this` `String`, which has been split around matches of the given expression `del`

## Integer Class

- `Integer.MIN_VALUE` – The minimum value represented by an `int` or `Integer`
- `Integer.MAX_VALUE` – The maximum value represented by an `int` or `Integer`
- `static int parseInt(String s)` – Returns the `String` argument as an `int`

## Double Class

- `static double parseDouble(String s)` – Returns the `String` argument as a `double`

## Math Class

- `static int abs(int x)` – Returns the absolute value of an `int` value
- `static double abs(double x)` – Returns the absolute value of a `double` value
- `static double pow(double base, double exponent)` – Returns the value of the first parameter raised to the power of the second parameter
- `static double sqrt(double x)` – Returns the nonnegative square root of a `double` value
- `static double random()` – Returns a `double` value greater than or equal to `0.0` and less than `1.0`

## ArrayList Class

- `int size()` – Returns the number of elements in the list
- `boolean add(E obj)` – Appends `obj` to end of list; returns `true`
- `void add(int index, E obj)` – Inserts `obj` at position `index` (0 <= index <= size), moving elements at position `index` and higher to the right (adds 1 to their indices) and adds 1 to size
- `E get(int index)` – Returns the element at position `index` in the list
- `E set(int index, E obj)` – Replaces the element at position `index` with `obj`; returns the element formerly at position `index`
- `E remove(int index)` – Removes element from position `index`, moving elements at position `index + 1` and higher to the left (subtracts 1 from their indices) and subtracts 1 from size; returns the element formerly at position `index`

## File Class

- `File(String pathname)` – The `File` constructor that accepts a `String` pathname

## Scanner Class

- `Scanner(File f)` – The `Scanner` constructor that accepts a `File` for reading
- `int nextInt()` – Returns the next `int` read from the file or input source if available. If the next `int` does not exist or is out of range, it will result in an `InputMismatchException`.
- `double nextDouble()` – Returns the next `double` read from the file or input source. If the next `double` does not exist, it will result in an `InputMismatchException`.
- `boolean nextBoolean()` – Returns the next `boolean` read from the file or input source. If the next `boolean` does not exist, it will result in an `InputMismatchException`.
- `String nextLine()` – Returns the next line of text as a `String` read from the file or input source; can return the empty string if called immediately after another `Scanner` method that is reading from the file or input source
- `String next()` – Returns the next `String` read from the file or input source
- `boolean hasNext()` – Returns `true` if there is a next item to read in the file or input source; `false` otherwise
- `void close()` – Closes this scanner

## Object Class

- `boolean equals(Object other)` – Indicates whether some `other` object is "equal to" `this` one.
- `String toString()` – Returns a `String` representation of `this` object.

## Extensions for Praxly

- Praxly supports all methods above except for the `File` class.
- `Scanner` is used by Praxly only to read input from `System.in`.
- Additional String methods: `charAt()`, `contains()`, `toUpperCase()`, `toLowerCase()`,
  `indexOf()`/`find()`, and `replace(old, new)` (replaces every occurrence).
- `String.split(del)` splits on `del` as a **literal delimiter**, not a regular
  expression (a deliberate simplification of Java's regex-based `split`).
- Additional Math methods: `log()`, `max()`, `min()`
- `Random` class: `new Random()`, `int nextInt(int bound)` (a value in `[0, bound)`),
  `double nextDouble()` (a value in `[0.0, 1.0)`), `boolean nextBoolean()`, and
  `void setSeed(long seed)` for deterministic sequences. (`setSeed(s)` uses the same
  seeded generator as the pseudocode `randomSeed(s)`, so a seeded `Random` and a seeded
  procedural `randomInt` produce the same sequence.)
- `char` literals (e.g. `'A'`) and escape sequences (`\n`, `\t`, `\r`, `\"`, `\'`, `\\`) in
  `String` and `char` literals.
- A default `Object.toString()` returns `"ClassName instance"`; the bitwise/shift operators
  and `**` (not part of the AP CSA subset) are not supported.
