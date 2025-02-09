import {TokenType, Token} from './token.js';
import * as ast from './ast.js';

export abstract class Parser {
  source: string;
  i: number;
  tokens: Token[];

  constructor(tokens: Token[], source: string) {
    this.source = source;
    this.tokens = tokens;
    this.i = 0;
  }

  has(type: TokenType) {
    return this.i < this.source.length && this.tokens[this.i].type == type;
  }

  hasAhead(type: TokenType, offset: number) {
    return this.i + offset < this.source.length && this.tokens[this.i + offset].type === type;
  }

  advance(): Token {
    this.i += 1;
    return this.tokens[this.i - 1];
  }

  skipLinebreaks() {
    while (this.has(TokenType.Linebreak)) {
      this.advance();
    }
  }

  abstract parse(): ast.Node;
}
