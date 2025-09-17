import assert from 'node:assert';
import * as praxis from '../build/language/praxis/index.js';
import * as python from '../build/language/python/index.js';
import * as english from '../build/language/explain/index.js'
import * as java from '../build/language/java/index.js';
import * as error from '../build/language/error.js';
import {makeLogger, getInput} from './utilities.js';
import {Evaluator} from '../build/language/evaluator.js';
import {GlobalRuntime} from '../build/language/runtime.js';
import {Memdia} from '../build/language/memdia.js';

function testTranslation(sample, ast) {
  let targetSource = ast.visit(new java.Translator(), {
    nestingLevel: 0,
    indentation: '  ',
  });
  it(`should translate from praxis to java`, () => assert.equal(targetSource, sample.output));
}

function testProgram(sample) {
  describe(`// ${sample.message}\n${sample.source}`, () => {
    const tokens = praxis.lex(sample.source);
    const ast = praxis.parse(tokens, sample.source);
    testTranslation(sample, ast);
  });
}

function testExpression(sample) {
  describe(sample.source, () => {
    const tokens = praxis.lex(sample.source);
    const ast = praxis.parseExpression(tokens, sample.source);

    testTranslation(sample, ast);
  });
}

describe('Translate Praxis Expressions to Java', () => {
  const samples = [
    {
      source: '5 + 1',
      output: '5 + 1'
    },
    {
      source: '5 - 4 - 3',
      output: '5 - 4 - 3'
    },
    {
      source: '2**8',
      output: 'Math.pow(2, 8)'
    },
    {
      source: 'false or true',
      output: 'false || true'
    },
    {
      source: '7 < 8',
      output: '7 < 8',
    },
    {
      source: '"blink" == "blank"',
      output: '"blink" == "blank"',
    },
    {
      source: '"blink" != "blank"',
      output: '"blink" != "blank"',
    },
    {
      source: 'not false and false',
      output: '!false && false',
    },
    {
      source: '7 / 3',
      output: '7 / 3',
    },
    {
      source: '7.0 / 4',
      output: '7.0 / 4',
    },
    {
      source: '10.5 / 0.5',
      output: '10.5 / 0.5',
    },
    {
      source: '5 + 2 * 3.0',
      output: '5 + 2 * 3.0',
    },
    {
      source: '5 + 2 * 3.0',
      output: '5 + 2 * 3.0',
    },
    {
      source: '-2 % 5',
      output: '-2 % 5',
    }
  ]

  samples.forEach(testExpression);
});

describe('Translate Praxis programs to Java', () =>
{
  const samples = [
    // {
    //   message: "No code",
    //   souce: ' ',
    //   output: ' '
    // },
    {
      message: 'if statment',
      source:
`int x = 7
if (x < 10)
  x++
end if
print "Woo"`,
      output:
`public class Praxly {

  public static void main(String[] args) {
    int x = 7;
    if (x < 10) {
      x++;
    }
    System.out.println("Woo");
  }
}`
    },
    {
      message: 'print array',
      source:
`int[] xs = {12, 103, 80}
print xs[0]
print xs[1]
print xs[2]
print xs.length
`,
      output:
`public class Praxly {

  public static void main(String[] args) {
    int[] xs = {12, 103, 80};
    System.out.println(xs[0]);
    System.out.println(xs[1]);
    System.out.println(xs[2]);
    System.out.println(xs.length);
  }
}`
    }
  ]

  samples.forEach(testProgram);
});

describe('Translate Praxis to Java : Classes', () => {
  const samples = [
    {
      message: 'basic object',
      source:
`class Count
  public int count = 0
  void inc()
    this.count = this.count + 1
  end inc
  void dec()
    this.count = this.count - 1
  end dec
end class Count
Count c = new Count()
print c.count
c.inc()
c.inc()
print c.count
c.dec()
print c.count`,
      output:
`public class Praxly {

  class Count {
    public int count = 0;

    public void inc() {
      this.count = this.count + 1;
    }

    public void dec() {
      this.count = this.count - 1;
    }
  }

  public static void main(String[] args) {
    Count c = new Count();
    System.out.println(c.count);
    c.inc();
    c.inc();
    System.out.println(c.count);
    c.dec();
    System.out.println(c.count);
  }
}`
    },
    {
      message: 'instance variable and setter',
      source:
`class Foo
  int x = 5
  void set(int x)
    this.x = x
  end set
end class Foo
Foo f = new Foo()
f.set(10)
print f.x
`,
      output:
`public class Praxly {

  class Foo {
    public int x = 5;

    public void set(int x) {
      this.x = x;
    }
  }

  public static void main(String[] args) {
    Foo f = new Foo();
    f.set(10);
    System.out.println(f.x);
  }
}`
    }
  ]

  samples.forEach(testProgram);
});

// errors
//     {
//       message: 'print array',
//       source:
// `int[] xs = {12, 103, 80}
// print xs
// print xs[0]
// print xs[1]
// print xs[2]
// print xs.length
// `,
//  wont be able to print xs as an array
//     }
