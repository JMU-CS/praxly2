import {Lexer} from '../lexer.js';
import {TokenType} from '../token.js';
import {Where} from '../where.js';
import {WhereError} from '../exception.js';

class PraxisLexer extends Lexer {
  indents: string[];

  constructor(source: string) {
    super(source);
    this.indents = [''];
  }

  initialize() {
    this.lexIndent();
  }

  lexToken() {
    if (this.has(' ') || this.has("\r")) {
      this.abandon();
    } else if (this.hasDigit()) {
      this.lexNumber();
    } else if (this.accept("\n")) {
      this.lexLinebreak();
    } else if (this.accept(',')) {
      this.emitToken(TokenType.Comma);
    } else if (this.has('.')) {
      this.lexDot();
    } else if (this.accept(';')) {
      this.emitToken(TokenType.Semicolon);
    } else if (this.accept('+')) {
      this.emitToken(TokenType.Plus);
    } else if (this.accept('%')) {
      this.emitToken(TokenType.Percent);
    } else if (this.accept('(')) {
      this.emitToken(TokenType.LeftParenthesis);
    } else if (this.accept(')')) {
      this.emitToken(TokenType.RightParenthesis);
    } else if (this.accept('[')) {
      this.emitToken(TokenType.LeftBracket);
    } else if (this.accept(']')) {
      this.emitToken(TokenType.RightBracket);
    } else if (this.accept('{')) {
      this.emitToken(TokenType.LeftCurly);
    } else if (this.accept('}')) {
      this.emitToken(TokenType.RightCurly);
    } else if (this.accept('~')) {
      this.emitToken(TokenType.Tilde);
    } else if (this.accept('^')) {
      this.emitToken(TokenType.Circumflex);
    } else if (this.accept('\u2264')) {
      this.emitToken(TokenType.LessThanOrEqual);
    } else if (this.accept('\u2265')) {
      this.emitToken(TokenType.GreaterThanOrEqual);
    } else if (this.accept('\u2260')) { // ≠
      this.emitToken(TokenType.NotEqual);
    } else if (this.accept('\u2b60')) {
      this.emitToken(TokenType.Equal);
    } else if (this.accept('\u2190')) {
      this.emitToken(TokenType.Equal);
    } else if (this.has('"')) {
      this.lexString();
    } else if (this.hasAlphabetic()) {
      this.lexIdentifier();
    } else if (this.accept('*')) {
      if (this.accept('*')) {
        this.emitToken(TokenType.DoubleAsterisk);
      } else {
        this.emitToken(TokenType.Asterisk);
      }
    } else if (this.accept('&')) {
      this.emitToken(TokenType.Ampersand);
    } else if (this.accept('|')) {
      if (this.accept('|')) {
        this.emitToken(TokenType.DoublePipe);
      } else {
        this.emitToken(TokenType.Pipe);
      }
    } else if (this.accept('!')) {
      if (this.accept('=')) {
        this.emitToken(TokenType.NotEqual);
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
    } else if (this.accept('/')) {
      if (this.accept('/')) {
        // Skip over leading whitespace.
        while (this.accept(' ')) {}
        let text = '';
        while (this.hasOtherwise("\n")) {
          text += this.source[this.i];
          this.advance();
        }
        this.emitTextToken(TokenType.LineComment, text);
      } else {
        this.emitToken(TokenType.ForwardSlash);
      }
    } else if (this.has('-')) {
      if (this.hasDigitAhead(1)) {
        this.lexNumber();
      } else {
        this.advance();
        this.emitToken(TokenType.Hyphen);
      }
    } else {
      throw new WhereError(`The program contains an unexpected character: \`${this.source[this.i]}\`.`, new Where(this.i, this.i + 1));
    }
  }

  lexLinebreak() {
    this.emitToken(TokenType.Linebreak);
    if (this.i < this.source.length) {
      this.lexIndent();
    }
  }

  lexDot() {
    this.advance(); // eat .
    if (this.accept('.')) {
      this.emitToken(TokenType.DotDot);
    } else {
      console.log("period");
      this.emitToken(TokenType.Period);
    }
  }

  lexIndent() {
    let indent = '';

    // First gobble up all the whitespace there is.
    while (this.has(' ') || this.has("\t")) {
      indent += this.source[this.i];
      this.advance();
    }

    // If the whole line is whitespace, we do not give it any influence over
    // the indentation.
    if (indent.length > 0 && (this.i === this.source.length || this.has("\r") || this.has("\n"))) {
      this.abandon();
    }

    // Issue an indent token only if the indent extends the previous indent.
    else if (indent.length > 0 && indent.length > this.indents[this.indents.length - 1].length && indent.startsWith(this.indents[this.indents.length - 1])) {
      this.indents.push(indent);
      this.emitToken(TokenType.Indent);
    }

    else {
      // Pop indents until match. If no match, issue error.
      while (this.indents.length > 1 &&
             this.indents[this.indents.length - 1].startsWith(indent) &&
             this.indents[this.indents.length - 1] !== indent) {
        this.indents.pop();
        this.emitToken(TokenType.Unindent);
      }

      if (this.indents[this.indents.length - 1] !== indent) {
        throw new WhereError('A line is not indented like the line above it.', new Where(this.start, this.i));
      }
    }
  }

  lexIdentifier() {
    let text = '';
    while (this.hasAlphanumeric()) {
      text += this.source[this.i];
      this.advance();
    }

    if (Lexer.keywords.hasOwnProperty(text)) {
      this.emitToken(Lexer.keywords[text]);
    } else {
      this.emitTextToken(TokenType.Identifier, text);
    }
  }
}

export function lexPraxis(source: string) {
  return new PraxisLexer(source).lex();
}
