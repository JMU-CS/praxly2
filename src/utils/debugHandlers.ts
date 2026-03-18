/**
 * Debug step computation functions that execute code and compute debug information.
 * Handles both simple execution and step-by-step debugging with output and variable tracking.
 */

import type { Program } from '../language/ast';
import type { SupportedLang } from '../components/LanguageSelector';
import { Interpreter } from '../language/interpreter';
import { findNodesAtLocation } from './debuggerUtils';
import type { SourceMap } from '../hooks/useCodeParsing';

/**
 * Result of a debug step operation with all data needed by UI
 */
export interface DebugStepData {
    sourceHighlightedLines: number[];
    panelHighlights: Map<string, number[]>; // For EditorPage multi-panel
    outputLines: string[];
    isComplete: boolean;
}

/**
 * Execute code and return output (shared between both pages)
 */
export function computeRunOutput(ast: Program | null, sourceCode: string = ''): string[] {
    const output: string[] = [];
    if (!ast) return output;

    try {
        const interpreter = new Interpreter();
        const results = interpreter.interpret(ast, sourceCode);
        output.push(...results);
    } catch (e: any) {
        // Re-throw InputPrompt errors so UI can handle input
        if (e.name === 'InputPrompt') {
            throw e;
        }
        output.push(`Error: ${e.message}`);
    }

    return output;
}

/**
 * Process a debug step for multi-panel highlighting (EditorPage-specific)
 * Computes which lines to highlight in each language panel
 */
export function computeMultiplePanelHighlighting(
    ast: Program | null,
    panels: Array<{ id: string; lang: SupportedLang }>,
    getTranslation: (ast: Program | null, lang: SupportedLang) => { code: string; sourceMap: SourceMap },
    sourceLocation: { start: number; end: number } | null
): Map<string, number[]> {
    const panelHighlights = new Map<string, number[]>();

    if (!ast || !sourceLocation || panels.length === 0) {
        return panelHighlights;
    }

    const nodesAtLocation = findNodesAtLocation(ast, sourceLocation.start);
    const nodeIds = nodesAtLocation.map(n => n.id);

    for (const panel of panels) {
        const translation = getTranslation(ast, panel.lang);
        const panelHighlightSet = new Set<number>();

        for (const nodeId of nodeIds) {
            const mapEntry = translation.sourceMap.get
                ? translation.sourceMap.get(nodeId)
                : (translation.sourceMap as any)[nodeId];

            if (mapEntry !== undefined) {
                if (typeof mapEntry === 'object' && 'lineStart' in mapEntry) {
                    panelHighlightSet.add(mapEntry.lineStart - 1);
                } else if (typeof mapEntry === 'number') {
                    panelHighlightSet.add(mapEntry);
                }
            }
        }
        panelHighlights.set(panel.id, Array.from(panelHighlightSet));
    }

    return panelHighlights;
}
