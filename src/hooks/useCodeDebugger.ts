/**
 * useCodeDebugger hook that manages debugging state and logic for stepping through code execution.
 * Tracks highlighted lines, variables, and the call stack for both source and translated code.
 */

import { useState, useCallback } from 'react';
import type { Program } from '../language/ast';
import type { SupportedLang } from '../components/LanguageSelector';
import { Debugger, type DebugStep, type StackFrame } from '../language/debugger';
import { getRangeLines } from '../utils/debuggerUtils';
import type { SourceMap } from './useCodeParsing';

interface DebugStepResult {
  sourceHighlightedLines: number[];
  translationHighlightedLines: number[];
  /** Cumulative program output up to this step. */
  outputLines: string[];
  isComplete: boolean;
  step: DebugStep | null;
}

/**
 * Custom hook for managing debugging state and logic
 */
export const useCodeDebugger = (
  getTranslation: (
    ast: Program | null,
    target: SupportedLang
  ) => { code: string; sourceMap: SourceMap }
) => {
  const [isDebugging, setIsDebugging] = useState(false);
  const [isDebugComplete, setIsDebugComplete] = useState(false);
  const [debuggerInstance, setDebuggerInstance] = useState<Debugger | null>(null);
  const [highlightedSourceLines, setHighlightedSourceLines] = useState<number[]>([]);
  const [highlightedTranslationLines, setHighlightedTranslationLines] = useState<number[]>([]);
  const [currentVariables, setCurrentVariables] = useState<Record<string, any>>({});
  const [currentCallStack, setCurrentCallStack] = useState<StackFrame[]>([]);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');

  const initDebugger = useCallback(
    (ast: Program | null, lang: SupportedLang, sourceCode: string = '') => {
      if (!ast) return;
      const debugInstance = new Debugger();
      debugInstance.init(ast, lang, sourceCode);
      setDebuggerInstance(debugInstance);
      setIsDebugging(true);
      setIsDebugComplete(false);
      setCurrentVariables({});
      setCurrentCallStack([]);
      setHighlightedSourceLines([]);
      setHighlightedTranslationLines([]);
      return true;
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

      const step = debuggerInstance.step();
      if (!step) return null;

      setCurrentVariables(step.variables);
      setCurrentCallStack(step.callStack);
      setWaitingForInput(Boolean(step.waitingForInput));
      setInputPrompt(step.waitingForInput ? step.inputPrompt || '' : '');

      // Highlight exactly the node being executed — in the source via its
      // character range, in the translation via the emitter's source map.
      const sourceHighlightedLines = step.sourceLocation
        ? getRangeLines(sourceCode, step.sourceLocation.start)
        : [];
      let translationHighlightedLines: number[] = [];
      if (step.nodeId) {
        const line = getTranslation(ast, currentTargetLang).sourceMap.get(step.nodeId);
        if (line !== undefined) translationHighlightedLines = [line];
      }

      setHighlightedSourceLines(sourceHighlightedLines);
      setHighlightedTranslationLines(translationHighlightedLines);

      if (step.isComplete) {
        setIsDebugComplete(true);
      }

      return {
        sourceHighlightedLines,
        translationHighlightedLines,
        outputLines: step.output,
        isComplete: step.isComplete,
        step,
      };
    },
    [debuggerInstance, getTranslation]
  );

  const stopDebugger = useCallback(() => {
    setIsDebugging(false);
    setDebuggerInstance(null);
    setHighlightedSourceLines([]);
    setHighlightedTranslationLines([]);
    setIsDebugComplete(false);
    setWaitingForInput(false);
    setInputPrompt('');
  }, []);

  const provideInput = useCallback(
    (input: string) => {
      if (!debuggerInstance) return;
      debuggerInstance.provideInput(input);
      setWaitingForInput(false);
      setInputPrompt('');
    },
    [debuggerInstance]
  );

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
    currentCallStack,
    setCurrentCallStack,
    waitingForInput,
    inputPrompt,
    initDebugger,
    stepDebugger,
    stopDebugger,
    provideInput,
  };
};
