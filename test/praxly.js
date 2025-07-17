import assert from 'node:assert';
import * as praxis from '../build/language/praxis/index.js';
import {Fruit, Type} from '../build/language/type.js';
import {GlobalRuntime, Evaluator} from '../build/language/evaluator.js';
import * as error from '../build/language/error.js';
import {Memdia} from '../build/language/memdia.js';

function makeLogger() {
  const logger = {
    stdout: '',
    log: text => {
      logger.stdout += text;
    },
  };
  return logger;
}

function getInput() {
  return new Promise(resolve => resolve(''));
}

// Functions passed to describe can't be async. Only functions passed to it can
// be asynchronous.

describe('Praxis: Expression Generation and Evaluation', () => {
  const samples = [
    {
      source: '5 + 1',
      serialization: "5 + 1",
      evaluation: new Fruit(Type.Integer, 6),
    },
    {
      source: '5 - 4 - 3',
      serialization: '5 - 4 - 3',
      evaluation: new Fruit(Type.Integer, -2),
    },
    {
      source: 'true and false',
      serialization: 'true and false',
      evaluation: new Fruit(Type.Boolean, false),
    },
    {
      source: 'false or true',
      serialization: 'false or true',
      evaluation: new Fruit(Type.Boolean, true),
    },
    {
      source: 'not true',
      serialization: 'not true',
      evaluation: new Fruit(Type.Boolean, false),
    },
    {
      source: 'not not true',
      serialization: 'not not true',
      evaluation: new Fruit(Type.Boolean, true),
    },
    {
      source: '6 < 7',
      serialization: '6 < 7',
      evaluation: new Fruit(Type.Boolean, true),
    },
    {
      source: '"blink" == "blank"',
      serialization: '"blink" == "blank"',
      evaluation: new Fruit(Type.Boolean, false),
    },
    {
      source: '"blink" != "blank"',
      serialization: '"blink" ≠ "blank"',
      evaluation: new Fruit(Type.Boolean, true),
    },
    {
      source: 'not false and true',
      serialization: 'not false and true',
      evaluation: new Fruit(Type.Boolean, true),
    },
    {
      source: 'not false and false',
      serialization: 'not false and false',
      evaluation: new Fruit(Type.Boolean, false),
    },
    {
      source: '7 / 3',
      serialization: '7 / 3',
      evaluation: new Fruit(Type.Integer, 2),
    },
    {
      source: '7.0 / 4',
      serialization: '7.0 / 4',
      evaluation: new Fruit(Type.Float, 1.75),
    },
    {
      source: '10.5 / 0.5',
      serialization: '10.5 / 0.5',
      evaluation: new Fruit(Type.Float, 21.0),
    },
    {
      source: '5 + 2 * 3.0',
      serialization: '5 + 2 * 3.0',
      evaluation: new Fruit(Type.Float, 11.0),
    },
    {
      source: '5 + 2 * 3.0',
      serialization: '5 + 2 * 3.0',
      evaluation: new Fruit(Type.Float, 11.0),
    },
    {
      source: '-2 % 5',
      serialization: '-2 % 5',
      evaluation: new Fruit(Type.Integer, 3),
    },
    {
      source: 'sqrt(0.25)',
      serialization: 'sqrt(0.25)',
      evaluation: new Fruit(Type.Float, 0.5),
    },
    {
      source: 'max(5, 689)',
      serialization: 'max(5, 689)',
      evaluation: new Fruit(Type.Integer, 689),
    },
    {
      source: 'min(5, 689)',
      serialization: 'min(5, 689)',
      evaluation: new Fruit(Type.Integer, 5),
    },
    {
      source: 'abs(6)',
      serialization: 'abs(6)',
      evaluation: new Fruit(Type.Integer, 6),
    },
    {
      source: 'abs(-6)',
      serialization: 'abs(-6)',
      evaluation: new Fruit(Type.Integer, 6),
    },
    {
      source: 'abs(0)',
      serialization: 'abs(0)',
      evaluation: new Fruit(Type.Integer, 0),
    },
    {
      source: 'log(1.0)',
      serialization: 'log(1.0)',
      evaluation: new Fruit(Type.Float, 0),
    },
    {
      source: 'log(1)',
      serialization: 'log(1)',
      evaluation: new Fruit(Type.Float, 0),
    },
    {
      source: 'log(1)',
      serialization: 'log(1)',
      evaluation: new Fruit(Type.Float, 0),
    },
    {
      source: 'log(10)',
      serialization: 'log(10)',
      evaluation: new Fruit(Type.Float, 2.302585092994046),
    },
  ];

  for (let sample of samples) {
    describe(sample.source, () => {
      const tokens = praxis.lex(sample.source);
      const ast = praxis.parseExpression(tokens, sample.source);

      const generatedSource = ast.visit(new praxis.Generator(), {
        nestingLevel: 0,
        indentation: '  ',
      });
      it(`should serialize to ${sample.serialization}`, () => assert.equal(generatedSource, sample.serialization));

      it(`should evaluate to ${sample.evaluation}`, async () => {
        const logger = makeLogger();
        const runtime = new GlobalRuntime(logger.log, getInput, false, 'this');
        const fruit = await ast.visit(new Evaluator(new praxis.OutputFormatter(), new Memdia()), runtime);
        assert.deepStrictEqual(fruit, sample.evaluation);
      });
    });
  }
});

