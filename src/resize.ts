const MIN_TAB_WIDTH = 300;
const MIN_PANEL_HEIGHT = 120;
const MIN_FOOTER_HEIGHT = 200;
const MAX_FOOTER_HEIGHT = 400;
let dragging = false;

// resizing functionality for between tabs
function onMouseDown(bar: HTMLDivElement, e: MouseEvent) {
  dragging = true;
  e.preventDefault();

  const leftTab = bar.parentElement as HTMLElement;
  const rightTab = leftTab.nextElementSibling as HTMLElement;

  if (!rightTab || !rightTab.classList.contains('tab')) return;

  const startX = e.clientX;
  const leftStartWidth = leftTab.offsetWidth;
  const rightStartWidth = rightTab.offsetWidth;

  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  const onMouseMove = (moveEvent: MouseEvent) => {
    const delta = moveEvent.clientX - startX;

    const newLeftWidth = leftStartWidth + delta;
    const newRightWidth = rightStartWidth - delta;

    // HARD GUARDS
    if ((newLeftWidth < MIN_TAB_WIDTH) || (newRightWidth < MIN_TAB_WIDTH)) return;

    leftTab.style.width = `${newLeftWidth}px`;
    leftTab.style.flexBasis = `${newLeftWidth}px`;

    rightTab.style.width = `${newRightWidth}px`;
    rightTab.style.flexBasis = `${newRightWidth}px`;
  };

  const onMouseUp = () => {
    dragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

// attach the listener on any new resize bars (when tabs are added)
export function attachResizeBar(bar: HTMLDivElement) {
  if (bar.dataset.resizeAttached) return;
  bar.dataset.resizeAttached = 'true';
  bar.addEventListener('mousedown', (e) => onMouseDown(bar, e));
}

export function initTabWidths() {
  const tabs = Array.from(document.querySelectorAll<HTMLElement>('.tab'));
  const main = document.querySelector('main') as HTMLElement;

  if (!main || tabs.length === 0) return;

  const resizeBarWidth = 5;
  const totalResizeBars = tabs.length - 1;

  const availableWidth =
    main.clientWidth - totalResizeBars * resizeBarWidth;

  const widthPerTab = availableWidth / tabs.length;

  tabs.forEach(tab => {
    tab.style.width = `${widthPerTab}px`;
    tab.style.flexBasis = `${widthPerTab}px`;
  });
}

function initializeResize() {
  document.querySelectorAll<HTMLDivElement>('.resize-bar')
    .forEach(bar => attachResizeBar(bar));

  if (!dragging) initTabWidths();
}

window.addEventListener('DOMContentLoaded', initializeResize);


// RESIZING INSIDE THE TAB BETWEEN EDITOR AND DIAGRAM //

/**
 * Attach a vertical resizer using a handle element placed
 * between the editor and memdia elements inside a tab-content container.
 * Also attaches a click listener to toggle memdia visibility.
 */
export function attachVerticalMemdiaResizer(
  handle: HTMLDivElement,
  editor: HTMLElement,
  memdia: HTMLElement,
  tabContent: HTMLElement
) {
  if (!handle || !editor || !memdia) return;
  if (handle.dataset.verticalResizeAttached) return;
  handle.dataset.verticalResizeAttached = 'true';

  handle.style.cursor = 'row-resize';

  let ignoreNextClick = false;

  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();

    let hasMoved = false;

    const container = handle.parentElement as HTMLElement; // tab-content
    const header = container.querySelector<HTMLElement>('.tab-header');

    const containerRect = container.getBoundingClientRect();
    const headerHeight = header?.offsetHeight ?? 0;
    const handleHeight = handle.offsetHeight;

    // Available height is space for editor + memdia excluding header and handle
    const available = container.clientHeight - headerHeight - handleHeight;
    if (available <= 0) return;

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      hasMoved = true;
      // Mouse Y relative to container content area beneath header
      const relativeY = moveEvent.clientY - containerRect.top - headerHeight;
      // Place handle centered; subtract half handle height
      let newEditorHeight = Math.round(relativeY - handleHeight / 2);
      // Clamp
      newEditorHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(available - MIN_PANEL_HEIGHT, newEditorHeight));
      const newMemdiaHeight = available - newEditorHeight;

      editor.style.height = `${newEditorHeight}px`;
      editor.style.flexBasis = `${newEditorHeight}px`;

      memdia.style.height = `${newMemdiaHeight}px`;
      memdia.style.flexBasis = `${newMemdiaHeight}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (hasMoved) {
        ignoreNextClick = true;
        setTimeout(() => ignoreNextClick = false, 50);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onClick = () => {
    if (ignoreNextClick) {
      ignoreNextClick = false;
      return;
    }
    toggleMemdiaVisibility(editor, memdia, tabContent, handle);
  };

  handle.addEventListener('mousedown', onMouseDown);
  handle.addEventListener('click', onClick, { capture: true });
}

// initialize a reasonable default split between editor and memdia.
export function initVerticalSplit(tabContent: HTMLElement, ratio: number = 0.6) {
  const editor = tabContent.querySelector<HTMLElement>('.editor');
  const memdia = tabContent.querySelector<HTMLElement>('.memdia');
  const header = tabContent.querySelector<HTMLElement>('.tab-header');
  const handle = tabContent.querySelector<HTMLElement>('.label');
  if (!editor || !memdia) return;

  // Determine available height beneath the header
  const containerHeight = tabContent.clientHeight;
  const headerHeight = header?.offsetHeight ?? 0;
  const handleHeight = handle?.offsetHeight ?? 0;
  const available = Math.max(0, containerHeight - headerHeight - handleHeight);
  if (available <= 0) return;

  const editorHeight = Math.max(MIN_PANEL_HEIGHT, Math.round(available * ratio));
  const memdiaHeight = Math.max(MIN_PANEL_HEIGHT, available - editorHeight);

  editor.style.height = `${editorHeight}px`;
  editor.style.flexBasis = `${editorHeight}px`;

  memdia.style.height = `${memdiaHeight}px`;
  memdia.style.flexBasis = `${memdiaHeight}px`;
}

/**
 * Toggle memdia visibility and adjust editor size accordingly.
 */
export function toggleMemdiaVisibility(
  editor: HTMLElement,
  memdia: HTMLElement,
  tabContent: HTMLElement,
  handle: HTMLElement
) {
  const arrowButton = handle.querySelector('.drawer-arrow');
  if (memdia.style.display === 'none') {
    memdia.style.display = '';
    editor.style.flexGrow = '';
    if (arrowButton) arrowButton.textContent = 'keyboard_arrow_down';
    initVerticalSplit(tabContent, 0.6);
  } else {
    memdia.style.display = 'none';
    editor.style.flexGrow = '1';
    if (arrowButton) arrowButton.textContent = 'keyboard_arrow_right';
  }
}



export function attachVerticalFooterResizer(
  handle: HTMLDivElement,
  main: HTMLDivElement,
  output: HTMLDivElement
) {
  if (!handle || !main || !output) return;
  if (handle.dataset.verticalResizeAttached) return;
  handle.dataset.verticalResizeAttached = 'true';

  handle.style.cursor = 'row-resize';

  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();

    let hasMoved = false;

    const container = document.querySelector(".workspace") as HTMLElement | null;
    if (!container) return;

    const handleHeight = handle.offsetHeight;

    // available space is just the workspace height (header is outside workspace)
    const available = container.clientHeight;
    if (available <= 0) return;

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      hasMoved = true;
      // Recalculate container rect on every move for accurate positioning
      const currentContainerRect = container.getBoundingClientRect();
      // Mouse Y relative to workspace top
      const relativeY = moveEvent.clientY - currentContainerRect.top;
      // Place handle centered; subtract half handle height
      let newMainHeight = Math.round(relativeY - handleHeight / 2);
      // Clamp both: main can't go below MIN_PANEL_HEIGHT, footer can't go below MIN_FOOTER_HEIGHT and can't exceed MAX_FOOTER_HEIGHT
      const minMainHeight = Math.max(MIN_PANEL_HEIGHT, available - MAX_FOOTER_HEIGHT);
      const maxMainHeight = available - MIN_FOOTER_HEIGHT;
      newMainHeight = Math.max(minMainHeight, Math.min(maxMainHeight, newMainHeight));
      const newFooterHeight = available - newMainHeight;

      main.style.height = `${newMainHeight}px`;
      main.style.flexBasis = `${newMainHeight}px`;

      output.style.height = `${newFooterHeight}px`;
      output.style.flexBasis = `${newFooterHeight}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  handle.addEventListener('mousedown', onMouseDown);
}
