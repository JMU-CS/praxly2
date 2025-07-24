import assert from 'node:assert';
import * as praxis from '../build/language/praxis/index.js';
import * as python from '../build/language/python/index.js';
import {Fruit, Type} from '../build/language/type.js';
import {GlobalRuntime, Evaluator} from '../build/language/evaluator.js';
import * as error from '../build/language/error.js';
import {Memdia} from '../build/language/memdia.js';
import {makeLogger, getInput} from './utilities.js';

// Functions passed to describe can't be async. Only functions passed to it can
// be asynchronous.

const platforms = [
  {language: 'praxis', module: praxis},
  {language: 'python', module: python},
];

function testTranslation(sample, ast) {
  for (let {language, module} of platforms) {
    if (sample.translation[language] !== 'TODO') {
      const generatedSource = ast.visit(new module.Translator(), {
        nestingLevel: 0,
        indentation: '  ',
      });
      it(`should translate from praxis to ${language}`, () => assert.equal(generatedSource, sample.translation[language]));
    }
  }
}

function testExpression(sample) {
  describe(sample.source, () => {
    const tokens = praxis.lex(sample.source);
    const ast = praxis.parseExpression(tokens, sample.source);

    testTranslation(sample, ast);

    it(`should evaluate to ${sample.evaluation}`, async () => {
      const logger = makeLogger();
      const runtime = new GlobalRuntime(logger.log, getInput, false, 'this');
      const fruit = await ast.visit(new Evaluator(new praxis.OutputFormatter(), new Memdia()), runtime);
      assert.deepStrictEqual(fruit, sample.evaluation);
    });
  });
}

function testProgram(sample) {
  describe(`// ${sample.message}\n${sample.source}`, () => {
    const tokens = praxis.lex(sample.source);
    const ast = praxis.parse(tokens, sample.source);

    if (sample.translation) {
      testTranslation(sample, ast);
    }

    it(`should output\n${sample.output}`, async () => {
      const logger = makeLogger();
      const runtime = new GlobalRuntime(logger.log, getInput, false, 'this');
      await ast.visit(new Evaluator(new praxis.OutputFormatter(), new Memdia()), runtime);
      assert.equal(logger.stdout, sample.output);
    });
  });
}