describe('Praxis: Program Generation and Output', () => {
  const samples = [
    {
      message: 'print sum',
      source: 'print 5 + 1',
      serialization: "print 5 + 1\n",
      output: "6\n",
    },
    {
      message: 'print compound expression',
      source: 'print (7 * (3 + 1))',
      serialization: "print (7 * (3 + 1))\n",
      output: "28\n",
    },
    {
      message: 'print array',
      source: `int[] xs \u2b60 {12, 103, 88}
print xs
print xs[0]
print xs[1]
print xs[2]
print xs.length
`,
      output: `{12, 103, 88}
12
103
88
3
`,
    },
    {
      message: 'print int increments and decrements',
      source: `int x \u2b60 13
x++
print x
x++
print x
x--
print x
x--
print x
`,
      output: `14
15
14
13
`,
    },
    {
      message: 'print float increments and decrements',
      source: `float x \u2b60 13.2
x++
print x
x++
print x
x--
print x
x--
print x
`,
      output: `14.2
15.2
14.2
13.2
`,
    },
    {
      message: 'print array element increments and decrements',
      source: `int[] counts \u2b60 {100, 500}
counts[0]++
counts[1]--
print counts
counts[0]--
counts[1]++
print counts
`,
      output: `{101, 499}
{100, 500}
`,
    },
    {
      message: 'if-sans-else statement',
      source: `int age \u2b60 18
if (age ≥ 18)
  print "vote"
end if
age--
if (age ≥ 18)
  print "vote"
end if
`,
      output: `vote
`,
    },
    {
      message: 'if-else statement',
      source: `int age \u2b60 18
if (age ≥ 18)
  print "vote"
else
  print "stay home"
end if
age--
if (age ≥ 18)
  print "vote"
else
  print "stay home"
end if
`,
      output: `vote
stay home
`,
    },
    {
      message: 'if-else-if statement',
      source: `int age \u2b60 18
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
else
  print "stay home"
end if
age \u2b60 12
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
else
  print "stay home"
end if
age \u2b60 14
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
else
  print "stay home"
end if
`,
      output: `vote
accompany
stay home
`,
    },
    {
      message: 'if-else-if-sans-else statement',
      source: `int age \u2b60 18
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
end if
age \u2b60 12
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
end if
age \u2b60 14
if (age ≥ 18)
  print "vote"
else if (age ≤ 12)
  print "accompany"
end if
`,
      output: `vote
accompany
`,
    },
  ];

  for (let sample of samples) {
    describe(`// ${sample.message}\n${sample.source}`, () => {
      const tokens = praxis.lex(sample.source);
      const ast = praxis.parse(tokens, sample.source);

      const generatedSource = ast.visit(new praxis.Generator(), {
        nestingLevel: 0,
        indentation: '  ',
      });
      const expectedSerialization = sample.serialization ?? sample.source;
      it(`should serialize to\n${expectedSerialization}`, () => assert.equal(generatedSource, expectedSerialization));

      it(`should output\n${sample.output}`, async () => {
        const logger = makeLogger();
        const runtime = new GlobalRuntime(logger.log, getInput, false, 'this');
        await ast.visit(new Evaluator(new praxis.OutputFormatter(), new Memdia()), runtime);
        assert.equal(logger.stdout, sample.output);
      });
    });
  }
});

