import {Where} from './where.js';

export enum TokenType {
  And,
  Asterisk,
  Ampersand,
  Bang,
  Boolean,
  Character,
  Class,
  Circumflex,
  Colon,
  Comma,
  Do,
  DotDot,
  Double,
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
  Extends,
  False,
  Float,
  For,
  ForwardSlash,
  Function,
  GreaterThan,
  GreaterThanOrEqual,
  Hyphen,
  HyphenHyphen,
  Identifier,
  If,
  Indent,
  Integer,
  LeftBracket,
  LeftCurly,
  LeftParenthesis,
  LessThan,
  LessThanOrEqual,
  Linebreak,
  LineComment,
  New,
  Not,
  NotEqual,
  Null,
  Or,
  Percent,
  Period,
  Pipe,
  Plus,
  PlusPlus,
  Print,
  Private,
  Public,
  Repeat,
  Return,
  RightBracket,
  RightCurly,
  RightParenthesis,
  Semicolon,
  String,
  Tilde,
  True,
  Unindent,
  Until,
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
