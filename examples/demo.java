public class Main {
    public static void main(String[] args) {

        // ========================= EXPRESSIONS ===============================

        // ---- Literal (int, double, String, boolean, null) + println ---------
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

        // ---- Bare declaration (declaredWithoutInitializer) then assign ------
        int later;
        later = 100;
        System.out.println(later);      // 100

        // ---- BinaryExpression: arithmetic (int division truncates) ----------
        int a = 17;
        int b = 5;
        System.out.println(a + b);      // 22
        System.out.println(a - b);      // 12
        System.out.println(a * b);      // 85
        System.out.println(a / b);      // 3
        System.out.println(a % b);      // 2

        // ---- CompoundAssignment (+= -= *= /= %=) ----------------------------
        int acc = 10;
        acc += 5;                       // 15
        acc -= 3;                       // 12
        acc *= 2;                       // 24
        acc /= 4;                       // 6
        acc %= 4;                       // 2
        System.out.println(acc);        // 2

        // ---- UpdateExpression (++ --), UnaryExpression (-, !) ---------------
        int i = 5;
        i++;
        --i;
        System.out.println(i);          // 5
        System.out.println(-a);         // -17
        System.out.println(!flag);      // false

        // ---- Comparison + logical (&& ||) -----------------------------------
        System.out.println(a > b && b > 0);       // true
        System.out.println(a == 17 || flag);      // true

        // ---- ConditionalExpression (ternary ?:) -----------------------------
        int bigger = (a > b) ? a : b;
        System.out.println(bigger);               // 17

        // ---- AP CSA String methods ------------------------------------------
        String s = "Hello";
        System.out.println(s.length());           // 5
        System.out.println(s.toUpperCase());      // HELLO
        System.out.println(s.toLowerCase());      // hello
        System.out.println(s.substring(1, 3));    // el
        System.out.println(s.charAt(0));          // H
        System.out.println(s.indexOf("ll"));      // 2
        System.out.println(s.contains("ell"));    // true
        System.out.println(s.compareTo("Hello")); // 0
        String[] parts = "a,b,c".split(",");      // split around ","
        System.out.println(parts[1]);             // b

        // ---- String equality via .equals() (AP CSA) -------------------------
        if (label.equals("java")) {
            System.out.println("match");
        }

        // ---- char literal ---------------------------------------------------
        char grade = 'A';
        System.out.println(grade);                // A

        // ---- Integer / Double statics ---------------------------------------
        System.out.println(Integer.parseInt("42") + 1);     // 43
        System.out.println(Double.parseDouble("2.5"));      // 2.5
        System.out.println(Integer.MAX_VALUE);              // 2147483647
        System.out.println(Integer.MIN_VALUE);              // -2147483648

        // ---- Math methods ---------------------------------------------------
        System.out.println(Math.abs(-7));         // 7
        System.out.println(Math.max(3, 8));       // 8
        System.out.println(Math.min(3, 8));       // 3
        System.out.println(Math.pow(2, 10));      // 1024
        System.out.println(Math.sqrt(16.0));      // 4
        System.out.println(Math.log(1.0));        // 0.0

        // ---- ArrayList (add / add(i,x) / get / set / size / remove) ---------
        ArrayList<Integer> list = new ArrayList<Integer>();
        list.add(10);
        list.add(20);
        list.add(1, 15);                          // insert 15 at index 1
        System.out.println(list.get(0));          // 10
        System.out.println(list.size());          // 3
        list.set(0, 5);
        System.out.println(list.get(0));          // 5
        list.remove(0);
        System.out.println(list.size());          // 2


        // ========================= STATEMENTS ================================

        // ---- If / else if / else --------------------------------------------
        int score = 82;
        if (score >= 90) {
            System.out.println("A");
        } else if (score >= 80) {
            System.out.println("B");
        } else {
            System.out.println("C");
        }

        // ---- While ----------------------------------------------------------
        int w = 0;
        while (w < 3) {
            System.out.println("while " + w);
            w++;
        }

        // ---- DoWhile --------------------------------------------------------
        int k = 0;
        do {
            System.out.println("do " + k);
            k++;
        } while (k < 2);

        // ---- For (C-style) + ArrayLiteral + IndexExpression + .length -------
        int[] nums = {10, 20, 30};
        int sum = 0;
        for (int j = 0; j < nums.length; j++) {
            sum = sum + nums[j];
        }
        System.out.println(sum);                  // 60

        // ---- For (for-each) -------------------------------------------------
        for (int v : nums) {
            System.out.println("each " + v);
        }

        // ---- IndexExpression write + MemberExpression (.length) -------------
        nums[0] = 99;
        System.out.println(nums[0]);              // 99
        System.out.println(nums.length);          // 3

        // ---- Switch / SwitchCase (matching case, default, break) ------------
        int day = 3;
        switch (day) {
            case 1:
                System.out.println("Mon");
                break;
            case 3:
                System.out.println("Wed");        // this runs
                break;
            default:
                System.out.println("other day");
        }

        // ---- Break / Continue -----------------------------------------------
        for (int t = 0; t < 5; t++) {
            if (t == 1) {
                continue;                         // skip printing 1
            }
            if (t == 3) {
                break;                            // stop the loop at 3
            }
            System.out.println("flow " + t);      // flow 0 / flow 2
        }

        // ---- Try / Catch / Finally ------------------------------------------
        try {
            System.out.println(1 / 0);            // division by zero -> error
        } catch (Exception e) {
            System.out.println("caught");         // this runs
        } finally {
            System.out.println("cleanup");        // always runs
        }


        // ========================= OBJECTS ===================================

        // ---- new, methods, fields, static read, extends + super -------------
        Counter c = new Counter(5);
        c.increment();
        c.increment();
        System.out.println(c.getCount());   // 7
        System.out.println(c.created);      // 0 (static field, read via instance)
        System.out.println(c.toString());   // Counter instance (default Object.toString)

        Dog d = new Dog("Fido");
        System.out.println(d.speak());      // woof (Dog's own method)
        System.out.println(d.describe());   // Fido the animal (inherited + super)
    }
}


// ============================= CLASSES =======================================

// ---- ClassDeclaration / FieldDeclaration / Constructor / MethodDeclaration --
class Counter {
    private int count;           // FieldDeclaration, declaredWithoutInitializer
    private int step = 1;        // private FieldDeclaration with initializer
    static int created = 0;      // static FieldDeclaration with initializer

    public Counter(int start) {  // Constructor + Parameter
        this.count = start;      // member Assignment via `this`
    }

    public void increment() {    // void MethodDeclaration
        this.count = this.count + this.step;
    }

    public int getCount() {      // non-void returnType + Return.value
        return this.count;
    }
}

// ---- Inheritance: ClassDeclaration.superClass via `extends`, plus super() ---
class Animal {
    public String name;

    public Animal(String name) {
        this.name = name;        // param shadows the field; `this.` disambiguates
    }

    public String describe() {
        return this.name + " the animal";
    }
}

class Dog extends Animal {
    public Dog(String name) {
        super(name);             // runs Animal's constructor on this instance
    }

    public String speak() {
        return "woof";
    }
}
