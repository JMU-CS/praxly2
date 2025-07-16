import * as praxis from './language/praxis/index.js';
import * as cm from './codemirror.js';

export const addMarks = cm.StateEffect.define<cm.Range<cm.Decoration>[]>();
const filterMarks = cm.StateEffect.define<(from: number, to: number) => boolean>();

const markField = cm.StateField.define({
  create() {
    return cm.Decoration.none;
  },
  update(value: any, tr: cm.Transaction) {
    value = value.map(tr.changes);
    for (let effect of tr.effects) {
      if (effect.is(addMarks)) {
        value = value.update({ add: effect.value, sort: true });
      } else if (effect.is(filterMarks)) {
        value = value.update({ filter: effect.value });
      }
    }
    return value;
  },
  provide: f => cm.EditorView.decorations.from(f),
});

export const stepMark = cm.Decoration.mark({
  attributes: {
    style: "background-color: #2a4160",
  }
});

export class CodeMirrorEditor {
  private editorView: cm.EditorView;

  constructor(elementId: string) {
    const parent = document.getElementById(elementId);
    if (!parent) {
      throw new Error(`Element with ID "${elementId}" not found.`);
    }

    this.editorView = new cm.EditorView({
      parent,
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
        cm.syntaxHighlighting(cm.defaultHighlightStyle, { fallback: true }),
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
        ]),
        praxis.plugin(),
        praxis.praxlyTheme,
        markField,
      ],
    });
  }

  removeAllMarks() {
    this.editorView.dispatch({
      effects: filterMarks.of(() => false)
    });
  }

  get view() {
    return this.editorView;
  }
}
