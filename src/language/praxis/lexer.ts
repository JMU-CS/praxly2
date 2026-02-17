import type { Token } from '../lexer';

export class PraxisLexer {
    private pos = 0;
    private input: string;

    constructor(input: string) {
        this.input = input;
    }

    tokenize(): Token[] {
        const tokens: Token[] = [];
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];

            // Skip whitespace
            if (/\s/.test(char)) { this.pos++; continue; }

            // Comments (// or #)
            if ((char === '/' && this.input[this.pos + 1] === '/') || char === '#') {
                while (this.pos < this.input.length && this.input[this.pos] !== '\n') this.pos++;
                continue;
            }

            // Numbers
            if (/\d/.test(char)) {
                let value = '';
                const start = this.pos;
                while (this.pos < this.input.length && (/\d/.test(this.input[this.pos]) || this.input[this.pos] === '.')) {
                    value += this.input[this.pos++];
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
                    'if', 'then', 'else', 'end', 'while', 'do', 'for', 'to', 'step', 'in',
                    'procedure', 'function', 'return', 'print', 'call',
                    'and', 'or', 'not', 'true', 'false', 'mod'
                ];

                const type = keywords.includes(value.toLowerCase()) ? 'KEYWORD' : 'IDENTIFIER';

                // Normalize boolean values
                if (value.toLowerCase() === 'true') tokens.push({ type: 'BOOLEAN', value: 'true', start });
                else if (value.toLowerCase() === 'false') tokens.push({ type: 'BOOLEAN', value: 'false', start });
                else tokens.push({ type, value, start });
                continue;
            }

            // Operators and Punctuation
            if (['+', '-', '*', '/', '=', '>', '<', '!', '(', ')', '[', ']', ',', '.'].includes(char)) {
                const start = this.pos;

                // Assignment: <-
                if (char === '<' && this.input[this.pos + 1] === '-') {
                    tokens.push({ type: 'OPERATOR', value: '<-', start });
                    this.pos += 2;
                    continue;
                }

                // Comparison: <=, >=, !=, ==
                if (['<', '>', '!', '='].includes(char) && this.input[this.pos + 1] === '=') {
                    tokens.push({ type: 'OPERATOR', value: char + '=', start });
                    this.pos += 2;
                    continue;
                }

                if (['+', '-', '*', '/', '%', '>', '<', '='].includes(char)) {
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
