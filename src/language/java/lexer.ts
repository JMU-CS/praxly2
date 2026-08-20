/**
 * Java lexer that tokenizes Java source code.
 * Handles Java-specific keywords, operators, and syntax elements.
 */

import type { Token } from '../lexer';
import { ownLineAt, type SourceComment } from '../comments';

export class JavaLexer {
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
        // Numeric literal suffix (9000000L, 98.6f, 1.5d) — consumed into the same
        // token so it isn't split off as a stray identifier; the parser's parseFloat()
        // already stops at (and ignores) a trailing non-numeric character.
        if (this.pos < this.input.length && /[lLfFdD]/.test(this.input[this.pos])) {
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

      // Char literal: a single character in single quotes, with escape handling.
      if (char === "'") {
        const start = this.pos;
        this.pos++;
        let value = '';
        while (this.pos < this.input.length && this.input[this.pos] !== "'") {
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
        if (value.length !== 1) {
          throw new Error(`Char literal must be exactly one character: '${value}'`);
        }
        tokens.push({ type: 'CHAR', value, start });
        continue;
      }

      if (/[a-zA-Z_]/.test(char)) {
        const start = this.pos;
        let value = '';
        while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
          value += this.input[this.pos++];
        }
        // Keywords including OOP-related keywords
        const keywords = [
          'public',
          'class',
          'static',
          'void',
          'int',
          'double',
          'boolean',
          'if',
          'else',
          'while',
          'for',
          'do',
          'return',
          'true',
          'false',
          'var',
          'new',
          'private',
          'protected',
          'extends',
          'this',
          'null',
          'final',
          'String',
          'char',
          'byte',
          'short',
          'float',
          'long',
          'switch',
          'case',
          'default',
          'break',
          'continue',
          'try',
          'catch',
          'finally',
        ];
        const type = keywords.includes(value) ? 'KEYWORD' : 'IDENTIFIER';
        if (value === 'true' || value === 'false') tokens.push({ type: 'BOOLEAN', value, start });
        else tokens.push({ type, value, start });
        continue;
      }

      if (['+', '-', '*', '/', '=', '>', '<', '!', '&', '|', '%'].includes(char)) {
        const start = this.pos;
        const next = this.input[this.pos + 1];
        if (char === '=' && next === '=') {
          tokens.push({ type: 'OPERATOR', value: '==', start });
          this.pos += 2;
          continue;
        }
        if (char === '!' && next === '=') {
          tokens.push({ type: 'OPERATOR', value: '!=', start });
          this.pos += 2;
          continue;
        }
        if (char === '&' && next === '&') {
          tokens.push({ type: 'OPERATOR', value: '&&', start });
          this.pos += 2;
          continue;
        }
        if (char === '|' && next === '|') {
          tokens.push({ type: 'OPERATOR', value: '||', start });
          this.pos += 2;
          continue;
        }
        if (char === '<' && next === '=') {
          tokens.push({ type: 'OPERATOR', value: '<=', start });
          this.pos += 2;
          continue;
        }
        if (char === '>' && next === '=') {
          tokens.push({ type: 'OPERATOR', value: '>=', start });
          this.pos += 2;
          continue;
        }
        if (char === '+' && next === '+') {
          tokens.push({ type: 'OPERATOR', value: '++', start });
          this.pos += 2;
          continue;
        }
        if (char === '-' && next === '-') {
          tokens.push({ type: 'OPERATOR', value: '--', start });
          this.pos += 2;
          continue;
        }
        if (char === '+' && next === '=') {
          tokens.push({ type: 'OPERATOR', value: '+=', start });
          this.pos += 2;
          continue;
        }
        if (char === '-' && next === '=') {
          tokens.push({ type: 'OPERATOR', value: '-=', start });
          this.pos += 2;
          continue;
        }
        if (char === '*' && next === '=') {
          tokens.push({ type: 'OPERATOR', value: '*=', start });
          this.pos += 2;
          continue;
        }
        if (char === '/' && next === '=') {
          tokens.push({ type: 'OPERATOR', value: '/=', start });
          this.pos += 2;
          continue;
        }
        if (char === '%' && next === '=') {
          tokens.push({ type: 'OPERATOR', value: '%=', start });
          this.pos += 2;
          continue;
        }

        tokens.push({ type: 'OPERATOR', value: char, start: this.pos++ });
        continue;
      }

      if (['(', ')', '{', '}', '[', ']', ';', ',', '.', ':', '?'].includes(char)) {
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
