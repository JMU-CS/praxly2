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
