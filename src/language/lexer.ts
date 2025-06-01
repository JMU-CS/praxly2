import {TokenType, Token, TextToken} from './token.js';
import {Where} from './where.js';
import {WhereError} from './error.js';

export abstract class Lexer {
  source: string;
  start: number;
  i: number;
  tokens: Token[];

  constructor(source: string) {
    this.source = source;
    this.start = 0;
    this.i = 0;
    this.tokens = [];
  }

  has(c: string) {
    return this.i < this.source.length && this.source[this.i] === c;
  }

  accept(c: string) {
    if (this.has(c)) {
      this.advance();
      return true;
    } else {
      return false;
    }
  }

  hasOtherwise(c: string) {
    return this.i < this.source.length && this.source[this.i] !== c;
  }

  hasAhead(c: string, offset: number) {
    return this.i + offset < this.source.length && this.source[this.i + offset] === c;
  }

  hasDigit() {
    return this.i < this.source.length && '0' <= this.source[this.i] && this.source[this.i] <= '9';
  }

  hasDigitAhead(offset: number) {
    return this.i + offset < this.source.length && '0' <= this.source[this.i + offset] && this.source[this.i + offset] <= '9';
  }

  hasAlphabetic() {
    return this.i < this.source.length &&
      ('a' <= this.source[this.i] && this.source[this.i] <= 'z' ||
       'A' <= this.source[this.i] && this.source[this.i] <= 'Z');
  }

  hasAlphanumeric() {
    return this.i < this.source.length &&
      (this.hasAlphabetic() || this.hasDigit());
  }

  skipWhitespace() {
    while (this.has(' ')) {
      this.abandon();
    }
  }

  lex(): Token[] {
    this.initialize();
    while (this.i < this.source.length) {
      this.lexToken();
    }

    this.emitToken(TokenType.EndOfSource);
    return this.tokens;
  }

  abandon() {
    this.i += 1;
    this.start = this.i;
  }

  advance() {
    this.i += 1;
  }

  emitToken(type: TokenType) {
    this.tokens.push(new Token(type, new Where(this.start, this.i)));
    this.start = this.i;
  }

  emitTextToken(type: TokenType, text: string) {
    this.tokens.push(new TextToken(type, new Where(this.start, this.i), text));
    this.start = this.i;
  }

  lexString() {
    this.advance();
    let text = "";
    while (this.hasOtherwise('"')) {
      if (this.has('\\')) {
        this.advance();
        if (this.i >= this.source.length) {
          throw new WhereError('A string literal is not closed.', new Where(this.start, this.i));
        }
      }
      text += this.source[this.i];
      this.advance();
    }

    if (!this.has('"')) {
      throw new WhereError('A string literal is not closed.', new Where(this.start, this.i));
    } else {
      this.advance();
      this.emitTextToken(TokenType.String, text);
    }
  }

  lexNumber() {
    let text = '';
    if (this.has('-')) {
      text += this.source[this.i];
      this.advance();
    }

    while (this.hasDigit()) {
      text += this.source[this.i];
      this.advance();
    }

    // Floats have a single radix point. Don't get fooled by "..". 0..5 is a
    // range.
    if (this.has('.') && !this.hasAhead('.', 1)) {
      text += this.source[this.i];
      this.advance();
      while (this.hasDigit()) {
        text += this.source[this.i];
        this.advance();
      }
      this.emitTextToken(TokenType.Float, text);
    } else {
      this.emitTextToken(TokenType.Integer, text);
    }
  }

  abstract initialize(): void;
  abstract lexToken(): void;

  static keywords: {[index: string]: TokenType} = {
    and: TokenType.And,
    class: TokenType.Class,
    do: TokenType.Do,
    else: TokenType.Else,
    end: TokenType.End,
    extends: TokenType.Extends,
    false: TokenType.False,
    for: TokenType.For,
    if: TokenType.If,
    new: TokenType.New,
    not: TokenType.Not,
    null: TokenType.Null,
    or: TokenType.Or,
    print: TokenType.Print,
    private: TokenType.Private,
    public: TokenType.Public,
    repeat: TokenType.Repeat,
    return: TokenType.Return,
    true: TokenType.True,
    until: TokenType.Until,
    while: TokenType.While,
  };
}
