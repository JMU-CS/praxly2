# ===========================================================================
# Praxly2 feature demo -- PYTHON        (shared notes: examples/README.md)
# ---------------------------------------------------------------------------
# AST nodes NOT reachable from Python source (covered by the other demos):
#   DoWhile / RepeatUntil ... no do-while / repeat syntax.
#   Switch / SwitchCase ..... no match/switch parsing.
#   UpdateExpression ........ no ++ / -- in Python.
#   CompoundAssignment ...... += etc. desugar to Assignment + BinaryExpression.
#   NewExpression ........... instantiation is a CallExpression, e.g. Dog("x").
#   ThisExpression .......... `self` is an ordinary Identifier.
#   ConditionalExpression ... `a if c else b` is not parsed.
# ===========================================================================


# ========================== EXPRESSIONS ====================================

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

# ---- ArrayLiteral / IndexExpression / MemberExpression / CallExpression ----
values = [5, 2, 9, 1]
values[0] = 50                    # index Assignment
values.append(7)                  # method call (MemberExpression + Call)
values.sort()
values.pop()
print(values, len(values), values[0])   # {1, 2, 9, 50} 4 1

# ---- ListComprehension -----------------------------------------------------
squares = [x * x for x in range(5)]
print(squares)                    # {0, 1, 4, 9, 16}

# ---- IndexExpression slice (indexEnd / indexStep) --------------------------
nums2 = [10, 20, 30, 40, 50]
print(nums2[1:4])                 # {20, 30, 40}
print(nums2[::2])                 # {10, 30, 50}


# ========================== STATEMENTS =====================================

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

# ---- Break / Continue ------------------------------------------------------
for n in range(5):
    if n == 3:
        break                     # stop the loop at 3
    if n == 1:
        continue                  # skip printing 1
    print("flow", n)              # flow 0 / flow 2

# ---- For ... else (elseBranch runs only if the loop finishes without break) -
for i in range(3):
    print("scan", i)
else:
    print("scanned all")          # runs (no break above)

# ---- For.variables: multiple loop targets via enumerate --------------------
for idx, item in enumerate([100, 200]):
    print(idx, item)              # 0 100 / 1 200

# ---- Try / ExceptionHandler / finally --------------------------------------
# Reading an undefined name raises; the handler catches it (binding the message
# to `err`) and the finally block always runs.
try:
    print(missingValue)           # raises: undefined variable
except ValueError as err:
    print("caught:", err)         # caught: ...
finally:
    print("cleanup")              # always runs


# ========================== FUNCTIONS ======================================

# ---- FunctionDeclaration / Parameter / Return ------------------------------
def greet(name, punct):
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

print(greet("sam", "!"))          # hi sam!
print(greet("sam", "?"))          # hi sam?
print(clamp(-5), clamp(9))        # 0 9
announce("")                      # (prints nothing)
announce("ready")                 # announce: ready
print("fib", fib(7))              # fib 13


# ========================== CLASSES ========================================

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
