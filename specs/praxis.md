# Praxis

The _Praxis Computer Science (5652_) test uses the pseudocode notation described below.
Many details are not provided by the spec, especially for classes and object-oriented programming.
Assume Java semantics unless stated otherwise.

## Basics

- Comments: `// this is a single-line comment`
- Placeholder for missing code: e.g., `/* missing code */` or `/* missing condition */`
- Print: `print arg` or `print(arg)`
    - By default, a newline is appended to the output (i.e., like `println`).
    - A comment is used where necessary to indicate if a line feed or blank is appended to the argument.
    - Example: `print(n)  // print a space after the number`
    - Example: `print "Name? "  // no newline after the prompt`

## Operators

- Assignment operator: `←`
    - `=`, `<-`, and `⟵` are also accepted by the interpreter.
- Arithmetic operators: `+`, `-`, `*`, `/`, `^`, `%`
    - Note that `/` indicates floating-point division unless stated otherwise.
- Relational operators: `==`, `≠`, `<`, `>`, `≤`, `≥`
    - `!=`, `<=`, and `>=` are also accepted by the interpreter.
- Logical operators: `and`, `or`, `not`
- String concatenation operator: `+`

## Variables

- Boolean values: `true`, `false`
- Null: `null`
- Data types: `boolean`, `char`, `double`, `float`, `int`, `int[]`, `int[][]`, `short`, `String`
- Array initialization
    - `int[] a ← {1, 2, 3}`
- Array reference
    - `b[0] = a[2]`

## Conditional statements

```
if (condition)
    block of statements
end if
```

```
if (condition)
    block of statements
else
    another block of statements
end if
```

## Iterative statements

For loop:
```
for (initialization; condition; increment)
    block of statements
end for
```

While loop:
```
while (condition)
    block of statements
end while
```

Do-while loop:
```
do
    block of statements
while (condition)
```

Repeat-until loop:
```
repeat
    block of statements
until (condition)
```

## Procedures (functions)

```
int procedureName(arg1, arg2, ...)
    block of statements
    return value
end procedureName
```

The return type is indicated in the procedure header and is based on the value returned by the procedure.
The return type is `void` if the procedure does not return a value:

```
void procedureName(arg1, arg2, ...)
    block of statements
end procedureName
```

## Classes

```
class className
    variable declarations
    procedures
end class className
```

- Object-oriented keywords: `extends`, `new`, `public`, `private`

## Example Program

The `sort` procedure sorts an integer array `arr` of length `len`.
The first element of `arr` is at index `0`.
A call `swap(arr, i , j)` swaps the values of `arr[i]` and `arr[j]`.
The output of the program is `{1, 2, 3, 4, 5}`.

```
void swap(int[] arr, int i, int j)
    int temp ← arr[i]
    arr[i] ← arr[j]
    arr[j] ← temp
end swap

void sort(int[] arr, int len)
    int pos ← 0
    while (pos < len)
        if (pos == 0)
            pos ← pos + 1
        else
            if (arr[pos] > arr[pos - 1])
                pos ← pos + 1
            else
                swap(arr, pos, pos - 1)
                pos ← pos - 1
            end if
        end if
    end while
end sort

int[] numbers ← {2, 1, 5, 3, 4}
sort(numbers, 5)
print numbers
```

## Extensions for Praxly

The Praxly interpreter also supports the following features:

- Python built-ins: `input()`, `int()`, `float()`
- Fixed-size array creation: `int[] array ← new int[10]`
- Java Math methods: `random()`, `randomInt()`, `randomSeed()`, `min()`, `max()`, `abs()`, `log()`, `sqrt()`
- Java String methods: `.charAt()`, `.contains()`, `.indexOf()`, `.length()`, `.substring()`, `.toLowerCase()`, `.toUpperCase()`

In addition, the following Java language features are supported:

- Increment/decrement: `++i`, `i++`, `--i`, `i--`
- `break` and `continue` statements
- `try`, `catch`, and `finally` (ending with `end try`)
- Trailing semicolons are allowed (ignored by Praxly)
- Constructors (see example below)

## Object-Oriented Example

Classes use the following syntax.
Notice that Praxis does not use `this` or `self`, so variable names must be unique.

```
class Animal

    private String name
    private String sound

    public Animal(String _name, String _sound)
        name ← _name
        sound ← _sound
    end Animal

    public String speak()
        return name + " says " + sound
    end speak

end class Animal

class Dog extends Animal

    public Dog(String _name)
        super(_name, "Woof")
    end Dog

    public String fetch()
        return name + " fetches the ball"
    end fetch

end class Dog

Animal a ← new Animal("Cat", "Meow")
Dog d ← new Dog("Rex")

print a.speak()  // Cat says Meow
print d.speak()  // Rex says Woof
print d.fetch()  // Rex fetches the ball
```
