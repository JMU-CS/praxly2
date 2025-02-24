import {Parser} from '../parser.js';
import {Token, TextToken, TokenType} from '../token.js';
import {Where} from '../where.js';
import {WhereError} from '../exception.js';
import * as ast from '../ast.js';

class PraxisParser extends Parser {
  hasTwoIdentifiers() {
    return this.has(TokenType.Identifier) && this.hasAhead(TokenType.Identifier, 1);
  }

  parse(): ast.Block {
    const statements = [];
    let blank = this.skipLinebreaks();
    if (blank.n > 0) {
      statements.push(new ast.Blank(blank.n, blank.where!));
    }
    while (!this.has(TokenType.EndOfSource)) {
      statements.push(this.topLevelStatement());
      let blank = this.skipLinebreaks();
      if (blank.n > 0) {
        statements.push(new ast.Blank(blank.n, blank.where!));
      }
    }
    if (statements.length === 0) {
      return new ast.Block(statements, new Where(0, 0));
    } else {
      return new ast.Block(statements, Where.enclose(statements[0].where, statements[statements.length - 1].where));
    }
  }

  topLevelStatement(): ast.Statement | ast.Expression {
    if (this.hasTwoIdentifiers() && this.hasAhead(TokenType.LeftParenthesis, 2)) {
      const defineNode = this.functionDefinition();
      this.statementLinebreak();
      return defineNode;
    } else if (this.has(TokenType.Class)) {
      const defineNode = this.classDefinition();
      this.statementLinebreak();
      return defineNode;
    } else {
      return this.statement(false);
    }
  }

  classDefinition(): ast.ClassDefinition {
    const classToken = this.advance() as TextToken;

    if (!this.has(TokenType.Identifier)) {
      throw new WhereError("The class name is missing.", classToken.where);
    }
    const classIdentifierToken = this.advance() as TextToken;
    let lastWhere = classIdentifierToken.where;

    let superclass = null;
    if (this.has(TokenType.Extends)) {
      const extendsToken = this.advance();
      if (!this.has(TokenType.Identifier)) {
        throw new WhereError("The superclass name is missing.", extendsToken.where);
      }
      const superclassToken = this.advance() as TextToken;
      lastWhere = superclassToken.where;
      superclass = superclassToken.text;
    }

    if (!this.has(TokenType.Linebreak)) {
      throw new WhereError("A linebreak is missing after this class header.", Where.enclose(classToken.where, lastWhere));
    }
    this.advance(); // eat linebreak

    this.skipLinebreaks();

    const instanceVariableDeclarations: ast.InstanceVariableDeclaration[] = [];
    const methodDefinitions: ast.MethodDefinition[] = [];

    if (this.has(TokenType.Indent)) {
      this.advance(); // eat indent

      while (this.hasOtherwise(TokenType.Unindent)) {
        let visibility = null;
        let firstWhere = null;
        if (this.has(TokenType.Public) || this.has(TokenType.Private)) {
          const visibilityToken = this.advance(); // eat public/private
          visibility = visibilityToken.type === TokenType.Public ? ast.Visibility.Public : ast.Visibility.Private;
          lastWhere = visibilityToken.where;
          firstWhere = visibilityToken.where;
        }

        if (!this.has(TokenType.Identifier)) {
          throw new WhereError("A type is missing.", lastWhere);
        }
        const scalarTypeToken = this.advance() as TextToken;
        firstWhere = firstWhere ?? scalarTypeToken.where;
        let type = scalarTypeToken.text;
        while (this.has(TokenType.LeftBracket)) {
          const leftToken = this.advance(); // eat [
          if (!this.has(TokenType.RightBracket)) {
            throw new WhereError("This [ is missing its ].", leftToken.where);
          }
          const rightToken = this.advance(); // eat ]
          lastWhere = rightToken.where;
          type += '[]';
        }

        if (!this.has(TokenType.Identifier)) {
          throw new WhereError("A name is missing after this type.", lastWhere);
        }

        if (this.hasAhead(TokenType.LeftParenthesis, 1)) {
          const core = this.subroutineCore('method', Where.enclose(scalarTypeToken.where, lastWhere));
          const declaration = new ast.MethodDefinition(core.identifier, core.formals, type, core.block, visibility, Where.enclose(firstWhere, core.block.where));
          methodDefinitions.push(declaration);
        } else {
          const memberIdentifierToken = this.advance() as TextToken;
          const declaration = new ast.InstanceVariableDeclaration(memberIdentifierToken.text, type, visibility, Where.enclose(firstWhere, memberIdentifierToken.where));
          instanceVariableDeclarations.push(declaration);
        }

        this.skipLinebreaks();
      }

      if (!this.has(TokenType.Unindent)) {
        throw new WhereError("The class must be closed.", lastWhere);
      }
      this.advance();
    }

    if (!this.has(TokenType.End) || !this.hasAhead(TokenType.Class, 1) || !this.hasAhead(TokenType.Identifier, 2) || (this.tokens[this.i + 2] as TextToken).text !== classIdentifierToken.text) {
      throw new WhereError(`The class must be closed with \`end class ${classIdentifierToken.text}\`.`, Where.enclose(classToken.where, lastWhere));
    }
    this.advance();
    this.advance();
    const endToken = this.advance();

    return new ast.ClassDefinition(classIdentifierToken.text, superclass, instanceVariableDeclarations, methodDefinitions, Where.enclose(classToken.where, endToken.where));
  }

