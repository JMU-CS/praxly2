/**
 * Everything the editor *does* with the program: parsing it as the user types,
 * running it, stepping the debugger, and keeping the console and the per-pane
 * highlighting in sync. `EditorPage` is left to wire this to the layout.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Program } from '../language/ast';
import type { SupportedLang } from '../components/LanguageSelector';
import type { Panel } from '../components/editor/types';
import { computeMultiplePanelHighlighting } from '../utils/debugHandlers';
import { useCodeDebugger } from './useCodeDebugger';
import { useProgramRunner } from './useProgramRunner';
import type { SourceMap } from './useCodeParsing';

type ParseCode = (lang: SupportedLang, input: string) => Program | null;
type GetTranslation = (
  ast: Program | null,
  lang: SupportedLang
) => { code: string; sourceMap: SourceMap };

interface UseEditorExecutionArgs {
  code: string;
  sourceLang: SupportedLang;
  panels: Panel[];
  parseCode: ParseCode;
  getTranslation: GetTranslation;
}

/** The AST view can't be executed — run its programs as Python. */
const executableLang = (lang: SupportedLang): SupportedLang => (lang === 'ast' ? 'python' : lang);

export function useEditorExecution({
  code,
  sourceLang,
  panels,
  parseCode,
  getTranslation,
}: UseEditorExecutionArgs) {
  const [ast, setAst] = useState<Program | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Once true, the "Run code to see execution results..." placeholder never
  // reappears — it's a first-run hint, not a state to flash on every re-run.
  const [hasRun, setHasRun] = useState(false);
  const [panelHighlightedLines, setPanelHighlightedLines] = useState<Map<string, number[]>>(
    new Map()
  );

  const {
    isDebugging,
    setIsDebugging,
    isDebugComplete,
    setIsDebugComplete,
    highlightedSourceLines,
    setHighlightedSourceLines,
    currentVariables,
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

  // Running is deferred a beat so the cleared console paints first.
  const runTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (runTimeoutRef.current !== null) clearTimeout(runTimeoutRef.current);
    };
  }, []);

  const runLang = executableLang(sourceLang);

  // Re-parse on every edit so the translation panes and the AST view stay live.
  useEffect(() => {
    if (sourceLang === 'ast') return;

    try {
      setAst(parseCode(sourceLang, code));
      setError(null);
    } catch (e: any) {
      setAst(null);
      setError(e.message);
    }
  }, [code, sourceLang, parseCode]);

  const clearHighlighting = useCallback(() => {
    setHighlightedSourceLines([]);
    setPanelHighlightedLines(new Map());
  }, [setHighlightedSourceLines]);

  /** Empties the console. Pass `resetHasRun` to bring the first-run hint back. */
  const clearConsole = useCallback((options: { resetHasRun?: boolean } = {}) => {
    setOutput([]);
    setError(null);
    if (options.resetHasRun) setHasRun(false);
  }, []);

  const resetRunner = runner.reset;

  /** Abandons any in-flight run or debug session and its highlighting. */
  const stopSession = useCallback(() => {
    setIsDebugging(false);
    setIsDebugComplete(false);
    clearHighlighting();
    resetRunner();
  }, [setIsDebugging, setIsDebugComplete, clearHighlighting, resetRunner]);

  /** Applies one debugger step to the source, the panes, and the console. */
  const applyDebugStep = useCallback(
    (program: Program) => {
      const result = stepDebugger(program, code, runLang);
      if (!result) return;

      setHighlightedSourceLines(result.sourceHighlightedLines);
      setPanelHighlightedLines(
        computeMultiplePanelHighlighting(program, panels, getTranslation, result.step?.nodeId)
      );
      // outputLines is the cumulative program output, so replace rather than append.
      setOutput(result.outputLines);

      if (result.isComplete) {
        setIsDebugComplete(true);
        setOutput((prev) => [...prev, 'Execution complete.']);
      }
    },
    [
      code,
      runLang,
      panels,
      getTranslation,
      stepDebugger,
      setHighlightedSourceLines,
      setIsDebugComplete,
    ]
  );

  const run = () => {
    clearConsole();
    setHasRun(true);
    // clearInputState(), not reset(): this fires immediately on click, while
    // the actual run (with the diagram's new result) only starts after the
    // deferred timeout below — clearing the diagram here too would make it
    // blank out and then flash back in once the real run replaces it.
    runner.clearInputState();

    if (runTimeoutRef.current !== null) clearTimeout(runTimeoutRef.current);
    runTimeoutRef.current = window.setTimeout(() => {
      runTimeoutRef.current = null;
      try {
        const program = parseCode(runLang, code);
        if (!program) return;

        setAst(program);
        runner.run(program, runLang, code);
      } catch (e: any) {
        console.error(e);
        reportError(e.message);
      }
    }, 100);
  };

  const debugStart = () => {
    clearConsole();
    setHasRun(true);
    // Clear any leftover plain-run diagram data so a fresh Debug session
    // starts from the empty diagram, instead of showing the last Run's state.
    runner.reset();

    try {
      const program = parseCode(runLang, code);
      if (!program) return;

      setAst(program);
      initDebugger(program, runLang, code);
      setOutput(['Debugger initialized. Click Step to begin.']);
      clearHighlighting();
    } catch (e: any) {
      console.error(e);
      setError(e.message);
    }
  };

  const debugStep = () => {
    if (!ast) return;

    try {
      applyDebugStep(ast);
    } catch (e: any) {
      console.error(e);
      reportError(e.message);
      setIsDebugComplete(true);
    }
  };

  const debugStop = () => {
    stopDebugger();
    // Clear plain-run diagram data too, so the diagram fully disappears on
    // Stop rather than falling back to a stale Run's leftover variables.
    runner.reset();
    setIsDebugging(false);
    clearHighlighting();
    setOutput((prev) => [...prev, 'Debugger stopped.']);
  };

  /** Feeds a paused `input()` call — a plain run's, or the debugger's. */
  const submitInput = (input: string) => {
    if (runner.waitingForInput) {
      runner.submitInput(input);
      return;
    }

    provideInput(input);
    if (!ast) return;
    // Let the debugger hook flush its state before stepping past the pause.
    setTimeout(() => applyDebugStep(ast), 0);
  };

  /** Drops the editor's highlighting while the program is being edited mid-debug. */
  const noteCodeEdited = useCallback(() => {
    if (isDebugging) clearHighlighting();
  }, [isDebugging, clearHighlighting]);

  return {
    ast,
    setAst,
    error,
    setError,
    output,
    hasRun,
    panelHighlightedLines,
    isDebugging,
    isDebugComplete,
    // Debug mode's currentVariables resets to {} on stop; fall back to the plain
    // runner's (also reset to {} at the start of each run) so a run's final state
    // stays visible instead of showing nothing once neither is actively stepping.
    currentVariables:
      Object.keys(currentVariables).length > 0 ? currentVariables : runner.currentVariables,
    currentCallStack,
    highlightedSourceLines,
    waitingForInput: waitingForInput || runner.waitingForInput,
    inputPrompt: inputPrompt || runner.inputPrompt,
    run,
    debugStart,
    debugStep,
    debugStop,
    submitInput,
    clearConsole,
    stopSession,
    noteCodeEdited,
  };
}

export type EditorExecution = ReturnType<typeof useEditorExecution>;
