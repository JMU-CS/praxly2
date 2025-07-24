import assert from 'node:assert';
import * as praxis from '../build/language/praxis/index.js';
import * as python from '../build/language/python/index.js';
import * as error from '../build/language/error.js';
import {makeLogger, getInput} from './utilities.js';
import {GlobalRuntime, Evaluator} from '../build/language/evaluator.js';
import {Memdia} from '../build/language/memdia.js';

function testTranslation(sample, ast) {
  let targetSource = ast.visit(new praxis.Translator(), {
    nestingLevel: 0,
    indentation: '  ',
  });
  it(`should translate from python to praxis`, () => assert.equal(targetSource, sample.praxis));
}

function testExpression(sample) {
  describe(sample.python, () => {
    const tokens = python.lex(sample.python);
    const ast = python.parseExpression(tokens, sample.python);
    testTranslation(sample, ast);
  });
}

function testProgram(sample) {
  describe(`# ${sample.message}\n${sample.python}`, () => {
    const tokens = python.lex(sample.python);
    const ast = python.parse(tokens, sample.python);

    testTranslation(sample, ast);

    it(`should output\n${sample.output}`, async () => {
      const logger = makeLogger();
      const runtime = new GlobalRuntime(logger.log, getInput, false, 'this');
      await ast.visit(new Evaluator(new python.OutputFormatter(), new Memdia()), runtime);
      assert.equal(logger.stdout, sample.output);
    });
  });
}

function testError(sample) {
  describe(`# ${sample.message}\n${sample.python}`, () => {
    const evaluate = async () => {
      const tokens = python.lex(sample.python);
      const ast = python.parse(tokens, sample.python);
      const logger = makeLogger();
      const runtime = new GlobalRuntime(logger.log, getInput, false, 'this');
      await ast.visit(new Evaluator(new python.OutputFormatter(), new Memdia()), runtime);
    };
    it(`should error on ${sample.message}`, () => assert.rejects(evaluate, sample.error));
  });
}

describe('Python: Interpret, Translate, and Execute Expressions', () => {
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

  samples.forEach(testExpression);
});

describe('Python: Interpret, Translate, and Execute Programs', () => {
  const samples = [
    {
      message: 'print sum',
      python: 'print(5 + 1)',
      praxis: "print 5 + 1\n",
      output: `6
`,
    },
  ];

  samples.forEach(testProgram);
});

describe('Python: Parse Errors', () => {
  const samples = [
    {
      message: 'illegal adjacent identifiers',
      python: `x x`,
      error: error.ParseError,
    },
  ];

  samples.forEach(testError);
});