describe('Praxis: Print', () => {
  const samples = [
    {
      message: 'space',
      source: `print 8    // space
print 6`,
      output: "8 6\n",
    },
    {
      message: 'nothing',
      source: `print 8    // nothing
print 6`,
      output: "86\n",
    },
    {
      message: 'non-space, non-nothing',
      source: `print 8    // nothing space, which means \\n
print 6`,
      output: "8\n6\n",
    },
    {
      message: 'no comment',
      source: `print 8\n
print 6\n`,
      output: "8\n6\n",
    },
  ];

  for (let sample of samples) {
    describe(`// ${sample.message}\n${sample.source}`, () => {
      it(`should output\n${sample.output}`, async () => {
        const tokens = praxis.lex(sample.source);
        const ast = praxis.parse(tokens, sample.source);

        const logger = makeLogger();
        const runtime = new GlobalRuntime(logger.log, getInput, false, 'this');
        await ast.visit(new Evaluator(new praxis.OutputFormatter(), new Memdia()), runtime);
        assert.equal(logger.stdout, sample.output);
      });
    });
  }
});

describe('Praxis: Array Generation and Output', () => {
  const samples = [
    {
      message: 'basic initialization and access',
      source: `int[] xs = {5, 7}
print xs
print xs.length
print xs[0]
print xs[1]`,
      output: "{5, 7}\n2\n5\n7\n",
    },
    {
      message: 'empty array',
      source: `int[] xs = {}
print xs
print xs.length`,
      output: "{}\n0\n",
    },
    {
      message: 'explicit allocation',
      source: `int[] xs = {5, 7}
xs[0] = 4
xs[1] = 6
print xs
print xs.length
print xs[0]
print xs[1]`,
      output: "{4, 6}\n2\n4\n6\n",
    },
    {
      message: 'multidimensional initialization and access',
      source: `int[][] nums = {{5, 3, 1}, {7, 4, 0}}
print nums
print nums.length
print nums[0].length
print nums[1].length
print nums[0][0]
print nums[0][1]
print nums[0][2]
print nums[1][0]
print nums[1][1]
print nums[1][2]`,
      output: "{{5, 3, 1}, {7, 4, 0}}\n2\n3\n3\n5\n3\n1\n7\n4\n0\n",
    },
    {
      message: 'ragged multidimensional initialization and access',
      source: `int[][] nums = {{5, 3}, {7, 4, 0}}
print nums
print nums.length
print nums[0].length
print nums[1].length
print nums[0][0]
print nums[0][1]
print nums[1][0]
print nums[1][1]
print nums[1][2]`,
      output: "{{5, 3}, {7, 4, 0}}\n2\n2\n3\n5\n3\n7\n4\n0\n",
    },
    {
      message: 'fixed size initialization and access',
      source: `int[0..2] counts = {10, 11, 12}
print counts
print counts.length
print counts[0]
print counts[1]
print counts[2]`,
      output: "{10, 11, 12}\n3\n10\n11\n12\n",
    },
    {
      message: 'multidimensional initialization and access',
      source: `int[0..1][0..2] nums = {{5, 3, 1}, {7, 4, 0}}
print nums
print nums.length
print nums[0].length
print nums[1].length
print nums[0][0]
print nums[0][1]
print nums[0][2]
print nums[1][0]
print nums[1][1]
print nums[1][2]`,
      output: "{{5, 3, 1}, {7, 4, 0}}\n2\n3\n3\n5\n3\n1\n7\n4\n0\n",
    },
    {
      message: 'mixed multidimensional initialization and access',
      source: `int[][0..2] nums = {{5, 3, 1}, {7, 4, 0}, {3, 10, 20}}
print nums
print nums.length
print nums[0].length
print nums[1].length
print nums[2].length
print nums[0][0]
print nums[0][1]
print nums[0][2]
print nums[1][0]
print nums[1][1]
print nums[1][2]
print nums[2][0]
print nums[2][1]
print nums[2][2]`,
      output: "{{5, 3, 1}, {7, 4, 0}, {3, 10, 20}}\n3\n3\n3\n3\n5\n3\n1\n7\n4\n0\n3\n10\n20\n",
    },
    {
      message: 'mixed multidimensional initialization and access',
      source: `int[0..2][] nums = {{5}, {7, 8}, {13, 14, 15}}
print nums
print nums.length
print nums[0].length
print nums[1].length
print nums[2].length
print nums[0][0]
print nums[1][0]
print nums[1][1]
print nums[2][0]
print nums[2][1]
print nums[2][2]`,
      output: "{{5}, {7, 8}, {13, 14, 15}}\n3\n1\n2\n3\n5\n7\n8\n13\n14\n15\n",
    },
  ];

  for (let sample of samples) {
    describe(`// ${sample.message}\n${sample.source}`, () => {
      it(`should output\n${sample.output}`, async () => {
        const tokens = praxis.lex(sample.source);
        const ast = praxis.parse(tokens, sample.source);

        const logger = makeLogger();
        const runtime = new GlobalRuntime(logger.log, getInput, false, 'this');
        await ast.visit(new Evaluator(new praxis.OutputFormatter(), new Memdia()), runtime);
        assert.equal(logger.stdout, sample.output);
      });
    });
  }
});

