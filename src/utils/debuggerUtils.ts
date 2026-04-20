/**
 * Debugging utility functions for mapping source code locations to AST nodes.
 * Provides line number calculation and node finding for debug highlighting.
 */

import type { Program, ASTNode } from '../language/ast';
import type { SourceMap } from '../language/visitor';

/**
 * Get the line number (1-based) for a character offset
 */
function getLineNumber(code: string, offset: number): number {
  const lines = code.substring(0, offset).split('\n');
  return lines.length;
}

/**
 * Get the starting line number for a character range (0-based for CodeMirror)
 */
export function getRangeLines(code: string, start: number): number[] {
  const startLine = getLineNumber(code, start);
  return [startLine - 1]; // Convert to 0-based for CodeMirror
}

/**
 * Find all AST nodes that span the given source location
 */
export function findNodesAtLocation(program: Program, sourceStart: number): ASTNode[] {
  const foundNodes: ASTNode[] = [];

  const traverse = (node: any): void => {
    if (!node || typeof node !== 'object') return;

    // Check if this node contains the source location
    if (node.loc && node.loc.start <= sourceStart && sourceStart < node.loc.end) {
      if (node.id && node.type) {
        foundNodes.push(node);
      }
    }

    // Traverse children
    if (Array.isArray(node)) {
      node.forEach(traverse);
    } else {
      Object.values(node).forEach(traverse);
    }
  };

  traverse(program);
  return foundNodes;
}

/**
 * Get highlighted line numbers from AST node IDs using a source map
 */
export function getHighlightedLinesFromNodeIds(nodeIds: string[], sourceMap: SourceMap): number[] {
  const lines = new Set<number>();
  for (const nodeId of nodeIds) {
    const lineIndex = sourceMap.get(nodeId);
    if (lineIndex !== undefined) {
      lines.add(lineIndex);
    }
  }
  return Array.from(lines);
}
