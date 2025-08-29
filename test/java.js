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

describe("Translate Praxis Expressions to Java", () => {
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
      output: 'Math.pow(2, 8);'
    },
    {
      source: 'False or True',
      output: 'false or true'
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
      source: 'not False and False',
      output: '!false and false',
    },
    {
      source: '7 / 3',
      output: '7 / 3',
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
    }
  ]

  samples.forEach(testExpression);
});

describe("Translate Praxis programs to Java", () =>
{
  const samples = [
    {
      message: "Classless code",
      source:
`int x = 7
if (x < 10)
  x++
end if
print "Woo"`,
      output:
`public class Main {
      public static void main(String[] args) {
        int x = 7;
        if (x < 10) {
          x++;
        }
        System.out.println("Woo");
      }
  }`
    }
  ]
})
