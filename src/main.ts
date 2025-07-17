import { CodeMirrorEditor } from './editor.js';
import { run } from './run.js';

// Toolbar buttons
const runButton = document.getElementById('run-button') as HTMLInputElement;
const debugButton = document.getElementById('debug-button') as HTMLInputElement;
export const stepButton = document.getElementById('step-button') as HTMLInputElement;
const exitButton = document.getElementById("exit-button") as HTMLInputElement;
const shareButton = document.getElementById("share-button") as HTMLInputElement;
const settingsButton = document.getElementById("settings-button") as HTMLInputElement;
const dropdownContent = document.querySelector(".dropdown-content") as HTMLElement;
const resetButton = document.getElementById("reset-button") as HTMLInputElement;

// Main elements
const leftSide = document.getElementById("left-side") as HTMLElement;
const resizeBarX = document.getElementById("resize-bar-X") as HTMLElement;
const rightSide = document.getElementById("right-side") as HTMLElement;
export const outputPanel = document.getElementById('output-panel') as HTMLElement;
const resizeBarY = document.getElementById("resize-bar-Y") as HTMLElement;
const memdiaPanel = document.getElementById("memdia-panel") as HTMLElement;

// left-side toolbar elements
const langSwitch = document.getElementById("lang-switch") as HTMLButtonElement;
const langDropdown = document.getElementById("dropdown-content") as HTMLDivElement;

// Code editor
export const editor = new CodeMirrorEditor('editor');
export const editorView = editor.view;
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

// reset button
resetButton.addEventListener('click', () => {
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: '' }
  });

  outputPanel.textContent = '';
  stepButton.style.display = 'none';
  exitButton.style.display = 'none';
  localStorage.removeItem('latest-source');
});

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

resizeBarX.addEventListener("mousedown", () => {
  document.addEventListener("mousemove", resizeX);
  document.addEventListener("mouseup", stopResizeX);
});

function resizeX(e: MouseEvent) {
  const leftEdge = leftSide.getBoundingClientRect().left;
  const totalWidth = leftSide.offsetWidth;
  const leftWidth = e.clientX - leftEdge;
  const rightWidth = totalWidth - leftWidth - resizeBarX.offsetWidth;

  leftSide.style.width = `${leftWidth}px`;
  rightSide.style.width = `${rightWidth}px`;
}

function stopResizeX() {
  document.removeEventListener("mousemove", resizeX);
  document.removeEventListener("mouseup", stopResizeX);
}

resizeBarY.addEventListener("mousedown", () => {
  document.addEventListener("mousemove", resizeY);
  document.addEventListener("mouseup", stopResizeY);
});

function resizeY(e: MouseEvent) {
  const topEdge = rightSide.getBoundingClientRect().top;
  const totalHeight = rightSide.offsetHeight;
  const outputHeight = e.clientY - topEdge;
  const memdiaHeight = totalHeight - outputHeight - resizeBarY.offsetHeight;

  outputPanel.style.height = `${outputHeight}px`;
  memdiaPanel.style.height = `${memdiaHeight}px`;
}

function stopResizeY() {
  document.removeEventListener("mousemove", resizeY);
  document.removeEventListener("mouseup", stopResizeY);
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (e.key === 'F5') {
    e.preventDefault();
    runButton.click();
  }
});
