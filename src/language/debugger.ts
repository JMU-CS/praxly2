/**
 * Debugger implementation that provides step-by-step code execution with variable inspection.
 * Tracks execution state and maps debug information back to source code locations.
 */

import type { Program, ASTNode } from './ast';
import { Interpreter } from './interpreter';
import { Translator } from './translator';

export type SupportedLang = 'python' | 'java' | 'csp' | 'praxis' | 'ast';

/**
 * Represents a single execution step with all relevant debug information
 */
export interface DebugStep {
  stepNumber: number;
  nodeId: string;
  nodeType: string;
  sourceLocation: { start: number; end: number } | null;
  variables: Record<string, any>;
  output: string[];
  isComplete: boolean;
  error?: string;
}

/**
 * Maps AST node IDs to line numbers in translated code
 */
export interface SourceMap {
  [nodeId: string]: {
    language: SupportedLang;
    lineStart: number;
    lineEnd: number;
    columnStart?: number;
    columnEnd?: number;
  };
}

/**
 * Debug context that maintains state across stepping operations
 */
export interface DebugContext {
  program: Program;
  sourceLang: SupportedLang;
  interpreter: Interpreter;
  translator: Translator;
  steps: DebugStep[];
  currentStep: number;
  isRunning: boolean;
  sourceMaps: Map<SupportedLang, SourceMap>;
}

/**
 * Main debugger class that orchestrates stepping through code
 * with execution state tracking and source mapping
 */
export class Debugger {
  private context: DebugContext | null = null;
  private executionGenerator: Generator<any, any, any> | null = null;

  /**
   * Initialize debugger with a program and source language
   */
  init(program: Program, sourceLang: SupportedLang): DebugContext {
    const interpreter = new Interpreter();
    const translator = new Translator();

    this.context = {
      program,
      sourceLang,
      interpreter,
      translator,
      steps: [],
      currentStep: 0,
      isRunning: false,
      sourceMaps: new Map(),
    };

    // Generate source maps for all target languages
    const targetLanguages: SupportedLang[] = ['python', 'java', 'csp', 'praxis'];
    for (const lang of targetLanguages) {
      if (lang !== 'ast') {
        const sourceMap = this.generateSourceMap(program, lang as any);
        this.context.sourceMaps.set(lang, sourceMap);
      }
    }

    // Initialize execution generator
    this.executionGenerator = (interpreter as any).stepThroughWithState(program);

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
        return {
          stepNumber: this.context.steps.length,
          nodeId: '',
          nodeType: 'Program',
          sourceLocation: null,
          variables: this.extractVariables(),
          output: (this.context.interpreter as any).getOutput?.() || [],
          isComplete: true,
        };
      }

      const { nodeId, nodeType, loc, variables } = result.value;
      const step: DebugStep = {
        stepNumber: this.context.steps.length,
        nodeId,
        nodeType,
        sourceLocation: loc || null,
        variables,
        output: (this.context.interpreter as any).getOutput?.() || [],
        isComplete: false,
      };

      this.context.steps.push(step);
      this.context.currentStep = this.context.steps.length - 1;

      return step;
    } catch (error: any) {
      const errorStep: DebugStep = {
        stepNumber: this.context.steps.length,
        nodeId: '',
        nodeType: 'Error',
        sourceLocation: null,
        variables: this.extractVariables(),
        output: (this.context.interpreter as any).getOutput?.() || [],
        isComplete: true,
        error: error.message,
      };

      this.context.steps.push(errorStep);
      return errorStep;
    }
  }

  /**
   * Get current debug step
   */
  getCurrentStep(): DebugStep | null {
    if (!this.context || this.context.currentStep < 0) return null;
    return this.context.steps[this.context.currentStep] || null;
  }

  /**
   * Get the line number range in the source language for a node
   */
  getSourceLineRange(): { start: number; end: number } | null {
    const currentStep = this.getCurrentStep();
    if (!currentStep || !currentStep.sourceLocation) return null;

    return {
      start: currentStep.sourceLocation.start,
      end: currentStep.sourceLocation.end,
    };
  }

  /**
   * Get line number ranges in translated language
   */
  getTranslatedLineRange(
    nodeId: string,
    targetLang: SupportedLang
  ): { start: number; end: number } | null {
    if (!this.context) return null;

    const sourceMap = this.context.sourceMaps.get(targetLang);
    if (!sourceMap || !sourceMap[nodeId]) return null;

    const mapping = sourceMap[nodeId];
    return {
      start: mapping.lineStart,
      end: mapping.lineEnd,
    };
  }

  /**
   * Get all translated line ranges for current step
   */
  getAllTranslatedRanges(targetLang: SupportedLang): { start: number; end: number } | null {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return null;

    return this.getTranslatedLineRange(currentStep.nodeId, targetLang);
  }

  /**
   * Generate a source map for a target language
   * Maps AST node IDs to their positions in translated code
   */
  private generateSourceMap(program: Program, targetLang: SupportedLang): SourceMap {
    const sourceMap: SourceMap = {};

    try {
      this.context!.translator.translate(
        program,
        targetLang === 'ast' ? 'python' : (targetLang as any)
      );

      // Parse the translated code to build line mappings
      let currentLine = 1;

      const walkAST = (node: ASTNode) => {
        if (node?.loc) {
          // Map this node to the corresponding line in translated code
          // For now, use a simple heuristic: estimate line position based on node depth
          // This can be enhanced with more sophisticated source mapping
          sourceMap[node.id] = {
            language: targetLang,
            lineStart: currentLine,
            lineEnd: currentLine,
          };
        }

        // Recursively walk children
        for (const key in node) {
          const child = (node as any)[key];
          if (child && typeof child === 'object') {
            if (Array.isArray(child)) {
              child.forEach((c) => {
                if (c && typeof c === 'object' && 'type' in c) {
                  walkAST(c);
                  currentLine++;
                }
              });
            } else if ('type' in child) {
              walkAST(child);
            }
          }
        }
      };

      walkAST(program);
    } catch (e) {
      // If source mapping fails, return empty map
    }

    return sourceMap;
  }

  /**
   * Extract current variable state from the interpreter's environment
   */
  private extractVariables(): Record<string, any> {
    if (!this.context) return {};

    // Access the interpreter's environment
    const interpreter = this.context.interpreter as any;
    const env = interpreter.globalEnv || interpreter.currentEnv;

    if (!env) return {};

    try {
      // Extract all variables from the current environment
      const variables: Record<string, any> = {};

      // Try to get values property from the environment
      if (env.values) {
        return { ...env.values };
      }

      // Fallback: try to extract via reflection
      for (const key in env) {
        if (key !== 'parent' && typeof env[key] !== 'function') {
          variables[key] = env[key];
        }
      }

      return variables;
    } catch (e) {
      return {};
    }
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
   * Get debugging context
   */
  getContext(): DebugContext | null {
    return this.context;
  }

  /**
   * Get all collected steps
   */
  getSteps(): DebugStep[] {
    return this.context?.steps || [];
  }
}
