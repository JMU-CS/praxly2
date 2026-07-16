/**
 * Debugger that provides step-by-step code execution with variable inspection.
 * Wraps the interpreter's step-through generator, tracking the collected steps,
 * the call stack, and input-pause state for the UI.
 */

import type { Program } from './ast';
import { Interpreter, InputPrompt } from './interpreter';
import type { DebugStepEvent, StackFrame } from './interpreter';

export type SupportedLang = 'python' | 'java' | 'csp' | 'praxis' | 'javascript' | 'blocks' | 'ast';

export type { StackFrame } from './interpreter';

/**
 * Represents a single execution step with all relevant debug information
 */
export interface DebugStep {
  stepNumber: number;
  nodeId: string;
  nodeType: string;
  sourceLocation: { start: number; end: number } | null;
  variables: Record<string, any>;
  /** Call stack at this step: global scope first, innermost call last. */
  callStack: StackFrame[];
  output: string[];
  isComplete: boolean;
  error?: string;
  waitingForInput?: boolean;
  inputPrompt?: string;
}

/**
 * Debug context that maintains state across stepping operations
 */
export interface DebugContext {
  program: Program;
  sourceLang: SupportedLang;
  interpreter: Interpreter;
  steps: DebugStep[];
  currentStep: number;
  sourceCode: string;
  waitingForInput: boolean;
  inputPrompt?: string;
}

/**
 * Main debugger class that orchestrates stepping through code
 * with execution state tracking
 */
export class Debugger {
  private context: DebugContext | null = null;
  private executionGenerator: Generator<DebugStepEvent, string[], void> | null = null;

  /**
   * Initialize debugger with a program and source language
   */
  init(program: Program, sourceLang: SupportedLang, sourceCode: string = ''): DebugContext {
    const interpreter = new Interpreter();

    this.context = {
      program,
      sourceLang,
      interpreter,
      steps: [],
      currentStep: 0,
      sourceCode,
      waitingForInput: false,
    };

    this.executionGenerator = interpreter.stepThroughWithState(program, sourceCode);

    return this.context;
  }

  /**
   * Advance execution by one step and capture all state
   */
  step(): DebugStep | null {
    if (!this.context || !this.executionGenerator) return null;

    try {
      const result = this.executionGenerator.next();

      if (result.done) {
        this.context.waitingForInput = false;
        return this.recordStep({
          nodeId: '',
          nodeType: 'Program',
          sourceLocation: null,
          isComplete: true,
        });
      }

      const event = result.value;
      const waitingForInput = event.nodeType === 'InputPrompt';
      this.context.waitingForInput = waitingForInput;
      this.context.inputPrompt = waitingForInput ? event.prompt || '' : undefined;

      return this.recordStep({
        nodeId: event.nodeId,
        nodeType: event.nodeType,
        sourceLocation: event.loc,
        variables: event.variables,
        callStack: event.callStack,
        isComplete: false,
        ...(waitingForInput && { waitingForInput: true, inputPrompt: event.prompt || '' }),
      });
    } catch (error: any) {
      // An InputPrompt escaping the generator means it can no longer resume —
      // record the pause so the UI can collect input, though stepping past it
      // requires the paths inside the generator (which all handle it there).
      if (error instanceof InputPrompt) {
        this.context.waitingForInput = true;
        this.context.inputPrompt = error.prompt;
        return this.recordStep({
          nodeId: '',
          nodeType: 'InputPrompt',
          sourceLocation: null,
          isComplete: false,
          waitingForInput: true,
          inputPrompt: error.prompt,
        });
      }

      return this.recordStep({
        nodeId: '',
        nodeType: 'Error',
        sourceLocation: null,
        isComplete: true,
        error: error.message,
      });
    }
  }

  /** Fills in the shared step fields (variables, output, numbering) and stores the step. */
  private recordStep(
    partial: Omit<DebugStep, 'stepNumber' | 'output' | 'variables' | 'callStack'> &
      Partial<Pick<DebugStep, 'variables' | 'callStack'>>
  ): DebugStep {
    const context = this.context!;
    const callStack = partial.callStack ?? context.interpreter.getStackFrames();
    const globals = callStack[0]?.variables ?? {};
    const locals = callStack[callStack.length - 1]?.variables ?? {};
    const step: DebugStep = {
      variables: partial.variables ?? { ...globals, ...locals },
      callStack,
      output: [...context.interpreter.getOutput()],
      stepNumber: context.steps.length,
      ...partial,
    };
    context.steps.push(step);
    context.currentStep = context.steps.length - 1;
    return step;
  }

  /**
   * Get current debug step
   */
  getCurrentStep(): DebugStep | null {
    if (!this.context || this.context.currentStep < 0) return null;
    return this.context.steps[this.context.currentStep] || null;
  }

  /**
   * Get all collected steps
   */
  getSteps(): DebugStep[] {
    return this.context?.steps || [];
  }

  /**
   * Reset debugger state
   */
  reset(): void {
    if (this.context) {
      this.context.currentStep = 0;
      this.context.steps = [];
      this.executionGenerator = null;
    }
  }

  /**
   * Provide input to the debugger and resume execution
   */
  provideInput(input: string): void {
    if (!this.context) return;
    this.context.interpreter.addInput(input);
    this.context.waitingForInput = false;
  }

  /**
   * Check if debugger is waiting for input
   */
  isWaitingForInput(): boolean {
    return this.context?.waitingForInput || false;
  }

  /**
   * Get the current input prompt
   */
  getInputPrompt(): string {
    return this.context?.inputPrompt || '';
  }
}
