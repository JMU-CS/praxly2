import {Parser} from '../parser.js';
import {Token, TextToken, TokenType} from '../token.js';
import {Where} from '../where.js';
import {WhereError} from '../error.js';
import * as ast from '../ast.js';

class PraxlyParser extends Parser {
  parse(): ast.Block {
    const statements = [];
    this.skipLinebreaks();
    while (!this.has(TokenType.EndOfSource)) {
      statements.push(this.topLevelStatement());
      this.skipLinebreaks();
    }
    if (statements.length === 0) {
      return new ast.Block(statements, new Where(0, 0));
    } else {
      return new ast.Block(statements, Where.enclose(statements[0].where, statements[statements.length - 1].where));
    }
  }

  topLevelStatement(): ast.Statement | ast.Expression {
    if (this.has(TokenType.Function)) {
      const defineNode = this.functionDefinition();
      this.statementLinebreak();
      return defineNode;
    } else {
      return this.statement();
    }
  }

  functionDefinition(): ast.FunctionDefinition {
    const functionToken = this.advance();

    if (!this.has(TokenType.Identifier)) {
      throw new WhereError(`The function's name is missing.`, functionToken.where);
    }
    const identifierToken = this.advance() as TextToken;

    if (!this.has(TokenType.LeftParenthesis)) {
      throw new WhereError(`A function's parameters must be enclosed in parentheses.`, Where.enclose(functionToken.where, identifierToken.where));
    }
    const leftToken = this.advance(); // eat (
    let latestToken = leftToken;

    const formals = [];
    if (this.has(TokenType.Identifier)) {
      const typeToken = this.advance() as TextToken;
      if (!this.has(TokenType.Identifier)) {
        throw new WhereError("A parameter must have both the type and the name.", typeToken.where);
      }
      const identifierToken = this.advance() as TextToken;
      latestToken = identifierToken;
      formals.push(new ast.Formal(identifierToken.text, typeToken.text));
      while (this.has(TokenType.Comma)) {
        this.advance();
        const typeToken = this.advance() as TextToken;
        if (!this.has(TokenType.Identifier)) {
          throw new WhereError("A parameter must have both the type and the name.", typeToken.where);
        }
        const identifierToken = this.advance() as TextToken;
        latestToken = identifierToken;
        formals.push(new ast.Formal(identifierToken.text, typeToken.text));
      }
    } 

    if (!this.has(TokenType.RightParenthesis)) {
      throw new WhereError(`A function's parameter must be enclosed in parentheses.`, Where.enclose(functionToken.where, latestToken.where));
    }
    const rightToken = this.advance(); // eat )

    this.skipLinebreaks();
    const body = this.curlyBlock();

    return new ast.FunctionDefinition(identifierToken.text, formals, body, Where.enclose(functionToken.where, body.where));
  }

  statementLinebreak() {
    if (this.has(TokenType.Linebreak)) {
      this.advance();
    } else if (!this.has(TokenType.EndOfSource)) {
      throw new WhereError(`A statement has stray text: \`${this.tokens[this.i].where.text(this.source)}\`.`, this.tokens[this.i].where);
    }
  } 

  statement(): ast.Statement | ast.Expression {
    // check for for, return, class, function definition
    let statement;

    if (this.has(TokenType.If)) {
      statement = this.ifStatement();
    } else if (this.has(TokenType.While)) {
      statement = this.whileStatement();
    } else if (this.has(TokenType.Print)) {
      statement = this.printStatement();
    } else if (this.has(TokenType.Identifier) && this.hasAhead(TokenType.Identifier, 1)) {
      statement = this.declaration();
    } else {
      statement = this.otherStatement();
    }

    this.statementLinebreak();
    return statement;
  }

  declaration() {
    const typeToken = this.advance() as TextToken;
    const identifierToken = this.advance() as TextToken;

    if (this.has(TokenType.Equal)) {
      this.advance();
      const rightNode = this.expression();
      return new ast.Declaration(identifierToken.text, typeToken.text, rightNode, Where.enclose(typeToken.where, rightNode.where));
    } else {
      return new ast.Declaration(identifierToken.text, typeToken.text, null, Where.enclose(typeToken.where, identifierToken.where));
    }
  }

  ifStatement(): ast.Statement {
    const ifToken = this.advance();
    const conditionNode = this.parenthesizedExpression(ifToken.where, "An if statement's condition").node;

    this.skipLinebreaks();
    const thenBlock = this.curlyBlock();
    this.skipLinebreaks();

    if (this.has(TokenType.Else)) {
      this.advance();
      const elseBlock = this.curlyBlock();
      return new ast.If(conditionNode, thenBlock, elseBlock, Where.enclose(ifToken.where, elseBlock.where));
    } else {
      return new ast.If(conditionNode, thenBlock, null, Where.enclose(ifToken.where, thenBlock.where));
    }
  }

