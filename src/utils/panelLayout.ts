import type { Panel } from '../components/editor/types';

/**
 * Pure transforms over the translation-panel list.
 *
 * Panels render as columns; a panel with `stackedUnder` set renders below its
 * root panel in the same column (max two per column). Keeping these as pure
 * functions makes the layout rules unit-testable and keeps EditorPage focused
 * on wiring.
 */

/** Removes a panel, unstacking any panel that was stacked under it. */
export function removePanelById(panels: Panel[], id: string): Panel[] {
  return panels
    .filter((panel) => panel.id !== id)
    .map((p) => (p.stackedUnder === id ? { ...p, stackedUnder: undefined } : p));
}

/**
 * Toggles stacking: an already-stacked panel pops back out to its own column;
 * a standalone panel stacks under the nearest free root panel to its left
 * (falling back to the last free root).
 */
export function toggleStack(panels: Panel[], id: string): Panel[] {
  const panel = panels.find((p) => p.id === id);
  if (!panel) return panels;

  if (panel.stackedUnder) {
    return panels.map((p) => (p.id === id ? { ...p, stackedUnder: undefined } : p));
  }

  const rootPanels = panels.filter((p) => !p.stackedUnder && p.id !== id);
  if (rootPanels.length === 0) return panels;

  const panelIndex = panels.indexOf(panel);
  let targetRoot: Panel | undefined;
  for (let i = panelIndex - 1; i >= 0; i--) {
    if (!panels[i].stackedUnder) {
      targetRoot = panels[i];
      break;
    }
  }
  if (!targetRoot) targetRoot = rootPanels[rootPanels.length - 1];

  // Only two panels fit per column — bail if the target already has a child.
  const alreadyStacked = panels.some((p) => p.stackedUnder === targetRoot!.id);
  if (alreadyStacked) return panels;

  return panels.map((p) => (p.id === id ? { ...p, stackedUnder: targetRoot!.id } : p));
}

/** Swaps which panel is root and which is stacked within the same column. */
export function swapStacked(panels: Panel[], sourceId: string, targetId: string): Panel[] {
  const source = panels.find((p) => p.id === sourceId);
  const target = panels.find((p) => p.id === targetId);
  if (!source || !target) return panels;

  const flip = (rootId: string, childId: string) =>
    panels.map((p) => {
      if (p.id === childId) return { ...p, stackedUnder: undefined };
      if (p.id === rootId) return { ...p, stackedUnder: childId };
      return p;
    });

  if (source.stackedUnder === targetId) return flip(targetId, sourceId);
  if (target.stackedUnder === sourceId) return flip(sourceId, targetId);
  return panels;
}

/**
 * Moves a panel to the target's position. Dragging always unstacks — the
 * moved panel becomes a standalone column at its drop position.
 */
export function reorderPanel(panels: Panel[], sourceId: string, targetId: string): Panel[] {
  if (sourceId === targetId) return panels;

  const sourceIndex = panels.findIndex((panel) => panel.id === sourceId);
  const targetIndex = panels.findIndex((panel) => panel.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return panels;

  const reordered = [...panels];
  const [moved] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, { ...moved, stackedUnder: undefined });
  return reordered;
}

/** True when the two panels share a column (one is stacked under the other). */
export function inSameColumn(panels: Panel[], aId: string, bId: string): boolean {
  const a = panels.find((p) => p.id === aId);
  const b = panels.find((p) => p.id === bId);
  return Boolean(a && b && (a.stackedUnder === bId || b.stackedUnder === aId));
}
