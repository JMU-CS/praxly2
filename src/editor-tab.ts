/**
 * One tab of the left side, including the CodeMirror editor.
 */

import { CodeMirrorEditor } from './editor.js';
import { leftSide } from './main.js';

export class EditorTab {

    public wrapper: HTMLDivElement;
    public editorDiv: HTMLDivElement;
    public editor: CodeMirrorEditor;
    public select: HTMLSelectElement;
    public button: HTMLButtonElement;
    public resizeBar: HTMLDivElement;

    constructor(index: number) {

        this.wrapper = document.createElement("div");
        this.wrapper.className = "editor-wrapper";
        this.wrapper.id = `editor-wrapper-${index}`;
        leftSide.appendChild(this.wrapper);

        this.editorDiv = document.createElement("div");
        this.editorDiv.className = "editor panel";
        this.editorDiv.id = `editor-${index}`;
        this.wrapper.appendChild(this.editorDiv);

        this.editor = new CodeMirrorEditor(`editor-${index}`);

        // TODO initialize language dropdown and new tab button
        this.select = document.createElement("select");
        this.button = document.createElement("button");

        this.resizeBar = document.createElement("div");
        this.resizeBar.className = "resize-bar-editor";
    }
}
