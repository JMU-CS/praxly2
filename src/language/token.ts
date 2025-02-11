import {Where} from './where.js';

export enum TokenType {
  And,
  Asterisk,
  Ampersand,
  Bang,
  BangEqual,
  Boolean,
  Character,
  Circumflex,
  Comma,
  DoubleAmpersand,
  DoubleAsterisk,
  DoubleEqual,
  DoubleForwardSlash,
  DoubleGreaterThan,
  DoubleLessThan,
  DoublePipe,
  Else,
  End,
  EndOfSource,
  Equal,
  Float,
  For,
  ForwardSlash,
  Function,
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
  LineComment,
  Not,
  NotEqual,
  Or,
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