  subroutineCore(context: string, firstWhere: Where) {
    const identifierToken = this.advance() as TextToken;

    const leftToken = this.advance(); // eat (
    let latestToken = leftToken;

    const formals = [];
    if (this.has(TokenType.Identifier)) {
      const typeToken = this.advance() as TextToken;
      if (!this.has(TokenType.Identifier)) {
        throw new WhereError("A parameter must have both a type and a name.", typeToken.where);
      }
      const identifierToken = this.advance() as TextToken;
      latestToken = identifierToken;
      formals.push(new ast.Formal(identifierToken.text, typeToken.text));
      while (this.has(TokenType.Comma)) {
        this.advance();
        const typeToken = this.advance() as TextToken;
        if (!this.has(TokenType.Identifier)) {
          throw new WhereError(`A ${context} must have both a type and a name.`, typeToken.where);
        }
        const identifierToken = this.advance() as TextToken;
        latestToken = identifierToken;
        formals.push(new ast.Formal(identifierToken.text, typeToken.text));
      }
    } 

    if (!this.has(TokenType.RightParenthesis)) {
      throw new WhereError(`A ${context}'s parameter must be enclosed in parentheses.`, Where.enclose(firstWhere, latestToken.where));
    }
    const rightToken = this.advance(); // eat )

    const block = this.indentedBlock(true, 'function definition', Where.enclose(firstWhere, rightToken.where), TokenType.End);

    if (!this.has(TokenType.End) || !this.hasAhead(TokenType.Identifier, 1) || (this.tokens[this.i + 1] as TextToken).text !== identifierToken.text) {
      throw new WhereError(`The ${context} must be closed with \`end ${identifierToken.text}\`.`, block.where);
    }
    this.advance();
    const endToken = this.advance();

    return {
      identifier: identifierToken.text,
      formals,
      block,
    };
  }

  functionDefinition(): ast.FunctionDefinition {
    const returnTypeToken = this.advance() as TextToken;
    const core = this.subroutineCore('function', returnTypeToken.where);
    return new ast.FunctionDefinition(core.identifier, core.formals, returnTypeToken.text, core.block, Where.enclose(returnTypeToken.where, core.block.where));
  }

  indentedBlock(inFunctionDefinition: boolean, contextLabel: string, contextWhere: Where, ...endTokenTypes: TokenType[]) {
    if (!this.has(TokenType.Linebreak)) {
      throw new WhereError(`A linebreak is missing after the header of this ${contextLabel}.`, contextWhere);
    }
    this.advance();

    let statements = [];
    if (this.has(TokenType.Indent)) {
      const indentToken = this.advance();
      while (!this.has(TokenType.Unindent)) {
        const statement = this.statement(inFunctionDefinition);
        statements.push(statement);
      }

      if (!this.has(TokenType.Unindent)) {
        throw new WhereError(`The block in this ${contextLabel} doesn't end.`, contextWhere);
      }
      this.advance();
    } else if (!this.hasAny(...endTokenTypes)) {
      throw new WhereError(`The block in this ${contextLabel} is not indented.`, contextWhere);
    }

    const blockWhere = statements.length > 0 ? Where.enclose(statements[0].where, statements[statements.length - 1].where) : contextWhere;
    return new ast.Block(statements, blockWhere);
  }

