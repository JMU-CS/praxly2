/**
 * One tab of the left side, including the CodeMirror editor.
 */

import { CodeMirrorEditor } from './editor.js';
import { leftSide, addNewTab, removeTab } from './main.js';
import { startEditorResize } from './resize.js';

export class EditorTab {

    public static next_id: number = 1;

    public wrapper: HTMLDivElement;
    public select: HTMLSelectElement;
    public button: HTMLButtonElement;
    public editorDiv: HTMLDivElement;
    public editor: CodeMirrorEditor;
    public resizeBar: HTMLDivElement;

    constructor() {

        // wrapper for the entire tab
        this.wrapper = document.createElement("div");
        this.wrapper.className = "editor-wrapper";
        leftSide.appendChild(this.wrapper);

        // language dropdown
        this.select = document.createElement("select");
        this.select.className = "language-menu";
        ["CSP", "English", "Java", "Praxis", "Python"].forEach(option => {
            const o = document.createElement("option");
            o.value = option;
            o.textContent = option;
            this.select.appendChild(o);
        });

        // TODO make selectedIndex the "next" language not in use
        this.select.selectedIndex = 3;  // Show Praxis by default

        // add/close tab button
        this.button = document.createElement("button");
        this.button.className = "tab-button";
        this.button.textContent = "+";
        this.button.addEventListener('click', addNewTab);

        // nav bar for the buttons
        const nav = document.createElement("nav");
        nav.classList.add("left-toolbar");
        nav.appendChild(this.select);
        nav.appendChild(this.button);
        this.wrapper.appendChild(nav);

        // div to hold the code editor
        this.editorDiv = document.createElement("div");
        this.editorDiv.className = "editor panel";
        this.editorDiv.id = `editor-${EditorTab.next_id++}`;
        this.wrapper.appendChild(this.editorDiv);

        // CodeMirror editor
        this.editor = new CodeMirrorEditor(this.editorDiv.id);

        // resize bar
        this.resizeBar = document.createElement("div");
        this.resizeBar.className = "resize-bar-editor";
        this.wrapper.appendChild(this.resizeBar);

        // TODO startEditorResize(this.resizeBar, this.wrapper.previousElementSibling?.previousElementSibling as HTMLElement, this.wrapper);
    }
}