  whileStatement(): ast.Statement {
    const whileToken = this.advance();
    const conditionNode = this.parenthesizedExpression(whileToken.where, "A while statement's condition").node;

    this.skipLinebreaks();
    const body = this.curlyBlock();
    this.skipLinebreaks();

    return new ast.While(conditionNode, body, Where.enclose(whileToken.where, body.where));
  }

  printStatement(): ast.Statement {
    const printToken = this.advance();
    const parameter = this.parenthesizedExpression(printToken.where, 'A print\'s parameter');
    return new ast.Print(parameter.node, Where.enclose(printToken.where, parameter.where));
  }

  otherStatement(): ast.Statement | ast.Expression {
    const expression = this.expression();
    if (this.has(TokenType.Equal)) {
      this.advance();
      const rightExpression = this.expression();
      return new ast.Assignment(expression, rightExpression, Where.enclose(expression.where, rightExpression.where));
    } else {
      return expression;
    }
  }

  curlyBlock(): ast.Block {
    if (!this.has(TokenType.LeftCurly)) {
      throw new Error('Blocks must be enclosed in curly braces.');
    }
    const leftCurlyToken = this.advance();

    this.skipLinebreaks();
    const statements = [];
    while (!this.has(TokenType.RightCurly)) {
      statements.push(this.statement());
      this.skipLinebreaks();
    }

    if (!this.has(TokenType.RightCurly)) {
      throw new WhereError('Blocks must be enclosed in curly braces.', leftCurlyToken.where);
    }
    const rightCurlyToken = this.advance();

    return new ast.Block(statements, Where.enclose(leftCurlyToken.where, rightCurlyToken.where));
  }

  parenthesizedExpression(predecessorWhere: Where, prefix: string) {
    if (!this.has(TokenType.LeftParenthesis)) {
      throw new WhereError(`${prefix} must be enclosed in parentheses.`, predecessorWhere);
    }
    const leftToken = this.advance(); // eat (

    const node = this.expression();

    if (!this.has(TokenType.RightParenthesis)) {
      throw new WhereError(`${prefix} must be enclosed in parentheses.`, Where.enclose(predecessorWhere, node.where));
    }
    const rightToken = this.advance(); // eat )

    return {
      node,
      where: Where.enclose(leftToken.where, rightToken.where),
    };
  }

  expression(): ast.Expression {
    return this.bitwiseOr();
  }