  statementLinebreak() {
    if (this.has(TokenType.Linebreak)) {
      this.advance();
    } else if (!this.has(TokenType.EndOfSource)) {
      throw new WhereError(`A statement has stray text: \`${this.tokens[this.i].where.text(this.source)}\`.`, this.tokens[this.i].where);
    }
  } 

  statement(inFunctionDefinition: boolean): ast.Statement | ast.Expression {
    let statement;

    if (this.has(TokenType.If)) {
      statement = this.ifStatement(inFunctionDefinition);
    } else if (this.has(TokenType.While)) {
      statement = this.whileStatement(inFunctionDefinition);
    } else if (this.has(TokenType.Do)) {
      statement = this.doStatement(inFunctionDefinition);
    } else if (this.has(TokenType.Repeat)) {
      statement = this.repeatStatement(inFunctionDefinition);
    } else if (this.has(TokenType.For)) {
      statement = this.forStatement(inFunctionDefinition);
    } else if (this.has(TokenType.Print)) {
      statement = this.printStatement();
    } else if (this.has(TokenType.LineComment)) {
      const token = this.advance() as TextToken;
      statement = new ast.LineComment(token.text, token.where);
    } else if (this.hasTwoIdentifiers()) {
      if (this.hasAhead(TokenType.Equal, 2)) {
        statement = this.initializedDeclaration();
      } else {
        statement = this.uninitializedDeclaration();
      }
    } else if (this.has(TokenType.Identifier) && this.hasAhead(TokenType.LeftBracket, 1) && this.hasAhead(TokenType.RightBracket, 2)) {
      statement = this.arrayDeclaration();
    } else if (this.has(TokenType.Return)) {
      statement = this.returnStatement(inFunctionDefinition);
    } else {
      statement = this.otherStatement();
    }

    this.statementLinebreak();
    return statement;
  }

  arrayDeclaration(): ast.ArrayDeclaration {
    const scalarTypeToken = this.advance() as TextToken;

    // Collect up type with a pair of brackets for each dimension.
    let type = scalarTypeToken.text;
    let leftToken;
    let rightToken;
    while (this.has(TokenType.LeftBracket)) {
      leftToken = this.advance();
      if (!this.has(TokenType.RightBracket)) {
        throw new WhereError("The left bracket of this array type is missing its matching right bracket.", leftToken.where);
      }
      rightToken = this.advance(); // eat ]
      type += '[]';
    }

    if (!this.has(TokenType.Identifier)) {
      throw new WhereError("This array declaration is missing a variable name.", Where.enclose(scalarTypeToken.where, rightToken!.where));
    }
    const identifierToken = this.advance() as TextToken;

    if (!this.has(TokenType.Equal)) {
      throw new WhereError("This array declaration is missing an assignment.", Where.enclose(scalarTypeToken.where, identifierToken.where));
    }
    const equalToken = this.advance(); // eat =

    if (!this.has(TokenType.LeftCurly)) {
      throw new WhereError("This array declaration is missing an array literal enclosed in {}.", Where.enclose(scalarTypeToken.where, equalToken.where));
    }

    const rightNode = this.expression();

    return new ast.ArrayDeclaration(identifierToken.text, type, rightNode, Where.enclose(scalarTypeToken.where, rightNode.where));
  }

  arrayLiteral(): ast.ArrayLiteral {
    const elementNodes = [];
    const leftToken = this.advance(); // eat {

    if (this.hasOtherwise(TokenType.RightCurly)) {
      elementNodes.push(this.expression());  
      while (this.has(TokenType.Comma)) {
        this.advance(); // eat ,
        elementNodes.push(this.expression());  
      }
    }

    if (!this.has(TokenType.RightCurly)) {
      const lastWhere = elementNodes.length === 0 ? leftToken.where : elementNodes[elementNodes.length - 1].where;
      throw new WhereError("This array literal is missing its `}`.", lastWhere);
    }
    const rightToken = this.advance(); // eat }

    return new ast.ArrayLiteral(elementNodes, Where.enclose(leftToken.where, rightToken.where));
  }

