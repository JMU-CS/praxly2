import * as ast from './language/ast.js';
import * as praxis from './language/praxis/index.js';
import * as python from './language/python/index.js';
import * as english from './language/english/index.js';
import * as cm from './codemirror.js';

import {Objectifier} from './language/objectifier.js';
import {GlobalRuntime, Evaluator} from './language/evaluator.js';
import {WhereError} from './language/error.js';
import {MemdiaSvg} from './language/memdia.js';
import {Where} from './language/where.js';

const addMarks = cm.StateEffect.define<cm.Range<cm.Decoration>[]>();
const filterMarks = cm.StateEffect.define<(from: number, to: number) => boolean>();

const markField = cm.StateField.define({
  create() { return cm.Decoration.none },
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
  provide: f => cm.EditorView.decorations.from(f),
});

function removeAllMarks() {
}

const stepMark = cm.Decoration.mark({
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

  const srcLang = document.getElementById('src-lang') as HTMLInputElement;
  const dstLang = document.getElementById('dst-lang') as HTMLInputElement;
  const runButton = document.getElementById('run-button') as HTMLInputElement;
  const debugButton = document.getElementById('debug-button') as HTMLInputElement;
  const stepButton = document.getElementById('step-button') as HTMLInputElement;
  const inputField = document.getElementById('input-field') as HTMLInputElement;
  const treePanel = document.getElementById('tree-panel') as HTMLElement;
  const outputPanel = document.getElementById('output-panel') as HTMLElement;
  const sourcePanel = document.getElementById('source-panel') as HTMLElement;

  inputField.style.display = 'none';

  const editor = document.getElementById('editor')!;
  const editorView = new cm.EditorView({
    parent: editor,
    doc: '',
    extensions: [
      cm.lineNumbers(),
      cm.highlightActiveLineGutter(),
      cm.highlightSpecialChars(),
      cm.history(),
      cm.foldGutter(),
      cm.drawSelection(),
      cm.dropCursor(),
      cm.EditorState.allowMultipleSelections.of(true),
      cm.indentOnInput(),
      cm.syntaxHighlighting(cm.defaultHighlightStyle, {fallback: true}),
      cm.bracketMatching(),
      cm.closeBrackets(),
      cm.autocompletion(),
      cm.rectangularSelection(),
      cm.crosshairCursor(),
      cm.highlightActiveLine(),
      cm.keymap.of([
        ...cm.closeBracketsKeymap,
        ...cm.defaultKeymap,
        ...cm.searchKeymap,
        ...cm.historyKeymap,
        ...cm.foldKeymap,
        ...cm.completionKeymap,
        ...cm.lintKeymap,
        {
           key: "Mod-/",
           run: cm.toggleComment,
           preventDefault: true,
        },
      ]),
      praxis.plugin(),
      praxis.praxlyTheme,
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

  srcLang.value = localStorage.getItem('source-language') ?? 'Praxis';
  dstLang.value = localStorage.getItem('target-language') ?? 'Praxis';

  const removeAllMarks = () => {
    editorView.dispatch({
      effects: filterMarks.of((_from, _to) => false),
    });
  };

  const log = (text: string) => {
    outputPanel.appendChild(document.createTextNode(text));
  };

  const getInput: () => Promise<string> = () => {
    return new Promise(resolve => {
      inputField.style.display = 'inline';
      const listener = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
          inputField.removeEventListener('keydown', listener);
          inputField.style.display = 'none';
          resolve(inputField.value);
        }
      };
      inputField.addEventListener('keydown', listener);
    });
  };

  // const iterable = new ast.ArrayLiteral([
    // new ast.Integer(5, Where.Nowhere),
    // new ast.Integer(7, Where.Nowhere),
  // ], Where.Nowhere);
  // const iterable = new ast.RangeLiteral(
    // new ast.Integer(5, Where.Nowhere),
    // new ast.Integer(21, Where.Nowhere),
    // Where.Nowhere
  // );

  // const tree = new ast.ForEach('foo', iterable, new ast.Block([
    // new ast.Print(new ast.Variable('foo', Where.Nowhere), "\n", Where.Nowhere)
  // ], Where.Nowhere), Where.Nowhere);

  // const runtime = new GlobalRuntime(log, getInput);
  // const evaluator = new Evaluator(new praxis.PraxisOutputFormatter(), new MemdiaSvg());
  // tree.visit(evaluator, runtime);

  const run = async (isDebug: boolean) => {
    outputPanel.innerText = '';

    const source = editorView.state.doc.toString();

    localStorage.setItem('latest-source', source);
    localStorage.setItem('source-language', srcLang.value);
    localStorage.setItem('target-language', dstLang.value);

    try {
      outputPanel.innerText = '';

      let tokens;
      let ast;
      let outputFormatter;
      let translator;

      if (srcLang.value === "Praxis") {
        tokens = praxis.lex(source);
        ast = praxis.parse(tokens, source);
        outputFormatter = new praxis.OutputFormatter();
      } else {
        tokens = python.lex(source);
        ast = python.parse(tokens, source);
        outputFormatter = new python.OutputFormatter();
      }

      if (dstLang.value === "Praxis") {
        translator = new praxis.Translator();
      } else if (dstLang.value === "Python") {
        translator = new python.Translator();
      } else {
        translator = new english.Translator();
      }

      // Update tree-panel
      const object = ast.visit(new Objectifier(), {});
      treePanel.innerText = JSON.stringify(object, null, 2);

      // Emit CodeMirror parser log
      if (false) {
        for (let i = 0; i < tokens.length; ++i) {
          console.log(tokens[i].toPretty(source));
        }

        const tree = praxis.lezerParser.parse(source);
        let level = 0;
        tree.iterate({
          enter: node => {
            console.log(`${'  '.repeat(level)}${node.name} [${node.from} ${node.to}]`);
            if (node.type.isError) {
              console.log(`${'  '.repeat(level)}error ${node} ${node.from} ${node.to}`);
            }
            level += 1;
          },
          leave: _node => {
            level -= 1;
          },
        });
      }

      // Update source-panel
      const generatedSource = ast.visit(translator, {
        nestingLevel: 0,
        indentation: '  ',
      });
      sourcePanel.innerText = generatedSource;

      // Update output-panel
      const allowsUndeclared = srcLang.value === 'Python';
      const receiverName = srcLang.value === 'Python' ? 'self' : 'this';
      const runtime = new GlobalRuntime(log, getInput, allowsUndeclared, receiverName);
      const evaluator = new Evaluator(outputFormatter, new MemdiaSvg(runtime));
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
              selection: cm.EditorSelection.range(e.where.start, e.where.end),
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

    stepButton.disabled = true;
    removeAllMarks();
  };

  stepButton.disabled = true;
  runButton.addEventListener('click', () => run(false));
  debugButton.addEventListener('click', () => run(true));
}

initialize();
