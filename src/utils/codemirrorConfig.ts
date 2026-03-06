/**
 * CodeMirror configuration and decorations for line highlighting.
 * Provides StateField and Effects for managing highlighted lines in the editor.
 */

import { Decoration, EditorView } from '@codemirror/view';
import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';

// CodeMirror decoration helper for line highlighting
export const highlightLineDecoration = Decoration.line({
    attributes: {
        style: 'background-color: rgba(99, 102, 241, 0.25); border-left: 3px solid rgb(99, 102, 241);'
    }
});

export const highlightLinesEffect = StateEffect.define<number[]>();

export const highlightedLinesField = StateField.define({
    create() {
        return Decoration.none;
    },
    update(decorations: any, tr: any) {
        for (const effect of tr.effects) {
            if (effect.is(highlightLinesEffect)) {
                const ranges = effect.value;
                const builder = new RangeSetBuilder<Decoration>();
                
                for (const lineNum of ranges) {
                    const line = tr.state.doc.line(lineNum + 1);
                    if (line) {
                        builder.add(line.from, line.from, highlightLineDecoration);
                    }
                }
                return builder.finish();
            }
        }
        return decorations.map(tr.changes);
    },
    provide: (f: any) => EditorView.decorations.from(f)
});

/**
 * Dispatch line highlighting effect to CodeMirror editor
 */
export const dispatchLineHighlighting = (editorViewRef: any, lines: number[]) => {
    if (!editorViewRef?.current) return;
    editorViewRef.current.dispatch({
        effects: highlightLinesEffect.of(lines)
    });
};
