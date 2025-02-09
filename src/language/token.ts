import {Where} from './where.js';

export enum TokenType {
  Asterisk,
  Ampersand,
  Bang,
  BangEqual,
  Boolean,
  Character,
  Circumflex,
  DoubleAmpersand,
  DoubleAsterisk,
  DoubleLessThan,
  DoubleEqual,
  DoubleGreaterThan,
  DoublePipe,
  Else,
  EndOfSource,
  Equal,
  Float,
  For,
  ForwardSlash,
  GreaterThan,
  GreaterThanOrEqual,
  Hyphen,
  Identifier,
  If,
  Integer,
  LeftBracket,
  LeftCurly,
  LeftParenthesis,
  LessThan,
  LessThanOrEqual,
  Linebreak,
  NotEqual,
  Percent,
  Period,
  Pipe,
  Plus,
  Print,
  Return,
  RightBracket,
  RightCurly,
  RightParenthesis,
  Semicolon,
  String,
  Tilde,
  While,
  Xor,
}

export class Token {
  type: TokenType;
  where: Where;

  constructor(type: TokenType, where: Where) {
    this.type = type;
    this.where = where;
  }

  toPretty(source: string) {
    return `{type: ${TokenType[this.type]}, text: "${this.where.text(source)}", where: ${this.where.start}-${this.where.end}}`;
  }
}

export class TextToken extends Token {
  text: string;

  constructor(type: TokenType, where: Where, text: string) {
    super(type, where);
    this.text = text;
  }

  toPretty(_source: string) {
    return `{type: ${TokenType[this.type]}, text: "${this.text}", where: ${this.where.start}-${this.where.end}}`;
  }
}
