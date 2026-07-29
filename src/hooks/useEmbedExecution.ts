/**
 * Everything the embed player *does*: parsing the (editable) embedded source,
 * running it, stepping the debugger, and collecting console output. Keeping it
 * here leaves `EmbedPage` as a layout file.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorView } from '@codemirror/view';

import type { Program } from '../language/ast';
import type { SupportedLang } from '../components/LanguageSelector';
import type { EmbedData } from '../utils/embedCodec';
import { getCodeMirrorExtensions } from '../utils/editorUtils';
import { highlightedLinesField, dispatchLineHighlighting } from '../utils/codemirrorConfig';
import { useCodeParsing } from './useCodeParsing';
import { useCodeDebugger } from './useCodeDebugger';
import { useProgramRunner } from './useProgramRunner';

export function useEmbedExecution(embedData: EmbedData | null, targetLang: SupportedLang) {
  const [output, setOutput] = useState<string[]>([]);
  const [ast, setAst] = useState<Program | null>(null);
  // One error slot for both parsing and execution: a program that now parses
  // clears whatever the last failed run reported, and vice versa.
  const [error, setError] = useState<string | null>(null);

  const { parseCode, getTranslation } = useCodeParsing();
  const {
    isDebugging,
    setIsDebugging,
    isDebugComplete,
    setIsDebugComplete,
    highlightedSourceLines,
    setHighlightedSourceLines,
    highlightedTranslationLines,
    setHighlightedTranslationLines,
    currentCallStack,
    waitingForInput,
    inputPrompt,
    initDebugger,
    stepDebugger,
    stopDebugger,
    provideInput,
  } = useCodeDebugger(getTranslation);

  const reportError = useCallback((message: string) => {
    setError(message);
    setOutput((prev) => [...prev, `Error: ${message}`]);
  }, []);

  const runner = useProgramRunner({ onOutput: setOutput, onError: reportError });

  const editorViewRef = useRef<EditorView | null>(null);

  const lang = (embedData?.lang ?? 'python') as SupportedLang;
  const sourceCode = embedData?.code ?? '';

  // Re-parse whenever the (editable) embedded source changes.
  useEffect(() => {
    if (!embedData) return;

    try {
      setAst(parseCode(embedData.lang as SupportedLang, embedData.code));
      setError(null);
    } catch (e: any) {
      setError(e.message);
      setAst(null);
    }
  }, [embedData, parseCode]);

  useEffect(() => {
    dispatchLineHighlighting(editorViewRef, highlightedSourceLines);
  }, [highlightedSourceLines]);

  const onCreateEditor = useCallback((view: EditorView) => {
    editorViewRef.current = view;
  }, []);

  const sourceExtensions = useMemo(() => {
    const extensions = getCodeMirrorExtensions(lang);
    extensions.push(highlightedLinesField);
    return extensions;
  }, [lang]);

  /** Applies one debugger step to the highlighting and console. */
  const applyDebugStep = useCallback(() => {
    const result = stepDebugger(ast, sourceCode, targetLang);
    if (!result) return;

    setHighlightedSourceLines(result.sourceHighlightedLines);
    setHighlightedTranslationLines(result.translationHighlightedLines);
    // outputLines is the cumulative program output, so replace rather than append.
    setOutput(result.outputLines);

    if (result.isComplete) {
      setIsDebugComplete(true);
      setOutput((prev) => [...prev, 'Execution complete.']);
    }
  }, [
    ast,
    sourceCode,
    targetLang,
    stepDebugger,
    setHighlightedSourceLines,
    setHighlightedTranslationLines,
    setIsDebugComplete,
  ]);

  const run = () => {
    setError(null);
    setOutput([]);
    runner.reset();
    if (!ast) return;
    runner.run(ast, lang, sourceCode);
  };

  const debugStart = () => {
    setError(null);
    setOutput([]);

    try {
      if (!ast) return;
      initDebugger(ast, lang, sourceCode);
      setOutput(['Debugger initialized. Click Step to begin.']);
    } catch (e: any) {
      console.error(e);
      setError(e.message);
    }
  };

  const debugStep = () => {
    if (!ast || !sourceCode) return;

    try {
      applyDebugStep();
    } catch (e: any) {
      console.error(e);
      reportError(e.message);
      setIsDebugComplete(true);
    }
  };

  const debugStop = () => {
    stopDebugger();
    setIsDebugging(false);
    setOutput((prev) => [...prev, 'Debugger stopped.']);
  };

  /** Feeds a paused `input()` call — a plain run's, or the debugger's. */
  const submitInput = (input: string) => {
    if (runner.waitingForInput) {
      runner.submitInput(input);
      return;
    }

    provideInput(input);
    if (!ast || !sourceCode) return;
    // Let the debugger hook flush its state before stepping past the pause.
    setTimeout(applyDebugStep, 0);
  };

  return {
    ast,
    output,
    error,
    lang,
    sourceExtensions,
    onCreateEditor,
    getTranslation,
    isDebugging,
    isDebugComplete,
    callStack: currentCallStack,
    highlightedTranslationLines,
    waitingForInput: waitingForInput || runner.waitingForInput,
    inputPrompt: inputPrompt || runner.inputPrompt,
    run,
    debugStart,
    debugStep,
    debugStop,
    submitInput,
  };
}
