/**
 * CSP (Communicating Sequential Processes) lexer that tokenizes CSP pseudocode source.
 * Handles CSP-specific keywords like PROCEDURE, REPEAT UNTIL, and FROM...TO syntax.
 */

import type { Token } from '../lexer';
import { ownLineAt, type SourceComment } from '../comments';

export class CSPLexer {
  private pos = 0;
  private input: string;

  /**
   * Creates a new instance.
   */
  constructor(input: string) {
    this.input = input;
  }

  /**
   * Tokenizes the source input into lexical tokens.
   */
  tokenize(): Token[] {
    const tokens: Token[] = [];
    const comments: SourceComment[] = [];
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      if (/\s/.test(char)) {
        this.pos++;
        continue;
      }

      // Comments
      if (char === '/' && this.input[this.pos + 1] === '/') {
        const cStart = this.pos;
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') this.pos++;
        comments.push({
          text: this.input.slice(cStart + 2, this.pos).trim(),
          start: cStart,
          end: this.pos,
          ownLine: ownLineAt(this.input, cStart),
        });
        continue;
      }

      if (/\d/.test(char)) {
        let value = '';
        const start = this.pos;
        while (
          this.pos < this.input.length &&
          (/\d/.test(this.input[this.pos]) || this.input[this.pos] === '.')
        ) {
          value += this.input[this.pos++];
        }
        tokens.push({ type: 'NUMBER', value, start });
        continue;
      }

      if (char === '"') {
        const start = this.pos;
        this.pos++;
        let value = '';
        while (this.pos < this.input.length && this.input[this.pos] !== '"') {
          const c = this.input[this.pos];
          if (c === '\\' && this.pos + 1 < this.input.length) {
            const next = this.input[this.pos + 1];
            const escapes: Record<string, string> = {
              n: '\n',
              t: '\t',
              r: '\r',
              '0': '\0',
              '\\': '\\',
              '"': '"',
              "'": "'",
            };
            value += next in escapes ? escapes[next] : next;
            this.pos += 2;
            continue;
          }
          value += this.input[this.pos++];
        }
        this.pos++;
        tokens.push({ type: 'STRING', value, start });
        continue;
      }

      if (/[a-zA-Z_]/.test(char)) {
        const start = this.pos;
        let value = '';
        while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
          value += this.input[this.pos++];
        }
        const keywords = [
          'IF',
          'ELSE',
          'REPEAT',
          'UNTIL',
          'TIMES',
          'FOR',
          'EACH',
          'IN',
          'PROCEDURE',
          'RETURN',
          'DISPLAY',
          'INPUT',
          'NOT',
          'AND',
          'OR',
          'MOD',
          'true',
          'false',
        ];
        const type = keywords.includes(value) ? 'KEYWORD' : 'IDENTIFIER';
        if (value === 'true' || value === 'false') tokens.push({ type: 'BOOLEAN', value, start });
        else tokens.push({ type, value, start });
        continue;
      }

      // Unicode symbols for assignment and relational operators
      if (char === '←' || char === '⟵') {
        tokens.push({ type: 'OPERATOR', value: '<-', start: this.pos++ });
        continue;
      }
      if (char === '≠') {
        tokens.push({ type: 'OPERATOR', value: '<>', start: this.pos++ });
        continue;
      }
      if (char === '≥') {
        tokens.push({ type: 'OPERATOR', value: '>=', start: this.pos++ });
        continue;
      }
      if (char === '≤') {
        tokens.push({ type: 'OPERATOR', value: '<=', start: this.pos++ });
        continue;
      }

      if (
        ['+', '-', '*', '/', '=', '>', '<', '!', '(', ')', '{', '}', '[', ']', ','].includes(char)
      ) {
        const start = this.pos;
        // Check for <-
        if (char === '<' && this.input[this.pos + 1] === '-') {
          tokens.push({ type: 'OPERATOR', value: '<-', start });
          this.pos += 2;
          continue;
        }
        // Check for <> (Not Equal)
        if (char === '<' && this.input[this.pos + 1] === '>') {
          tokens.push({ type: 'OPERATOR', value: '<>', start });
          this.pos += 2;
          continue;
        }
        // Check for <=, >=, !=
        if (['<', '>', '!'].includes(char) && this.input[this.pos + 1] === '=') {
          tokens.push({ type: 'OPERATOR', value: char + '=', start });
          this.pos += 2;
          continue;
        }

        if (['+', '-', '*', '/', '=', '<', '>'].includes(char)) {
          tokens.push({ type: 'OPERATOR', value: char, start: this.pos++ });
          continue;
        }

        tokens.push({ type: 'PUNCTUATION', value: char, start: this.pos++ });
        continue;
      }

      throw new Error(`Unexpected character: ${char} at position ${this.pos}`);
    }
    tokens.push({ type: 'EOF', value: '', start: this.pos });
    (tokens as any).comments = comments;
    (tokens as any).source = this.input;
    return tokens;
  }
}
