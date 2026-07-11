/**
 * Praxis lexer that tokenizes Praxis pseudo-code source.
 * Handles Praxis-specific syntax including type keywords and procedural declarations.
 */

import type { Token } from '../lexer';
import { ownLineAt, type SourceComment } from '../comments';

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
    const comments: SourceComment[] = [];
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      // Skip whitespace
      if (/\s/.test(char)) {
        this.pos++;
        continue;
      }

      // Single-line Comments
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

      // `/* ... */` is a placeholder for missing exam-question code, not a
      // comment — emit a PLACEHOLDER token carrying the inner text.
      if (char === '/' && this.input[this.pos + 1] === '*') {
        const start = this.pos;
        this.pos += 2;
        const textStart = this.pos;
        while (
          this.pos < this.input.length &&
          !(this.input[this.pos] === '*' && this.input[this.pos + 1] === '/')
        ) {
          this.pos++;
        }
        const text = this.input.slice(textStart, this.pos).trim();
        this.pos += 2; // skip */
        tokens.push({ type: 'PLACEHOLDER', value: text, start });
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

      // Strings (double-quoted) and char literals (single-quoted), with escape
      // sequences. A char literal must resolve to exactly one character.
      if (char === '"' || char === "'") {
        const quote = char;
        const start = this.pos;
        this.pos++;
        let value = '';
        while (this.pos < this.input.length && this.input[this.pos] !== quote) {
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
        this.pos++; // closing quote
        if (quote === "'") {
          if (value.length !== 1) {
            throw new Error(`Char literal must be exactly one character: '${value}'`);
          }
          tokens.push({ type: 'CHAR', value, start });
        } else {
          tokens.push({ type: 'STRING', value, start });
        }
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
          'break',
          'continue',
          'try',
          'catch',
          'finally',
          'print',
          'and',
          'or',
          'not',
          'true',
          'false',
          'class',
          'extends',
          'new',
          'super',
          'public',
          'private',
          'null',
          'procedure',
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
      if (operators.includes(char) || ['←', '⟵', '≠', '≥', '≤'].includes(char)) {
        const start = this.pos;

        // Increment / Decrement
        if (char === '+' && this.input[this.pos + 1] === '+') {
          tokens.push({ type: 'OPERATOR', value: '++', start });
          this.pos += 2;
          continue;
        }
        if (char === '-' && this.input[this.pos + 1] === '-') {
          tokens.push({ type: 'OPERATOR', value: '--', start });
          this.pos += 2;
          continue;
        }

        // Multi-character Assignments and Comparisons
        if (char === '<' && this.input[this.pos + 1] === '-') {
          tokens.push({ type: 'OPERATOR', value: '<-', start });
          this.pos += 2;
          continue;
        }
        if (['<', '>', '!', '='].includes(char) && this.input[this.pos + 1] === '=') {
          tokens.push({ type: 'OPERATOR', value: char + '=', start });
          this.pos += 2;
          continue;
        }

        // Praxis Specific Unicode Math Symbols
        if (char === '←' || char === '⟵') {
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
    (tokens as any).comments = comments;
    (tokens as any).source = this.input;
    return tokens;
  }
}
