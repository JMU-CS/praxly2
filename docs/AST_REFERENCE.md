# AST Node Reference

Every AST node type defined in [`src/language/ast.ts`](../src/language/ast.ts), and how it's dispatched by the emitters/translators in [`src/language/visitor.ts`](../src/language/visitor.ts).

- **Statement / declaration nodes** are dispatched by `ASTVisitor.visitStatement()` to an abstract `visitX()` method that every emitter (`java`, `python`, `csp`, `praxis`, `javascript`) must implement.
- **Expression nodes** have no `visitX()` counterpart — they're handled inside each emitter's own `generateExpression(expr, parentPrecedence)` switch statement instead.
- **Nested/helper nodes** (`Parameter`, `SwitchCase`, `ExceptionHandler`) aren't dispatched on their own; they're plain data read directly by the parent node's visit method (e.g. `visitSwitch` iterates `stmt.cases`).

| Node Type             | Visitor Method                                     | Explanation                                                                                   |
| --------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Program               | visitProgram(program: Program)                     | Root node; holds the top-level list of statements.                                            |
| Block                 | visitBlock(block: Block)                           | A `{ }`-style list of statements (loop/if/function bodies, etc.).                             |
| Assignment            | visitAssignment(stmt: any)                         | Variable or member assignment, e.g. `x = value`.                                              |
| Print                 | visitPrint(stmt: any)                              | Output statement (`print`, `System.out.println`, etc.).                                       |
| If                    | visitIf(stmt: any)                                 | If-else statement.                                                                            |
| While                 | visitWhile(stmt: any)                              | Pre-condition loop: checks the condition, then runs the body.                                 |
| DoWhile               | visitDoWhile(stmt: any)                            | Post-condition loop: runs the body once, then checks the condition.                           |
| RepeatUntil           | visitRepeatUntil(stmt: any)                        | Post-condition loop that repeats **until** the condition is true (Praxis's `repeat...until`). |
| For                   | visitFor(stmt: any)                                | For loop — count-based, C-style, or for-each, depending on source language.                   |
| Switch                | visitSwitch(stmt: any)                             | Switch/case statement; iterates its `cases` (`SwitchCase[]`) internally.                      |
| SwitchCase            | _N/A — read directly by visitSwitch_               | One `case`/`default` clause: an optional `test` expression and `consequent` statements.       |
| FunctionDeclaration   | visitFunctionDeclaration(stmt: any)                | Top-level function definition.                                                                |
| Return                | visitReturn(stmt: any)                             | Return statement, with an optional value.                                                     |
| BinaryExpression      | _N/A — generateExpression() switch_                | Binary operation, e.g. `a + b`, `x and y`.                                                    |
| UnaryExpression       | _N/A — generateExpression() switch_                | Unary operation, e.g. `-x`, `not x`.                                                          |
| UpdateExpression      | _N/A — generateExpression() switch_                | Increment/decrement, e.g. `x++`, `--x`.                                                       |
| Identifier            | _N/A — generateExpression() switch_                | A variable/name reference.                                                                    |
| Literal               | _N/A — generateExpression() switch_                | A literal constant value (number, string, boolean).                                           |
| ArrayLiteral          | _N/A — generateExpression() switch_                | An array/list literal, e.g. `[1, 2, 3]`.                                                      |
| CallExpression        | _N/A — generateExpression() switch_                | A function call, e.g. `foo(a, b)`.                                                            |
| ExpressionStatement   | visitExpressionStatement(stmt: any)                | A bare expression used as a statement (e.g. a call for its side effect).                      |
| ClassDeclaration      | visitClassDeclaration(classDecl: ClassDeclaration) | Class definition, including its fields, constructor, and methods.                             |
| FieldDeclaration      | visitFieldDeclaration(field: FieldDeclaration)     | A class field/member-variable declaration.                                                    |
| Constructor           | visitConstructor(ctor: Constructor)                | A class constructor.                                                                          |
| MethodDeclaration     | visitMethodDeclaration(method: MethodDeclaration)  | A class method definition.                                                                    |
| NewExpression         | _N/A — generateExpression() switch_                | Object instantiation, e.g. `new Foo()`.                                                       |
| MemberExpression      | _N/A — generateExpression() switch_                | Property/method access, e.g. `obj.field`.                                                     |
| ThisExpression        | _N/A — generateExpression() switch_                | A `this` reference.                                                                           |
| Parameter             | _N/A — nested in params arrays_                    | A function/method/constructor parameter (name + declared type).                               |
| IndexExpression       | _N/A — generateExpression() switch_                | Array/list indexing (and Python-style slicing), e.g. `arr[i]`, `arr[1:3]`.                    |
| Break                 | visitBreak(stmt: any)                              | `break` statement.                                                                            |
| Continue              | visitContinue(stmt: any)                           | `continue` statement.                                                                         |
| Try                   | visitTry(stmt: any)                                | Try/catch/finally statement; iterates its `handlers` (`ExceptionHandler[]`) internally.       |
| ExceptionHandler      | _N/A — read directly by visitTry_                  | One `catch` clause: exception type, bound variable name, and handler body.                    |
| ConditionalExpression | _N/A — generateExpression() switch_                | Ternary conditional, e.g. `cond ? a : b`.                                                     |
| CompoundAssignment    | _N/A — generateExpression() switch_                | Compound assignment operator, e.g. `x += 1`.                                                  |
| ListComprehension     | _N/A — generateExpression() switch_                | Python-style list comprehension, e.g. `[x for x in range(10)]`.                               |

## Notes

- The **interpreter** (`src/language/interpreter.ts`) does not use `ASTVisitor` at all — it executes the AST directly via its own `executeBlock()`/`evaluate()` switch statements over `NodeType`, separate from the emitter visitor pattern described above.
- Per [`CLAUDE.md`](../CLAUDE.md), adding a new `Statement` node type requires updating `ast.ts`, `visitor.ts` (new abstract method + `visitStatement` dispatch case), all emitters, `interpreter.ts`, and `translator.ts`.
