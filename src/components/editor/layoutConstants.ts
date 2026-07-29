/** Pixel budgets shared by the editor's panes and their resize drags. */

export const MIN_SOURCE_WIDTH = 280;
export const MIN_PANEL_WIDTH = 240;
export const MIN_OUTPUT_HEIGHT = 120;
export const MIN_MEM_DIA_HEIGHT = 100;
export const MAX_MEM_DIA_HEIGHT = 360;
export const MIN_AI_PANEL_WIDTH = 260;
export const MAX_AI_PANEL_WIDTH = 560;
/** Fixed width of the left icon rail (`AddPanelStrip`). */
export const ADD_STRIP_WIDTH = 64;
/** Below this the pane row scrolls horizontally instead of sharing the width. */
export const MOBILE_BREAKPOINT = 1024;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Width a freshly opened translation panel starts at. */
export const defaultPanelWidth = (viewportWidth: number = window.innerWidth): number =>
  viewportWidth < MOBILE_BREAKPOINT
    ? Math.max(MIN_PANEL_WIDTH, Math.floor(viewportWidth * 0.8))
    : 350;
