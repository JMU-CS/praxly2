import {lexPraxis} from './language/praxis/lexer.js';
import {parsePraxis} from './language/praxis/parser.js';
import {PraxisGenerator} from './language/praxis/generator.js';
import {Objectifier} from './language/objectifier.js';
import {Runtime, Evaluator} from './language/evaluator.js';
import {praxisSymbolMap} from './language/praxis/symbol-map.js';
import {WhereError} from './language/exception.js';
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
    outputPanel.innerText = '';

    const source = editor.value;

    localStorage.setItem('latest-source', source);

    try {
      Runtime.stdout = '';
      const tokens = lexPraxis(source);
      const ast = parsePraxis(tokens, source);

      const object = ast.visit(new Objectifier(), {});
      treePanel.innerText = JSON.stringify(object, null, 2);

      const generatedSource = ast.visit(new PraxisGenerator(), {
        nestingLevel: 0,
        indentation: '  ',
      });
      sourcePanel.innerText = generatedSource;

      const runtime = Runtime.new();
      ast.visit(new Evaluator(praxisSymbolMap), runtime);
      outputPanel.innerText = Runtime.stdout;
    } catch (e) {
      if (e instanceof Error) {
        const message = e.message.replaceAll(/`(.*?)`/g, '<var>$1</var>');
        const p = document.createElement('p');
        p.innerHTML = message;
        outputPanel.appendChild(p);
        console.error(e);
        if (e instanceof WhereError) {
          console.error(e.where);
        }
      }
    }
  });
}

initialize();
