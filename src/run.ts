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
import { VariableTable } from './variabletable.js';

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

function getSourceLanguage(): string {
  const srcLang = document.getElementById("src-lang") as HTMLSelectElement | null;
  // Embed pages won't have this dropdown
  return srcLang?.value ?? "Praxis";
}

function getDestinationLanguages(): string[] {
  const dstDropdowns = document.querySelectorAll<HTMLSelectElement>(".editor-lang");
  return [...dstDropdowns].map(d => d.value);
}

export const run = async (isDebug: boolean) => {
  // Clear previous output
  outputPanel.innerText = '';

  // Save current program
  const source = editorView.state.doc.toString();
  localStorage.setItem('latest-source', source);

  const translation = {
    'CSP': new csp.Translator(),
    'English': new english.Translator(),
    'Java': new java.Translator(),
    'Praxis': new praxis.Translator(),
    'Python': new python.Translator()
  };

  const src = getSourceLanguage();
  const dstLangs = getDestinationLanguages();

  try {
    outputPanel.innerText = '';

    let tokens: any;
    let programAst: any;
    let outputFormatter: any;

    // Determine source language
    if (src === "Praxis") {
      tokens = praxis.lex(source);
      programAst = praxis.parse(tokens, source);
      outputFormatter = new praxis.OutputFormatter();
    } else if (src === "Python") {
      tokens = python.lex(source);
      programAst = python.parse(tokens, source);
      outputFormatter = new python.OutputFormatter();
    } else {
      tokens = praxis.lex(source);
      programAst = praxis.parse(tokens, source);
      outputFormatter = new praxis.OutputFormatter();
    }

    if (dstLangs.length > 0 && editorTabs.length > 0) {
      // no-op for now
    }

    // Runtime and visualizers
    const runtime = new GlobalRuntime(log, getInput, false, 'this');

    const memdia = new MemdiaSvg(runtime);
    const varTable = new VariableTable(runtime);

    // prime the table
    varTable.refresh();

    const evaluator = new Evaluator(outputFormatter, memdia);

    if (isDebug) {
      evaluator.step = (node: ast.Node) => {
        // Highlight node
        editor.removeAllMarks();
        editorView.dispatch({
          effects: addMarks.of([stepMark.range(node.where.start, node.where.end)])
        });

        return new Promise(resolve => {
          const listener = () => {
            stepButton.removeEventListener('click', listener);

            // refresh variables whenever stepping
            varTable.refresh();

            resolve();
          };
          stepButton.addEventListener('click', listener);
        });
      };
    }

    await programAst.visit(evaluator, runtime);

    // Final refresh after execution completes
    varTable.refresh();

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
