import { resizeBarY, resizeBarX, leftSide, rightSide, outputPanel, memdiaPanel } from './main';

let isResizingHoriz = false;
let isResizingVert = false;

export function resizeEvents() {
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
}

export function resizeHandler(e: MouseEvent) {
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

// individual function for resize bars in between editors

export function startEditorResize(bar: HTMLElement, leftEditor: HTMLElement, rightEditor: HTMLElement) {
  let isDragging = false;

  bar.addEventListener("mousedown", () => {
    isDragging = true;
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    function onMouseMove(e: MouseEvent) {
      if (!isDragging) return;
      //   const container = bar.parentElement as HTMLElement;
      //   const containerRect = container.getBoundingClientRect();
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

// startEditorResize(resizeEditorX, editorWrapper0, editorWrapper1);
// startEditorResize(resizeEditorXX, editorWrapper1, editorWrapper2);
