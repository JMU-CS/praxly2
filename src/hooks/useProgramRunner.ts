/**
 * useProgramRunner drives a plain (non-debug) execution of a parsed program.
 *
 * It runs on the `Debugger` rather than the interpreter directly so a program
 * that calls `input()` can pause mid-run and resume with the user's answer,
 * instead of being re-executed from the top on every keystroke. Both the full
 * editor and the embed player share it, so a run behaves the same in each.
 */

import { useCallback, useRef, useState } from 'react';

import type { Program } from '../language/ast';
import type { SupportedLang } from '../components/LanguageSelector';
import { Debugger } from '../language/debugger';

interface RunnerCallbacks {
  /** Called with the cumulative program output after every step. */
  onOutput: (lines: string[]) => void;
  /** Called when execution throws; the message is already logged. */
  onError: (message: string) => void;
}

export interface ProgramRunner {
  /** True while a run is parked on an `input()` call. */
  waitingForInput: boolean;
  /** Prompt text for the pending `input()` call, if any. */
  inputPrompt: string;
  /** Variables visible at the most recent step of the current (or just-finished) run. */
  currentVariables: Record<string, any>;
  /** Runs `program` to completion, or until it pauses for input. */
  run: (program: Program, lang: SupportedLang, sourceCode: string) => void;
  /** Answers the pending `input()` call and resumes to completion. */
  submitInput: (input: string) => void;
  /** Abandons any paused run and clears the diagram — used when switching modes (Debug start/stop). */
  reset: () => void;
  /** Abandons any paused run without touching the diagram — used right before a
   *  new Run's own result is about to replace it, so the diagram doesn't blank
   *  out and flash back in. */
  clearInputState: () => void;
}

export function useProgramRunner(callbacks: RunnerCallbacks): ProgramRunner {
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  // Mirrors what the debugger already exposes for step-through mode, so a plain
  // Run can feed the same memory-diagram panel instead of leaving it empty.
  const [currentVariables, setCurrentVariables] = useState<Record<string, any>>({});

  // The Debugger instance behind a run that paused for input(). Held in a ref
  // rather than state: nothing renders from it, and the input handler needs
  // the value the *current* run wrote, not the one from its closure.
  const pausedRunRef = useRef<Debugger | null>(null);

  // Callbacks are recreated on every render of the calling page; reading them
  // through a ref keeps `run`/`submitInput` stable identities.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const clearInputState = useCallback(() => {
    pausedRunRef.current = null;
    setWaitingForInput(false);
    setInputPrompt('');
  }, []);

  const reset = useCallback(() => {
    clearInputState();
    // Also clear the diagram data: reset() means "abandon this run's state",
    // and callers (Debug starting/stopping) rely on this to stop showing a
    // previous run's leftover variables.
    setCurrentVariables({});
  }, [clearInputState]);

  /** Steps `instance` until it finishes or parks on input(). */
  const drain = useCallback(
    (start: () => Debugger) => {
      try {
        const instance = start();
        const { onOutput } = callbacksRef.current;
        let step = instance.step();

        while (step && !step.isComplete) {
          // `step.output` is the cumulative output so far, so replace rather
          // than append.
          onOutput(step.output);
          setCurrentVariables(step.variables);

          if (step.waitingForInput) {
            pausedRunRef.current = instance;
            setWaitingForInput(true);
            setInputPrompt(step.inputPrompt || '');
            return;
          }

          step = instance.step();
        }

        if (step) {
          onOutput(step.output);
          setCurrentVariables(step.variables);
        }
        // Clear only the input-pause bookkeeping here, not via reset() —
        // reset() also clears currentVariables, which would immediately wipe
        // out the final-state variables just set above (same render batch).
        clearInputState();
      } catch (e: any) {
        console.error(e);
        reset();
        callbacksRef.current.onError(e.message);
      }
    },
    [reset, clearInputState]
  );

  const run = useCallback(
    (program: Program, lang: SupportedLang, sourceCode: string) => {
      setCurrentVariables({});
      drain(() => {
        const instance = new Debugger();
        instance.init(program, lang, sourceCode);
        return instance;
      });
    },
    [drain]
  );

  const submitInput = useCallback(
    (input: string) => {
      const paused = pausedRunRef.current;
      if (!paused) return;
      drain(() => {
        paused.provideInput(input);
        return paused;
      });
    },
    [drain]
  );

  return {
    waitingForInput,
    inputPrompt,
    currentVariables,
    run,
    submitInput,
    reset,
    clearInputState,
  };
}
