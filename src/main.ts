import { CodeMirrorEditor } from './editor.js';
import { EditorTab } from './editor-tab.js';
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
const infoModal = document.getElementById("info-modal")as HTMLElement;
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

// Editor tabs
export const editorTabs: EditorTab[] = [];
let activeEditorIndex = 0;

// TODO remove convenience variables for current editor?
export let editorTab: EditorTab;
export let editor: CodeMirrorEditor;
export let editorView: any;

// ---------------------------------------------------------------------------
// Adding editor tabs
// ---------------------------------------------------------------------------

export function setActiveEditor(index: number) {
  editorTab = editorTabs[index];
  editor = editorTab.editor;
  editorView = editor.view;
  editorView.focus();
  activeEditorIndex = index;
}

function removeTab(index : number) {
  const tab = editorTabs[index];

  const prevSibling = tab.wrapper.previousElementSibling;
  if (prevSibling && prevSibling.classList.contains("resize-bar-editor")) {
    prevSibling.remove();
  }

  tab.wrapper.remove();

  // remove the tab from the array
  editorTabs.splice(index, 1);

  // Update activeEditorIndex
  if (editorTabs.length === 0) {
    addNewTab();
  } else if (activeEditorIndex === index) {
    // Removed tab was active → pick previous tab or first tab
    const newIndex = index > 0 ? index - 1 : 0;
    setActiveEditor(newIndex);
  } else if (activeEditorIndex > index) {
    // Removed tab was before the active tab → shift active index left
    setActiveEditor(activeEditorIndex-1);
  }
  editorTabs[activeEditorIndex].button.textContent = "+";
  editorTabs[activeEditorIndex].button.addEventListener('click', addNewTab);
}

export function addNewTab() {
  let index = editorTabs.length;

  // take off the + button and add an x button for the previous tab
  const prevTab = editorTabs[index-1];
  if (prevTab) {
    prevTab.button.textContent = "x";
    prevTab.button.removeEventListener('click', addNewTab);
    prevTab.button.addEventListener('click', () => removeTab(index));
  }

  const tab = new EditorTab(index);
  // if you are working with the first tab - assign the dropdown as the source
  if (index == 0) {
    tab.select.id = "src-lang";
  } else {
    // otherwise its a destination
    tab.select.classList.add("dst-lang");
  }

  editorTabs.push(tab);
  setActiveEditor(index);
}

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
// Share button
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
// Reset button
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

// ---------------------------------------------------------------------------
// Initialization function
// ---------------------------------------------------------------------------

function initialize(): void {
  // TODO figure out why this is being called twice
  if (leftSide.childElementCount > 0) {
    return;
  }

  // first editor
  addNewTab();

  // TODO store source of all editors?
  const latestSource = localStorage.getItem('latest-source') || "";
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: latestSource },
  });

  resizeEvents();
}

window.addEventListener("load", initialize);
