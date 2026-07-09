/**
 * JavaScript lexer that tokenizes JavaScript source code.
 * Handles JS-specific keywords, operators, and syntax including
 * let/const/var declarations, === strict equality, template literals,
 * and single-quoted strings.
 */

import type { Token } from '../lexer';
import { ownLineAt, type SourceComment } from '../comments';

const JS_KEYWORDS = new Set([
  'let',
  'const',
  'var',
  'function',
  'class',
  'extends',
  'new',
  'return',
  'if',
  'else',
  'while',
  'for',
  'do',
  'of',
  'in',
  'break',
  'continue',
  'switch',
  'case',
  'default',
  'try',
  'catch',
  'finally',
  'throw',
  'true',
  'false',
  'null',
  'undefined',
  'this',
  'super',
  'static',
  'import',
  'export',
  'from',
  'typeof',
  'instanceof',
  'void',
  'delete',
  'async',
  'await',
]);

export class JavaScriptLexer {
  private pos = 0;
  private input: string;

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    const comments: SourceComment[] = [];
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      // Whitespace
      if (/\s/.test(char)) {
        this.pos++;
        continue;
      }

      // Single-line comment
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

      // Block comment
      if (char === '/' && this.input[this.pos + 1] === '*') {
        this.pos += 2;
        while (this.pos < this.input.length - 1) {
          if (this.input[this.pos] === '*' && this.input[this.pos + 1] === '/') {
            this.pos += 2;
            break;
          }
          this.pos++;
        }
        continue;
      }

      // Numbers (including floats and hex)
      if (/\d/.test(char) || (char === '.' && /\d/.test(this.input[this.pos + 1] ?? ''))) {
        const start = this.pos;
        let value = '';
        if (
          char === '0' &&
          (this.input[this.pos + 1] === 'x' || this.input[this.pos + 1] === 'X')
        ) {
          value += this.input[this.pos++] + this.input[this.pos++];
          while (this.pos < this.input.length && /[0-9a-fA-F]/.test(this.input[this.pos])) {
            value += this.input[this.pos++];
          }
        } else {
          while (
            this.pos < this.input.length &&
            (/\d/.test(this.input[this.pos]) || this.input[this.pos] === '.')
          ) {
            value += this.input[this.pos++];
          }
          // Scientific notation
          if (this.pos < this.input.length && /[eE]/.test(this.input[this.pos])) {
            value += this.input[this.pos++];
            if (this.pos < this.input.length && /[+-]/.test(this.input[this.pos]))
              value += this.input[this.pos++];
            while (this.pos < this.input.length && /\d/.test(this.input[this.pos]))
              value += this.input[this.pos++];
          }
        }
        tokens.push({ type: 'NUMBER', value, start });
        continue;
      }

      // Double-quoted strings
      if (char === '"') {
        const start = this.pos++;
        let value = '';
        while (this.pos < this.input.length && this.input[this.pos] !== '"') {
          if (this.input[this.pos] === '\\') {
            this.pos++;
            const esc = this.input[this.pos++];
            switch (esc) {
              case 'n':
                value += '\n';
                break;
              case 't':
                value += '\t';
                break;
              case 'r':
                value += '\r';
                break;
              default:
                value += esc;
            }
          } else {
            value += this.input[this.pos++];
          }
        }
        this.pos++; // closing "
        tokens.push({ type: 'STRING', value, start });
        continue;
      }

      // Single-quoted strings
      if (char === "'") {
        const start = this.pos++;
        let value = '';
        while (this.pos < this.input.length && this.input[this.pos] !== "'") {
          if (this.input[this.pos] === '\\') {
            this.pos++;
            const esc = this.input[this.pos++];
            switch (esc) {
              case 'n':
                value += '\n';
                break;
              case 't':
                value += '\t';
                break;
              case 'r':
                value += '\r';
                break;
              default:
                value += esc;
            }
          } else {
            value += this.input[this.pos++];
          }
        }
        this.pos++; // closing '
        tokens.push({ type: 'STRING', value, start });
        continue;
      }

      // Template literals — treat as plain string (no interpolation)
      if (char === '`') {
        const start = this.pos++;
        let value = '';
        while (this.pos < this.input.length && this.input[this.pos] !== '`') {
          if (this.input[this.pos] === '\\') {
            this.pos++;
            value += this.input[this.pos++];
          } else {
            value += this.input[this.pos++];
          }
        }
        this.pos++; // closing `
        tokens.push({ type: 'STRING', value, start });
        continue;
      }

      // Identifiers and keywords
      if (/[a-zA-Z_$]/.test(char)) {
        const start = this.pos;
        let value = '';
        while (this.pos < this.input.length && /[a-zA-Z0-9_$]/.test(this.input[this.pos])) {
          value += this.input[this.pos++];
        }
        if (value === 'true' || value === 'false') {
          tokens.push({ type: 'BOOLEAN', value, start });
        } else if (JS_KEYWORDS.has(value)) {
          tokens.push({ type: 'KEYWORD', value, start });
        } else {
          tokens.push({ type: 'IDENTIFIER', value, start });
        }
        continue;
      }

      // Multi-character operators (order matters — longest first)
      const multiOps = [
        '===',
        '!==',
        '**=',
        '>>>=',
        '<<=',
        '>>=',
        '**',
        '||',
        '&&',
        '??',
        '++',
        '--',
        '+=',
        '-=',
        '*=',
        '/=',
        '%=',
        '&=',
        '|=',
        '^=',
        '<<',
        '>>',
        '>>>',
        '=>',
        '<=',
        '>=',
        '==',
        '!=',
      ];
      let matched = false;
      for (const op of multiOps) {
        if (this.input.startsWith(op, this.pos)) {
          const start = this.pos;
          this.pos += op.length;
          // Normalise strict equality to regular equality for our AST
          const normalized = op === '===' ? '==' : op === '!==' ? '!=' : op;
          tokens.push({ type: 'OPERATOR', value: normalized, start });
          matched = true;
          break;
        }
      }
      if (matched) continue;

      // Single-character operators
      if ('+-*/%&|^~!<>='.includes(char)) {
        tokens.push({ type: 'OPERATOR', value: char, start: this.pos++ });
        continue;
      }

      // Punctuation
      if ('(){}[];,.:?'.includes(char)) {
        tokens.push({ type: 'PUNCTUATION', value: char, start: this.pos++ });
        continue;
      }

      // Unknown character — skip
      this.pos++;
    }

    tokens.push({ type: 'EOF', value: '', start: this.pos });
    (tokens as any).comments = comments;
    (tokens as any).source = this.input;
    return tokens;
  }
}
