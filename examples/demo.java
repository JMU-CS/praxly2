// ===========================================================================
// Praxly2 feature demo -- JAVA
// ---------------------------------------------------------------------------
// Praxly2 supports a SUBSET of Java. This program exercises every
// Universal-AST node the Java parser can produce. Everything in main() runs
// with no runtime error; the tail of main() holds constructs that PARSE and
// TRANSLATE but are no-ops in the interpreter (clearly labeled).
//
// AST nodes NOT reachable from Java source (covered by the other demos):
//   FunctionDeclaration ..... Java has only methods, never free functions.
//   RepeatUntil ............. no repeat/until syntax.
//   Try / ExceptionHandler .. try/catch are not recognized keywords here.
//   NewExpression ........... `new X(...)` is encoded as a CallExpression.
//   ThisExpression .......... `this` is encoded as an Identifier.
//   ListComprehension ....... Python-only.
//
// Interpreter notes honored below:
//   * System.out.println takes exactly ONE argument -> concatenate with '+'.
//   * A C-style for-loop update should be `i++` (an embedded plain assignment
//     like `i = i + 1` is a no-op).
//   * Compare Strings with `==` (String.equals is not implemented).
//   * No Math / ArrayList / generics -> use plain arrays.
// ===========================================================================


// ---- ClassDeclaration / FieldDeclaration / Constructor / MethodDeclaration -
class Counter {
    private int count;          // FieldDeclaration, declaredWithoutInitializer
    private int step = 1;       // private FieldDeclaration with initializer
    static int created = 0;     // static FieldDeclaration with initializer

    public Counter(int start) { // Constructor + Parameter
        this.count = start;     // member Assignment via `this`
    }

    public void increment() {   // void MethodDeclaration
        this.count = this.count + this.step;
    }

    public int getCount() {     // non-void returnType + Return.value
        return this.count;
    }
}

// ---- Inheritance: ClassDeclaration.superClass via `extends`, plus super() ---
class Animal {
    public String name;

    public Animal(String name) {
        this.name = name;
    }

    public String describe() {
        return this.name + " the animal";
    }
}

class Dog extends Animal {
    public Dog(String name) {
        super(name);            // runs Animal's constructor on this instance
    }

    public String speak() {
        return "woof";
    }
}


// ---- Program entry point (static main is auto-invoked by the interpreter) ---
public class Main {
    public static void main(String[] args) {

        // ---- Literal (int, double, String, boolean, null) + println --------
        int whole = 42;
        double frac = 3.14;
        String label = "java";
        boolean flag = true;
        String nothing = null;
        System.out.println(whole);      // 42
        System.out.println(frac);       // 3.14
        System.out.println(label);      // java
        System.out.println(flag);       // true
        System.out.println(nothing);    // None

        // ---- Bare declaration (declaredWithoutInitializer) then assign -----
        int later;
        later = 100;
        System.out.println(later);      // 100

        // ---- BinaryExpression: arithmetic (int division truncates) ---------
        int a = 17;
        int b = 5;
        System.out.println(a + b);      // 22
        System.out.println(a - b);      // 12
        System.out.println(a * b);      // 85
        System.out.println(a / b);      // 3
        System.out.println(a % b);      // 2

        // ---- CompoundAssignment (+= -= *= /= %=) ---------------------------
        int acc = 10;
        acc += 5;                       // 15
        acc -= 3;                       // 12
        acc *= 2;                       // 24
        acc /= 4;                       // 6
        acc %= 4;                       // 2
        System.out.println(acc);        // 2

        // ---- UpdateExpression (++ --), UnaryExpression (-, !) --------------
        int i = 5;
        i++;
        --i;
        System.out.println(i);          // 5
        System.out.println(-a);         // -17
        System.out.println(!flag);      // false

        // ---- Comparison + logical (&& ||) ----------------------------------
        System.out.println(a > b && b > 0);    // true
        System.out.println(a == 17 || flag);   // true

        // ---- If / else if / else ------------------------------------------
        int score = 82;
        if (score >= 90) {
            System.out.println("A");
        } else if (score >= 80) {
            System.out.println("B");
        } else {
            System.out.println("C");
        }

        // ---- While ---------------------------------------------------------
        int w = 0;
        while (w < 3) {
            System.out.println("while " + w);
            w++;
        }

        // ---- DoWhile -------------------------------------------------------
        int k = 0;
        do {
            System.out.println("do " + k);
            k++;
        } while (k < 2);

        // ---- For (C-style) + ArrayLiteral + IndexExpression + .length ------
        int[] nums = {10, 20, 30};
        int sum = 0;
        for (int j = 0; j < nums.length; j++) {
            sum = sum + nums[j];
        }
        System.out.println(sum);        // 60

        // ---- For (for-each) ------------------------------------------------
        for (int v : nums) {
            System.out.println("each " + v);
        }

        // ---- IndexExpression write + MemberExpression (.length) ------------
        nums[0] = 99;
        System.out.println(nums[0]);    // 99
        System.out.println(nums.length);// 3

        // ---- Supported String methods --------------------------------------
        String s = "Hello";
        System.out.println(s.length());        // 5
        System.out.println(s.toUpperCase());   // HELLO
        System.out.println(s.substring(1, 3)); // el
        System.out.println(s.charAt(0));       // H

        // ---- String equality uses == (String.equals is not implemented) ---
        if (label == "java") {
            System.out.println("match");
        }

        // ---- Objects: new, methods, fields, static read, extends + super ---
        Counter c = new Counter(5);
        c.increment();
        c.increment();
        System.out.println(c.getCount());   // 7
        System.out.println(c.created);      // 0 (static field, read via instance)

        Dog d = new Dog("Fido");
        System.out.println(d.speak());      // woof (Dog's own method)
        System.out.println(d.describe());   // Fido the animal (inherited + super)

        // ===================================================================
        // Parsed & translated, but NOT run to completion by the interpreter.
        // These are valid AST nodes (useful for translation tests). Some are
        // skipped, some run as no-ops -- none of them errors.
        // ===================================================================

        // ConditionalExpression (ternary ?:) parses and TRANSLATES, but the
        // interpreter does not execute a ternary (it produces no value, which
        // fails the int assignment). Guarded by `if (false)` so the demo runs.
        if (false) {
            int bigger = (a > b) ? a : b;
            System.out.println(bigger);
        }

        // Switch / SwitchCase (default + break) -- skipped by the interpreter
        switch (score) {
            case 80:
                System.out.println("eighty");
                break;
            default:
                System.out.println("other");
        }

        // Break / Continue -- valid AST nodes, treated as no-ops by the
        // interpreter (the loop still completes over its own bound)
        for (int t = 0; t < 4; t++) {
            if (t == 1) {
                continue;
            }
            if (t == 3) {
                break;
            }
            System.out.println("flow " + t);
        }
    }
}
