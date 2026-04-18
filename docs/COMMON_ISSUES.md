# Common Issues and Solutions

This guide covers common problems, how to diagnose them, and how to fix them.

## Table of Contents

1. [Lexer Issues](#lexer-issues)
2. [Parser Issues](#parser-issues)
3. [AST Structure Issues](#ast-structure-issues)
4. [Interpreter Issues](#interpreter-issues)
5. [Translator/Emitter Issues](#translator--emitter-issues)
6. [UI/Integration Issues](#uiintegration-issues)
7. [Debugging Techniques](#debugging-techniques)

---

## Lexer Issues

### Issue: Parser throws "Unexpected token" immediately

**Symptom:**

```
Error: Unexpected token: 'PUNCTUATION' ','
```

**Root Causes:**

1. Lexer didn't emit all necessary tokens
2. Lexer classified a token with the wrong type
3. Multi-character operator wasn't recognized (e.g., `==` lexed as `=` and `=`)

**How to Diagnose:**

```typescript
const lexer = new YourLexer(sourceCode);
const tokens = lexer.tokenize();
console.log(tokens); // ← Inspect the token stream
```

Look for:

- Missing tokens in the sequence
- Tokens with the wrong `type`
- Multi-character operators split into multiple tokens

**Example Fix:**

```typescript
// BAD: Multi-char operator not checked first
if (char === '=') {
  tokens.push({ type: 'OPERATOR', value: '=', start });
  pos++;
}

// GOOD: Check for == first
if (char === '=' && input[pos + 1] === '=') {
  tokens.push({ type: 'OPERATOR', value: '==', start });
  pos += 2;
} else if (char === '=') {
  tokens.push({ type: 'OPERATOR', value: '=', start });
  pos++;
}
```

---

### Issue: Keywords not recognized as KEYWORD tokens

**Symptom:**
Parser tries to parse `if` as an identifier instead of a keyword.

**Root Cause:**
Lexer didn't recognize the word as a keyword.

**How to Diagnose:**

```typescript
const lexer = new YourLexer('if (x > 5) { }');
const tokens = lexer.tokenize();
console.log(tokens[0]); // Should be KEYWORD, not IDENTIFIER
```

**Fix:**
Ensure your keyword list is complete and matches the parser's expectations:

```typescript
// In your lexer
const keywords = [
  'if', 'else', 'while', 'for', 'do', 'break', 'continue',
  'return', 'function', 'var', 'let', 'const', 'class', 'new',
  'this', 'true', 'false', 'null', 'undefined', 'try', 'catch',
  'finally', 'throw', ...
];

if (keywords.includes(value)) {
  tokens.push({ type: 'KEYWORD', value, start });
} else {
  tokens.push({ type: 'IDENTIFIER', value, start });
}
```

---

### Issue: String content is mangled

**Symptom:**

```
Input: let msg = "Hello \"World\"";
Token value: Hello \"World  (missing closing quote)
```

**Root Cause:**
Lexer doesn't handle escape sequences correctly.

**Fix:**

```typescript
// When parsing strings, handle escapes
if (char === '"') {
  const start = pos;
  pos++; // consume opening quote
  let value = '';
  while (pos < input.length && input[pos] !== '"') {
    if (input[pos] === '\\' && pos + 1 < input.length) {
      // Consume both the backslash and the escaped character
      value += input[pos] + input[pos + 1];
      pos += 2;
    } else {
      value += input[pos++];
    }
  }
  if (pos < input.length) pos++; // consume closing quote
  tokens.push({ type: 'STRING', value, start });
  continue;
}
```

---

### Issue: Comments aren't skipped

**Symptom:**

```
Input: x = 10  // comment
Tokens include: {..., IDENTIFIER('comment'), ...}
```

**Root Cause:**
Comment handling code doesn't skip or is placed after identifier matching.

**Fix:**
Check for comments **before** checking for identifiers:

```typescript
// Check for comments BEFORE identifiers
if (char === '/' && input[pos + 1] === '/') {
  // Skip line comment
  while (pos < input.length && input[pos] !== '\n') pos++;
  continue;  // ← Important: skip to next iteration
}

if (char === '/' && input[pos + 1] === '*') {
  // Skip block comment
  pos += 2;
  while (pos < input.length) {
    if (input[pos] === '*' && input[pos + 1] === '/') {
      pos += 2;
      break;
    }
    pos++;
  }
  continue;  // ← Important: skip to next iteration
}

// NOW check for identifiers
if (/[a-zA-Z_]/.test(char)) { ... }
```

---

## Parser Issues

### Issue: "Expected X, got Y" errors during parsing

**Symptom:**

```
Error: Expected PUNCTUATION ')', got IDENTIFIER 'else'
```

**Root Cause:**
Parser is in the wrong context. Usually:

1. Expression parsing continued too long
2. A previous statement didn't fully consume its tokens
3. Multi-statement context not handled

**How to Diagnose:**
Add debug output to see where parsing fails:

```typescript
parse(): Program {
  const body: Statement[] = [];
  while (!this.isAtEnd()) {
    console.log(`Current position: ${this.current}, token: ${this.peek().type} ${this.peek().value}`);
    body.push(this.statement());
  }
  return { id: generateId(), type: 'Program', body };
}
```

**Fix:**
Ensure each parsing method consumes all tokens it should:

```typescript
// BAD: Doesn't consume the semicolon
private statement(): Statement {
  if (this.match('KEYWORD', 'return')) {
    const value = this.expression();
    return { ... }  // ← Missing: this.consume('PUNCTUATION', ';')
  }
}

// GOOD: Consumes everything
private statement(): Statement {
  if (this.match('KEYWORD', 'return')) {
    const value = this.expression();
    this.consume('PUNCTUATION', ';');
    return { ... }
  }
}
```

---

### Issue: Operator precedence is wrong

**Symptom:**

```
Input: 2 + 3 * 4
Expected AST: + (2, *(3, 4))
Actual AST:   *(+(2, 3), 4)
```

**Root Cause:**
Expression parsing methods are in the wrong order.

**Fix:**
Verify method hierarchy (lower precedence should call higher precedence):

```typescript
// Correct order (low to high precedence)
expression() → assignment()
assignment() → logicalOr()
logicalOr() → logicalAnd()
logicalAnd() → equality()
equality() → comparison()
comparison() → term()          // +, -
term() → factor()              // *, /
factor() → unary()             // !, -
unary() → postfix()            // (), [], .
postfix() → primary()          // literals, identifiers

// If your precedences are different, reorder accordingly
```

---

### Issue: Parser hangs/infinite loop

**Symptom:**
Browser becomes unresponsive when parsing.

**Root Cause:**
A `while` loop in the parser isn't advancing the token pointer.

**How to Diagnose:**
Add a safety check:

```typescript
private statement(): Statement {
  // Add a watchdog counter
  let iterations = 0;
  while (this.check('KEYWORD', 'let') && iterations < 1000) {
    iterations++;
    // ... parsing code
    // Missing this.advance() or similar?
  }
  if (iterations >= 1000) {
    throw new Error('Possible infinite loop in parser');
  }
}
```

**Fix:**
Ensure every `while` loop advances tokens:

```typescript
// BAD: Infinite loop
while (this.check('KEYWORD', 'let')) {
  let name = this.consume('IDENTIFIER').value;
  // ← Never calls advance() or consume() for the 'let' keyword!
}

// GOOD: Advances on each iteration
while (this.match('KEYWORD', 'let')) {
  // ← match() advances
  let name = this.consume('IDENTIFIER').value;
}
```

---

### Issue: "Cannot read property 'name' of undefined"

**Symptom:**

```
Error: Cannot read property 'name' of undefined
  at visitAssignment (emitter.ts:120)
```

**Root Cause:**
Parser created an AST node with missing required fields.

**How to Diagnose:**

```typescript
// Before passing to interpreter/translator
console.log(JSON.stringify(ast, null, 2)); // ← Inspect the AST structure
```

**Fix:**
Ensure parser always sets all required fields:

```typescript
// BAD: Missing 'value' field
if (this.match('KEYWORD', 'var')) {
  const name = this.consume('IDENTIFIER').value;
  return { id: generateId(), type: 'Assignment', name }; // ← Missing 'value'
}

// GOOD: All required fields set
if (this.match('KEYWORD', 'var')) {
  const name = this.consume('IDENTIFIER').value;
  let value: Expression = { id: generateId(), type: 'Literal', value: null };
  if (this.match('OPERATOR', '=')) {
    value = this.expression();
  }
  return { id: generateId(), type: 'Assignment', name, value };
}
```

Compare against [src/language/ast.ts](../src/language/ast.ts) to see all required fields for each node type.

---

## AST Structure Issues

### Issue: AST nodes have duplicate types

**Symptom:**

```
{
  type: 'Assignment',
  name: 'x',
  value: { type: 'Assignment', ... }  // ← Wrong type, should be an Expression
}
```

**Root Cause:**
Parser put the wrong type of node in the wrong place.

**How to Diagnose:**
Check the AST against type definitions in [src/language/ast.ts](../src/language/ast.ts).

**Fix:**
Verify the parser returns the correct node type:

```typescript
// Check: Assignment.value should be an Expression, not another Assignment
private assignment(): Statement | Expression {
  let expr = this.logicalOr();

  if (this.match('OPERATOR', '=')) {
    const value = this.assignment();  // ← Recursive for right-associativity
    if (expr.type === 'Identifier') {
      return {
        id: generateId(),
        type: 'Assignment',
        name: (expr as Identifier).name,
        value: value as Expression  // ← Ensure it's an Expression
      };
    }
  }

  return expr;
}
```

---

### Issue: AST nodes are missing location info

**Symptom:**
Source map is empty; debugger can't highlight statements.

**Root Cause:**
Parser didn't set the `loc` field on AST nodes.

**Fix:**
Add location tracking:

```typescript
private statement(): Statement {
  const startIdx = this.current;  // ← Remember start position

  let stmt: Statement;
  if (this.match('KEYWORD', 'if')) {
    stmt = this.ifStatement();
  } else {
    stmt = this.expressionStatement();
  }

  // Attach location info
  if (startIdx >= 0 && startIdx < this.tokens.length) {
    const startToken = this.tokens[startIdx];
    const endToken = this.tokens[this.current - 1];
    stmt.loc = {
      start: startToken.start,
      end: endToken.start + endToken.value.length
    };
  }

  return stmt;
}
```

---

## Interpreter Issues

### Issue: "Undefined variable" runtime error

**Symptom:**

```
Runtime Error: Undefined variable 'x'
```

**Root Cause:**

1. Variable was never declared
2. Variable was declared in a different scope
3. Variable name is misspelled

**How to Diagnose:**

```typescript
const interpreter = new Interpreter();
try {
  const output = interpreter.interpret(ast);
  console.log(output);
} catch (e) {
  console.error(e);
  // Add debugging to interpreter
}
```

**Fix:**
Check that all variable uses are preceded by declarations:

```typescript
// In your parser, ensure variables are declared
let x = 10; // ← Declaration
print(x); // ← Use

// BAD: Using before declaring
print(x);
let x = 10;
```

Also check scoping — variables declared inside a block aren't accessible outside:

```typescript
if (x > 5) {
  let y = 10;
}
print(y); // ← Error: y is out of scope
```

---

### Issue: "Undefined function" runtime error

**Symptom:**

```
Runtime Error: Undefined function 'greet'
```

**Root Cause:**
Function was never declared, or the interpreter doesn't support function calls for your language.

**Fix:**
Ensure your parser creates `FunctionDeclaration` nodes and the interpreter handles them:

```typescript
// Interpreter should have this logic
interpret(program: Program): string[] {
  // First pass: register all functions
  for (const stmt of program.body) {
    if (stmt.type === 'FunctionDeclaration') {
      this.globalEnv.define(stmt.name, stmt);  // ← Store the declaration
    }
  }

  // Second pass: execute
  // ...
}

executeStatement(stmt: Statement) {
  case 'ExpressionStatement': {
    const expr = stmt.expression;
    if (expr.type === 'CallExpression') {
      const func = this.globalEnv.get((expr.callee as Identifier).name);
      if (!func) throw new Error(`Undefined function...`);
      // ← Call the function
    }
  }
}
```

---

### Issue: `this` is undefined in methods

**Symptom:**

```
Runtime Error: Cannot read property 'x' of undefined
  (this.x in method)
```

**Root Cause:**
Interpreter didn't bind `this` in method context.

**Fix:**
When calling methods, bind `this`:

```typescript
// In JavaInstance.callMethod
callMethod(methodName: string, args: any[], interpreter: Interpreter, env: Environment): any {
  const method = this.klass.getMethod(methodName);
  const methodEnv = new Environment(env);

  // ← Bind this
  methodEnv.define('this', this);
  methodEnv.define('self', this);  // Python compat

  // Bind parameters
  method.params.forEach((param, i) => {
    methodEnv.define(param.name, args[i] || null);
  });

  interpreter.executeBlock(method.body.body, methodEnv);
  return null;
}
```

---

## Translator / Emitter Issues

### Issue: "visit\* method not implemented" error

**Symptom:**

```
TypeError: Object doesn't support property or method 'visitWhile'
```

**Root Cause:**
Your emitter doesn't implement the `visitWhile()` method, but the AST contains a While node.

**How to Diagnose:**

```typescript
const translator = new Translator();
try {
  const code = translator.translate(ast, 'javascript');
} catch (e) {
  console.error(e); // ← Error will show which method is missing
}
```

**Fix:**
Implement the missing method:

```typescript
export class YourEmitter extends ASTVisitor {
  visitWhile(stmt: While): void {
    const condition = this.generateExpression(stmt.condition, 0);
    this.emit(`while (${condition}) {`);
    this.indent();
    this.visitBlock(stmt.body);
    this.dedent();
    this.emit('}');
  }
}
```

---

### Issue: Generated code has wrong indentation

**Symptom:**

```
if (x > 5) {
print(x);
    return;
}
```

**Root Cause:**
Inconsistent use of `this.indent()` and `this.dedent()`.

**Fix:**
Ensure every block increases indentation:

```typescript
visitIf(stmt: If): void {
  this.emit(`if (condition) {`);
  this.indent();         // ← Increase indent
  this.visitBlock(...);  // ← Children are indented
  this.dedent();         // ← Decrease indent
  this.emit('}');
}

visitWhile(stmt: While): void {
  this.emit(`while (condition) {`);
  this.indent();         // ← Same for while
  this.visitBlock(...);
  this.dedent();
  this.emit('}');
}
```

---

### Issue: String escaping broken in output

**Symptom:**

```
Java output: System.out.println("Hello "World"");  // ← Wrong!
Expected:    System.out.println("Hello \"World\"");
```

**Root Cause:**
Emitter doesn't escape quotes in string literals.

**Fix:**
Properly escape strings when generating code:

```typescript
// In emitter's generateExpression()
case 'Literal': {
  const lit = expr as Literal;
  if (typeof lit.value === 'string') {
    // Escape backslashes first, then quotes
    const escaped = lit.value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  return String(lit.value);
}
```

---

### Issue: Type information lost in translation

**Symptom:**

```
Python: x = 10
Java translation: x = 10;  // ← Missing type!
Expected:        int x = 10;
```

**Root Cause:**
Emitter doesn't use the symbol table to infer types.

**Fix:**
The Translator's `analyze()` method builds a symbol table. Use it in your emitter:

```typescript
export class YourEmitter extends ASTVisitor {
  constructor(protected context: TranslationContext) {
    super(context);
  }

  visitAssignment(stmt: Assignment): void {
    const type = this.context.symbolTable.get(stmt.name) || 'Object';
    const value = this.generateExpression(stmt.value, 0);
    this.emit(`${type} ${stmt.name} = ${value};`);
  }
}
```

---

## UI / Integration Issues

### Issue: Language dropdown doesn't show new language

**Symptom:**
Added the language to the parser, but it doesn't appear in the UI.

**Root Cause:**
Didn't update `SupportedLang` type or UI dropdown in [src/pages/EditorPage.tsx](../../src/pages/EditorPage.tsx).

**Fix:**

1. Update the type:

```typescript
export type SupportedLang = 'python' | 'java' | 'csp' | 'praxis' | 'yourNewLang' | 'ast';
```

2. Update the dropdown:

```tsx
<select value={sourceLang} onChange={...}>
  <option value="python">Python</option>
  <option value="java">Java</option>
  <option value="csp">CSP</option>
  <option value="praxis">Praxis</option>
  <option value="yourNewLang">Your New Language</option>
</select>
```

---

### Issue: Cannot add translation panel for new language

**Symptom:**
Dropdown shows the language, but "Add Panel" button doesn't work.

**Root Cause:**
Language not added to the "Add Panel" dropdown.

**Fix:**
Find the "Add Panel" menu in [src/pages/EditorPage.tsx](../../src/pages/EditorPage.tsx) and add:

```tsx
{
  showAddMenu && (
    <div className="language-menu">
      <button
        onClick={() => {
          addPanel('python');
        }}
      >
        Python
      </button>
      ...
      <button
        onClick={() => {
          addPanel('yourNewLang');
        }}
      >
        Your New Language
      </button>
    </div>
  );
}
```

---

### Issue: Parsing works, but no output shown

**Symptom:**
Code parses without errors, but output panel is blank.

**Root Cause:**
Interpreter isn't being called, or output isn't being captured.

**How to Diagnose:**

```typescript
// In useCodeParsing hook
const parseCode = useCallback((lang: SupportedLang, input: string): Program | null => {
  const ast = parser.parse();
  console.log('AST:', ast); // ← Should show the AST
  return ast;
}, []);

// In EditorPage.tsx
const interpreter = new Interpreter();
const output = interpreter.interpret(ast);
console.log('Output:', output); // ← Should show output
```

**Fix:**
Ensure the interpreter is called in the UI:

```typescript
useEffect(() => {
  try {
    const ast = parseCode(sourceLang, code);
    if (ast) {
      const interpreter = new Interpreter();
      const output = interpreter.interpret(ast);
      setOutput(output); // ← Don't forget this!
    }
  } catch (e) {
    setError(e.message);
  }
}, [code, sourceLang]);
```

---

## Debugging Techniques

### Technique 1: Inspect the Token Stream

```typescript
const lexer = new YourLexer(sourceCode);
const tokens = lexer.tokenize();
console.table(tokens); // Pretty-print tokens
```

Output:

```
┌─────┬──────────┬────────┬───────┐
│ (index) │ type     │ value  │ start │
├─────┼──────────┼────────┼───────┤
│ 0   │ KEYWORD  │ 'let'  │ 0     │
│ 1   │ IDENTIFIER│ 'x'    │ 4     │
│ 2   │ OPERATOR │ '='    │ 6     │
│ 3   │ NUMBER   │ '10'   │ 8     │
│ 4   │ PUNCTUATION│ ';'   │ 10    │
│ 5   │ EOF      │ ''     │ 11    │
└─────┴──────────┴────────┴───────┘
```

---

### Technique 2: Inspect the AST Structure

```typescript
const parser = new YourParser(tokens);
const ast = parser.parse();
console.log(JSON.stringify(ast, null, 2));
```

This will show the entire AST in readable JSON format.

---

### Technique 3: Add Logging to Critical Methods

```typescript
// In parser
private statement(): Statement {
  console.log(`[Parser] Parsing statement, current token: ${this.peek().type} ${this.peek().value}`);

  if (this.match('KEYWORD', 'if')) {
    console.log(`[Parser] Detected IF statement`);
    return this.ifStatement();
  }

  // ...
}
```

---

### Technique 4: Test Each Component Independently

Test the lexer, parser, and interpreter separately:

```typescript
// Test 1: Lexer only
const lexer = new YourLexer(code);
const tokens = lexer.tokenize();
console.log('Tokens:', tokens);
assert(tokens.length > 0);

// Test 2: Parser only
const parser = new YourParser(tokens);
const ast = parser.parse();
console.log('AST:', ast);
assert(ast.body.length > 0);

// Test 3: Interpreter only (if AST is valid)
const interpreter = new Interpreter();
const output = interpreter.interpret(ast);
console.log('Output:', output);
```

---

### Technique 5: Use TypeScript Type Checking

TypeScript can catch many errors before runtime:

```typescript
// Will error if stmt doesn't have 'name' property
const stmt: Assignment = ... as any;
const name: string = stmt.name;  // ← TypeScript checks this

// Better: use type guards
if (stmt.type === 'Assignment') {
  const a = stmt as Assignment;
  const name = a.name;  // ← Safe
}
```

---

## Still Stuck?

1. **Check existing language implementations** — Compare your code to Python, Java, etc.
2. **Read the AST definition carefully** — [src/language/ast.ts](../src/language/ast.ts)
3. **Read the Compiler Pipeline guide** — [COMPILER_PIPELINE.md](./COMPILER_PIPELINE.md)
4. **Simplify your test case** — Test with the simplest possible input first
5. **Add console.log everywhere** — Liberal logging helps!
6. **Ask for help** — Show your code and error messages
