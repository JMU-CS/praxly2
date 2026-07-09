/**
 * Language-agnostic comment attachment.
 *
 * Lexers capture single-line comments (delimiter stripped) as SourceComment
 * records; after parsing, `attachComments` associates each with a statement:
 *   - a comment sharing a statement's end line becomes that statement's
 *     `trailingComment` (inline comment after code);
 *   - a run of own-line comments directly above a statement becomes its
 *     `leadingComments`;
 *   - the leading run above the very first statement is pinned to the Program
 *     as `headerComments` so it stays put when an emitter reorders code.
 *
 * The emitters re-add each target language's comment delimiter, so comments
 * translate along with the code.
 */
import type { Program, Statement } from './ast';

export interface SourceComment {
  text: string; // content after the delimiter (delimiter and surrounding space stripped)
  start: number; // char offset of the delimiter
  end: number; // char offset just past the comment
  ownLine: boolean; // true when only whitespace precedes it on its line
}

/** True when only whitespace separates `start` from the previous newline (or BOF). */
export function ownLineAt(input: string, start: number): boolean {
  for (let i = start - 1; i >= 0 && input[i] !== '\n'; i--) {
    if (input[i] !== ' ' && input[i] !== '\t' && input[i] !== '\r') return false;
  }
  return true;
}

// Statement/declaration node types that may carry comments.
const ATTACHABLE = new Set<string>([
  'Assignment',
  'Print',
  'If',
  'While',
  'DoWhile',
  'RepeatUntil',
  'For',
  'Return',
  'ExpressionStatement',
  'Break',
  'Continue',
  'Switch',
  'Try',
  'FunctionDeclaration',
  'ClassDeclaration',
  'MethodDeclaration',
  'FieldDeclaration',
  'Constructor',
  'VariableDeclaration',
]);

/**
 * Attaches `comments` to statements in `program` by source position.
 * `consumed` holds start offsets of comments already claimed by the parser for
 * other purposes (e.g. Praxis print separator/newline metadata); those are
 * skipped so they aren't emitted twice.
 */
export function attachComments(
  program: Program,
  comments: SourceComment[] | undefined,
  source: string,
  consumed?: Set<number>
): void {
  if (!comments || comments.length === 0) return;

  // offset -> 0-based line number, via newline scan.
  const lineStarts: number[] = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') lineStarts.push(i + 1);
  }
  const lineOf = (offset: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  // All comment-attachable nodes, in source order.
  const stmts: Statement[] = [];
  const collect = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (typeof node.type === 'string' && ATTACHABLE.has(node.type) && node.loc) {
      stmts.push(node);
    }
    for (const key in node) {
      if (key === 'loc' || key === 'id') continue;
      const v = node[key];
      if (v && typeof v === 'object') collect(v);
    }
  };
  collect(program.body);
  stmts.sort((a, b) => a.loc!.start - b.loc!.start || a.loc!.end - b.loc!.end);

  const firstStmt = stmts[0];

  for (const c of comments) {
    if (consumed?.has(c.start)) continue;
    const cLine = lineOf(c.start);

    if (!c.ownLine) {
      // Trailing: the statement that starts on this line before the comment,
      // closest to it. (Matched by start line, not end line: some lexers report
      // a statement's end offset past the trailing newline, i.e. on the next
      // line, but a trailing comment always sits on a single-line statement.)
      let best: Statement | undefined;
      for (const s of stmts) {
        if (s.loc!.start <= c.start && lineOf(s.loc!.start) === cLine) {
          if (!best || s.loc!.start > best.loc!.start) best = s;
        }
      }
      if (best) best.trailingComment = c.text;
      continue;
    }

    // Leading: the first statement that starts after this comment.
    let target: Statement | undefined;
    for (const s of stmts) {
      if (s.loc!.start > c.end) {
        target = s;
        break;
      }
    }
    if (!target) continue; // dangling comment at end of block/file — dropped
    (target.leadingComments ??= []).push(c.text);
  }

  // Pin the first statement's leading block to the program as a header so it
  // stays at the top when an emitter hoists/reorders that statement.
  if (firstStmt?.leadingComments) {
    program.headerComments = firstStmt.leadingComments;
    delete firstStmt.leadingComments;
  }
}