  returnStatement(inFunctionDefinition: boolean): ast.Return {
    const returnToken = this.advance();

    if (!inFunctionDefinition) {
      throw new WhereError(`A return statement is allowed only in a function.`, returnToken.where);
    }

    if (this.hasOtherwise(TokenType.Linebreak)) {
      const node = this.expression();
      return new ast.Return(node, Where.enclose(returnToken.where, node.where));
    } else {
      return new ast.Return(null, returnToken.where);
    }
  }

  initializedDeclaration() {
    const typeToken = this.advance() as TextToken;
    const identifierToken = this.advance() as TextToken;
    this.advance(); // eat =
    const rightNode = this.expression();
    return new ast.Declaration(identifierToken.text, typeToken.text, rightNode, Where.enclose(typeToken.where, rightNode.where));
  }

  uninitializedDeclaration() {
    const typeToken = this.advance() as TextToken;
    const identifierToken = this.advance() as TextToken;
    return new ast.Declaration(identifierToken.text, typeToken.text, null, Where.enclose(typeToken.where, identifierToken.where));
  }

  ifStatement(inFunctionDefinition: boolean): ast.Statement {
    const ifToken = this.advance();
    const conditionNode = this.parenthesizedExpression(ifToken.where, "An if statement's condition").node;
    const thenBlock = this.indentedBlock(inFunctionDefinition, 'if statement', Where.enclose(ifToken.where, conditionNode.where), TokenType.Else, TokenType.End);

    let elseBlock = null;
    if (this.has(TokenType.Else)) {
      const elseToken = this.advance();
      elseBlock = this.indentedBlock(inFunctionDefinition, 'else branch', elseToken.where, TokenType.End);
    }

    if (!this.has(TokenType.End) || !this.hasAhead(TokenType.If, 1)) {
      throw new WhereError(`The if statement must be closed with \`end if\`.`, Where.enclose(ifToken.where, elseBlock ? elseBlock.where : thenBlock.where));
    }
    this.advance();
    const endToken = this.advance();

    return new ast.If(conditionNode, thenBlock, elseBlock, Where.enclose(ifToken.where, endToken.where));
  }

  whileStatement(inFunctionDefinition: boolean): ast.Statement {
    const whileToken = this.advance();
    const conditionNode = this.parenthesizedExpression(whileToken.where, "A while statement's condition").node;

    const block = this.indentedBlock(inFunctionDefinition, 'while loop', Where.enclose(whileToken.where, conditionNode.where), TokenType.End);

    if (!this.has(TokenType.End) || !this.hasAhead(TokenType.While, 1)) {
      throw new WhereError(`The loop must be closed with \`end while\`.`, block.where);
    }
    this.advance();
    const endToken = this.advance();

    return new ast.While(conditionNode, block, Where.enclose(whileToken.where, endToken.where));
  }

  forStatement(inFunctionDefinition: boolean): ast.Statement {
    const forToken = this.advance();

    if (!this.has(TokenType.LeftParenthesis)) {
      throw new WhereError('The for loop is missing a left parenthesis in its header.', forToken.where);
    }
    this.advance(); // eat (

    let initializationNode = null;
    if (this.hasTwoIdentifiers() && this.hasAhead(TokenType.Equal, 2)) {
      initializationNode = this.initializedDeclaration();
    } else if (this.hasOtherwise(TokenType.Semicolon)) {
      initializationNode = this.otherStatement();
    }

    if (!this.has(TokenType.Semicolon)) {
      throw new WhereError("The for loop is missing a semicolon between its initialization and condition.", initializationNode?.where ?? forToken.where);
    }
    this.advance(); // eat ;

    const conditionNode = this.expression();

    if (!this.has(TokenType.Semicolon)) {
      throw new WhereError("The for loop is missing a semicolon between its condition and increment.", conditionNode.where);
    }
    const semicolonTokenB = this.advance(); // eat ;

    const increments = [];
    if (this.hasOtherwise(TokenType.RightParenthesis)) {
      increments.push(this.otherStatement());
      while (this.has(TokenType.Comma)) {
        this.advance(); // eat ,
        increments.push(this.otherStatement());
      }
    }

    const incrementBlockWhere = increments.length === 0 ? semicolonTokenB.where : Where.enclose(increments[0].where, increments[increments.length - 1].where);
    const incrementBlock = new ast.Block(increments, incrementBlockWhere);

    if (!this.has(TokenType.RightParenthesis)) {
      throw new WhereError("The for loop is missing a right parenthesis in its header.", Where.enclose(forToken.where, incrementBlock.where));
    }
    const rightToken = this.advance(); // eat )

    const block = this.indentedBlock(inFunctionDefinition, 'for loop', Where.enclose(forToken.where, rightToken.where), TokenType.End);

    if (!this.has(TokenType.End) || !this.hasAhead(TokenType.For, 1)) {
      throw new WhereError(`The loop must be closed with \`end for\`.`, block.where);
    }
    this.advance();
    const endToken = this.advance();

    return new ast.For(initializationNode, conditionNode, incrementBlock, block, Where.enclose(forToken.where, endToken.where));
  }

