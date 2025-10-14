/**
 * One tab of the left side, including the CodeMirror editor, resizing, and memory diagram tab.
 */

import { CodeMirrorEditor } from './editor.js';
import { leftSide, rightSide, addNewTab, removeTab, editorTabs } from './main.js';
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

    }
}

let isEditorResizing = false;
let isMainResizing = false;

// let currentResizeBar: HTMLDivElement | null = null;
let leftWrapper: HTMLDivElement | null = null;
let rightWrapper: HTMLDivElement | null = null;
let startX = 0;
let startLeftWidth = 0;
let startRightWidth = 0;

const MIN_EDITOR_WIDTH = 250;
const MIN_MAIN_WIDTH = 300;

// get the current resize bar separating the left and right sides
function getMainResizeBar(): HTMLDivElement | null {
  const bars = leftSide.querySelectorAll<HTMLDivElement>(".resize-bar-editor");
  return bars.length > 0 ? bars[bars.length - 1] : null;
}

// detect which resize bar was clicked
document.addEventListener("mousedown", (e) => {
  const target = e.target as HTMLElement;
  if (!target.classList.contains("resize-bar-editor")) return;

  const mainResizeBar = getMainResizeBar();

  // case 1: main (rightmost) resize bar between left/right sides
  if (mainResizeBar && target === mainResizeBar) {
    isMainResizing = true;
    startX = e.clientX;
    startLeftWidth = leftSide.offsetWidth;
    startRightWidth = rightSide.offsetWidth;
    document.body.style.cursor = "col-resize";
    e.preventDefault();
    return;
  }

  // case 2: internal editor resize between two wrappers
  const wrapper = target.closest(".editor-wrapper") as HTMLDivElement;
  if (!wrapper) return;

  const wrapperIndex = editorTabs.findIndex(tab => tab.wrapper === wrapper);
  if (wrapperIndex === -1 || wrapperIndex === editorTabs.length - 1) return;

  leftWrapper = editorTabs[wrapperIndex].wrapper;
  rightWrapper = editorTabs[wrapperIndex + 1].wrapper;

  isEditorResizing = true;
  startX = e.clientX;
  startLeftWidth = leftWrapper.offsetWidth;
  startRightWidth = rightWrapper.offsetWidth;
  document.body.style.cursor = "col-resize";
  e.preventDefault();
});

// handle resizing dynamically
document.addEventListener("mousemove", (e) => {
  if (isEditorResizing && leftWrapper && rightWrapper) {
    const dx = e.clientX - startX;
    const newLeftWidth = startLeftWidth + dx;
    const newRightWidth = startRightWidth - dx;

    if (newLeftWidth >= MIN_EDITOR_WIDTH && newRightWidth >= MIN_EDITOR_WIDTH) {
      leftWrapper.style.flex = `0 0 ${newLeftWidth}px`;
      rightWrapper.style.flex = `0 0 ${newRightWidth}px`;
    }
    return;
  }

    if (isMainResizing) {
    const dx = e.clientX - startX;
    const newLeftWidth = startLeftWidth + dx;

    // Get the total container width to prevent overshoot
    const containerWidth = leftSide.parentElement?.offsetWidth || 0;
    const maxLeftWidth = containerWidth - MIN_MAIN_WIDTH;

    // Clamp left width so the right side never disappears
    const clampedLeftWidth = Math.min(Math.max(newLeftWidth, MIN_MAIN_WIDTH), maxLeftWidth);

    leftSide.style.flex = `0 0 ${clampedLeftWidth}px`;
    rightSide.style.flex = "1 1 auto"; // let it fill remaining space
    }
});

// stop all resizing
document.addEventListener("mouseup", () => {
  if (isEditorResizing || isMainResizing) {
    isEditorResizing = false;
    isMainResizing = false;
    leftWrapper = null;
    rightWrapper = null;
    document.body.style.cursor = "default";
  }
});
