import assert from 'node:assert';
import {lexPraxis} from '../build/language/praxis/lexer.js';
import {parsePraxis, parsePraxisExpression} from '../build/language/praxis/parser.js';
import {PraxisGenerator} from '../build/language/praxis/generator.js';
import {Fruit, Type} from '../build/language/type.js';
import {GlobalRuntime, Evaluator} from '../build/language/evaluator.js';
import {praxisSymbolMap} from '../build/language/praxis/symbol-map.js';

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
      const tokens = lexPraxis(sample.source);
      const ast = parsePraxisExpression(tokens, sample.source);

      const generatedSource = ast.visit(new PraxisGenerator(), {
        nestingLevel: 0,
        indentation: '  ',
      });
      it(`should serialize to ${sample.serialization}`, () => assert.equal(generatedSource, sample.serialization));

      const runtime = new GlobalRuntime();
      const fruit = ast.visit(new Evaluator(praxisSymbolMap), runtime);
      it(`should evaluate to ${sample.evaluation}`, () => assert.deepStrictEqual(fruit, sample.evaluation));
    });
  }
});

describe('Praxis: Program Generation and Output', () => {
  const samples = [
    {
      source: 'print 5 + 1',
      serialization: "print 5 + 1\n",
      output: "6\n",
    },
    {
      source: 'print (7 * (3 + 1))',
      serialization: "print 7 * (3 + 1)\n",
      output: "28\n",
    },
    {
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
  ];

  for (let sample of samples) {
    describe(sample.source, () => {
      const tokens = lexPraxis(sample.source);
      const ast = parsePraxis(tokens, sample.source);

      const generatedSource = ast.visit(new PraxisGenerator(), {
        nestingLevel: 0,
        indentation: '  ',
      });
      const expectedSerialization = sample.serialization ?? sample.source;
      it(`should serialize to\n${expectedSerialization}`, () => assert.equal(generatedSource, expectedSerialization));

      const runtime = new GlobalRuntime();
      ast.visit(new Evaluator(praxisSymbolMap), runtime);
      it(`should output\n${sample.output}`, () => assert.equal(runtime.stdout, sample.output));
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
      source: `print 8    // nothing space, which means \n
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
    describe(sample.source, () => {
      const tokens = lexPraxis(sample.source);
      const ast = parsePraxis(tokens, sample.source);

      const runtime = new GlobalRuntime();
      ast.visit(new Evaluator(praxisSymbolMap), runtime);
      it(`on ${sample.message}, should output\n${sample.output}`, () => assert.equal(runtime.stdout, sample.output));
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
  ];

  for (let sample of samples) {
    describe(sample.source, () => {
      const tokens = lexPraxis(sample.source);
      const ast = parsePraxis(tokens, sample.source);

      const runtime = new GlobalRuntime();
      ast.visit(new Evaluator(praxisSymbolMap), runtime);
      it(`on ${sample.message}, should output\n${sample.output}`, () => assert.equal(runtime.stdout, sample.output));
    });
  }
});

describe('Praxis: Illegal Array', () => {
  const samples = [
    {
      message: 'bad element type',
      source: `int[] xs = {false}`,
    },
    {
      message: 'bad separator',
      source: `int[] xs = {5; 6}`,
    },
    {
      message: 'bad index in non-empty array',
      source: `int[] xs = {5; 6}
print(xs[2])`,
    },
    {
      message: 'bad index in empty array',
      source: `int[] xs = {}
print(xs[0])`,
    },
    {
      message: 'negative index',
      source: `int[] xs = {5; 6}
print(xs[-1])`,
    },
    {
      message: 'assignment to bad index',
      source: `int[] xs = {5; 6}
xs[2] = 7`,
    },
  ];

  for (let sample of samples) {
    describe(sample.source, () => {
      const evaluate = () => {
        const tokens = lexPraxis(sample.source);
        const ast = parsePraxis(tokens, sample.source);
        const runtime = new GlobalRuntime();
        ast.visit(new Evaluator(praxisSymbolMap), runtime);
      };
      it(`should error on ${sample.message}`, () => assert.throws(evaluate));
    });
  }
});
