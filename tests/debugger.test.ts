/**
 * Debugger step-through tests: stepping into user-defined functions/methods,
 * per-frame variable state, and control flow while debugging.
 */

import { describe, it, expect } from 'vitest';
import { PraxisLexer } from '../src/language/praxis/lexer';
import { PraxisParser } from '../src/language/praxis/parser';
import { Lexer as PythonLexer } from '../src/language/python/lexer';
import { Parser as PythonParser } from '../src/language/python/parser';
import { JavaLexer } from '../src/language/java/lexer';
import { JavaParser } from '../src/language/java/parser';
import { Debugger, type DebugStep, type SupportedLang } from '../src/language/debugger';
import { Translator } from '../src/language/translator';
import type { Program } from '../src/language/ast';

function parse(lang: SupportedLang, code: string): Program {
  switch (lang) {
    case 'praxis':
      return new PraxisParser(new PraxisLexer(code).tokenize()).parse();
    case 'python':
      return new PythonParser(new PythonLexer(code).tokenize()).parse();
    case 'java':
      return new JavaParser(new JavaLexer(code).tokenize()).parse();
    default:
      throw new Error(`unsupported test language ${lang}`);
  }
}

/** Runs the debugger to completion (or `maxSteps`) and returns every step. */
function collectSteps(lang: SupportedLang, code: string, maxSteps = 200): DebugStep[] {
  const dbg = new Debugger();
  dbg.init(parse(lang, code), lang, code);
  const steps: DebugStep[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const step = dbg.step();
    if (!step) break;
    steps.push(step);
    if (step.isComplete) break;
  }
  return steps;
}

const lineOf = (code: string, step: DebugStep): number | null =>
  step.sourceLocation ? code.slice(0, step.sourceLocation.start).split('\n').length : null;

describe('Debugger stepping into functions', () => {
  const praxisFn = `int double_it(int n)
    int result <- n * 2
    return result
end double_it

int x <- 5
int y <- double_it(x)
print y
`;

  it('steps through the function body line by line for a call in an assignment', () => {
    const steps = collectSteps('praxis', praxisFn);
    const lines = steps.map((s) => lineOf(praxisFn, s));
    // call site announced (7), body assignment (2), return (3), back at call site (7)
    expect(lines).toEqual([6, 7, 2, 3, 7, 8, null]);
    expect(steps[steps.length - 1].output).toEqual(['10']);
  });

  it('shows the function locals while inside and destroys them after return', () => {
    const steps = collectSteps('praxis', praxisFn);
    const bodyStep = steps.find((s) => lineOf(praxisFn, s) === 2)!;
    expect(bodyStep.variables).toMatchObject({ n: 5, result: 10, x: 5 });

    const returnStep = steps.find((s) => s.nodeType === 'Return')!;
    expect(returnStep.variables).toMatchObject({ n: 5, result: 10 });

    // Back at the call site: the function frame's locals are gone.
    const afterReturn = steps[steps.indexOf(returnStep) + 1];
    expect(afterReturn.variables).toEqual({ x: 5, y: 10 });
    expect(afterReturn.callStack).toHaveLength(1);
  });

  it('tracks the call stack while inside the function', () => {
    const steps = collectSteps('praxis', praxisFn);
    const bodyStep = steps.find((s) => lineOf(praxisFn, s) === 2)!;
    expect(bodyStep.callStack.map((f) => f.name)).toEqual(['global', 'double_it']);
    expect(bodyStep.callStack[1].variables).toEqual({ n: 5, result: 10 });
    // Function and class declarations never appear as variables.
    for (const step of steps) {
      expect(step.variables).not.toHaveProperty('double_it');
    }
  });

  it('steps into a call used inside a print statement', () => {
    const code = `int double_it(int n)
    return n * 2
end double_it

print double_it(4)
`;
    const steps = collectSteps('praxis', code);
    expect(steps.some((s) => s.nodeType === 'Return' && lineOf(code, s) === 2)).toBe(true);
    expect(steps[steps.length - 1].output).toEqual(['8']);
  });

  it('steps into a call used inside an if condition', () => {
    const code = `boolean big(int n)
    return n > 10
end big

if (big(20))
    print "big"
end if
`;
    const steps = collectSteps('praxis', code);
    expect(steps.some((s) => s.nodeType === 'Return' && lineOf(code, s) === 2)).toBe(true);
    expect(steps[steps.length - 1].output).toEqual(['big']);
  });

  it('steps through nested calls innermost-first', () => {
    const code = `int inc(int n)
    return n + 1
end inc

int twice(int n)
    return n * 2
end twice

print twice(inc(3))
`;
    const steps = collectSteps('praxis', code);
    const frameNames = steps
      .filter((s) => s.nodeType === 'Return')
      .map((s) => s.callStack[s.callStack.length - 1].name);
    expect(frameNames).toEqual(['inc', 'twice']);
    expect(steps[steps.length - 1].output).toEqual(['8']);
  });

  it('stacks frames for recursive calls', () => {
    const code = `int fact(int n)
    if (n <= 1)
        return 1
    end if
    return n * fact(n - 1)
end fact

print fact(3)
`;
    const steps = collectSteps('praxis', code);
    const deepest = Math.max(...steps.map((s) => s.callStack.length));
    expect(deepest).toBe(4); // global + fact(3) + fact(2) + fact(1)
    expect(steps[steps.length - 1].output).toEqual(['6']);
  });

  it('produces the same output as a normal run when a call mixes with arithmetic', () => {
    const code = `int askQ(int n)
    print "asked"
    return n
end askQ

int score <- 1
score <- score + askQ(10)
print score
`;
    const steps = collectSteps('praxis', code);
    // The call body ran exactly once (one "asked"), and arithmetic used its result.
    expect(steps[steps.length - 1].output).toEqual(['asked', '11']);
  });
});

