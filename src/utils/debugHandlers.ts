/**
 * Debug highlighting helpers shared by the editor pages.
 */

import type { Program } from '../language/ast';
import type { SupportedLang } from '../components/LanguageSelector';
import type { SourceMap } from '../hooks/useCodeParsing';

/**
 * Computes which line to highlight in each open translation panel for the
 * debug step at `nodeId`, using each panel's emitter source map.
 */
export function computeMultiplePanelHighlighting(
  ast: Program | null,
  panels: Array<{ id: string; lang: SupportedLang }>,
  getTranslation: (
    ast: Program | null,
    lang: SupportedLang
  ) => { code: string; sourceMap: SourceMap },
  nodeId: string | null | undefined
): Map<string, number[]> {
  const panelHighlights = new Map<string, number[]>();

  if (!ast || !nodeId || panels.length === 0) {
    return panelHighlights;
  }

  for (const panel of panels) {
    const line = getTranslation(ast, panel.lang).sourceMap.get(nodeId);
    panelHighlights.set(panel.id, line !== undefined ? [line] : []);
  }

  return panelHighlights;
}
