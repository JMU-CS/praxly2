/**
 * One tab of the left side, including the CodeMirror editor.
 */

import { CodeMirrorEditor } from './editor.js';
import { leftSide, addNewTab } from './main.js';
import { startEditorResize } from './resize.js';

export class EditorTab {

    public wrapper: HTMLDivElement;
    public editorDiv: HTMLDivElement;
    public editor: CodeMirrorEditor;
    public select: HTMLSelectElement;
    public button: HTMLButtonElement;
    public resizeBar: HTMLDivElement;

    constructor(index: number) {


        // resize bar
        this.resizeBar = document.createElement("div");
        if (leftSide.childElementCount > 1) {
            this.resizeBar.className = "resize-bar-editor";
        }
        leftSide.appendChild(this.resizeBar);

        // wrapper for the entire tab
        this.wrapper = document.createElement("div");
        this.wrapper.className = "editor-wrapper";
        this.wrapper.id = `editor-wrapper-${index}`;
        leftSide.appendChild(this.wrapper);

        startEditorResize(this.resizeBar, this.wrapper.previousElementSibling?.previousElementSibling as HTMLElement, this.wrapper);

        // div to hold the code editor
        this.editorDiv = document.createElement("div");
        this.editorDiv.className = "editor panel";
        this.editorDiv.id = `editor-${index}`;

        // language dropdown
        this.select = document.createElement("select");
        this.select.className = "language-menu";
        ["CSP", "English", "Java", "Praxis", "Python"].forEach(option => {
            const o = document.createElement("option");
            o.value = option;
            o.textContent = option;
            this.select.appendChild(o);
        });
        this.select.selectedIndex = 3; // Show Praxis originally

        // add new tab button
        this.button = document.createElement("button");
        this.button.className = "language-button";
        this.button.textContent = "+";
        this.button.addEventListener('click', addNewTab);

        // nav bar for the tab
        const nav = document.createElement("nav");
        nav.classList.add("left-toolbar");
        nav.appendChild(this.select);
        nav.appendChild(this.button);


        this.wrapper.appendChild(nav);

        this.wrapper.appendChild(this.editorDiv);

        this.editor = new CodeMirrorEditor(`editor-${index}`);

    }
}