describe('Debugger stepping into methods (Java / Python)', () => {
  it('steps into a sibling static method called from main()', () => {
    const code = `public class Main {
    public static int doubleIt(int n) {
        int result = n * 2;
        return result;
    }

    public static void main(String[] args) {
        int x = 5;
        int y = doubleIt(x);
        System.out.println(y);
    }
}
`;
    const steps = collectSteps('java', code);
    expect(steps[steps.length - 1].output).toEqual(['10']);

    const bodyStep = steps.find((s) => lineOf(code, s) === 3)!;
    expect(bodyStep).toBeDefined();
    expect(bodyStep.callStack.map((f) => f.name)).toEqual(['global', 'main', 'doubleIt']);
    expect(bodyStep.callStack[2].variables).toEqual({ n: 5, result: 10 });
  });

  it('steps into an instance method called on an object', () => {
    const code = `class Counter:
    def __init__(self):
        self.count = 0

    def bump(self, amount):
        self.count = self.count + amount
        return self.count

c = Counter()
print(c.bump(2))
`;
    const steps = collectSteps('python', code);
    expect(steps[steps.length - 1].output).toEqual(['2']);
    const inMethod = steps.find((s) => s.callStack[s.callStack.length - 1]?.name === 'bump')!;
    expect(inMethod).toBeDefined();
    expect(inMethod.callStack[1].variables).toMatchObject({ amount: 2 });
  });
});

describe('Debugger control flow', () => {
  it('handles break inside a while loop without aborting the program', () => {
    const code = `int i <- 0
while (i < 10)
    if (i == 2)
        break
    end if
    print i
    i <- i + 1
end while
print "done"
`;
    const steps = collectSteps('praxis', code);
    expect(steps[steps.length - 1].output).toEqual(['0', '1', 'done']);
    expect(steps.some((s) => s.nodeType === 'Break')).toBe(true);
  });

  it('yields a step for the return line itself', () => {
    const code = `void hello()
    print "hi"
    return
end hello

hello()
`;
    const steps = collectSteps('praxis', code);
    expect(steps.some((s) => s.nodeType === 'Return')).toBe(true);
    expect(steps[steps.length - 1].output).toEqual(['hi']);
  });

  it('reports arity errors the same way a normal run does', () => {
    const code = `int inc(int n)
    return n + 1
end inc

print inc(1, 2)
`;
    const steps = collectSteps('praxis', code);
    const last = steps[steps.length - 1];
    expect(last.isComplete).toBe(true);
    expect(last.output.join('\n')).toContain('Expected 1 arguments but got 2');
  });
});

