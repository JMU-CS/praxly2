import {lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, keymap} from '@codemirror/view';
import {foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldKeymap} from '@codemirror/language';
import {history, defaultKeymap, historyKeymap} from '@codemirror/commands';
import {searchKeymap} from '@codemirror/search';
import {closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap} from '@codemirror/autocomplete';
import {lintKeymap} from '@codemirror/lint';
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


import {StateField, StateEffect, Transaction, Range} from "@codemirror/state";
import {EditorView, Decoration} from "@codemirror/view";

const addMarks = StateEffect.define<Range<Decoration>[]>();
const filterMarks = StateEffect.define<(from: number, to: number) => boolean>();

const markField = StateField.define({
  create() { return Decoration.none },
  update(value: any, tr) {
    value = value.map(tr.changes);
    for (let effect of tr.effects) {
      if (effect.is(addMarks)) {
				value = value.update({add: effect.value, sort: true});
			} else if (effect.is(filterMarks)) {
				value = value.update({filter: effect.value});
			}
    }
    return value;
  },
  provide: f => EditorView.decorations.from(f),
});

function removeAllMarks() {
}

const stepMark = Decoration.mark({
  attributes: {
    style: "background-color: #2a4160",
  }
});

function initialize() {
  const match = window.location.pathname.match(/\/([^\/]+)\.html$/);
  const page = match ? match[1] : null;
  if (page !== "sandbox") {
    // TODO support other entry points
    return;
  }

  const runButton = document.getElementById('run-button') as HTMLInputElement;
  const debugButton = document.getElementById('debug-button') as HTMLInputElement;
  const stepButton = document.getElementById('step-button') as HTMLInputElement;
  const inputField = document.getElementById('input-field') as HTMLInputElement;
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
      markField,
    ],
  });

  const latestSource = localStorage.getItem('latest-source');
  if (latestSource) {
    editorView.focus();
    editorView.dispatch({
      changes: {from: 0, to: editorView.state.doc.length, insert: latestSource},
    });
  }

  const removeAllMarks = () => {
    editorView.dispatch({
      effects: filterMarks.of((_from, _to) => false),
    });
  };

  const run = async (isDebug: boolean) => {
    outputPanel.innerText = '';

    const source = editorView.state.doc.toString();

    localStorage.setItem('latest-source', source);

    try {
      outputPanel.innerText = '';
      
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

      const log = (text: string) => {
        outputPanel.appendChild(document.createTextNode(text));
      };

      const getInput: () => Promise<string> = () => {
        return new Promise(resolve => {
          const listener = (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
              inputField.removeEventListener('keydown', listener);
              resolve(inputField.value);
            }
          };
          inputField.addEventListener('keydown', listener);
        });
      };

      // Update output-panel
      const runtime = new GlobalRuntime(log, getInput);
      const evaluator = new Evaluator(praxisSymbolMap);
      if (isDebug) {
        evaluator.step = (node: ast.Node) => {
          stepButton.disabled = false;

          // Highlight node
          removeAllMarks();
          editorView.dispatch({
            effects: addMarks.of([stepMark.range(node.where.start, node.where.end)])
          })

          return new Promise(resolve => {
            const listener = () => {
              stepButton.removeEventListener('click', listener);
              resolve();
            };
            stepButton.addEventListener('click', listener);
          });
        };
      }
      await ast.visit(evaluator, runtime);

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

    stepButton.disabled = true;
    removeAllMarks();
  };

  stepButton.disabled = true;
  runButton.addEventListener('click', () => run(false));
  debugButton.addEventListener('click', () => run(true));
}

initialize();
