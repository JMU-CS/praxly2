import { addMarks, stepMark } from './editor.js';
import { EditorSelection } from '@codemirror/state';

import * as ast from './language/ast.js';
import { GlobalRuntime, Evaluator } from './language/evaluator.js';
import { WhereError } from './language/error.js';
import { MemdiaSvg } from './language/memdia.js';
import * as praxis from './language/praxis/index.js';
import { editor, editorView, stepButton, outputPanel } from './main.js';

const log = (text: string) => {
  outputPanel.appendChild(document.createTextNode(text));
};

// TODO implement wobbly input boxes in the output div
const getInput: () => Promise<string> = () => {
  return new Promise(resolve => {
    resolve("Go Dukes!");
  });
};

export const run = async (isDebug: boolean) => {

  // Clear previous output
  outputPanel.innerText = '';

  // Save current program
  const source = editorView.state.doc.toString();
  localStorage.setItem('latest-source', source);

  try {
    outputPanel.innerText = '';

    const tokens = praxis.lex(source);
    const ast = praxis.parse(tokens, source);
    const outputFormatter = new praxis.OutputFormatter();

    // Update output-panel
    const runtime = new GlobalRuntime(log, getInput, false, 'this');
    const evaluator = new Evaluator(outputFormatter, new MemdiaSvg(runtime));
    if (isDebug) {
      evaluator.step = (node: ast.Node) => {

        // Highlight node
        editor.removeAllMarks();
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
      console.error(e);
    }
  }

  // Unhighlight node
  editor.removeAllMarks();
};
