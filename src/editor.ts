import { EditorView, Decoration, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, keymap } from '@codemirror/view';
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldKeymap } from '@codemirror/language';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { searchKeymap } from '@codemirror/search';
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { EditorState, StateField, StateEffect, Transaction, Range } from '@codemirror/state';

import * as praxis from './language/praxis/index.js';

export const addMarks = StateEffect.define<Range<Decoration>[]>();
const filterMarks = StateEffect.define<(from: number, to: number) => boolean>();

const markField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(value: any, tr: Transaction) {
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
  provide: f => EditorView.decorations.from(f),
});

export const stepMark = Decoration.mark({
  attributes: {
    style: "background-color: #2a4160",
  }
});

export class CodeMirrorEditor {
  private editorView: EditorView;

  constructor(elementId: string) {
    const parent = document.getElementById(elementId);
    if (!parent) {
      throw new Error(`Element with ID "${elementId}" not found.`);
    }

    this.editorView = new EditorView({
      parent,
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
