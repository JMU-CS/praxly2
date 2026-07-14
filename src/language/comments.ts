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
import { generateId } from './ast';

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

// Statement/declaration node types whose child bodies may contain blank lines.
// (Blank lines inside these get their own recursion pass.)
const childBodiesOf = (stmt: any): Statement[][] => {
  const bodies: Statement[][] = [];
  switch (stmt?.type) {
    case 'If':
      bodies.push(stmt.thenBranch.body);
      if (stmt.elseBranch) bodies.push(stmt.elseBranch.body);
      break;
    case 'While':
    case 'DoWhile':
    case 'RepeatUntil':
    case 'For':
    case 'ForEach':
      bodies.push(stmt.body.body);
      break;
    case 'Try':
      bodies.push(stmt.body.body);
      for (const h of stmt.handlers ?? []) bodies.push(h.body.body);
      if (stmt.finallyBlock) bodies.push(stmt.finallyBlock.body);
      break;
    case 'Switch':
      for (const c of stmt.cases ?? []) bodies.push(c.consequent);
      break;
    case 'FunctionDeclaration':
    case 'MethodDeclaration':
    case 'Constructor':
      bodies.push(stmt.body.body);
      break;
    case 'ClassDeclaration':
      bodies.push(stmt.body);
      break;
  }
  return bodies;
};

/**
 * Inserts `BlankLine` no-op nodes into `program` so translated output keeps the
 * source's blank lines (for side-by-side comparison). Language-agnostic: keys
 * off statement `loc` and the source, mirroring `attachComments`, and runs
 * immediately after it.
 *
 * For each adjacent pair of statements in a body array (both must have `loc`),
 * it counts the whitespace-only source lines that fall *before* the following
 * statement's leading-comment run and inserts one `BlankLine` per such line.
 * Blank lines *inside/after* a leading-comment run are intentionally dropped so
 * the comment stays adjacent to its statement (never misplaced). Runs of blank
 * lines are preserved verbatim (one node per line).
 *
 * `consumed` holds start offsets of comments the parser already claimed for
 * other purposes; those are ignored when locating a leading-comment run, as in
 * `attachComments`.
 */
export function insertBlankLines(
  program: Program,
  comments: SourceComment[] | undefined,
  source: string,
  consumed?: Set<number>
): void {
  // offset -> 0-based line number, via newline scan (as in attachComments).
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

  // True when source line `l` (0-based) contains only whitespace.
  const isBlankLine = (l: number): boolean => {
    const start = lineStarts[l];
    const end = l + 1 < lineStarts.length ? lineStarts[l + 1] : source.length;
    return source.slice(start, end).trim() === '';
  };

  // 0-based line numbers that hold an own-line comment (delimiter at line start
  // after only whitespace). Used to locate a statement's leading-comment run.
  const commentLines = new Set(
    (comments ?? []).filter((c) => c.ownLine && !consumed?.has(c.start)).map((c) => lineOf(c.start))
  );

  // Number of blank lines between statement A and B that fall *before* B's
  // leading-comment run. Works purely in line space (never uses `loc.end`,
  // which can overshoot onto the next line via a trailing-newline token — see
  // attachComments): walk up from B through its leading run (own-line comments
  // and blanks, stopping at A's code) to find the run's topmost comment, then
  // count the contiguous blank lines directly above it. Blanks *within/after*
  // the comment run are left uncounted, so the comment stays glued to B.
  const leadingBlankCount = (aStart: number, bStart: number): number => {
    const floorLine = lineOf(aStart);
    const bLine = lineOf(bStart);
    let topComment = -1;
    for (let l = bLine - 1; l > floorLine; l--) {
      if (commentLines.has(l)) topComment = l;
      else if (!isBlankLine(l)) break; // reached A's code
    }
    const anchorLine = topComment >= 0 ? topComment : bLine;
    let count = 0;
    for (let l = anchorLine - 1; l > floorLine && isBlankLine(l); l--) count++;
    return count;
  };

  const processList = (list: Statement[]): void => {
    // Recurse into child bodies first (they are distinct arrays).
    for (const stmt of list) {
      for (const body of childBodiesOf(stmt)) processList(body);
    }
    // Then splice BlankLine nodes between consecutive located statements.
    const result: Statement[] = [];
    for (let i = 0; i < list.length; i++) {
      const cur = list[i];
      const prev = i > 0 ? list[i - 1] : undefined;
      if (prev?.loc && cur.loc) {
        const blanks = leadingBlankCount(prev.loc.start, cur.loc.start);
        for (let b = 0; b < blanks; b++) {
          result.push({ id: generateId(), type: 'BlankLine' });
        }
      }
      result.push(cur);
    }
    list.splice(0, list.length, ...result);
  };

  processList(program.body);
}
