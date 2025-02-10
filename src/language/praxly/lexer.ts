import {Lexer} from '../lexer.js';
import {TokenType} from '../token.js';

class PraxlyLexer extends Lexer {
  lexToken() {
    if (this.has(' ')) {
      this.abandon();
    } else if (this.hasDigit()) {
      this.lexNumber();
    } else if (this.accept("\n")) {
      this.emitToken(TokenType.Linebreak);
    } else if (this.accept(',')) {
      this.emitToken(TokenType.Comma);
    } else if (this.accept('+')) {
      this.emitToken(TokenType.Plus);
    } else if (this.accept('/')) {
      this.emitToken(TokenType.ForwardSlash);
    } else if (this.accept('%')) {
      this.emitToken(TokenType.Percent);
    } else if (this.accept('(')) {
      this.emitToken(TokenType.LeftParenthesis);
    } else if (this.accept(')')) {
      this.emitToken(TokenType.RightParenthesis);
    } else if (this.accept('{')) {
      this.emitToken(TokenType.LeftCurly);
    } else if (this.accept('}')) {
      this.emitToken(TokenType.RightCurly);
    } else if (this.accept('~')) {
      this.emitToken(TokenType.Tilde);
    } else if (this.accept('^')) {
      this.emitToken(TokenType.Circumflex);
    } else if (this.accept('*')) {
      if (this.accept('*')) {
        this.emitToken(TokenType.DoubleAsterisk);
      } else {
        this.emitToken(TokenType.Asterisk);
      }
    } else if (this.accept('&')) {
      if (this.accept('&')) {
        this.emitToken(TokenType.DoubleAmpersand);
      } else {
        this.emitToken(TokenType.Ampersand);
      }
    } else if (this.accept('|')) {
      if (this.accept('|')) {
        this.emitToken(TokenType.DoublePipe);
      } else {
        this.emitToken(TokenType.Pipe);
      }
    } else if (this.accept('!')) {
      if (this.accept('=')) {
        this.emitToken(TokenType.BangEqual);
      } else {
        this.emitToken(TokenType.Bang);
      }
    } else if (this.accept('=')) {
      if (this.accept('=')) {
        this.emitToken(TokenType.DoubleEqual);
      } else {
        this.emitToken(TokenType.Equal);
      }
    } else if (this.accept('<')) {
      if (this.accept('<')) {
        this.emitToken(TokenType.DoubleLessThan);
      } else if (this.accept('=')) {
        this.emitToken(TokenType.LessThanOrEqual);
      } else {
        this.emitToken(TokenType.LessThan);
      }
    } else if (this.accept('>')) {
      if (this.accept('>')) {
        this.emitToken(TokenType.DoubleGreaterThan);
      } else if (this.accept('=')) {
        this.emitToken(TokenType.GreaterThanOrEqual);
      } else {
        this.emitToken(TokenType.GreaterThan);
      }
    } else if (this.has('"')) {
      this.lexString();
    } else if (this.hasAlphabetic()) {
      this.lexIdentifier();
    } else if (this.has('-')) {
      if (this.hasDigitAhead(1)) {
        this.lexNumber();
      } else {
        this.advance();
        this.emitToken(TokenType.Hyphen);
      }
    } else {
      throw new Error(`unexpected character: ${this.source[this.i]}`);
    }
  }

  lexIdentifier() {
    let text = '';
    while (this.hasAlphanumeric()) {
      text += this.source[this.i];
      this.advance();
    }

    if (text === 'true' || text === 'false') {
      this.emitTextToken(TokenType.Boolean, text);
    } else if (text === 'for') {
      this.emitToken(TokenType.For);
    } else if (text === 'while') {
      this.emitToken(TokenType.While);
    } else if (text === 'function') {
      this.emitToken(TokenType.Function);
    } else if (text === 'if') {
      this.emitToken(TokenType.If);
    } else if (text === 'else') {
      this.emitToken(TokenType.Else);
    } else if (text === 'return') {
      this.emitToken(TokenType.Return);
    } else if (text === 'print') {
      this.emitToken(TokenType.Print);
    } else {
      this.emitTextToken(TokenType.Identifier, text);
    }
  }
}

export function lexPraxly(source: string) {
  return new PraxlyLexer(source).lex();
}