describe('Praxis: Objects', () => {
  const samples = [
    {
      message: 'basic object',
      source: `class Count
  public int count = 0
  void inc()
    count = count + 1
  end inc
  void dec()
    count = count - 1
  end dec
end class Count
Count c = new Count
print c.count
c.inc()
c.inc()
print c.count
c.dec()
print c.count`,
      output: "0\n2\n1\n",
    },
    {
      message: 'public instance variable access',
      source: `class Dog
  public String name
end class Dog
Dog d = new Dog
d.name = "Bizness"
print d.name`,
      output: "Bizness\n",
    },
    {
      message: 'internal method calls',
      source: `class Count
  public int n
  void inc()
    n = n + 1
  end inc
  void inc2()
    inc()
    inc()
  end inc2
end class Count
Count c = new Count
c.n = 0
print c.n
c.inc2()
c.inc2()
c.inc2()
print c.n`,
      output: "0\n6\n",
    },
    {
      message: 'call global functions from methods',
      source: `class Smallest
  public int value
  void add(int x)
    value = min(x, value)
  end add
end class Smallest
Smallest s = new Smallest
s.value = 999999
s.add(6)
s.add(3)
s.add(400)
s.add(-5)
print s.value`,
      output: "-5\n",
    },
    {
      message: 'method with return',
      source: `class Smallest
  public int value
  int add(int x)
    value = min(x, value)
    return value
  end add
end class Smallest
Smallest s = new Smallest
s.value = 999999
print s.add(6)
print s.add(3)
print s.add(400)
print s.add(-5)
print s.value`,
      output: "6\n3\n3\n-5\n-5\n",
    },
  ];

  for (let sample of samples) {
    describe(`// ${sample.message}\n${sample.source}`, () => {
      it(`should output\n${sample.output}`, async () => {
        const tokens = praxis.lex(sample.source);
        const ast = praxis.parse(tokens, sample.source);

        const logger = makeLogger();
        const runtime = new GlobalRuntime(logger.log, getInput, false, 'this');
        await ast.visit(new Evaluator(new praxis.OutputFormatter(), new Memdia()), runtime);
        assert.equal(logger.stdout, sample.output);
      });
    });
  }
});

// unknown method internal/external
// parentheses after constructor

describe('Praxis: Object Errors', () => {
  const samples = [
    {
      message: 'private access',
      source: `class Circle
  private double radius
end class Circle
Circle c = new Circle
print c.radius`,
      error: error.VisibilityError,
    },
    {
      message: 'external access of unknown instance variable',
      source: `class Circle
  public double radius
end class Circle
Circle c = new Circle
print c.diameter`,
      error: error.UndeclaredError,
    },
    {
      message: 'internal access of unknown instance variable',
      source: `class Circle
  public double radius
  void debug()
    print diameter
  end debug
end class Circle
Circle c = new Circle
c.debug()`,
      error: error.UndeclaredError,
    },
    {
      message: 'external access of unknown instance method',
      source: `class Circle
  public double radius
end class Circle
Circle c = new Circle
print c.area()`,
      error: error.UndeclaredError,
    },
    {
      message: 'internal access of unknown instance method',
      source: `class Circle
  public double radius
  double circumference()
    return diameter() * 3.14159
  end
end class Circle
Circle c = new Circle
print c.circumference()`,
      error: error.UndeclaredError,
    },
    {
      message: 'uninitialized instance variable',
      source: `class Circle
  public double radius
end class Circle
Circle c = new Circle
print c.radius`,
      error: error.UninitializedError,
    },
  ];

  for (let sample of samples) {
    describe(`// ${sample.message}\n${sample.source}`, () => {
      const evaluate = async () => {
        const tokens = praxis.lex(sample.source);
        const ast = praxis.parse(tokens, sample.source);
        const logger = makeLogger();
        const runtime = new GlobalRuntime(logger.log, getInput, false, 'this');
        await ast.visit(new Evaluator(new praxis.OutputFormatter(), new Memdia()), runtime);
      };
      it(`should error on ${sample.message}`, () => assert.rejects(evaluate, sample.error));
    });
  }
});

