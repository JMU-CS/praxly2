import { addMarks, stepMark } from './editor.js';
import { EditorSelection } from '@codemirror/state';

import * as ast from './language/ast.js';
import * as praxis from './language/praxis/index.js';
import * as python from './language/python/index.js';
import * as english from './language/explain/index.js';
import * as java from './language/java/index.js';
import * as csp from './language/csp/index.js';

import { Evaluator } from './language/evaluator.js';
import { GlobalRuntime } from './language/runtime.js';
import { WhereError } from './language/error.js';
import { MemdiaSvg } from './language/memdia.js';
import { editor, editorView, editorTabs, stepButton, outputPanel } from './main.js';

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

  const translation = {
    'CSP' : new csp.Translator(),
    'English' : new english.Translator(),
    'Java' : new java.Translator(),
    'Praxis' : new praxis.Translator(),
    'Python' : new python.Translator()
  };

  const srcLang = document.getElementById("src-lang") as HTMLSelectElement;
  const dstDropdowns = document.querySelectorAll<HTMLSelectElement>(".dst-lang");
  const dstLangs = [...dstDropdowns].map(dropdown => dropdown.value);
  console.log(dstLangs);

  // srcLang.value = localStorage.getItem('source-language') ?? 'Praxis';

  try {
    outputPanel.innerText = '';

    let tokens;
    let ast;
    let outputFormatter;
    let translator;

    // determoine the src value
    if (srcLang.value == "Praxis") {
      tokens = praxis.lex(source);
      ast = praxis.parse(tokens, source);
      outputFormatter = new praxis.OutputFormatter();
    } else {
        tokens = python.lex(source);
        ast = python.parse(tokens, source);
        outputFormatter = new python.OutputFormatter();
    }

    // determine all the dst values
    for (const tab in editorTabs) {

    }
    // translator = translation[dstLangs[i]]


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
