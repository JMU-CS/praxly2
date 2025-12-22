const MIN_TAB_WIDTH = 300;
let dragging = false;

// resizing functionality
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

// for attaching the listener on any new resize bars
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