describe('Praxis: Parse Errors', () => {
  const samples = [
    {
      message: 'bad separator',
      source: `int[] xs = {5; 6}`,
    },
  ];

  for (let sample of samples) {
    describe(`// ${sample.message}\n${sample.source}`, () => {
      const evaluate = async () => {
        const tokens = praxis.lex(sample.source);
        const ast = praxis.parse(tokens, sample.source);
        const logger = makeLogger();
        const runtime = new GlobalRuntime(logger.log, getInput, false, 'this');
        await ast.visit(new Evaluator(new praxis.OutputFormatter(), new Memdia()), runtime);
      };
      it(`should error on ${sample.message}`, () => assert.rejects(evaluate, error.ParseError));
    });
  }
});

describe('Praxis: Illegal Array', () => {
  const samples = [
    {
      message: 'bad element type',
      source: `int[] xs = {false}`,
      error: error.TypeError,
    },
    {
      message: 'bad index in non-empty array',
      source: `int[] xs = {5, 6}
print(xs[2])`,
      error: error.IllegalIndexError,
    },
    {
      message: 'bad index in empty array',
      source: `int[] xs = {}
print(xs[0])`,
      error: error.IllegalIndexError,
    },
    {
      message: 'negative index',
      source: `int[] xs = {5, 6}
print(xs[-1])`,
      error: error.IllegalIndexError,
    },
    {
      message: 'assignment to bad index',
      source: `int[] xs = {5, 6}
xs[2] = 7`,
      error: error.IllegalIndexError,
    },
    {
      message: 'mismatched sizes',
      source: `int[0..2] xs = {5, 6}`,
      error: error.TypeError,
    },
    {
      message: 'multidimensional mismatched sizes',
      source: `int[0..1][0..2] xs = {{5, 6}, {1, 3}}`,
      error: error.TypeError,
    },
    {
      message: 'ragged fixed-size multidimensional initialization and access',
      source: `int[0..2][0..1] nums = {{5, 3}, {7, 4, 0}}`,
      error: error.TypeError,
    },
  ];

  for (let sample of samples) {
    describe(`// ${sample.message}\n${sample.source}`, () => {
      const evaluate = async () => {
        const tokens = praxis.lex(sample.source);
        const ast = praxis.parse(tokens, sample.source);
        const logger = makeLogger();
        const runtime = new GlobalRuntime(logger.log, getInput, false, 'this');
        await ast.visit(new Evaluator(new praxis.OutputFormatter(), new Memdia()), runtime);
        console.log("hi");
      };
      it(`should error on ${sample.message}`, () => assert.rejects(evaluate, sample.error));
    });
  }
});

describe('Praxis: Type Errors', () => {
  const samples = [
    {
      message: 'increment boolean',
      source: `boolean b = false
b++`,
    },
    {
      message: 'increment string',
      source: `String s = "pardon"
s++`,
    },
  ];

  for (let sample of samples) {
    describe(`// ${sample.message}\n${sample.source}`, () => {
      const evaluate = async () => {
        const tokens = praxis.lex(sample.source);
        const ast = praxis.parse(tokens, sample.source);
        const logger = makeLogger();
        const runtime = new GlobalRuntime(logger.log, getInput, false, 'this');
        await ast.visit(new Evaluator(new praxis.OutputFormatter(), new Memdia()), runtime);
      };
      it(`should error on ${sample.message}`, () => assert.rejects(evaluate, error.TypeError));
    });
  }
});