  doStatement(inFunctionDefinition: boolean): ast.Statement {
    const doToken = this.advance();
    const block = this.indentedBlock(inFunctionDefinition, 'do-while loop', doToken.where, TokenType.While);

    if (!this.has(TokenType.While)) {
      throw new WhereError(`The loop must be closed with \`while\` and a condition.`, block.where);
    }
    const whileToken = this.advance(); // eat while

    const conditionNode = this.parenthesizedExpression(whileToken.where, "A do loop's condition").node;

    return new ast.DoWhile(block, conditionNode, Where.enclose(doToken.where, conditionNode.where));
  }

  repeatStatement(inFunctionDefinition: boolean): ast.Statement {
    const repeatToken = this.advance();
    const block = this.indentedBlock(inFunctionDefinition, 'repeat-until loop', repeatToken.where, TokenType.Until);

    if (!this.has(TokenType.Until)) {
      throw new WhereError(`The loop must be closed with \`until\` and a condition.`, block.where);
    }
    const untilToken = this.advance(); // eat while

    const conditionNode = this.parenthesizedExpression(repeatToken.where, "A repeat loop's condition").node;

    return new ast.RepeatUntil(block, conditionNode, Where.enclose(repeatToken.where, conditionNode.where));
  }

  printStatement(): ast.Statement {
    const printToken = this.advance();
    const parameterNode = this.expression();
    return new ast.Print(parameterNode, Where.enclose(printToken.where, parameterNode.where));
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
    return this.logicalOr();
  }

