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
