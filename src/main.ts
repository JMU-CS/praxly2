import {lexPraxis} from './language/praxis/lexer.js';
import {parsePraxis} from './language/praxis/parser.js';
import {PraxisGenerator} from './language/praxis/generator.js';
import {Objectifier} from './language/objectifier.js';
import {Runtime, Evaluator} from './language/evaluator.js';
import {praxisSymbolMap} from './language/praxis/symbol-map.js';
import {WhereError} from './language/exception.js';
import * as ast from './language/ast.js';
import {EditorView, basicSetup} from 'codemirror';
import {EditorSelection} from '@codemirror/state';
import {praxis} from './language/praxis/highlighter.js';
import {vsCodeDark} from '@fsegurai/codemirror-theme-vscode-dark';
import {praxlyTheme} from './praxly-theme.js';

function initialize() {
  const runButton = document.getElementById('run-button') as HTMLInputElement;
  const treePanel = document.getElementById('tree-panel') as HTMLElement;
  const outputPanel = document.getElementById('output-panel') as HTMLElement;
  const sourcePanel = document.getElementById('source-panel') as HTMLElement;

  const editor = document.getElementById('editor')!;
  const editorView = new EditorView({
    parent: editor,
    doc: '',
    extensions: [basicSetup, praxis(), praxlyTheme],
  });

  const latestSource = localStorage.getItem('latest-source');
  if (latestSource) {
    editorView.focus();
    editorView.dispatch({
      changes: {from: 0, to: editorView.state.doc.length, insert: latestSource},
    });
  }

  runButton.addEventListener('click', () => {
    outputPanel.innerText = '';

    const source = editorView.state.doc.toString();

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
        if (e instanceof WhereError) {
          const button = document.createElement('button');
          button.classList.add('jump-button');
          const lineNumber = editorView.state.doc.lineAt(e.where.start).number;
          button.innerText = `Line ${lineNumber}`;
          button.addEventListener('click', () => {
            editorView.dispatch({
              selection: EditorSelection.range(e.where.start, e.where.end),
            });
          });
          outputPanel.appendChild(button);
          console.error(e.where);
        }

        const message = e.message.replaceAll(/`(.*?)`/g, '<var>$1</var>');
        const span = document.createElement('span');
        span.innerHTML = `: ${message}`;
        outputPanel.appendChild(span);
        // console.error(e);
      }
    }
  });
}

initialize();
