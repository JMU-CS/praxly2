// ===========================================================================
// Praxly2 feature demo -- JAVASCRIPT
// ---------------------------------------------------------------------------
// Praxly2 supports a SUBSET of JavaScript. This program exercises every
// Universal-AST node the JS parser can produce, and every construct here runs
// with no runtime error.
//
// AST nodes NOT reachable from JavaScript source (covered by the other demos):
//   RepeatUntil ......... no repeat/until syntax.
//   ListComprehension ... Python-only.
//
// Interpreter notes honored below:
//   * Output is console.log(...) (multiple args are space-joined).
//   * Arrays use .append(x) -- .push(x) is not implemented.
//   * No Math / parseInt -- use int(), float(), str(), len(), range().
//   * `let`/`const`/`var` all behave identically (no block scoping enforced).
// ===========================================================================


// ---- FunctionDeclaration / Parameter / Return (with and without a value) ---
function greet(name, punct = "!") {   // Parameter.defaultValue on `punct`
    return "hi " + name + punct;
}

function fib(n) {                     // recursion via CallExpression
    if (n <= 1) {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
}

function announce(msg) {
    if (msg === "") {
        return;                       // bare Return (Return.value omitted)
    }
    console.log("announce: " + msg);
}


// ---- ClassDeclaration / Constructor / MethodDeclaration / this / super -----
class Animal {
    constructor(name) {
        this.name = name;             // ThisExpression + member Assignment
    }
    describe() {
        return this.name + " the animal";
    }
}

// ClassDeclaration.superClass via `extends`
class Dog extends Animal {
    constructor(name) {
        super(name);                  // super() runs the parent constructor
    }
    speak() {
        return "woof";
    }
}


// ---- Literal (number, string, boolean, null) + Assignment + console.log ----
let count = 7;
const pi = 3.14;
var title = "javascript";
let active = true;
let nothing = null;
console.log(count, pi, title, active, nothing);

// ---- BinaryExpression: arithmetic (JS division is float) + ** --------------
let a = 17;
let b = 5;
console.log(a + b, a - b, a * b);       // 22 12 85
console.log(a / b, a % b, 2 ** 8);      // 3.4 2 256

// ---- CompoundAssignment (+= -= *= /= %=) -----------------------------------
let acc = 10;
acc += 5;                               // 15
acc -= 3;                               // 12
acc *= 2;                               // 24
acc /= 4;                               // 6
acc %= 4;                               // 2
console.log(acc);                       // 2

// ---- UpdateExpression (++ --) + UnaryExpression (-, !) + comparison/logic --
let i = 5;
i++;
--i;
console.log(i, -a, !active);                 // 5 -17 false
console.log(a > b && b > 0, a === 17 || active);   // true true

// ---- If / else if / else ---------------------------------------------------
let score = 82;
if (score >= 90) {
    console.log("A");
} else if (score >= 80) {
    console.log("B");
} else {
    console.log("C");
}

// ---- While / DoWhile -------------------------------------------------------
let w = 0;
while (w < 3) {
    console.log("while " + w);
    w++;
}
let k = 0;
do {
    console.log("do " + k);
    k++;
} while (k < 2);

// ---- For (C-style) + ArrayLiteral + IndexExpression + .length --------------
let nums = [10, 20, 30];
let sum = 0;
for (let j = 0; j < nums.length; j++) {
    sum += nums[j];                     // compound assignment executes in JS
}
console.log(sum);                       // 60

// ---- For (for-of) over an array and over a string --------------------------
for (const v of nums) {
    console.log("each " + v);
}
for (const ch of "hi") {
    console.log("char " + ch);          // char h / char i
}

// ---- IndexExpression write + array method (.append) + len() ----------------
nums[0] = 99;
nums.append(40);
console.log(nums[0], nums.length, len(nums));   // 99 4 4

// ---- Supported String methods + conversions --------------------------------
let s = "Hello";
console.log(s.length, s.toUpperCase(), s.substring(1, 3), s.charAt(0));  // 5 HELLO el H
console.log(int("42"), str(7), float("1.5"));                            // 42 7 1.5

// ---- Function calls --------------------------------------------------------
console.log(greet("sam"));              // hi sam!  (uses the default punct)
console.log(greet("sam", "?"));         // hi sam?  (overrides the default)
announce("");                           // (prints nothing)
announce("ready");                      // announce: ready
console.log("fib", fib(7));             // fib 13

// ---- Objects: new (NewExpression) + methods + this + extends + super -------
let d = new Dog("Fido");
console.log(d.speak());                 // woof (Dog's own method)
console.log(d.describe());              // Fido the animal (inherited + super)


// ---- Try / ExceptionHandler / finally --------------------------------------
// Reading an undefined name throws; the catch clause handles it (binding the
// message to `err`) and the finally block always runs.
try {
    console.log(missingValue);          // throws: undefined variable
} catch (err) {
    console.log("caught: " + err);      // caught: ...
} finally {
    console.log("cleanup");             // always runs
}

// ---- Switch / SwitchCase (matching case, default, break) -------------------
let day = 3;
switch (day) {
    case 1:
        console.log("Mon");
        break;
    case 3:
        console.log("Wed");             // this runs
        break;
    default:
        console.log("other day");
}

// ---- Break / Continue ------------------------------------------------------
for (let t = 0; t < 5; t++) {
    if (t === 1) {
        continue;                       // skip printing 1
    }
    if (t === 3) {
        break;                          // stop the loop at 3
    }
    console.log("flow " + t);           // flow 0 / flow 2
}

// ---- ConditionalExpression (ternary) ---------------------------------------
let bigger = (a > b) ? a : b;
console.log(bigger);                    // 17