describe('Debugger input handling inside functions', () => {
  it('pauses for input() inside a function body and resumes after provideInput', () => {
    const code = `String ask()
    String name <- input("name?")
    return name
end ask

String who <- ask()
print who
`;
    const dbg = new Debugger();
    dbg.init(parse('praxis', code), 'praxis', code);

    let step: DebugStep | null = null;
    for (let i = 0; i < 20; i++) {
      step = dbg.step();
      expect(step).not.toBeNull();
      if (step!.waitingForInput) break;
    }
    expect(step!.waitingForInput).toBe(true);
    expect(step!.inputPrompt).toBe('name?');
    // We paused inside the function: its frame is on the stack.
    expect(step!.callStack.map((f) => f.name)).toEqual(['global', 'ask']);

    dbg.provideInput('Ada');
    const after: DebugStep[] = [];
    for (let i = 0; i < 20; i++) {
      const s = dbg.step();
      if (!s) break;
      after.push(s);
      if (s.isComplete) break;
    }
    const last = after[after.length - 1];
    expect(last.isComplete).toBe(true);
    expect(last.output).toEqual(['> Ada', 'Ada']);
  });
});

describe('Debugger translation-panel highlighting (emitter source maps)', () => {
  const TARGETS = ['python', 'javascript', 'java', 'csp', 'praxis'] as const;

  it('maps a nested else-if to the elif / else-if line in every target', () => {
    // The newScore example: the nested If inside `else` is emitted as a
    // collapsed elif / else-if chain by the emitters.
    const code = `int newScore ( int diceOne, int diceTwo, int oldScore )
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
`;
    const program = parse('praxis', code);

    // Step until the debugger sits on the nested If (the second If yielded).
    const dbg = new Debugger();
    dbg.init(program, 'praxis', code);
    let nestedIf: DebugStep | undefined;
    for (let i = 0; i < 50; i++) {
      const s = dbg.step();
      if (!s || s.isComplete) break;
      if (s.nodeType === 'If' && lineOf(code, s) === 5) nestedIf = s;
    }
    expect(nestedIf).toBeDefined();

    const expectedLineText: Record<string, string> = {
      python: 'elif',
      javascript: 'else if',
      java: 'else if',
      csp: 'ELSE IF',
      praxis: 'else if',
    };
    for (const target of TARGETS) {
      const { code: out, sourceMap } = new Translator().translateWithMap(program, target);
      const line = sourceMap.get(nestedIf!.nodeId);
      expect(line, `${target} should map the nested If`).toBeDefined();
      expect(out.split('\n')[line!], `${target} line ${line}`).toContain(expectedLineText[target]);
    }
  });

  it('maps every debugger step to a line in every target for class-free code', () => {
    const code = `int helper(int n)
    if (n > 3)
        return n
    else if (n > 1)
        return n * 10
    else
        return 0
    end if
end helper

int i <- 0
while (i < 3)
    if (i == 1)
        i <- i + 2
        continue
    end if
    print helper(i)
    i <- i + 1
end while

for (int j <- 0; j < 4; j <- j + 1)
    if (j == 2)
        break
    end if
    print j
end for

do
    i <- i - 1
while (i > 2)

repeat
    i <- i + 1
until (i > 4)
`;
    // Node ids are random per parse, so the debugger and the translators must
    // share one parsed program — exactly as the editor pages do.
    const program = parse('praxis', code);
    const maps = TARGETS.map(
      (t) => [t, new Translator().translateWithMap(program, t).sourceMap] as const
    );

    const dbg = new Debugger();
    dbg.init(program, 'praxis', code);
    for (let i = 0; i < 500; i++) {
      const step = dbg.step();
      if (!step || step.isComplete) break;
      if (!step.nodeId) continue;
      for (const [target, map] of maps) {
        expect(
          map.get(step.nodeId),
          `${target} is missing a line for ${step.nodeType} (praxis line ${lineOf(code, step)})`
        ).toBeDefined();
      }
    }
  });
});
