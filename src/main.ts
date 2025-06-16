import {lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, keymap} from '@codemirror/view';
import {foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldKeymap} from '@codemirror/language';
import {history, defaultKeymap, historyKeymap} from '@codemirror/commands';
import {searchKeymap} from '@codemirror/search';
import {closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap} from '@codemirror/autocomplete';
import {lintKeymap} from '@codemirror/lint';
import {EditorView} from 'codemirror';
import {EditorState, EditorSelection} from '@codemirror/state';

import {lexPraxis} from './language/praxis/lexer.js';
import {parsePraxis} from './language/praxis/parser.js';
import {PraxisGenerator} from './language/praxis/generator.js';
import {Objectifier} from './language/objectifier.js';
import {GlobalRuntime, Evaluator} from './language/evaluator.js';
import {praxisSymbolMap} from './language/praxis/symbol-map.js';
import {WhereError} from './language/error.js';
import * as ast from './language/ast.js';
import {praxis} from './language/praxis/highlighter.js';
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
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, {fallback: true}),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap,
      ]),
      praxis(),
      praxlyTheme,
    ],
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
      const tokens = lexPraxis(source);
      const ast = parsePraxis(tokens, source);

      // Update tree-panel
      const object = ast.visit(new Objectifier(), {});
      treePanel.innerText = JSON.stringify(object, null, 2);

      // Update source-panel
      const generatedSource = ast.visit(new PraxisGenerator(), {
        nestingLevel: 0,
        indentation: '  ',
      });
      sourcePanel.innerText = generatedSource;

      // Update output-panel
      const runtime = new GlobalRuntime();
      ast.visit(new Evaluator(praxisSymbolMap), runtime);
      outputPanel.innerText = runtime.stdout;

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
          // console.error(e.where);
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
