/**
 * Minimal typings for Blockly's JSON workspace serialization format
 * (Blockly.serialization.workspaces.save/load). Only the fields the
 * converters read/write are modeled.
 *
 * In the Blocks language, this JSON — stringified — *is* the source code:
 * it flows through the app as the editor's `code` string, and
 * `blocksToProgram` / `programToBlocks` play the role of parser / emitter.
 */

export interface BlockState {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlockState; shadow?: BlockState }>;
  next?: { block: BlockState };
  extraState?: unknown;
}

export interface WorkspaceState {
  blocks?: { languageVersion: number; blocks: BlockState[] };
  variables?: Array<{ name: string; id: string }>;
}

/** Resolves an input to its connected block (falling back to the shadow). */
export function inputBlock(state: BlockState, name: string): BlockState | undefined {
  const input = state.inputs?.[name];
  return input?.block ?? input?.shadow;
}
