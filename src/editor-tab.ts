/**
 * One tab of the left side, including the CodeMirror editor, resizing, and memory diagram tab.
 */

import { CodeMirrorEditor } from './editor.js';
import { leftSide, addNewTab, removeTab } from './main.js';
import { startEditorResize } from './resize.js'; // remove this eventually

export class EditorTab {

    public static next_id: number = 1;

    public wrapper: HTMLDivElement;
    public select: HTMLSelectElement;
    public button: HTMLButtonElement;
    public editorDiv: HTMLDivElement;
    public editor: CodeMirrorEditor;
    public resizeBar: HTMLDivElement;
    // add attribute for memory

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

        const tabLeft = document.createElement("div");
        tabLeft.className = "tab-left";
        tabLeft.appendChild(nav);

        // div to hold the code editor
        this.editorDiv = document.createElement("div");
        this.editorDiv.className = "editor panel";
        this.editorDiv.id = `editor-${EditorTab.next_id++}`;

        tabLeft.appendChild(this.editorDiv);
        this.wrapper.appendChild(tabLeft);

        // CodeMirror editor
        this.editor = new CodeMirrorEditor(this.editorDiv.id);

        const tabRight = document.createElement("div");
        tabRight.className = "tab-right";

        // resize bar
        this.resizeBar = document.createElement("div");
        this.resizeBar.className = "resize-bar-editor";
        tabRight.appendChild(this.resizeBar);
        this.wrapper.appendChild(tabRight);

        // TODO startEditorResize(this.resizeBar, this.wrapper.previousElementSibling?.previousElementSibling as HTMLElement, this.wrapper);
    }
}
