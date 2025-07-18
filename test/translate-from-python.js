import assert from 'node:assert';
import * as praxis from '../build/language/praxis/index.js';
import * as python from '../build/language/python/index.js';

describe('Translate Python Expressions to Praxly', () => {
  const samples = [
    {
      python: '5 + 1',
      praxis: "5 + 1",
    },
    {
      python: '5 - 4 - 3',
      praxis: '5 - 4 - 3',
    },
    {
      python: 'True and False',
      praxis: 'true and false',
    },
    {
      python: 'False or True',
      praxis: 'false or true',
    },
    {
      python: 'not True',
      praxis: 'not true',
    },
    {
      python: 'not not True',
      praxis: 'not not true',
    },
    {
      python: '6 < 7',
      praxis: '6 < 7',
    },
    {
      python: '"blink" == "blank"',
      praxis: '"blink" == "blank"',
    },
    {
      python: '"blink" != "blank"',
      praxis: '"blink" ≠ "blank"',
    },
    {
      python: 'not False and True',
      praxis: 'not false and true',
    },
    {
      python: 'not False and False',
      praxis: 'not false and false',
    },
    {
      python: '7 / 3',
      praxis: '7 / 3',
    },
    {
      python: '7.0 / 4',
      praxis: '7.0 / 4',
    },
    {
      python: '10.5 / 0.5',
      praxis: '10.5 / 0.5',
    },
    {
      python: '5 + 2 * 3.0',
      praxis: '5 + 2 * 3.0',
    },
    {
      python: '5 + 2 * 3.0',
      praxis: '5 + 2 * 3.0',
    },
    {
      python: '-2 % 5',
      praxis: '-2 % 5',
    },
    {
      python: 'sqrt(0.25)',
      praxis: 'sqrt(0.25)',
    },
    {
      python: 'max(5, 689)',
      praxis: 'max(5, 689)',
    },
    {
      python: 'min(5, 689)',
      praxis: 'min(5, 689)',
    },
    {
      python: 'abs(6)',
      praxis: 'abs(6)',
    },
    {
      python: 'abs(-6)',
      praxis: 'abs(-6)',
    },
    {
      python: 'abs(0)',
      praxis: 'abs(0)',
    },
    {
      python: 'log(1.0)',
      praxis: 'log(1.0)',
    },
    {
      python: 'log(1)',
      praxis: 'log(1)',
    },
    {
      python: 'log(1)',
      praxis: 'log(1)',
    },
    {
      python: 'log(10)',
      praxis: 'log(10)',
    },
  ];

  for (let sample of samples) {
    describe(sample.python, () => {
      const tokens = python.lex(sample.python);
      const ast = python.parseExpression(tokens, sample.python);

      const generatedSource = ast.visit(new praxis.Translator(), {
        nestingLevel: 0,
        indentation: '  ',
      });
      it(`should translate to Praxis code ${sample.praxis}`, () => assert.equal(generatedSource, sample.praxis));
    });
  }
});

describe('Translate Full Python Programs to Praxly', () => {
  const samples = [
    {
      message: 'print sum',
      python: 'print(5 + 1)',
      praxis: "print 5 + 1\n",
    },
  ];

  for (let sample of samples) {
    describe(`# ${sample.message}\n${sample.python}`, () => {
      const tokens = python.lex(sample.python);
      const ast = python.parse(tokens, sample.python);

      const generatedSource = ast.visit(new praxis.Translator(), {
        nestingLevel: 0,
        indentation: '  ',
      });
      it(`should translate to Praxis code\n${sample.praxis}`, () => assert.equal(generatedSource, sample.praxis));
    });
  }
});
