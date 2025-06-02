import {TokenType, Token} from './token.js';
import * as ast from './ast.js';
import {Where} from './where.js';

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
    return this.i < this.source.length && this.tokens[this.i].type === type;
  }

  hasAny(...types: TokenType[]) {
    return this.i < this.source.length && types.some(type => this.tokens[this.i].type === type);
  }

  hasOtherwise(type: TokenType) {
    return this.i < this.source.length && this.tokens[this.i].type !== type && this.tokens[this.i].type !== TokenType.EndOfSource;
  }

  hasAhead(type: TokenType, offset: number) {
    return this.i + offset < this.source.length && this.tokens[this.i + offset].type === type;
  }

  advance(): Token {
    this.i += 1;
    return this.tokens[this.i - 1];
  }

  skipLinebreaks() {
    let n = 0;
    let where = Where.Nowhere;
    while (this.has(TokenType.Linebreak)) {
      const token = this.advance();
      if (where) {
        where.end = token.where.end;
      } else {
        where = new Where(token.where.start, token.where.end);
      } 
      n += 1;
    }
    return {n, where};
  }

  abstract parse(): ast.Node;
}
