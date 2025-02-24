import {lexPraxis} from '../build/language/praxis/lexer.js';
import {parsePraxis} from '../build/language/praxis/parser.js';
import {PraxisGenerator} from '../build/language/praxis/generator.js';
import {Runtime, Evaluator, Fruit, Type} from '../build/language/evaluator.js';
import {praxisSymbolMap} from '../build/language/praxis/symbol-map.js';

test('Praxis Serialization and Output', () => {
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
    const tokens = lexPraxis(sample.source);
    const ast = parsePraxis(tokens, sample.source);

    const generatedSource = ast.visit(new PraxisGenerator(), {
      nestingLevel: 0,
      indentation: '  ',
    });
    expect(generatedSource).toBe(sample.serialization);

    Runtime.stdout = '';
    const runtime = Runtime.new();
    ast.visit(new Evaluator(praxisSymbolMap), runtime);
    expect(Runtime.stdout).toBe(sample.output);
  }
});
