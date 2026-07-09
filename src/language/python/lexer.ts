/**
 * Python lexer that tokenizes Python source code.
 * Handles indentation-based scoping with INDENT/DEDENT tokens.
 */

import type { Token } from '../lexer';
import type { SourceComment } from '../comments';

export class Lexer {
  private pos = 0;
  private input: string;
  private indentStack: number[] = [0];
  private tokens: Token[] = [];
  private comments: SourceComment[] = [];

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
    const lines = this.input.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const indentMatch = line.match(/^\s*/);
      const indentLevel = indentMatch ? indentMatch[0].length : 0;

      // Strip any inline comment (respecting string literals) so a trailing
      // `# ...` on a block-header line doesn't hide the closing colon.
      const code = this.stripInlineComment(line);
      if (code.length < line.length) {
        // A `#` in code position starts a comment running to end of line.
        this.comments.push({
          text: line.slice(code.length + 1).trim(),
          start: this.pos + code.length,
          end: this.pos + line.length,
          ownLine: code.trim() === '',
        });
      }
      const trimmed = code.trim();
      if (trimmed === '') {
        this.pos += line.length + 1;
        continue; // Skip blank and comment-only lines
      }

      // Handle indentation (generates virtual curly braces for scope)
      if (indentLevel > this.indentStack[this.indentStack.length - 1]) {
        this.indentStack.push(indentLevel);
        this.tokens.push({ type: 'PUNCTUATION', value: '{', start: this.pos });
      } else {
        while (indentLevel < this.indentStack[this.indentStack.length - 1]) {
          this.indentStack.pop();
          this.tokens.push({ type: 'PUNCTUATION', value: '}', start: this.pos });
        }
      }

      // Tokenize the visible characters of the line
      this.tokenizeLine(trimmed, this.pos + indentLevel);
      this.pos += line.length + 1; // advance pointer to next line start

      // End of statement marker (virtual semicolon)
      // Only emit if the line didn't end with a colon (colon anticipates a block)
      if (!trimmed.endsWith(':')) {
        this.tokens.push({ type: 'PUNCTUATION', value: ';', start: this.pos - 1 });
      }
    }

    // Dedent remaining scopes
    while (this.indentStack.length > 1) {
      this.indentStack.pop();
      this.tokens.push({ type: 'PUNCTUATION', value: '}', start: this.pos });
    }

    this.tokens.push({ type: 'EOF', value: '', start: this.pos });
    (this.tokens as any).comments = this.comments;
    (this.tokens as any).source = this.input;
    return this.tokens;
  }

  /**
   * Returns the line with any inline `#` comment removed. A `#` inside a
   * string literal is preserved; only a `#` in code position ends the line.
   */
  private stripInlineComment(line: string): string {
    let inString = false;
    let quote = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inString) {
        if (ch === '\\') {
          i++; // skip the escaped character
          continue;
        }
        if (ch === quote) inString = false;
      } else if (ch === '"' || ch === "'") {
        inString = true;
        quote = ch;
      } else if (ch === '#') {
        return line.slice(0, i);
      }
    }
    return line;
  }

  /**
   * Tokenizes the source input into lexical tokens.
   */
  private tokenizeLine(line: string, offset: number) {
    let p = 0;
    while (p < line.length) {
      const char = line[p];

      if (/\s/.test(char)) {
        p++;
        continue;
      }

      if (char === '#') {
        break;
      } // Inline Comment

      if (/\d/.test(char)) {
        let value = '';
        while (p < line.length && (/\d/.test(line[p]) || line[p] === '.')) value += line[p++];
        this.tokens.push({ type: 'NUMBER', value, start: offset + p });
        continue;
      }

      if (char === '"' || char === "'") {
        const quote = char;
        p++;
        let value = '';
        while (p < line.length && line[p] !== quote) {
          if (line[p] === '\\') {
            value += '\\' + line[p + 1];
            p += 2;
          } else {
            value += line[p++];
          }
        }
        p++;
        this.tokens.push({ type: 'STRING', value, start: offset + p });
        continue;
      }

      if (/[a-zA-Z_]/.test(char)) {
        let value = '';
        while (p < line.length && /[a-zA-Z0-9_]/.test(line[p])) value += line[p++];
        const keywords = [
          'def',
          'class',
          'if',
          'elif',
          'else',
          'while',
          'for',
          'in',
          'return',
          'break',
          'continue',
          'and',
          'or',
          'not',
          'True',
          'False',
          'None',
          'pass',
          'try',
          'except',
          'finally',
          'as',
        ];

        if (keywords.includes(value)) {
          if (value === 'True' || value === 'False')
            this.tokens.push({
              type: 'BOOLEAN',
              value: value === 'True' ? 'true' : 'false',
              start: offset + p,
            });
          else this.tokens.push({ type: 'KEYWORD', value, start: offset + p });
        } else {
          this.tokens.push({ type: 'IDENTIFIER', value, start: offset + p });
        }
        continue;
      }

      if (
        [
          '+',
          '-',
          '*',
          '/',
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
          ':',
          ';',
          '%',
        ].includes(char)
      ) {
        let value = char;
        // Three-character (`//=`), then two-character operators, then single.
        const three = line.slice(p, p + 3);
        const two = line.slice(p, p + 2);
        if (three === '//=') {
          value = three;
          p += 2;
        } else if (
          ['==', '!=', '>=', '<=', '+=', '-=', '*=', '/=', '%=', '**', '//'].includes(two)
        ) {
          value = two;
          p++;
        }
        if (
          ['+', '-', '*', '/', '%', '==', '!=', '>', '<', '>=', '<=', '**', '//'].includes(value)
        ) {
          this.tokens.push({ type: 'OPERATOR', value, start: offset + p });
        } else if (['+=', '-=', '*=', '/=', '%=', '//='].includes(value)) {
          this.tokens.push({ type: 'OPERATOR', value, start: offset + p });
        } else if (value === '=') {
          this.tokens.push({ type: 'OPERATOR', value, start: offset + p });
        } else {
          // Emit punctuation including colons, but skip colons at end of line
          // (those are block markers, not slicing operators)
          if (value === ':' && p === line.length - 1) {
            // Skip end-of-line colon
          } else {
            this.tokens.push({ type: 'PUNCTUATION', value, start: offset + p });
          }
        }
        p++;
        continue;
      }

      throw new Error(`Unexpected character: ${char} at position ${offset + p}`);
    }
  }
}
