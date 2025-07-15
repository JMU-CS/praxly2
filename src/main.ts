import { lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, keymap } from '@codemirror/view';
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldKeymap } from '@codemirror/language';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { searchKeymap } from '@codemirror/search';
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { EditorState, EditorSelection } from '@codemirror/state';

import * as praxis from './language/praxis/index.js';
import { GlobalRuntime, Evaluator } from './language/evaluator.js';
import { WhereError } from './language/error.js';
import * as ast from './language/ast.js';
import { MemdiaSvg } from './language/memdia.js';

import { StateField, StateEffect, Transaction, Range } from "@codemirror/state";
import { EditorView, Decoration } from "@codemirror/view";

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
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
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
    praxis.plugin(),
    praxis.praxlyTheme,
    markField,
  ],
});

function removeAllMarks() {
  editorView.dispatch({
    effects: filterMarks.of(() => false)
  });
}

const stepMark = Decoration.mark({
  attributes: {
    style: "background-color: #2a4160",
  }
});

// Toolbar buttons
const runButton = document.getElementById('run-button') as HTMLInputElement;
const debugButton = document.getElementById('debug-button') as HTMLInputElement;
const stepButton = document.getElementById('step-button') as HTMLInputElement;
const exitButton = document.getElementById("exit-button") as HTMLInputElement;
const shareButton = document.getElementById("share-button") as HTMLInputElement;
const settingsButton = document.getElementById("settings-button") as HTMLInputElement;
const dropdownContent = document.querySelector(".dropdown-content") as HTMLElement;
const resetButton = document.getElementById("reset-button") as HTMLInputElement;

// Main elements
const leftSide = document.getElementById("left-side") as HTMLElement;
const resizeBarX = document.getElementById("resize-bar-X") as HTMLElement;
const rightSide = document.getElementById("right-side") as HTMLElement;
const outputPanel = document.getElementById('output-panel') as HTMLElement;
const resizeBarY = document.getElementById("resize-bar-Y") as HTMLElement;
const memdiaPanel = document.getElementById("memdia-panel") as HTMLElement;

// Code editor
const latestSource = localStorage.getItem('latest-source');
if (latestSource) {
  editorView.focus();
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: latestSource },
  });
}

// ---------------------------------------------------------------------------
// Running a program
// ---------------------------------------------------------------------------

const log = (text: string) => {
  outputPanel.appendChild(document.createTextNode(text));
};

// TODO implement wobbly input boxes in the output div
const getInput: () => Promise<string> = () => {
  return new Promise(resolve => {
    resolve("Go Dukes!");
  });
};

const run = async (isDebug: boolean) => {

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
    const runtime = new GlobalRuntime(log, getInput);
    const evaluator = new Evaluator(outputFormatter, new MemdiaSvg(runtime));
    if (isDebug) {
      evaluator.step = (node: ast.Node) => {

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

  // Unhighlight node
  removeAllMarks();
};

// ---------------------------------------------------------------------------
// Toolbar events
// ---------------------------------------------------------------------------

runButton.addEventListener('click', () => {
  run(false);
});

debugButton.addEventListener('click', () => {
  runButton.style.display = 'none';
  debugButton.style.display = 'none';
  stepButton.style.display = 'inline-flex';
  exitButton.style.display = 'inline-flex';
  run(true);
});

exitButton.addEventListener('click', () => {
  runButton.style.display = 'inline-flex';
  debugButton.style.display = 'inline-flex';
  stepButton.style.display = 'none';
  exitButton.style.display = 'none';
});

settingsButton.addEventListener("click", () => {
  if (dropdownContent.style.display === "block") {
    dropdownContent.style.display = "none";
  } else {
    dropdownContent.style.display = "block";
  }
});

// reset button
resetButton.addEventListener('click', () => {
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: '' }
  });

  outputPanel.textContent = '';
  stepButton.style.display = 'none';
  exitButton.style.display = 'none';
  localStorage.removeItem('latest-source');
});

// ---------------------------------------------------------------------------
// Resize events
// ---------------------------------------------------------------------------

resizeBarX.addEventListener("mousedown", () => {
  document.addEventListener("mousemove", resizeX);
  document.addEventListener("mouseup", stopResizeX);
});

function resizeX(e: MouseEvent) {
  const leftEdge = leftSide.getBoundingClientRect().left;
  const totalWidth = leftSide.offsetWidth;
  const leftWidth = e.clientX - leftEdge;
  const rightWidth = totalWidth - leftWidth - resizeBarX.offsetWidth;

  leftSide.style.width = `${leftWidth}px`;
  rightSide.style.width = `${rightWidth}px`;
}

function stopResizeX() {
  document.removeEventListener("mousemove", resizeX);
  document.removeEventListener("mouseup", stopResizeX);
}

resizeBarY.addEventListener("mousedown", () => {
  document.addEventListener("mousemove", resizeY);
  document.addEventListener("mouseup", stopResizeY);
});

function resizeY(e: MouseEvent) {
  const topEdge = rightSide.getBoundingClientRect().top;
  const totalHeight = rightSide.offsetHeight;
  const outputHeight = e.clientY - topEdge;
  const memdiaHeight = totalHeight - outputHeight - resizeBarY.offsetHeight;

  outputPanel.style.height = `${outputHeight}px`;
  memdiaPanel.style.height = `${memdiaHeight}px`;
}

function stopResizeY() {
  document.removeEventListener("mousemove", resizeY);
  document.removeEventListener("mouseup", stopResizeY);
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (e.key === 'F5') {
    e.preventDefault();
    runButton.click();
  }
});
