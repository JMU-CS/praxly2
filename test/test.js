import assert from 'node:assert';
import {lexPraxis} from '../build/language/praxis/lexer.js';
import {parsePraxis} from '../build/language/praxis/parser.js';
import {PraxisGenerator} from '../build/language/praxis/generator.js';
import {Runtime, Evaluator, Fruit, Type} from '../build/language/evaluator.js';
import {praxisSymbolMap} from '../build/language/praxis/symbol-map.js';

describe('Praxis Serialization and Output', () => {
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
