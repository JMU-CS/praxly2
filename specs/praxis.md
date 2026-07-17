# Praxis

The _Praxis Computer Science (5652)_ test uses the pseudocode notation described below.
Many details were not provided in the original spec, especially for classes and object-oriented programming.
Assume Java semantics unless stated otherwise.

## Basics

- Comments: `// this is a single-line comment`
- Placeholder for missing code: e.g., `/* missing code */` or `/* missing condition */`.
  A placeholder has no value — assigning one to a variable (`x ← /* missing */`) leaves
  that variable uninitialized (reading it later is a runtime error), and using a
  placeholder directly (e.g. `if (/* cond */)`) is an immediate runtime error.
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
    - Used only for strings, arrays, and objects
- Data types: `boolean`, `char`, `double`, `float`, `int`, `int[]`, `int[][]`, `short`, `String`
- Array initialization
    - `int[] a ← {1, 2, 3}`
- A bare declaration with no initializer (`int x`) leaves `x` uninitialized — reading it
  before assigning a value is a runtime error.
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

In addition to the official Praxis specification, the Praxly interpreter supports the following language features:

- Increment/decrement: `++i`, `i++`, `--i`, `i--`
- `break` and `continue` statements
- `try`, `catch`, and `finally` (ending with `end try`)
- Constructors (optional; see examples below)
- Fixed-size array creation: `int[] array ← new int[10]` (elements default to `0`/`false`/`null`)
- Character literals in single quotes (e.g. `char c ← 'A'`), holding exactly one character; double quotes denote strings
- Escape sequences in string and character literals: `\n`, `\t`, `\r`, `\"`, `\'`, `\\`
- Trailing semicolons are allowed (they are ignored by Praxly)

Praxly also supports `if ... else if ... else` statements.
This is a more concise alternative to nesting an `if` inside an `else` block; a single `end if` closes the whole chain.

For compatibility with the other languages supported by Praxly, arrays also support the following list operations:

- `append()`
- `insert()`
- `length()`
- `remove()`

The following built-in functions are also available:

- Python built-ins: `input()`, `int()`, `float()`, `str()`
- Java Math methods: `random()`, `randomInt()`, `randomSeed()`, `min()`, `max()`, `abs()`, `log()`, `sqrt()`
- Java String methods: `.charAt()`, `.contains()`, `.indexOf()`, `.length()`, `.replace()`, `.substring()`, `.toLowerCase()`, `.toUpperCase()`

## Inheritance Example

Classes use the following syntax.
The Praxis test does not use `this` or `self`, so all variable names must be unique.
Praxly allows optional use of `this` to make translating from other language easier.
The keyword `super` is used to call the superclass's constructor.

```
public class Animal

    private String name
    private String sound

    public Animal(String n, String s)
        name ← n
        sound ← s
    end Animal

    public String speak()
        return name + " says " + sound
    end speak

end class Animal

public class Dog extends Animal

    public Dog(String n)
        super(n, "Woof")
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

## Composition Example

The following snippet shows that `public`/`private` modifiers are optional, and that fields can be initialized when declared.
If no constructor is defined, a default constructor is generated.

```
class A
    String word ← "friend"
    String add()
        return "Hello " + name
    end add
end class A

class B
    A temp ← new A()
    void greet()
        print temp.add()
    end greet
end class B

B b ← new B()
b.greet()
```
