/**
 * Praxis lexer that tokenizes Praxis pseudo-code source.
 * Handles Praxis-specific syntax including type keywords and procedural declarations.
 */

import type { Token } from '../lexer';

export class PraxisLexer {
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

      // Skip whitespace
      if (/\s/.test(char)) {
        this.pos++;
        continue;
      }

      // Single-line Comments
      if (char === '/' && this.input[this.pos + 1] === '/') {
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') this.pos++;
        continue;
      }

      // Multi-line Comments (useful for the '/* missing code */' found in Praxis examples)
      if (char === '/' && this.input[this.pos + 1] === '*') {
        this.pos += 2;
        while (
          this.pos < this.input.length &&
          !(this.input[this.pos] === '*' && this.input[this.pos + 1] === '/')
        ) {
          this.pos++;
        }
        this.pos += 2; // skip */
        continue;
      }

      // Numbers
      if (/\d/.test(char)) {
        let value = '';
        const start = this.pos;
        while (this.pos < this.input.length && /\d/.test(this.input[this.pos])) {
          value += this.input[this.pos++];
        }
        // Check for decimal point, but not ".." range operator
        if (
          this.input[this.pos] === '.' &&
          this.input[this.pos + 1] !== '.' &&
          /\d/.test(this.input[this.pos + 1])
        ) {
          value += this.input[this.pos++]; // consume the .
          while (this.pos < this.input.length && /\d/.test(this.input[this.pos])) {
            value += this.input[this.pos++];
          }
        }
        tokens.push({ type: 'NUMBER', value, start });
        continue;
      }

      // Strings
      if (char === '"' || char === "'") {
        const quote = char;
        const start = this.pos;
        this.pos++;
        let value = '';
        while (this.pos < this.input.length && this.input[this.pos] !== quote) {
          value += this.input[this.pos++];
        }
        this.pos++;
        tokens.push({ type: 'STRING', value, start });
        continue;
      }

      // Identifiers and Keywords
      if (/[a-zA-Z_]/.test(char)) {
        const start = this.pos;
        let value = '';
        while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
          value += this.input[this.pos++];
        }

        const keywords = [
          'if',
          'else',
          'end',
          'while',
          'do',
          'for',
          'repeat',
          'until',
          'return',
          'print',
          'and',
          'or',
          'not',
          'true',
          'false',
          'mod',
          'in',
          'class',
          'extends',
          'new',
          'public',
          'private',
          'null',
          'procedure',
          'function',
          'boolean',
          'char',
          'double',
          'float',
          'int',
          'short',
          'string',
          'void',
        ];

        const lowerValue = value.toLowerCase();
        const type = keywords.includes(lowerValue) ? 'KEYWORD' : 'IDENTIFIER';

        // Normalize boolean values
        if (lowerValue === 'true') tokens.push({ type: 'BOOLEAN', value: 'true', start });
        else if (lowerValue === 'false') tokens.push({ type: 'BOOLEAN', value: 'false', start });
        else if (lowerValue === 'null') tokens.push({ type: 'KEYWORD', value: 'null', start });
        else tokens.push({ type, value, start });
        continue;
      }

      // Operators and Punctuation
      const operators = [
        '+',
        '-',
        '*',
        '/',
        '%',
        '^',
        '=',
        '>',
        '<',
        '!',
        '(',
        ')',
        '[',
        ']',
        '{',
        '}',
        ',',
        '.',
        ';',
        ':',
      ];
      if (operators.includes(char) || ['←', '≠', '≥', '≤'].includes(char)) {
        const start = this.pos;

        // Range operator (..)
        if (char === '.' && this.input[this.pos + 1] === '.') {
          tokens.push({ type: 'OPERATOR', value: '..', start });
          this.pos += 2;
          continue;
        }

        // Multi-character Assignments and Comparisons
        if (char === '<' && this.input[this.pos + 1] === '-') {
          tokens.push({ type: 'OPERATOR', value: '<-', start });
          this.pos += 2;
          continue;
        }
        if (char === '<' && this.input[this.pos + 1] === '>') {
          tokens.push({ type: 'OPERATOR', value: '<>', start });
          this.pos += 2;
          continue;
        }
        if (['<', '>', '!', '='].includes(char) && this.input[this.pos + 1] === '=') {
          tokens.push({ type: 'OPERATOR', value: char + '=', start });
          this.pos += 2;
          continue;
        }

        // Praxis Specific Unicode Math Symbols
        if (char === '←') {
          tokens.push({ type: 'OPERATOR', value: '<-', start: this.pos++ });
          continue;
        }
        if (char === '≠') {
          tokens.push({ type: 'OPERATOR', value: '!=', start: this.pos++ });
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

        // Map symbols accurately to Operator vs Punctuation buckets
        if (['+', '-', '*', '/', '%', '^', '>', '<', '='].includes(char)) {
          tokens.push({ type: 'OPERATOR', value: char, start: this.pos++ });
        } else {
          tokens.push({ type: 'PUNCTUATION', value: char, start: this.pos++ });
        }
        continue;
      }

      throw new Error(`Unexpected character: ${char} at position ${this.pos}`);
    }
    tokens.push({ type: 'EOF', value: '', start: this.pos });
    return tokens;
  }
}
