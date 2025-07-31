import { CodeMirrorEditor } from './editor.js';
import { run } from './run.js';
let isResizingHoriz = false;
let isResizingVert = false;


// Toolbar buttons
const runButton = document.getElementById('run-button') as HTMLInputElement;
const debugButton = document.getElementById('debug-button') as HTMLInputElement;
export const stepButton = document.getElementById('step-button') as HTMLInputElement;
const exitButton = document.getElementById("exit-button") as HTMLInputElement;
const shareButton = document.getElementById("share-button") as HTMLInputElement;
const settingsButton = document.getElementById("settings-button") as HTMLInputElement;
const dropdownContent = document.querySelector(".dropdown-content") as HTMLElement;
const resetButton = document.getElementById("reset-button") as HTMLInputElement;
const resetModal = document.getElementById('reset-confirm') as HTMLElement;
const confirmReset = document.getElementById('confirm-reset') as HTMLButtonElement;
const cancelReset = document.getElementById('cancel-reset') as HTMLButtonElement;
const examplesButton = document.getElementById("examples-button") as HTMLButtonElement;
const examplesModal = document.getElementById("examples-modal")as HTMLButtonElement;
const closeExamples = document.getElementById("close-examples")as HTMLButtonElement;


// Main elements
const leftSide = document.getElementById("left-side") as HTMLElement;
const resizeBarX = document.getElementById("resize-bar-X") as HTMLElement;
const rightSide = document.getElementById("right-side") as HTMLElement;
export const outputPanel = document.getElementById('output-panel') as HTMLElement;
const resizeBarY = document.getElementById("resize-bar-Y") as HTMLElement;
const memdiaPanel = document.getElementById("memdia-panel") as HTMLElement;
const resizeEditorX = document.querySelector(".resize-bar-editor-x") as HTMLElement;
const resizeEditorXX = document.querySelector(".resize-bar-editor-xx") as HTMLElement;
const editorWrapper0 = document.getElementById("editor-wrapper-0") as HTMLElement;
const editorWrapper1 = document.getElementById("editor-wrapper-1") as HTMLElement;
const editorWrapper2 = document.getElementById("editor-wrapper-2") as HTMLElement;

// hiding editor 1 and 2 and resize bars
editorWrapper1.style.display = "none";
editorWrapper2.style.display = "none";
resizeEditorX.style.display = "none";
resizeEditorXX.style.display = "none";

// left-side toolbar elements
const langSwitch = document.getElementById("language-button") as HTMLButtonElement;
const langDropdown = document.getElementById("language-menu") as HTMLDivElement;

// Code editor
// export const editor = new CodeMirrorEditor('editor');
export const editor0 = new CodeMirrorEditor("editor-0");
export const editor1 = new CodeMirrorEditor("editor-1");
export const editor2 = new CodeMirrorEditor("editor-2");
// export const editor = editor0;
export let editor = editor0;
export let editorView = editor.view;
const newEditorButton = document.getElementById("new-editor")!;
const editorContainer = document.getElementById("editor-container")!;
let editorCount = 1;

export function setActiveEditor(index: number) {
  if (index === 0) editor = editor0;
  else if (index === 1) editor = editor1;
  else if (index === 2) editor = editor2;

  editorView = editor.view;
}

const latestSource = localStorage.getItem('latest-source');
if (latestSource) {
  editorView.focus();
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: latestSource },
  });
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

settingsButton.addEventListener("click", () => {
  if (dropdownContent.style.display === "block") {
    dropdownContent.style.display = "none";
  } else {
    dropdownContent.style.display = "block";
  }
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
// Resize events
// ---------------------------------------------------------------------------

resizeBarX.addEventListener('mousedown', () => {
  isResizingHoriz = true;
  document.addEventListener('mousemove', resizeHandler);
});

resizeBarY.addEventListener('mousedown', () => {
  isResizingVert = true;
  document.addEventListener('mousemove', resizeHandler);
});


document.addEventListener("mouseup", () => {
  isResizingHoriz = false;
  isResizingVert = false;
  document.removeEventListener("mousemove", resizeHandler);
});



function resizeHandler(e: MouseEvent) {
  if (isResizingHoriz) {
    const leftEdge = leftSide.getBoundingClientRect().left;
    const totalWidth = leftSide.offsetWidth + rightSide.offsetWidth + resizeBarX.offsetWidth;

    const leftWidth = e.clientX - leftEdge;
    const rightWidth = totalWidth - leftWidth - resizeBarX.offsetWidth;

    if (leftWidth > 100 && rightWidth > 100) {
      leftSide.style.width = `${leftWidth}px`;
      rightSide.style.width = `${rightWidth}px`;
    }
  }

  if (isResizingVert) {
    const topEdge = rightSide.getBoundingClientRect().top;
    const totalHeight = outputPanel.offsetHeight + memdiaPanel.offsetHeight + resizeBarY.offsetHeight;

    const outputHeight = e.clientY - topEdge;
    const memdiaHeight = totalHeight - outputHeight - resizeBarY.offsetHeight;

    if (outputHeight > 100 && memdiaHeight > 100) {
      outputPanel.style.height = `${outputHeight}px`;
      memdiaPanel.style.height = `${memdiaHeight}px`;
    }
  }

}

let visibleEditors = 1;

newEditorButton.addEventListener("click", () => {
  if (visibleEditors === 1) {
    editorWrapper1.style.display = "flex";
    resizeEditorX.style.display = "block";
    setActiveEditor(1);
    visibleEditors++;
  } else if (visibleEditors === 2) {
    editorWrapper2.style.display = "flex";
    resizeEditorXX.style.display = "block";
    setActiveEditor(2);
    visibleEditors++;
  }
});

// individual function for resize bars in between editors 0, 1, 2

function startEditorResize(bar: HTMLElement, leftEditor: HTMLElement, rightEditor: HTMLElement) {
  let isDragging = false;

  bar.addEventListener("mousedown", () => {
    isDragging = true;
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    function onMouseMove(e: MouseEvent) {
      if (!isDragging) return;
      const container = bar.parentElement as HTMLElement;
      const containerRect = container.getBoundingClientRect();
      const totalWidth = leftEditor.offsetWidth + rightEditor.offsetWidth + bar.offsetWidth;
      const offsetLeft = leftEditor.getBoundingClientRect().left;
      const leftWidth = e.clientX - offsetLeft;
      const rightWidth = totalWidth - leftWidth - bar.offsetWidth;

      if (leftWidth > 100 && rightWidth > 100) {
        leftEditor.style.flex = `0 0 ${leftWidth}px`;
        rightEditor.style.flex = `0 0 ${rightWidth}px`;
      }
    }

    function onMouseUp() {
      isDragging = false;
      document.body.style.cursor = "default";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
  });
}

startEditorResize(resizeEditorX, editorWrapper0, editorWrapper1);
startEditorResize(resizeEditorXX, editorWrapper1, editorWrapper2);



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
examplesButton.addEventListener("click", () => {
  examplesModal.style.display = "flex";
});

closeExamples.addEventListener("click", () => {
  examplesModal.style.display = "none";
});

examplesModal.addEventListener("click", (e) => {
  if (e.target === examplesModal) {
    examplesModal.style.display = "none";
  }
});
