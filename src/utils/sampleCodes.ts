/**
 * Canonical example program catalog.
 *
 * This is stored as typed TS rather than JSON so we can keep multiline snippets readable,
 * preserve compile-time checks, and attach metadata for menu grouping.
 */

export type ExampleLanguage = 'python' | 'java' | 'csp' | 'praxis' | 'javascript';
export type ExampleCategory = 'fundamentals' | 'conditionals' | 'loops' | 'functions';

export interface ExampleProgram {
  id: string;
  title: string;
  description: string;
  category: ExampleCategory;
  lang: ExampleLanguage;
  code: string;
}

export const EXAMPLE_CATEGORIES: Record<ExampleCategory, string> = {
  fundamentals: 'Fundamentals',
  conditionals: 'Conditionals',
  loops: 'Loops',
  functions: 'Functions',
};

export const EXAMPLE_PROGRAMS: ExampleProgram[] = [
  {
    id: 'praxis-dice-score',
    title: 'Praxis Dice Score',
    description: 'Nested conditionals and return values',
    category: 'functions',
    lang: 'praxis',
    code: `int newScore ( int diceOne, int diceTwo, int oldScore )
  if ( diceOne == diceTwo )
    return 0
  else
    if ( ( diceOne == 6 ) or ( diceTwo == 6 ) )
      return oldScore
    else
      return oldScore + diceOne + diceTwo
    end if
  end if
end newScore

print newScore(1, 2, 3)
`,
  },
  {
    id: 'praxis-for-loop',
    title: 'Praxis Loop Printer',
    description: 'Simple counting loop with output',
    category: 'loops',
    lang: 'praxis',
    code: `for ( i ← 0; i < 5; i ← i + 1 )
  print i
end for
`,
  },
  {
    id: 'csp-repeat-until',
    title: 'CSP Repeat Until',
    description: 'Repeat-until loop with arithmetic update',
    category: 'loops',
    lang: 'csp',
    code: `x ← 0
REPEAT UNTIL (x >= 5)
{
  x ← x + 1
}
DISPLAY(x)
`,
  },
  {
    id: 'csp-procedure-greet',
    title: 'CSP Procedure',
    description: 'Procedure declaration and call',
    category: 'functions',
    lang: 'csp',
    code: `PROCEDURE greet(name)
{
  DISPLAY("Hello " + name)
}

greet("Praxly")
`,
  },
  {
    id: 'python-grade-check',
    title: 'Python Grade Bands',
    description: 'If / elif / else branching',
    category: 'conditionals',
    lang: 'python',
    code: `score = 84

if score >= 90:
  print("A")
elif score >= 80:
  print("B")
else:
  print("Keep practicing")
`,
  },
  {
    id: 'python-dice-roll',
    title: 'Python Dice Roll',
    description: 'While a random condition is met',
    category: 'loops',
    lang: 'python',
    code: `randomSeed(7)
roll = 0
attempts = 0

while roll != 6:
  roll = randomInt(6) + 1
  attempts = attempts + 1
  print(roll)

print("Rolled a 6 after", attempts, "tries")
`,
  },
  {
    id: 'java-main-loop',
    title: 'Java Main Loop',
    description: 'Class entry point and for loop',
    category: 'loops',
    lang: 'java',
    code: `public class Main {
  public static void main(String[] args) {
    int sum = 0;
    for (int i = 1; i <= 5; i++) {
      sum = sum + i;
    }
    System.out.println(sum);
  }
}
`,
  },
  {
    id: 'java-if-branch',
    title: 'Java Conditional',
    description: 'If / else with numeric comparison',
    category: 'conditionals',
    lang: 'java',
    code: `public class Main {
  public static void main(String[] args) {
    int x = 7;
    if (x < 10) {
      System.out.println("small");
    } else {
      System.out.println("big");
    }
  }
}
`,
  },
  {
    id: 'javascript-function',
    title: 'JS Max Function',
    description: 'Declare with conditional return',
    category: 'functions',
    lang: 'javascript',
    code: `function max(a, b) {
  if (a > b) {
    return a;
  } else {
    return b;
  }
}

console.log(max(7, 3));
`,
  },
  {
    id: 'javascript-array-loop',
    title: 'JS Array For-Of',
    description: 'For-of loop over an array literal',
    category: 'loops',
    lang: 'javascript',
    code: `let nums = [10, 20, 30, 40];
let sum = 0;
for (const n of nums) {
  sum = sum + n;
}
console.log(sum);
`,
  },
];

export const DEFAULT_EXAMPLE_ID = 'praxis-dice-score';

export const getExampleById = (id: string): ExampleProgram | undefined =>
  EXAMPLE_PROGRAMS.find((example) => example.id === id);

const firstByLang = (lang: ExampleLanguage): string =>
  EXAMPLE_PROGRAMS.find((example) => example.lang === lang)?.code ?? '';

// Compatibility exports for existing imports.
export const SAMPLE_CODE_PYTHON = firstByLang('python');
export const SAMPLE_CODE_JAVA = firstByLang('java');
export const SAMPLE_CODE_CSP = firstByLang('csp');
export const SAMPLE_CODE_PRAXIS = firstByLang('praxis');
