/**
 * CSP (Communicating Sequential Processes) lexer that tokenizes CSP pseudocode source.
 * Handles CSP-specific keywords like PROCEDURE, REPEAT UNTIL, and FROM...TO syntax.
 */

import type { Token } from '../lexer';

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
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      if (/\s/.test(char)) {
        this.pos++;
        continue;
      }

      // Comments
      if (char === '/' && this.input[this.pos + 1] === '/') {
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') this.pos++;
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
          'FROM',
          'TO',
          'STEP',
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
          'CLASS',
          'PRIVATE',
          'PUBLIC',
          'CONSTRUCTOR',
          'THIS',
          'NEW',
        ];
        const type = keywords.includes(value) ? 'KEYWORD' : 'IDENTIFIER';
        if (value === 'true' || value === 'false') tokens.push({ type: 'BOOLEAN', value, start });
        else tokens.push({ type, value, start });
        continue;
      }

      // Unicode symbols for assignment and relational operators
      if (char === '←') {
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

      if (['+', '-', '*', '/', '=', '>', '<', '(', ')', '{', '}', '[', ']', ','].includes(char)) {
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
    return tokens;
  }
}
