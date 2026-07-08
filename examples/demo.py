# ===========================================================================
# Praxly2 feature demo -- PYTHON
# ---------------------------------------------------------------------------
# Praxly2 supports a SUBSET of Python. This program exercises every
# Universal-AST node the Python parser can produce. It runs top to bottom
# with no runtime error.
#
# The final section contains constructs that PARSE and TRANSLATE but are
# treated as no-ops by the interpreter (clearly labeled).
#
# AST nodes NOT reachable from Python source (covered by the other demos):
#   DoWhile / RepeatUntil ... no do-while / repeat syntax.
#   Switch / SwitchCase ..... no match/switch parsing.
#   UpdateExpression ........ no ++ / -- in Python.
#   CompoundAssignment ...... += etc. desugar to Assignment + BinaryExpression.
#   NewExpression ........... instantiation is a CallExpression, e.g. Dog("x").
#   ThisExpression .......... `self` is an ordinary Identifier.
#   ConditionalExpression ... `a if c else b` is not parsed.
# ===========================================================================


# ---- Literal (int, float, str, True, False, None) + multi-arg Print --------
count = 7
pi = 3.14
title = "python"
active = True
missing = None
print(count, pi, title, active, missing)

# ---- BinaryExpression + augmented Assignment (desugars to `x = x <op> y`) ---
total = 10
total += 5            # 15
total -= 3            # 12
total *= 2            # 24
total /= 4            # 6.0  (Python division is always float)
print(total)
print(7 % 3, 2 ** 8, 10 / 4)      # 1 256 2.5

# ---- UnaryExpression (-, not) + comparison + logical (and/or) --------------
print(-count, not active)                          # -7 false
print(count > 3 and pi < 4, count == 7 or active)  # true true

# ---- If / elif / else (elif => nested If in elseBranch) --------------------
score = 82
if score >= 90:
    print("A")
elif score >= 80:
    print("B")        # this runs
else:
    print("C")

# ---- While (pre-condition loop) --------------------------------------------
i = 0
while i < 3:
    print("while", i)
    i += 1

# ---- For over range() / a list literal / a string --------------------------
for k in range(0, 6, 2):
    print("range", k)             # 0 2 4
for item in [11, 22, 33]:
    print("list", item)
for ch in "hi":
    print("char", ch)             # h i

# ---- FunctionDeclaration / Parameter / Return ------------------------------
# Parameter.defaultValue (call with all args); Return with a value
def greet(name, punct="!"):
    return "hi " + name + punct

# Parameter annotation => paramType
def clamp(x: int):
    if x < 0:
        return 0                  # early Return
    return x

def announce(msg):
    if msg == "":
        return                    # bare Return (Return.value omitted)
    print("announce:", msg)

# recursion via CallExpression
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

print(greet("sam", "?"))          # hi sam?
print(clamp(-5), clamp(9))        # 0 9
announce("")                      # (prints nothing)
announce("ready")                 # announce: ready
print("fib", fib(7))              # fib 13

# ---- ArrayLiteral / IndexExpression / MemberExpression / CallExpression ----
values = [5, 2, 9, 1]
values[0] = 50                    # index Assignment
values.append(7)                  # method call (MemberExpression + Call)
values.sort()
values.pop()
print(values, len(values), values[0])   # {1, 2, 9, 50} 4 1


# ---- ClassDeclaration / Constructor / MethodDeclaration / FieldDeclaration -
class Animal:
    kind = "animal"               # class attribute => FieldDeclaration

    # Constructor (__init__); member Assignment via self
    def __init__(self, name):
        self.name = name

    def full(self):
        return self.name + " (" + self.kind + ")"

    def label(self):
        return "name=" + self.name

# ClassDeclaration.superClass via `class Dog(Animal)`
class Dog(Animal):
    def __init__(self, name):
        self.name = name

    def speak(self):
        return "woof"

a = Animal("Rex")
print(a.full())                   # Rex (animal)
d = Dog("Fido")
print(d.speak())                  # woof (Dog's own method)
print(d.label())                  # name=Fido (method inherited from Animal)


# ===========================================================================
# Parsed & translated, but NOT executed by the Praxly2 interpreter.
# Each produces a valid AST node (useful for translation tests) yet is a
# runtime no-op, so nothing here errors.
# ===========================================================================

# Try / ExceptionHandler / finally -- the whole construct is skipped at runtime
try:
    print("inside try")           # not actually printed
except ValueError as err:
    print("handled", err)
finally:
    print("cleanup")

# Break / Continue -- no-ops here; the loop still completes over its range
for n in range(3):
    if n == 1:
        continue                  # in real Python this would skip n == 1
    if n == 2:
        break                     # in real Python this would stop the loop
    print("flow", n)

# ListComprehension -- evaluates to an unused value at runtime
squares = [x * x for x in range(5)]

# IndexExpression slice (indexEnd / indexStep) -- parses; interpreter reads one
part = values[0:2]

# For.variables (multiple loop targets) + enumerate -- only the first is bound
for idx, val in enumerate([100, 200]):
    pass

# While.elseBranch / For.elseBranch (loop `else`) -- parsed, never executed
while False:
    print("never")
else:
    pass