  bitwiseOr(): ast.Expression {
    let leftNode = this.xor();
    while (this.has(TokenType.Pipe)) {
      const operatorToken = this.advance();
      const rightNode = this.xor();
      leftNode = new ast.Xor(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
    }
    return leftNode;
  }

  xor(): ast.Expression {
    let leftNode = this.bitwiseAnd();
    while (this.has(TokenType.Circumflex)) {
      const operatorToken = this.advance();
      const rightNode = this.bitwiseAnd();
      leftNode = new ast.Xor(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
    }
    return leftNode;
  }

  bitwiseAnd(): ast.Expression {
    let leftNode = this.equality();
    while (this.has(TokenType.Ampersand)) {
      const operatorToken = this.advance();
      const rightNode = this.equality();
      leftNode = new ast.BitwiseAnd(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
    }
    return leftNode;
  }

  equality(): ast.Expression {
    let leftNode = this.relational();
    while (this.has(TokenType.DoubleEqual) || this.has(TokenType.NotEqual)) {
      const operatorToken = this.advance();
      const rightNode = this.relational();
      if (operatorToken.type === TokenType.Equal) {
        leftNode = new ast.Equal(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
      } else {
        leftNode = new ast.NotEqual(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
      }
    }
    return leftNode;
  }

  relational(): ast.Expression {
    let leftNode = this.shift();
    while (this.has(TokenType.LessThan) || this.has(TokenType.GreaterThan) || this.has(TokenType.LessThanOrEqual) || this.has(TokenType.GreaterThanOrEqual)) {
      const operatorToken = this.advance();
      const rightNode = this.shift();
      if (operatorToken.type === TokenType.LessThan) {
        leftNode = new ast.LessThan(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
      } else if (operatorToken.type === TokenType.GreaterThan) {
        leftNode = new ast.GreaterThan(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
      } else if (operatorToken.type === TokenType.LessThanOrEqual) {
        leftNode = new ast.LessThanOrEqual(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
      } else {
        leftNode = new ast.GreaterThanOrEqual(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
      }
    }
    return leftNode;
  }

  shift(): ast.Expression {
    let leftNode = this.logicalOr();
    while (this.has(TokenType.DoubleLessThan) || this.has(TokenType.DoubleGreaterThan)) {
      const operatorToken = this.advance();
      const rightNode = this.logicalOr();
      if (operatorToken.type === TokenType.DoubleLessThan) {
        leftNode = new ast.LeftShift(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
      } else {
        leftNode = new ast.RightShift(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
      }
    }
    return leftNode;
  }

  logicalOr(): ast.Expression {
    let leftNode = this.logicalAnd();
    while (this.has(TokenType.DoublePipe)) {
      const operatorToken = this.advance();
      const rightNode = this.logicalAnd();
      leftNode = new ast.LogicalOr(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
    }
    return leftNode;
  }

  logicalAnd(): ast.Expression {
    let leftNode = this.additive();
    while (this.has(TokenType.DoubleAmpersand)) {
      const operatorToken = this.advance();
      const rightNode = this.additive();
      leftNode = new ast.LogicalAnd(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
    }
    return leftNode;
  }

  additive(): ast.Expression {
    let leftNode = this.multiplicative();
    while (this.has(TokenType.Plus) || this.has(TokenType.Hyphen)) {
      const operatorToken = this.advance();
      const rightNode = this.multiplicative();
      if (operatorToken.type === TokenType.Plus) {
        leftNode = new ast.Add(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
      } else {
        leftNode = new ast.Subtract(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
      }
    }
    return leftNode;
  }

  multiplicative(): ast.Expression {
    let leftNode = this.power();
    while (this.has(TokenType.Asterisk) || this.has(TokenType.ForwardSlash) || this.has(TokenType.Percent)) {
      const operatorToken = this.advance();
      const rightNode = this.power();
      if (operatorToken.type === TokenType.Asterisk) {
        leftNode = new ast.Multiply(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
      } else if (operatorToken.type === TokenType.ForwardSlash) {
        leftNode = new ast.Divide(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
      } else {
        leftNode = new ast.Remainder(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
      }
    }
    return leftNode;
  }

  power(): ast.Expression {
    let leftNode = this.unary();
    if (this.has(TokenType.DoubleAsterisk)) {
      const operatorToken = this.advance();
      const rightNode = this.unary();
      leftNode = new ast.Power(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
    }
    return leftNode;
  }

  unary(): ast.Expression {
    if (this.has(TokenType.Bang)) {
      const operatorToken = this.advance();
      const operandNode = this.unary();
      return new ast.LogicalNegate(operandNode, Where.enclose(operatorToken.where, operandNode.where));
    } else if (this.has(TokenType.Hyphen)) {
      const operatorToken = this.advance();
      const operandNode = this.unary();
      return new ast.ArithmeticNegate(operandNode, Where.enclose(operatorToken.where, operandNode.where));
    } else if (this.has(TokenType.Tilde)) {
      const operatorToken = this.advance();
      const operandNode = this.unary();
      return new ast.BitwiseNegate(operandNode, Where.enclose(operatorToken.where, operandNode.where));
    } else {
      return this.apex();
    }
  }

  variable() {
    const identifierToken = this.advance() as TextToken;
    if (this.has(TokenType.LeftParenthesis)) {
      const leftToken = this.advance();
      let latestWhere = leftToken.where;
      const actuals = [];
      if (this.hasOtherwise(TokenType.RightParenthesis)) {
        actuals.push(this.expression());
        while (this.has(TokenType.Comma)) {
          this.advance();
          actuals.push(this.expression());
        }
        latestWhere = actuals[actuals.length - 1].where;
      }
      if (this.has(TokenType.RightParenthesis)) {
        const rightToken = this.advance();
        return new ast.FunctionCall(identifierToken.text, actuals, Where.enclose(identifierToken.where, rightToken.where));
      } else {
        throw new WhereError("A function call's parameters must be enclosed in parentheses.", Where.enclose(identifierToken.where, latestWhere));
      }
    } else {
      return new ast.Variable(identifierToken.text, identifierToken.where);
    }
  }

  apex(): ast.Expression {
    if (this.has(TokenType.Integer)) {
      const token = this.advance() as TextToken;
      return new ast.Integer(parseInt(token.text), token.where);
    } else if (this.has(TokenType.Float)) {
      const token = this.advance() as TextToken;
      return new ast.Float(parseFloat(token.text), token.where);
    } else if (this.has(TokenType.String)) {
      const token = this.advance() as TextToken;
      return new ast.String(token.text, token.where);
    } else if (this.has(TokenType.Boolean)) {
      const token = this.advance() as TextToken;
      return new ast.Boolean(token.text == 'true', token.where);
    } else if (this.has(TokenType.Identifier)) {
      return this.variable();
    } else if (this.has(TokenType.LeftParenthesis)) {
      const leftParenthesisToken = this.advance();
      const expression = this.expression();
      if (!this.has(TokenType.RightParenthesis)) {
        throw new WhereError('A right parenthesis is missing.', Where.enclose(leftParenthesisToken.where, expression.where));
      }
      this.advance();
      return expression;
    } else {
      if (this.i < this.tokens.length) {
        throw new WhereError(`An unexpected token was encountered: ${this.tokens[this.i].toPretty(this.source)}.`, this.tokens[this.i].where);
      } else {
        throw new Error('The program ended unexpectedly.');
      }
    }
  }
}

export function parsePraxly(tokens: Token[], source: string) {
  return new PraxlyParser(tokens, source).parse();
}
