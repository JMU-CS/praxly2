import assert from 'node:assert';
import * as praxis from '../build/language/praxis/index.js';
import * as python from '../build/language/python/index.js';
import * as english from '../build/language/explain/index.js'
import * as error from '../build/language/error.js';
import {makeLogger, getInput} from './utilities.js';
import {Evaluator} from '../build/language/evaluator.js';
import {GlobalRuntime} from '../build/language/runtime.js';
import {Memdia} from '../build/language/memdia.js';

function testTranslation(sample, ast) {
  let targetSource = ast.visit(new english.Translator(), {
    nestingLevel: 0,
    indentation: '  ',
  });
  it(`should translate from praxis to english`, () => assert.equal(targetSource, sample.english));
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

describe ("English : Translate Programs to from Praxis to english", () => {
  const samples = [
    {
      message: "Class Dog",
      praxis:
      `class Dog
        String name = "Bella"
        void bark()
          print "woof"
        end bark
      end class Dog`,
      english:
      `Define a class named Dog. It includes 1 instance variable, a variable named "name" of type String with the value "Bella" and a method called bark that takes no parameters. When called, the method will print "woof".`
    }
  ];

  samples.forEach(testProgram);
});
