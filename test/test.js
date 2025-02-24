import assert from 'node:assert';
import {lexPraxis} from '../build/language/praxis/lexer.js';
import {parsePraxis, parsePraxisExpression} from '../build/language/praxis/parser.js';
import {PraxisGenerator} from '../build/language/praxis/generator.js';
import {Runtime, Evaluator, Fruit, Type} from '../build/language/evaluator.js';
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
  ];

  for (let sample of samples) {
    describe(sample.source, () => {
      const tokens = lexPraxis(sample.source);
      const ast = parsePraxisExpression(tokens, sample.source);

      const generatedSource = ast.visit(new PraxisGenerator(), {
        nestingLevel: 0,
        indentation: '  ',
      });
      it(`should serialize to ${generatedSource}`, () => assert.equal(generatedSource, sample.serialization));

      const runtime = Runtime.new();
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
  ];

  for (let sample of samples) {
    describe(sample.source, () => {
      const tokens = lexPraxis(sample.source);
      const ast = parsePraxis(tokens, sample.source);

      const generatedSource = ast.visit(new PraxisGenerator(), {
        nestingLevel: 0,
        indentation: '  ',
      });
      it(`should serialize to\n${generatedSource}`, () => assert.equal(generatedSource, sample.serialization));

      Runtime.stdout = '';
      const runtime = Runtime.new();
      ast.visit(new Evaluator(praxisSymbolMap), runtime);
      const stdout = Runtime.stdout;
      it(`should output\n${sample.output}`, () => assert.equal(stdout, sample.output));
    });
  }
});
