/**
 * Canonical example program catalog.
 *
 * This is stored as typed TS rather than JSON so we can keep multiline snippets readable,
 * preserve compile-time checks, and attach metadata for menu grouping.
 */

export type ExampleLanguage = 'python' | 'java' | 'csp' | 'praxis';
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
    title: 'Dice Score Function',
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
end newScore`,
  },
  {
    id: 'praxis-for-loop',
    title: 'Praxis Loop Printer',
    description: 'Simple counting loop with output',
    category: 'loops',
    lang: 'praxis',
    code: `for i <- 0; i < 5; i <- i + 1
  print(i)
end for`,
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
  print("Keep practicing")`,
  },
  {
    id: 'python-running-total',
    title: 'Python Running Total',
    description: 'While loop and assignment updates',
    category: 'loops',
    lang: 'python',
    code: `i = 1
total = 0

while i <= 5:
  total = total + i
  i = i + 1

print(total)`,
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
}`,
  },
  {
    id: 'java-if-branch',
    title: 'Java Conditional Branch',
    description: 'If / else with numeric comparison',
    category: 'conditionals',
    lang: 'java',
    code: `int x = 7;
if (x < 10) {
  System.out.println("small");
} else {
  System.out.println("big");
}`,
  },
  {
    id: 'csp-repeat-until',
    title: 'CSP Repeat Until',
    description: 'Repeat-until loop with arithmetic update',
    category: 'loops',
    lang: 'csp',
    code: `x <- 0
REPEAT UNTIL (x >= 5)
{
  x <- x + 1
}
DISPLAY(x)`,
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

greet("Praxly")`,
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