  logicalOr(): ast.Expression {
    let leftNode = this.logicalAnd();
    while (this.has(TokenType.Or)) {
      const operatorToken = this.advance();
      const rightNode = this.logicalAnd();
      leftNode = new ast.LogicalOr(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
    }
    return leftNode;
  }

  logicalAnd(): ast.Expression {
    let leftNode = this.bitwiseOr();
    while (this.has(TokenType.And)) {
      const operatorToken = this.advance();
      const rightNode = this.bitwiseOr();
      leftNode = new ast.LogicalAnd(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
    }
    return leftNode;
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
      if (operatorToken.type === TokenType.DoubleEqual) {
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
    let leftNode = this.additive();
    while (this.has(TokenType.DoubleLessThan) || this.has(TokenType.DoubleGreaterThan)) {
      const operatorToken = this.advance();
      const rightNode = this.additive();
      if (operatorToken.type === TokenType.DoubleLessThan) {
        leftNode = new ast.LeftShift(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
      } else {
        leftNode = new ast.RightShift(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
      }
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
    let leftNode = this.prefixUnary();
    if (this.has(TokenType.DoubleAsterisk)) {
      const operatorToken = this.advance();
      const rightNode = this.prefixUnary();
      leftNode = new ast.Power(leftNode, rightNode, Where.enclose(leftNode.where, rightNode.where));
    }
    return leftNode;
  }

  prefixUnary(): ast.Expression {
    if (this.has(TokenType.Not)) {
      const operatorToken = this.advance();
      const operandNode = this.prefixUnary();
      return new ast.LogicalNegate(operandNode, Where.enclose(operatorToken.where, operandNode.where));
    } else if (this.has(TokenType.Hyphen)) {
      const operatorToken = this.advance();
      const operandNode = this.prefixUnary();
      return new ast.ArithmeticNegate(operandNode, Where.enclose(operatorToken.where, operandNode.where));
    } else if (this.has(TokenType.Tilde)) {
      const operatorToken = this.advance();
      const operandNode = this.prefixUnary();
      return new ast.BitwiseNegate(operandNode, Where.enclose(operatorToken.where, operandNode.where));
    } else {
      return this.postfixUnary();
    }
  }

  postfixUnary(): ast.Expression {
    let leftNode = this.instantiate();
    while (this.hasAny(TokenType.LeftBracket, TokenType.Period)) {
      const operatorToken = this.advance();
      if (operatorToken.type === TokenType.LeftBracket) {
        const indexNode = this.expression();
        if (!this.has(TokenType.RightBracket)) {
          throw new WhereError("The right bracket of this index is missing.", Where.enclose(operatorToken.where, indexNode.where));
        }
        const rightToken = this.advance();
        leftNode = new ast.ArraySubscript(leftNode, indexNode, Where.enclose(leftNode.where, rightToken.where));
      } else {
        if (this.has(TokenType.Identifier)) {
          const propertyToken = this.advance() as TextToken;
          if (this.has(TokenType.LeftParenthesis)) {
            const actualsPayload = this.actuals('method', propertyToken.where);
            leftNode = new ast.MethodCall(leftNode, propertyToken.text, actualsPayload.actuals, Where.enclose(leftNode.where, actualsPayload.where));
          } else {
            leftNode = new ast.Member(leftNode, propertyToken.text, Where.enclose(leftNode.where, propertyToken.where));
          }
        } else {
          throw new WhereError("The property name after `.` is missing.", operatorToken.where);
        }
      }
    }
    return leftNode;
  }

  instantiate() {
    if (this.has(TokenType.New)) {
      const newToken = this.advance();
      if (!this.has(TokenType.Identifier)) {
        throw new WhereError("A class name is missing after `new`.", newToken.where);
      }
      const identifierToken = this.advance() as TextToken;
      return new ast.Instantiation(identifierToken.text, Where.enclose(newToken.where, identifierToken.where));
    } else {
      return this.apex();
    }
  }

  actuals(context: string, firstWhere: Where) {
    const leftToken = this.advance();
    let lastWhere = leftToken.where;
    const actuals = [];
    if (this.hasOtherwise(TokenType.RightParenthesis)) {
      actuals.push(this.expression());
      while (this.has(TokenType.Comma)) {
        this.advance();
        actuals.push(this.expression());
      }
      lastWhere = actuals[actuals.length - 1].where;
    }
    if (!this.has(TokenType.RightParenthesis)) {
      throw new WhereError(`A ${context} call's parameters must be enclosed in parentheses.`, Where.enclose(firstWhere, lastWhere));
    }
    const rightToken = this.advance();
    return {
      actuals,
      where: Where.enclose(firstWhere, rightToken.where),
    };
  }

  variable() {
    const identifierToken = this.advance() as TextToken;
    if (this.has(TokenType.LeftParenthesis)) {
      const actualsPayload = this.actuals('function', identifierToken.where);
      return new ast.FunctionCall(identifierToken.text, actualsPayload.actuals, Where.enclose(identifierToken.where, actualsPayload.where));
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
    } else if (this.has(TokenType.True)) {
      const token = this.advance();
      return new ast.Boolean(true, token.where);
    } else if (this.has(TokenType.False)) {
      const token = this.advance();
      return new ast.Boolean(false, token.where);
    } else if (this.has(TokenType.Identifier)) {
      return this.variable();
    } else if (this.has(TokenType.LeftCurly)) {
      return this.arrayLiteral();
    } else if (this.has(TokenType.LeftParenthesis)) {
      const leftParenthesisToken = this.advance();
      const expression = this.expression();
      if (!this.has(TokenType.RightParenthesis)) {
        throw new WhereError('A right parenthesis is missing.', Where.enclose(leftParenthesisToken.where, expression.where));
      }
      const rightToken = this.advance(); // eat )
      expression.where = Where.enclose(expression.where, rightToken.where);
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

export function parsePraxis(tokens: Token[], source: string) {
  return new PraxisParser(tokens, source).parse();
}

export function parsePraxisExpression(tokens: Token[], source: string) {
  return new PraxisParser(tokens, source).expression();
}
