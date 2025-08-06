import { CodeMirrorEditor } from './editor.js';
import { run } from './run.js';
import { startEditorResize, resizeEvents } from './resize';



// Toolbar buttons
const runButton = document.getElementById('run-button') as HTMLInputElement;
const debugButton = document.getElementById('debug-button') as HTMLInputElement;
export const stepButton = document.getElementById('step-button') as HTMLInputElement;
const exitButton = document.getElementById("exit-button") as HTMLInputElement;
const shareButton = document.getElementById("share-button") as HTMLInputElement;
const infoButton = document.getElementById("info-button") as HTMLInputElement;
const resetButton = document.getElementById("reset-button") as HTMLInputElement;

// Info modal
const infoModal = document.getElementById("info-modal")as HTMLButtonElement;
const closeInfo = document.getElementById("close-info")as HTMLButtonElement;

// Reset modal
const resetModal = document.getElementById('reset-confirm') as HTMLElement;
const confirmReset = document.getElementById('confirm-reset') as HTMLButtonElement;
const cancelReset = document.getElementById('cancel-reset') as HTMLButtonElement;

// Main elements
export const leftSide = document.getElementById("left-side") as HTMLElement;
export const resizeBarX = document.getElementById("resize-bar-X") as HTMLElement;
export const rightSide = document.getElementById("right-side") as HTMLElement;
export const outputPanel = document.getElementById('output-panel') as HTMLElement;
export const resizeBarY = document.getElementById("resize-bar-Y") as HTMLElement;
export const memdiaPanel = document.getElementById("memdia-panel") as HTMLElement;


// left-side toolbar elements
const langSwitch = document.getElementById("language-button") as HTMLButtonElement;
const langDropdown = document.getElementById("language-menu") as HTMLDivElement;

// Code editor

let editorContainer = document.getElementById("editor-container") as HTMLElement;
if (!editorContainer) {
  editorContainer = document.createElement("div");
  editorContainer.id = "editor-container";
  document.getElementById("left-side")!.appendChild(editorContainer);
}

export const newEditorButton = document.getElementById("new-editor")!;



const allEditors: CodeMirrorEditor[] = [];
let activeEditorIndex = 0;
export let editor: CodeMirrorEditor;
export let editorView: any;

const latestSource = localStorage.getItem('latest-source') || "";

// const latestSource = localStorage.getItem('latest-source');
// if (latestSource) {
//   editorView.focus();
//   editorView.dispatch({
//     changes: { from: 0, to: editorView.state.doc.length, insert: latestSource },
//   });
// }

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

// ---------------------------------------------------------------------------
// resize events
// ---------------------------------------------------------------------------

function createEditorWrapper(index: number): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "editor-wrapper";
  wrapper.id = `editor-wrapper-${index}`;

  const editorDiv = document.createElement("div");
  editorDiv.className = "editor panel";
  editorDiv.id = `editor-${index}`;

  wrapper.appendChild(editorDiv);
  return wrapper;
}

function createResizeBar(): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "resize-bar-editor";
  bar.style.width = "6px";
  bar.style.backgroundColor = "#2d485a";
  bar.style.cursor = "col-resize";
  bar.style.flexShrink = "0";
  return bar;
}

export function setActiveEditor(index: number) {
  editor = allEditors[index];
  editorView = editor.view;
  activeEditorIndex = index;
}

function addNewEditor() {
  const previousWrapper = document.getElementById(`editor-wrapper-${activeEditorIndex}`);

  const resizeBar = createResizeBar();
  const newWrapper = createEditorWrapper(activeEditorIndex + 1);

  editorContainer.appendChild(resizeBar);
  editorContainer.appendChild(newWrapper);

  const newEditor = new CodeMirrorEditor(`editor-${activeEditorIndex + 1}`);
  allEditors.push(newEditor);

  if (previousWrapper) {
    startEditorResize(resizeBar, previousWrapper, newWrapper);
  }

  setActiveEditor(activeEditorIndex + 1);
}

// Initialize the first editor
const firstWrapper = createEditorWrapper(0);
editorContainer.appendChild(firstWrapper);
const firstEditor = new CodeMirrorEditor("editor-0");
editor = firstEditor;
editorView = firstEditor.view;
editorView.focus();
editorView.dispatch({
  changes: { from: 0, to: editorView.state.doc.length, insert: latestSource },
});
allEditors.push(firstEditor);
setActiveEditor(0);

newEditorButton.addEventListener("click", addNewEditor);


window.addEventListener('DOMContentLoaded', () => {
  resizeEvents();
});


// ---------------------------------------------------------------------------
// Reset notifications
// ---------------------------------------------------------------------------

resetButton.addEventListener('click', () => {
  resetModal.style.display = 'flex';

});

confirmReset.addEventListener('click', () => {
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: '' }
  });

  outputPanel.textContent = '';
  stepButton.style.display = 'none';
  exitButton.style.display = 'none';
  localStorage.removeItem('latest-source');
  resetModal.style.display = 'none';
});

cancelReset.addEventListener('click', () => {
  resetModal.style.display = 'none';
});

// ---------------------------------------------------------------------------
// Share buttons
// ---------------------------------------------------------------------------

shareButton.addEventListener('click', generateUrl);

export function generateUrl() {
  const code = editorView.state.doc.toString();
  const encoded = encodeURIComponent(code);
  window.location.hash = '';
  window.location.hash = `code=${encoded}`
  saveToLocal();
  const dummy = document.createElement('input');
  dummy.value = window.location.href;
  document.body.appendChild(dummy);
  dummy.select();
  document.execCommand('copy');
  document.body.removeChild(dummy);
  const toast = document.getElementById('toast');
  if (toast) {
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }
}

export function saveToLocal() {
  const code = editorView.state.doc.toString();
  window.localStorage.setItem(`${new Date().toLocaleDateString()}`, code);
}

// ---------------------------------------------------------------------------
// Left toolbar events
// ---------------------------------------------------------------------------

langSwitch.addEventListener("click", () => {
  if (langDropdown.style.display === "block") {
    langDropdown.style.display = "none";
  } else {
    langDropdown.style.display = "block";
  }
});

const closeDropdown = () => {
  langDropdown.style.display = "none";
};


// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (e.key === 'F5') {
    e.preventDefault();
    runButton.click();
  }
});

// EXAMPLES MODAL CONTENT
infoButton.addEventListener("click", () => {
  infoModal.style.display = "flex";
});

closeInfo.addEventListener("click", () => {
  infoModal.style.display = "none";
});

infoModal.addEventListener("click", (e) => {
  if (e.target === infoModal) {
    infoModal.style.display = "none";
  }
});