function testError(sample) {
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

describe('Expressions', () => {
  const samples = [
    {
      source: '5 + 1',
      evaluation: new Fruit(Type.Integer, 6),
      translation: {
        praxis: "5 + 1",
        python: "5 + 1",
      },
    },
    {
      source: '5 - 4 - 3',
      evaluation: new Fruit(Type.Integer, -2),
      translation: {
        praxis: '5 - 4 - 3',
        python: '5 - 4 - 3',
      },
    },
    {
      source: 'true and false',
      evaluation: new Fruit(Type.Boolean, false),
      translation: {
        praxis: 'true and false',
        python: 'True and False',
      },
    },
    {
      source: 'false or true',
      evaluation: new Fruit(Type.Boolean, true),
      translation: {
        praxis: 'false or true',
        python: 'False or True',
      },
    },
    {
      source: 'not true',
      evaluation: new Fruit(Type.Boolean, false),
      translation: {
        praxis: 'not true',
        python: 'not True',
      },
    },
    {
      source: 'not not true',
      evaluation: new Fruit(Type.Boolean, true),
      translation: {
        praxis: 'not not true',
        python: 'not not True',
      },
    },
    {
      source: '6 < 7',
      evaluation: new Fruit(Type.Boolean, true),
      translation: {
        praxis: '6 < 7',
        python: '6 < 7',
      },
    },
    {
      source: '"blink" == "blank"',
      evaluation: new Fruit(Type.Boolean, false),
      translation: {
        praxis: '"blink" == "blank"',
        python: '"blink" == "blank"',
      },
    },
    {
      source: '"blink" != "blank"',
      evaluation: new Fruit(Type.Boolean, true),
      translation: {
        praxis: '"blink" ≠ "blank"',
        python: '"blink" != "blank"',
      },
    },
    {
      source: 'not false and true',
      evaluation: new Fruit(Type.Boolean, true),
      translation: {
        praxis: 'not false and true',
        python: 'not False and True',
      },
    },
    {
      source: 'not false and false',
      evaluation: new Fruit(Type.Boolean, false),
      translation: {
        praxis: 'not false and false',
        python: 'not False and False',
      },
    },
    {
      source: '7 / 3',
      evaluation: new Fruit(Type.Integer, 2),
      translation: {
        praxis: '7 / 3',
        python: '7 / 3',
      },
    },
    {
      source: '7.0 / 4',
      evaluation: new Fruit(Type.Float, 1.75),
      translation: {
        praxis: '7.0 / 4',
        python: '7.0 / 4',
      },
    },
    {
      source: '10.5 / 0.5',
      evaluation: new Fruit(Type.Float, 21.0),
      translation: {
        praxis: '10.5 / 0.5',
        python: '10.5 / 0.5',
      },
    },
    {
      source: '5 + 2 * 3.0',
      evaluation: new Fruit(Type.Float, 11.0),
      translation: {
        praxis: '5 + 2 * 3.0',
        python: '5 + 2 * 3.0',
      },
    },
    {
      source: '5 + 2 * 3.0',
      evaluation: new Fruit(Type.Float, 11.0),
      translation: {
        praxis: '5 + 2 * 3.0',
        python: '5 + 2 * 3.0',
      },
    },
    {
      source: '-2 % 5',
      evaluation: new Fruit(Type.Integer, 3),
      translation: {
        praxis: '-2 % 5',
        python: '-2 % 5',
      },
    },
    {
      source: 'sqrt(0.25)',
      evaluation: new Fruit(Type.Float, 0.5),
      translation: {
        praxis: 'sqrt(0.25)',
        python: 'sqrt(0.25)',
      },
    },
    {
      source: 'max(5, 689)',
      evaluation: new Fruit(Type.Integer, 689),
      translation: {
        praxis: 'max(5, 689)',
        python: 'max(5, 689)',
      },
    },
    {
      source: 'min(5, 689)',
      evaluation: new Fruit(Type.Integer, 5),
      translation: {
        praxis: 'min(5, 689)',
        python: 'min(5, 689)',
      },
    },
    {
      source: 'abs(6)',
      evaluation: new Fruit(Type.Integer, 6),
      translation: {
        praxis: 'abs(6)',
        python: 'abs(6)',
      },
    },
    {
      source: 'abs(-6)',
      evaluation: new Fruit(Type.Integer, 6),
      translation: {
        praxis: 'abs(-6)',
        python: 'abs(-6)',
      },
    },
    {
      source: 'abs(0)',
      evaluation: new Fruit(Type.Integer, 0),
      translation: {
        praxis: 'abs(0)',
        python: 'abs(0)',
      },
    },
    {
      source: 'log(1.0)',
      evaluation: new Fruit(Type.Float, 0),
      translation: {
        praxis: 'log(1.0)',
        python: 'log(1.0)',
      },
    },
    {
      source: 'log(1)',
      evaluation: new Fruit(Type.Float, 0),
      translation: {
        praxis: 'log(1)',
        python: 'log(1)',
      },
    },
    {
      source: 'log(10)',
      evaluation: new Fruit(Type.Float, 2.302585092994046),
      translation: {
        praxis: 'log(10)',
        python: 'log(10)',
      },
    },
  ];

  samples.forEach(testExpression);
});

describe('Programs', () => {
  const samples = [
    {
      message: 'print sum',
      source: 'print 5 + 1',
      translation: {
        praxis: "print 5 + 1\n",
        python: "print(5 + 1)\n",
      },
      output: "6\n",
    },
    {
      message: 'print compound expression',
      source: 'print (7 * (3 + 1))',
      translation: {
        praxis: "print (7 * (3 + 1))\n",
        python: "print((7 * (3 + 1)))\n",
      },
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
      translation: {
        praxis: `int[] xs \u2b60 {12, 103, 88}
print xs
print xs[0]
print xs[1]
print xs[2]
print xs.length
`,
        python: `xs = [12, 103, 88]
print(xs)
print(xs[0])
print(xs[1])
print(xs[2])
print(len(xs))
`,
      },
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
      translation: {
        praxis: `int x \u2b60 13
x++
print x
x++
print x
x--
print x
x--
print x
`,
        python: `x = 13
x = x + 1
print(x)
x = x + 1
print(x)
x = x - 1
print(x)
x = x - 1
print(x)
`,
      },
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
      translation: {
        praxis: `float x \u2b60 13.2
x++
print x
x++
print x
x--
print x
x--
print x
`,
        python: `x = 13.2
x = x + 1
print(x)
x = x + 1
print(x)
x = x - 1
print(x)
x = x - 1
print(x)
`,
      },
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
      translation: {
        praxis: `int[] counts \u2b60 {100, 500}
counts[0]++
counts[1]--
print counts
counts[0]--
counts[1]++
print counts
`,
        python: `counts = [100, 500]
counts[0] = counts[0] + 1
counts[1] = counts[1] - 1
print(counts)
counts[0] = counts[0] - 1
counts[1] = counts[1] + 1
print(counts)
`,
      },
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
      translation: {
        praxis: `int age \u2b60 18
if (age ≥ 18)
  print "vote"
end if
age--
if (age ≥ 18)
  print "vote"
end if
`,
        python: `age = 18
if age >= 18:
  print("vote")
age = age - 1
if age >= 18:
  print("vote")
`,
      },
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
      translation: {
        praxis: `int age \u2b60 18
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
        python: `age = 18
if age >= 18:
  print("vote")
else:
  print("stay home")
age = age - 1
if age >= 18:
  print("vote")
else:
  print("stay home")
`,
      },
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
      translation: {
        praxis: `int age \u2b60 18
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
        python: `age = 18
if age >= 18:
  print("vote")
elif age <= 12:
  print("accompany")
else:
  print("stay home")
age = 12
if age >= 18:
  print("vote")
elif age <= 12:
  print("accompany")
else:
  print("stay home")
age = 14
if age >= 18:
  print("vote")
elif age <= 12:
  print("accompany")
else:
  print("stay home")
`,
      },
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
      translation: {
        praxis: `int age \u2b60 18
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
        python: `age = 18
if age >= 18:
  print("vote")
elif age <= 12:
  print("accompany")
age = 12
if age >= 18:
  print("vote")
elif age <= 12:
  print("accompany")
age = 14
if age >= 18:
  print("vote")
elif age <= 12:
  print("accompany")
`,
      },
      output: `vote
accompany
`,
    },
    {
      message: 'shadowing',
      source: `int x \u2b60 5
for (int x \u2b60 0; x < 3; x \u2b60 x + 1)
  print x
end for
print x
`,
      translation: {
        praxis: `int x \u2b60 5
for (int x \u2b60 0; x < 3; x \u2b60 x + 1)
  print x
end for
print x
`,
        python: `x = 5
x = 0
while x < 3:
  print(x)
  x = x + 1
print(x)
`,
      },
      output: `0
1
2
5
`,
    },
  ];

  samples.forEach(testProgram);
});

describe('Print', () => {
  const samples = [
    {
      message: 'space',
      source: `print 8    // space
print 6`,
      translation: {
        praxis: `print 8 // space
print 6
`,
        python: 'TODO',
      },
      output: "8 6\n",
    },
    {
      message: 'nothing',
      source: `print 8    // nothing
print 6`,
      translation: {
        praxis: `print 8 // nothing
print 6
`,
        python: 'TODO',
      },
      output: "86\n",
    },
    {
      message: 'non-space, non-nothing',
      source: `print 8    // nothing space, which means \\n
print 6`,
      translation: {
        praxis: `print 8 // nothing space, which means \\n
print 6
`,
        python: 'TODO',
      },
      output: "8\n6\n",
    },
    {
      message: 'no comment',
      source: `print 8
print 6
`,
      translation: {
        praxis: `print 8
print 6
`,
        python: 'TODO',
      },
      output: "8\n6\n",
    },
  ];

  samples.forEach(testProgram);
});

describe('Array Generation and Output', () => {
  const samples = [
    {
      message: 'basic initialization and access',
      source: `int[] xs = {5, 7}
print xs
print xs.length
print xs[0]
print xs[1]`,
      translation: {
        praxis: `int[] xs \u2b60 {5, 7}
print xs
print xs.length
print xs[0]
print xs[1]
`,
        python: `TODO`,
      },
      output: "{5, 7}\n2\n5\n7\n",
    },
    {
      message: 'empty array',
      source: `int[] xs = {}
print xs
print xs.length`,
      translation: {
        praxis: `int[] xs \u2b60 {}
print xs
print xs.length
`,
        python: `TODO`,
      },
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
      translation: {
        praxis: `int[] xs \u2b60 {5, 7}
xs[0] \u2b60 4
xs[1] \u2b60 6
print xs
print xs.length
print xs[0]
print xs[1]
`,
        python: `TODO`,
      },
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
      translation: {
        praxis: `int[][] nums \u2b60 {{5, 3, 1}, {7, 4, 0}}
print nums
print nums.length
print nums[0].length
print nums[1].length
print nums[0][0]
print nums[0][1]
print nums[0][2]
print nums[1][0]
print nums[1][1]
print nums[1][2]
`,
        python: `TODO`,
      },
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
      translation: {
        praxis: `int[][] nums \u2b60 {{5, 3}, {7, 4, 0}}
print nums
print nums.length
print nums[0].length
print nums[1].length
print nums[0][0]
print nums[0][1]
print nums[1][0]
print nums[1][1]
print nums[1][2]
`,
        python: `TODO`,
      },
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
      translation: {
        praxis: `int[0..2] counts \u2b60 {10, 11, 12}
print counts
print counts.length
print counts[0]
print counts[1]
print counts[2]
`,
        python: `TODO`,
      },
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
      translation: {
        praxis: `int[0..1][0..2] nums \u2b60 {{5, 3, 1}, {7, 4, 0}}
print nums
print nums.length
print nums[0].length
print nums[1].length
print nums[0][0]
print nums[0][1]
print nums[0][2]
print nums[1][0]
print nums[1][1]
print nums[1][2]
`,
        python: `TODO`,
      },
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
      translation: {
        praxis: `int[][0..2] nums \u2b60 {{5, 3, 1}, {7, 4, 0}, {3, 10, 20}}
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
print nums[2][2]
`,
        python: `TODO`,
      },
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
      translation: {
        praxis: `int[0..2][] nums \u2b60 {{5}, {7, 8}, {13, 14, 15}}
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
print nums[2][2]
`,
        python: `TODO`,
      },
      output: "{{5}, {7, 8}, {13, 14, 15}}\n3\n1\n2\n3\n5\n7\n8\n13\n14\n15\n",
    },
  ];

  samples.forEach(testProgram);
});

describe('Objects', () => {
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
      message: 'instance variable and setter',
      source:
`class Foo
  int x = 5
  void set(int x)
    this.x = x
  end set
end class Foo
Foo f = new Foo
f.set(10)
print f.x
`,
      translation: {
        praxis:
`class Foo
  int x \u2b60 5

  void set(int x)
    this.x \u2b60 x
  end set
end class Foo
Foo f \u2b60 new Foo
f.set(10)
print f.x
`,
        python:
`class Foo:
  def set(self, x):
    self.x = x
f = Foo()
f.set(10)
print(f.x)
`
      },
      output: `10
`,
    },
    {
      message: 'public instance variable access',
      source: `class Dog
  public String name
end class Dog
Dog d = new Dog
d.name = "Bizness"
print d.name`,
      translation: {
        praxis: `class Dog
  public String name
end class Dog
Dog d \u2b60 new Dog
d.name \u2b60 "Bizness"
print d.name
`,
        python: `TODO`,
      },
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
      translation: {
        praxis: `class Count
  public int n

  void inc()
    n \u2b60 n + 1
  end inc

  void inc2()
    inc()
    inc()
  end inc2
end class Count
Count c \u2b60 new Count
c.n \u2b60 0
print c.n
c.inc2()
c.inc2()
c.inc2()
print c.n
`,
        python: `TODO`,
      },
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
      translation: {
        praxis: `class Smallest
  public int value

  void add(int x)
    value \u2b60 min(x, value)
  end add
end class Smallest
Smallest s \u2b60 new Smallest
s.value \u2b60 999999
s.add(6)
s.add(3)
s.add(400)
s.add(-5)
print s.value
`,
        python: `TODO`,
      },
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
      translation: {
        praxis: `class Smallest
  public int value

  int add(int x)
    value \u2b60 min(x, value)
    return value
  end add
end class Smallest
Smallest s \u2b60 new Smallest
s.value \u2b60 999999
print s.add(6)
print s.add(3)
print s.add(400)
print s.add(-5)
print s.value
`,
        python: `TODO`,
      },
      output: "6\n3\n3\n-5\n-5\n",
    },
  ];

  samples.forEach(testProgram);
});

describe('Object Errors', () => {
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

  samples.forEach(testError);
});

describe('Parse Errors', () => {
  const samples = [
    {
      message: 'bad separator',
      source: `int[] xs = {5; 6}`,
      error: error.ParseError,
    },
  ];

  samples.forEach(testError);
});

describe('Illegal Array', () => {
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

  samples.forEach(testError);
});

describe('Type Errors', () => {
  const samples = [
    {
      message: 'increment boolean',
      source: `boolean b = false
b++`,
      error: error.TypeError,
    },
    {
      message: 'increment string',
      source: `String s = "pardon"
s++`,
      error: error.TypeError,
    },
  ];

  samples.forEach(testError);
});
