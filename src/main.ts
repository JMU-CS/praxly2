import { EditorView } from '@codemirror/view';
import { CodeMirrorEditor } from './editor.js';
import { Tab } from './tab.js';
import { run } from './run.js';
import { initTabWidths } from './resize.js';

// Main elements
const main = document.querySelector("main") as HTMLElement;
export const outputPanel = document.getElementById('output-panel') as HTMLElement;
export const stdout = document.getElementById('stdout') as HTMLElement;
export const stderr = document.getElementById('stderr') as HTMLElement;
export const memdiaPanel = document.getElementById("memdia-panel") as HTMLElement;

const IS_EMBED = document.body.classList.contains("embed");

// Toolbar buttons
const runButton = document.getElementById('run-button') as HTMLInputElement;
const debugButton = document.getElementById('debug-button') as HTMLInputElement;
export const stepButton = document.getElementById('step-button') as HTMLInputElement;
const exitButton = document.getElementById("exit-button") as HTMLInputElement;
const shareButton = document.getElementById("share-button") as HTMLInputElement;
const infoButton = document.getElementById("info-button") as HTMLInputElement;
const resetButton = document.getElementById("reset-button") as HTMLInputElement;

// embed-only optional button
const openButton = document.getElementById("open-button") as HTMLButtonElement | null;

// Info modal
const infoModal = document.getElementById("info-modal") as HTMLElement;
const closeInfo = document.getElementById("close-info") as HTMLButtonElement;

// Reset modal
const resetModal = document.getElementById('reset-confirm') as HTMLElement;
const confirmReset = document.getElementById('confirm-reset') as HTMLButtonElement;
const cancelReset = document.getElementById('cancel-reset') as HTMLButtonElement;

// Editor tabs
export const editorTabs: Tab[] = [];
let activeEditorIndex = 0;

// Convenience variables
export let editorTab: Tab;
export let editor: CodeMirrorEditor;
export let editorView: EditorView;

// ---------------------------------------------------------------------------
// Adding editor tabs
// ---------------------------------------------------------------------------

export function addNewTab() {
  // embed = only one editor
  if (IS_EMBED && editorTabs.length > 0) return;

  let index = editorTabs.length;

  const tab = new Tab();
  editorTabs.push(tab);
  setActiveEditor(index);

  // embed: strip multi-tab UI + remove tab memdia + no width math
  if (IS_EMBED) {
    tab.tabButton.style.display = 'none';
    tab.resizeBar.style.display = 'none';

    const memdia = tab.tab.querySelector('.memdia') as HTMLElement | null;
    if (memdia) memdia.remove();

    tab.tab.style.width = '100%';
    tab.tab.style.flexBasis = '100%';
  } else {
    initTabWidths();

    const prevTab = editorTabs[index - 1];
    if (prevTab) {
      prevTab.tabButton.style.display = 'none';
    }
  }
}

export function findActiveEditor(ev: MouseEvent) {
  if (IS_EMBED) return;

  // find the currently active tab
  const target = ev.target as Node | null;
  if (!target) return;

  // TODO: using the entire tab causes a slight issue
  const index = editorTabs.findIndex(tab => tab.editorDiv.contains(target));
  // const index = editorTabs.findIndex(tab => tab.tab.contains(target));

  if (index === -1) return;

  if (activeEditorIndex !== index) {
    setActiveEditor(index);
  }
}

export function removeTab(ev: MouseEvent) {
  if (IS_EMBED) return;

  if (editorTabs.length == 1) return;

  let index = editorTabs.findIndex(tab => tab.exitButton === ev.target || tab.exitButton.contains(ev.target as Node));

  const tab = editorTabs[index];
  tab.tab.remove();
  editorTabs.splice(index, 1);

  if (activeEditorIndex === index) {
    const newIndex = index > 0 ? index - 1 : 0;
    setActiveEditor(newIndex);
  } else if (activeEditorIndex > index) {
    setActiveEditor(activeEditorIndex - 1);
  }

  const last = editorTabs[editorTabs.length - 1];
  if (last && last.tabButton.style.display === 'none') {
      last.tabButton.style.display = 'flex';
  }

  initTabWidths();
}

function setActiveEditor(index: number) {
  editorTab = editorTabs[index];
  editor = editorTab.editor;
  editorView = editor.view;
  editorView.focus();
  activeEditorIndex = index;
  globalThis.EDITOR_VIEW = editorView;

  // update the src-language tab
  let currDropdown = editorTabs[index].languageDropdown;
  if (currDropdown.classList.contains('dst-lang')) {
    currDropdown.classList.remove('dst-lang');
    currDropdown.id = 'src-lang';
  }

  // highlight the tab
  editorTab.overlay.style.display = 'none';

  // make sure all the other tabs are dst's
  editorTabs.forEach(tab => {
    if (tab != editorTab) {
      tab.languageDropdown.classList.add('dst-lang');
      // "disable" the tab
      tab.overlay.style.display = 'block';
      if (tab.languageDropdown.id === 'src-lang') {
        tab.languageDropdown.id = '';
      }
    }
  });

}

// ---------------------------------------------------------------------------
// Run and Debug buttons
// ---------------------------------------------------------------------------

runButton.addEventListener('click', () => {
  run(false);
});

debugButton.addEventListener('click', () => {
  document.querySelectorAll<HTMLLIElement>(".hide")
    .forEach(el => el.style.display = 'flex');
  runButton.style.display = 'none';
  debugButton.style.display = 'none';
  stepButton.style.display = 'inline-flex';
  exitButton.style.display = 'inline-flex';
  run(true);
});

exitButton.addEventListener('click', () => {
  document.querySelectorAll<HTMLLIElement>(".hide")
    .forEach(el => el.style.display = 'none');
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
  window.location.hash = `code=${encoded}`;
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
  let editorView = globalThis.EDITOR_VIEW;
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: '' }
  });

  stdout.textContent = '';
  stderr.textContent = '';
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

// ---------------------------------------------------------------------------
// Info modal
// ---------------------------------------------------------------------------

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
// Initialization
// ---------------------------------------------------------------------------

function initialize(): void {
  // TODO Why is this function being called twice on startup?
  if (globalThis.EDITOR_VIEW) {
    return;
  }

  if (IS_EMBED) {
    // build one editor tab
    if (editorTabs.length === 0) addNewTab();

    // load from or latest-source
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const params = new URLSearchParams(hash);
    const codeParam = params.get('code');

    const initial =
      (codeParam ? decodeURIComponent(codeParam) : null) ??
      localStorage.getItem('latest-source') ??
      "";

    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: initial },
    });

    // embed-only open button
    if (openButton) {
      openButton.addEventListener('click', () => {
        window.open('/', '_blank', 'noopener,noreferrer');
      });
    }

    return;
  }

  // main page behavior
  if (main.childElementCount > 0) return;

  addNewTab();

  const latestSource = localStorage.getItem('latest-source') || "";
  const latestLanguage = localStorage.getItem('source-language') || "Praxis";
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: latestSource },
  });
  // TODO: load in src language from local storage
  // document.getElementById('source-language');
}

window.addEventListener("load", initialize);
document.addEventListener('click', findActiveEditor);
