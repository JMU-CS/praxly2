import assert from 'node:assert';
import {lexPraxis} from '../build/language/praxis/lexer.js';
import {parsePraxis, parsePraxisExpression} from '../build/language/praxis/parser.js';
import {PraxisGenerator} from '../build/language/praxis/generator.js';
import {GlobalRuntime, Evaluator, Fruit, Type} from '../build/language/evaluator.js';
import {praxisSymbolMap} from '../build/language/praxis/symbol-map.js';

describe('Praxis Expression Generation and Evaluation', () => {
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
      // not (a OP b) vs (not a) OP b
      //
      // a  b  NOT a  a AND b  a OR b  NOT (a AND b)  NOT (a OR b)  (NOT a) AND b
      // T  T    F       T       T     F              F             F
      // T  F    F       F       T     T              F             F
      // F  T    T       F       T     T              F             T
      // F  F    T       F       F     T              T             F
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

describe('Praxis Program Generation and Output', () => {
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
