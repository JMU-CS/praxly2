import {lexPraxly} from './language/praxly/lexer.js';
import {parsePraxly} from './language/praxly/parser.js';
import {PraxlyGenerator} from './language/praxly/generator.js';
import {Objectifier} from './language/objectifier.js';
import {Runtime, Evaluator} from './language/evaluator.js';
import {praxlySymbolMap} from './language/praxly/symbol-map.js';
import * as ast from './language/ast.js';

function initialize() {
  const runButton = document.getElementById('run-button') as HTMLInputElement;
  const editor = document.getElementById('editor') as HTMLInputElement;
  const treePanel = document.getElementById('tree-panel') as HTMLElement;
  const outputPanel = document.getElementById('output-panel') as HTMLElement;
  const sourcePanel = document.getElementById('source-panel') as HTMLElement;

  const latestSource = localStorage.getItem('latest-source');
  if (latestSource) {
    editor.value = latestSource;
  }

  runButton.addEventListener('click', () => {
    const source = editor.value;

    localStorage.setItem('latest-source', source);

    const tokens = lexPraxly(source);
    const ast = parsePraxly(tokens, source);

    const object = ast.visit(new Objectifier(), {});
    treePanel.innerText = JSON.stringify(object, null, 2);

    const generatedSource = ast.visit(new PraxlyGenerator(), {
      nestingLevel: 0,
      indentation: '  ',
    });
    sourcePanel.innerText = generatedSource;

    const runtime = new Runtime();
    ast.visit(new Evaluator(praxlySymbolMap), runtime);
    outputPanel.innerText = runtime.stdout;
  });
}

initialize();
