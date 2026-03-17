/**
 * useCodeDebugger hook that manages debugging state and logic for stepping through code execution.
 * Tracks highlighted lines, variables, and debug step information for both source and translated code.
 */

import { useState, useCallback } from 'react';
import type { Program } from '../language/ast';
import type { SupportedLang } from '../components/LanguageSelector';
import { Debugger, type DebugStep } from '../language/debugger';
import { getRangeLines, findNodesAtLocation } from '../utils/debuggerUtils';
import type { SourceMap } from './useCodeParsing';

interface DebugStepResult {
    sourceHighlightedLines: number[];
    translationHighlightedLines: number[];
    outputLines: string[];
    isComplete: boolean;
    step: DebugStep | null;
}

/**
 * Custom hook for managing debugging state and logic
 */
export const useCodeDebugger = (
    getTranslation: (ast: Program | null, target: SupportedLang) => { code: string; sourceMap: SourceMap }
) => {
    const [isDebugging, setIsDebugging] = useState(false);
    const [isDebugComplete, setIsDebugComplete] = useState(false);
    const [debuggerInstance, setDebuggerInstance] = useState<Debugger | null>(null);
    const [highlightedSourceLines, setHighlightedSourceLines] = useState<number[]>([]);
    const [highlightedTranslationLines, setHighlightedTranslationLines] = useState<number[]>([]);
    const [currentVariables, setCurrentVariables] = useState<Record<string, any>>({});

    const initDebugger = useCallback(
        (ast: Program | null, lang: SupportedLang, sourceCode: string = '') => {
            if (!ast) return;
            try {
                const debugInstance = new Debugger();
                debugInstance.init(ast, lang, sourceCode);
                setDebuggerInstance(debugInstance);
                setIsDebugging(true);
                setIsDebugComplete(false);
                setCurrentVariables({});
                setHighlightedSourceLines([]);
                setHighlightedTranslationLines([]);
                return true;
            } catch (e) {
                throw e;
            }
        },
        []
    );

    const stepDebugger = useCallback(
        (
            ast: Program | null,
            sourceCode: string,
            currentTargetLang: SupportedLang
        ): DebugStepResult | null => {
            if (!debuggerInstance || !ast || !sourceCode) return null;

            try {
                const step = debuggerInstance.step();
                if (!step) return null;

                setCurrentVariables(step.variables);

                let sourceHighlightedLines: number[] = [];
                let translationHighlightedLines: number[] = [];

                if (step.sourceLocation) {
                    const nodesAtLocation = findNodesAtLocation(ast, step.sourceLocation.start);

                    // Highlight source lines
                    const sourceHighlights = new Set<number>();
                    for (const node of nodesAtLocation) {
                        if (node.loc) {
                            const nodeLines = getRangeLines(sourceCode, node.loc.start);
                            nodeLines.forEach(line => sourceHighlights.add(line));
                        }
                    }
                    sourceHighlightedLines = Array.from(sourceHighlights);

                    // Highlight translation lines
                    const translation = getTranslation(ast, currentTargetLang);
                    const translationSourceMap = translation.sourceMap;
                    const nodeIds = nodesAtLocation.map(n => n.id);

                    for (const nodeId of nodeIds) {
                        const mapEntry = translationSourceMap.get
                            ? translationSourceMap.get(nodeId)
                            : (translationSourceMap as any)[nodeId];

                        if (mapEntry !== undefined) {
                            if (typeof mapEntry === 'object' && 'lineStart' in mapEntry) {
                                translationHighlightedLines.push(mapEntry.lineStart - 1);
                            } else if (typeof mapEntry === 'number') {
                                translationHighlightedLines.push(mapEntry);
                            }
                        }
                    }
                }

                setHighlightedSourceLines(sourceHighlightedLines);
                setHighlightedTranslationLines(translationHighlightedLines);

                const outputLines: string[] = [];
                outputLines.push(`--- Step ${step.stepNumber} ---`);
                outputLines.push(`Node: ${step.nodeType}`);
                if (step.sourceLocation) {
                    outputLines.push(
                        `Location: ${step.sourceLocation.start} - ${step.sourceLocation.end}`
                    );
                }
                outputLines.push('');

                if (step.isComplete) {
                    setIsDebugComplete(true);
                    outputLines.push('Execution complete.');
                }

                return {
                    sourceHighlightedLines,
                    translationHighlightedLines,
                    outputLines,
                    isComplete: step.isComplete,
                    step
                };
            } catch (e) {
                throw e;
            }
        },
        [debuggerInstance, getTranslation]
    );

    const stopDebugger = useCallback(() => {
        setIsDebugging(false);
        setDebuggerInstance(null);
        setHighlightedSourceLines([]);
        setHighlightedTranslationLines([]);
        setIsDebugComplete(false);
        setCurrentVariables({});
    }, []);

    return {
        isDebugging,
        setIsDebugging,
        isDebugComplete,
        setIsDebugComplete,
        debuggerInstance,
        highlightedSourceLines,
        setHighlightedSourceLines,
        highlightedTranslationLines,
        setHighlightedTranslationLines,
        currentVariables,
        setCurrentVariables,
        initDebugger,
        stepDebugger,
        stopDebugger
    };
};
