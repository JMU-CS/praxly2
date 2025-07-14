import {Parser} from '../parser.js';
import {Token, TextToken, TokenType} from '../token.js';
import {Where} from '../where.js';
import {ParseError} from '../error.js';
import * as ast from '../ast.js';
import {Type, ArrayType, SizedArrayType, AnyType} from '../type.js';

// https://praxis.ets.org/on/demandware.static/-/Library-Sites-ets-praxisLibrary/default/pdfs/5652.pdf

enum BlockMode {
  Curly,
  End,
};

class PythonParser extends Parser {
  hasTwoIdentifiers() {
    return this.has(TokenType.Identifier) && this.hasAhead(TokenType.Identifier, 1);
  }

  parse(): ast.Block {
    const statements = [];
    let blank = this.skipLinebreaks();
    if (blank.n > 0) {
      statements.push(new ast.Blank(blank.n, blank.where));
    }
    while (!this.has(TokenType.EndOfSource)) {
      statements.push(this.topLevelStatement());
      let blank = this.skipLinebreaks();
      if (blank.n > 0) {
        statements.push(new ast.Blank(blank.n, blank.where));
      }
    }
    if (statements.length === 0) {
      return new ast.Block(statements, new Where(0, 0));
    } else {
      return new ast.Block(statements, Where.enclose(statements[0].where, statements[statements.length - 1].where));
    }
  }

  arrayType(elementType: Type): Type {
    if (this.has(TokenType.LeftBracket)) {
      let type;
      const leftToken = this.advance(); // eat [

      // See if there's a range.
      if (this.has(TokenType.Integer) && this.hasAhead(TokenType.DotDot, 1) && this.hasAhead(TokenType.Integer, 2)) {
        const minToken = this.advance() as TextToken;
        this.advance(); // eat ..
        const maxToken = this.advance() as TextToken;
        if (minToken.text !== '0') {
          throw new ParseError("The starting index must be 0.", minToken.where);
        }
        const size = parseInt(maxToken.text) + 1;
        if (!this.has(TokenType.RightBracket)) {
          throw new ParseError("The left bracket of this array type is missing its matching right bracket.", leftToken.where);
        }
        const rightToken = this.advance(); // eat ]
        return new SizedArrayType(this.arrayType(elementType), size, Where.enclose(elementType.where, rightToken.where));
      } else {
        if (!this.has(TokenType.RightBracket)) {
          throw new ParseError("The left bracket of this array type is missing its matching right bracket.", leftToken.where);
        }
        const rightToken = this.advance(); // eat ]
        return new ArrayType(this.arrayType(elementType), null, Where.enclose(elementType.where, rightToken.where));
      }
    } else {
      return elementType;
    }
  }

  type(): Type {
    const scalarTypeToken = this.advance() as TextToken;
    let type = new Type(scalarTypeToken.text, scalarTypeToken.where);

    // int[0..2][0..1] is  3-array of 2-arrays. Currently I'm parsing this as
    // (int[0..2])[0..1]. But the brackets are right-associative. Can I parse
    // this with a recursive helper?

    // Gobble up arrays.
    if (this.has(TokenType.LeftBracket)) {
      type = this.arrayType(type);
    }

    return type;
  }

  topLevelStatement(): ast.Statement {
    // functions are defined with def and a following identifier with ()
    if (this.has(TokenType.Function) && this.hasAhead(TokenType.LeftParenthesis, 2)) {
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
    const classToken = this.advance() as TextToken; // eat Class

    if (!this.has(TokenType.Identifier)) {
      throw new ParseError("The class name is missing.", classToken.where);
    }
    const classIdentifierToken = this.advance() as TextToken;
    let lastWhere = classIdentifierToken.where;

    let superclass = null;

    if (!this.has(TokenType.Colon)) {
      throw new ParseError("A : is missing after the class name.", lastWhere);
    }


    if (!this.has(TokenType.Linebreak)) {
      throw new ParseError("A linebreak is missing after this class header.", Where.enclose(classToken.where, lastWhere));
    }
    this.advance(); // eat linebreak


    this.skipLinebreaks();

    const instanceVariableDeclarations: ast.InstanceVariableDeclaration[] = [];
    const methodDefinitions: ast.MethodDefinition[] = [];

    if (this.has(TokenType.Indent)) {
      this.advance(); // eat indent

      while (this.hasOtherwise(TokenType.Unindent)) {
        let firstWhere = null;

        // check if instance variable
        if (!this.has(TokenType.Identifier)) {
          throw new ParseError("A name is missing for this variable.", lastWhere);
        } else {
          const memberIdentifierToken = this.advance() as TextToken;
          firstWhere = firstWhere ?? memberIdentifierToken.where;

          // The original Praxis document says nothing about how instance
          // variables are initialized. On the outside through public access?
          // On the inside through a constructor? On the inside through direct
          // assignment in the declaration? For the time being, let's allow
          // direct assignment, since that's simplest and doesn't depend on
          // visibility.

          let rightNode = null;
          if (this.has(TokenType.Equal)) {
            this.advance(); // eat =
            rightNode = this.expression();
          }

          const declaration = new ast.InstanceVariableDeclaration(memberIdentifierToken.text, Type.Any, null, rightNode, Where.enclose(firstWhere, memberIdentifierToken.where));
          instanceVariableDeclarations.push(declaration);
        }

        // check if function
        if (this.has(TokenType.Function)) {
          const core = this.functionDefinition();
          const declaration = new ast.MethodDefinition(core.identifier, core.formals, Type.Any, core.body, null, Where.enclose(firstWhere, core.body.where));
          methodDefinitions.push(declaration);
        }

        this.skipLinebreaks();
      }

      if (!this.has(TokenType.Unindent)) {
        throw new ParseError("The class must be closed.", lastWhere);
      }
      this.advance();
    }

    return new ast.ClassDefinition(classIdentifierToken.text, superclass, instanceVariableDeclarations, methodDefinitions, Where.enclose(classToken.where, lastWhere));
  }

  subroutineCore(context: string, firstWhere: Where) {
    const identifierToken = this.advance() as TextToken;

    const leftToken = this.advance(); // eat (
    let latestToken = leftToken;

    const formals = [];
    if (this.has(TokenType.Identifier)) {
      // if (!this.has(TokenType.Identifier)) {
      //   throw new ParseError("A parameter must have both a type and a name.", type.where);
      // }
      const identifierToken = this.advance() as TextToken;
      latestToken = identifierToken;
      formals.push(new ast.Formal(identifierToken.text, Type.Any));
      while (this.has(TokenType.Comma)) {
        let comma = this.advance(); // pass the ,
        // const type = this.type();
        if (!this.has(TokenType.Identifier)) {
          throw new ParseError(`A ${context} must have a name.`, comma.where);
        }
        const identifierToken = this.advance() as TextToken;
        latestToken = identifierToken;
        formals.push(new ast.Formal(identifierToken.text, Type.Any));
      }
    }

    if (!this.has(TokenType.RightParenthesis)) {
      throw new ParseError(`A ${context}'s parameter must be enclosed in parentheses.`, Where.enclose(firstWhere, latestToken.where));
    }
    const rightToken = this.advance(); // eat )

    if (!this.has(TokenType.Colon)) {
      throw new ParseError(`A ${context}'s definition must include a :`, Where.enclose(firstWhere, rightToken.where));
    }
    const colon = this.advance(); // eat :

    const block = this.block(true, 'function definition', Where.enclose(firstWhere, colon.where));


    return {
      identifier: identifierToken.text,
      formals,
      block,
    };
  }

  functionDefinition(): ast.FunctionDefinition {
    // if (!this.has(TokenType.Function)) {
    //   throw new ParseError("Function definitions must start with keyword def", Where.enclose())
    // }
    const def = this.advance(); // eat def
    const core = this.subroutineCore('function', def.where);
    return new ast.FunctionDefinition(core.identifier, core.formals, Type.Any, core.block, Where.enclose(def.where, core.block.where));
  }

  block(inFunctionDefinition: boolean, contextLabel: string, contextWhere: Where): ast.Block {
    // if (this.has(TokenType.LeftCurly)) {
    //   return [this.curlyBlock(inFunctionDefinition, contextLabel, contextWhere), BlockMode.Curly];
    // } else {
      return this.indentedBlock(inFunctionDefinition, contextLabel, contextWhere)
    // }
  }

  curlyBlock(inFunctionDefinition: boolean, contextLabel: string, contextWhere: Where) {
    const leftToken = this.advance(); // eat {

    if (!this.has(TokenType.Linebreak)) {
      throw new ParseError(`A linebreak is missing after the header of this ${contextLabel}.`, contextWhere);
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
        throw new ParseError(`The block in this ${contextLabel} doesn't end.`, contextWhere);
      }
      this.advance();
    }

    if (!this.has(TokenType.RightCurly)) {
      throw new ParseError(`The block in this ${contextLabel} must be closed with \`}\`.`, contextWhere);
    }
    const rightToken = this.advance(); // eat }

    return new ast.Block(statements, Where.enclose(leftToken.where, rightToken.where));
  }

  indentedBlock(inFunctionDefinition: boolean, contextLabel: string, contextWhere: Where) {
    if (!this.has(TokenType.Linebreak)) {
      throw new ParseError(`A linebreak is missing after the header of this ${contextLabel}.`, contextWhere);
    }
    this.advance();

    let statements = [];
    if (this.has(TokenType.Indent)) {
      const indentToken = this.advance();
      while (!this.has(TokenType.Unindent) && !this.has(TokenType.EndOfSource)) {
        const statement = this.statement(inFunctionDefinition);
        statements.push(statement);
      }

      if (this.has(TokenType.Unindent)) {
        this.advance();
      }
    }

    const blockWhere = statements.length > 0 ? Where.enclose(statements[0].where, statements[statements.length - 1].where) : contextWhere;
    return new ast.Block(statements, blockWhere);
  }

  statementLinebreak() {
    if (this.has(TokenType.Linebreak)) {
      this.advance();
    } else if (!this.has(TokenType.EndOfSource)) {
      throw new ParseError(`A statement has stray text: \`${this.tokens[this.i].where.text(this.source)}\`.`, this.tokens[this.i].where);
    }
  }

  statement(inFunctionDefinition: boolean): ast.Statement {
    let statement;

    if (this.has(TokenType.If)) {
      statement = this.ifStatement(inFunctionDefinition);
    } else if (this.has(TokenType.While)) {
      statement = this.whileStatement(inFunctionDefinition);
    } else if (this.has(TokenType.For)) {
      throw new ParseError(`For loops are not supported.`, this.advance().where); // for loops currently not supported
    } else if (this.has(TokenType.Print)) {
      statement = this.printStatement();
    } else if (this.has(TokenType.LineComment)) {
      const token = this.advance() as TextToken;
      statement = new ast.LineComment(token.text, token.where);
    } else if (this.has(TokenType.Identifier) && this.hasAhead(TokenType.Equal, 1)) {
      // variable will be assigned an array literal
      if (this.hasAhead(TokenType.LeftBracket, 2)) {
        statement = this.arrayDeclaration();
      } else {
        // variable will be assigned to a literal
        statement = this.declaration();
      }
    } else if (this.has(TokenType.Return)) {
      statement = this.returnStatement(inFunctionDefinition);
    } else {
      statement = this.otherStatement();
    }

    // Skip past any trailing comment.
    if (this.has(TokenType.LineComment)) {
      this.advance();
    }

    this.statementLinebreak();
    return statement;
  }

  hasArrayWithoutIndex() {
    return this.has(TokenType.Identifier) &&
           this.hasAhead(TokenType.LeftBracket, 1) &&
           this.hasAhead(TokenType.RightBracket, 2);
  }

  hasArrayWithRange() {
    return this.has(TokenType.Identifier) &&
           this.hasAhead(TokenType.LeftBracket, 1) &&
           this.hasAhead(TokenType.Integer, 2) &&
           this.hasAhead(TokenType.DotDot, 3) &&
           this.hasAhead(TokenType.Integer, 4) &&
           this.hasAhead(TokenType.RightBracket, 5);
  }

  arrayDeclaration(): ast.ArrayDeclaration {
    const type = Type.Any; // types are not necessary

    if (!this.has(TokenType.Identifier)) {
      throw new ParseError("This array declaration is missing a variable name.", type.where);
    }
    const identifierToken = this.advance() as TextToken;

    if (!this.has(TokenType.Equal)) {
      throw new ParseError("This array declaration is missing an assignment.", Where.enclose(identifierToken.where, identifierToken.where));
    }
    const equalToken = this.advance(); // eat =

    if (!this.has(TokenType.LeftBracket)) {
      throw new ParseError("This array declaration is missing an array literal enclosed in [].", Where.enclose(identifierToken.where, equalToken.where));
    }

    const rightNode = this.expression();

    return new ast.ArrayDeclaration(identifierToken.text, type as ArrayType, rightNode, Where.enclose(type.where, rightNode.where));
  }

  arrayLiteral(): ast.ArrayLiteral {
    const elementNodes = [];
    const leftToken = this.advance(); // eat [

    if (this.hasOtherwise(TokenType.RightBracket)) {
      elementNodes.push(this.expression());
      while (this.has(TokenType.Comma)) {
        this.advance(); // eat ,
        elementNodes.push(this.expression());
      }
    }

    if (!this.has(TokenType.RightBracket)) {
      const lastWhere = elementNodes.length === 0 ? leftToken.where : elementNodes[elementNodes.length - 1].where;
      throw new ParseError("This array literal is missing its `]`.", lastWhere);
    }
    const rightToken = this.advance(); // eat ]

    return new ast.ArrayLiteral(elementNodes, Where.enclose(leftToken.where, rightToken.where));
  }

  returnStatement(inFunctionDefinition: boolean): ast.Return {
    const returnToken = this.advance();

    if (!inFunctionDefinition) {
      throw new ParseError(`A return statement is allowed only in a function.`, returnToken.where);
    }

    if (this.hasOtherwise(TokenType.Linebreak)) {
      const node = this.expression();
      return new ast.Return(node, Where.enclose(returnToken.where, node.where));
    } else {
      return new ast.Return(null, returnToken.where);
    }
  }

  initializedDeclaration() {
    const type = this.type();
    const identifierToken = this.advance() as TextToken;
    this.advance(); // eat =
    const rightNode = this.expression();
    return new ast.Declaration(identifierToken.text, type, rightNode, Where.enclose(type.where, rightNode.where));
  }

  uninitializedDeclaration() {
    const type = this.type();
    const identifierToken = this.advance() as TextToken;
    return new ast.Declaration(identifierToken.text, type, null, Where.enclose(type.where, identifierToken.where));
  }

  declaration() {
    let type = Type.Any; // type can be anything, Where(rightNode.where, rightNode.where)
    const identifierToken = this.advance() as TextToken;
    this.advance(); // eat =
    const rightNode = this.expression();
    return new ast.Declaration(identifierToken.text, type, rightNode, Where.enclose(identifierToken.where, rightNode.where));
  }

  ifStatement(inFunctionDefinition: boolean): ast.Statement {
    const conditionNodes = [];
    const thenBlocks = [];

    const ifToken = this.advance();
    const conditionNode = this.eatCondition(ifToken.where, "An if statement's condition").node;
    let thenBlock;
    let blockMode;
    thenBlock = this.block(inFunctionDefinition, 'if statement', Where.enclose(ifToken.where, conditionNode.where));
    let lastWhere = thenBlock.where;
    conditionNodes.push(conditionNode);
    thenBlocks.push(thenBlock);

    while (this.has(TokenType.Else) && this.hasAhead(TokenType.If, 1)) {
      this.advance(); // eat else
      const ifToken = this.advance();
      const conditionNode = this.parenthesizedExpression(ifToken.where, "An elif statement's condition").node;
      thenBlock = this.block(inFunctionDefinition, 'elif statement', Where.enclose(ifToken.where, conditionNode.where));
      lastWhere = thenBlock.where;
      conditionNodes.push(conditionNode);
      thenBlocks.push(thenBlock);
    }

    let elseBlock = null;
    if (this.has(TokenType.Else)) {
      const elseToken = this.advance();
      elseBlock = this.block(inFunctionDefinition, 'else branch', elseToken.where);
      lastWhere = elseBlock.where;
    }

    return new ast.If(conditionNodes, thenBlocks, elseBlock, Where.enclose(ifToken.where, lastWhere));
  }

  eatCondition(predecessorWhere: Where, prefix: string) {
    // goal - eat until : is found
    const node = this.expression(); // this should eat up until the :

    if (!this.has(TokenType.Colon)) {
      throw new ParseError(`${prefix} must include ':' at the end.`, predecessorWhere);
    }
    const endToken = this.advance(); // eat :

    return {
      node,
      where: Where.enclose(predecessorWhere, endToken.where)
    };
  }

  whileStatement(inFunctionDefinition: boolean): ast.Statement {
    const whileToken = this.advance();
    const conditionNode = this.eatCondition(whileToken.where, "A while statement's condition").node;

    const block = this.block(inFunctionDefinition, 'while loop', Where.enclose(whileToken.where, conditionNode.where));
    let lastWhere = block.where;

    return new ast.While(conditionNode, block, Where.enclose(whileToken.where, lastWhere));
  }

  forStatement(inFunctionDefinition: boolean): ast.Statement {
    const forToken = this.advance(); // eat for
    let lastWhere = forToken.where;

    if (!this.has(TokenType.LeftParenthesis)) {
      throw new ParseError('The for loop is missing a left parenthesis in its header.', forToken.where);
    }
    this.advance(); // eat (

    let initializationNode = null;
    if (this.hasTwoIdentifiers() && this.hasAhead(TokenType.Equal, 2)) {
      initializationNode = this.initializedDeclaration();
      lastWhere = initializationNode.where;
    } else if (this.hasOtherwise(TokenType.Semicolon)) {
      initializationNode = this.otherStatement();
      lastWhere = initializationNode.where;
    }

    if (!this.has(TokenType.Semicolon)) {
      throw new ParseError("The for loop is missing a semicolon between its initialization and condition.", lastWhere);
    }
    this.advance(); // eat ;

    const conditionNode = this.expression();

    if (!this.has(TokenType.Semicolon)) {
      throw new ParseError("The for loop is missing a semicolon between its condition and increment.", conditionNode.where);
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
    lastWhere = incrementBlockWhere;

    if (!this.has(TokenType.RightParenthesis)) {
      throw new ParseError("The for loop is missing a right parenthesis in its header.", Where.enclose(forToken.where, lastWhere));
    }
    const rightToken = this.advance(); // eat )

    const block = this.block(inFunctionDefinition, 'for loop', Where.enclose(forToken.where, rightToken.where));
    lastWhere = block.where;

    return new ast.For(initializationNode, conditionNode, incrementBlock, block, Where.enclose(forToken.where, lastWhere));
  }

  printStatement(): ast.Print {
    const printToken = this.advance(); // eat print

    if (!this.has(TokenType.LeftParenthesis)) {
      throw new ParseError(`Print statement needs a opening parenthesis`, printToken.where);
    }
    const leftParenthesis = this.advance(); // eat (
    const parameterNode = this.expression();

    // In Praxly, what character comes after the print is determined by a
    // trailing comment. The comment text may be "space" or "nothing". Any
    // other text leads to linebreak.
    let trailer = "\n";
    if (this.has(TokenType.LineComment)) {
      const commentToken = this.advance() as TextToken;
      if (commentToken.text.toLowerCase() === 'space') {
        trailer = ' ';
      } else if (commentToken.text.toLowerCase() === 'nothing') {
        trailer = '';
      }
    }

    if (!this.has(TokenType.RightParenthesis)) {
      throw new ParseError(`Print statement needs a closing parenthesis`, parameterNode.where);
    }
    const rightParenthesis = this.advance(); // eat )

    let statement = new ast.Print(parameterNode, trailer, Where.enclose(printToken.where, rightParenthesis.where));

    return statement;
  }

  otherStatement(): ast.Statement {
    const expression = this.expression();
    if (this.has(TokenType.Equal)) {
      this.advance();
      const rightExpression = this.expression();
      return new ast.Assignment(expression, rightExpression, Where.enclose(expression.where, rightExpression.where));
    } else {
      return new ast.ExpressionStatement(expression);
    }
  }

  parenthesizedExpression(predecessorWhere: Where, prefix: string) {
    if (!this.has(TokenType.LeftParenthesis)) {
      throw new ParseError(`${prefix} must be enclosed in parentheses.`, predecessorWhere);
    }
    const leftToken = this.advance(); // eat (

    const node = this.expression();

    if (!this.has(TokenType.RightParenthesis)) {
      throw new ParseError(`${prefix} must be enclosed in parentheses.`, Where.enclose(predecessorWhere, node.where));
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
    while (this.hasAny(TokenType.LeftBracket, TokenType.Period, TokenType.PlusPlus, TokenType.HyphenHyphen)) {
      const operatorToken = this.advance();
      if (operatorToken.type === TokenType.LeftBracket) {
        const indexNode = this.expression();
        if (!this.has(TokenType.RightBracket)) {
          throw new ParseError("The right bracket of this index is missing.", Where.enclose(operatorToken.where, indexNode.where));
        }
        const rightToken = this.advance();
        leftNode = new ast.ArraySubscript(leftNode, indexNode, Where.enclose(leftNode.where, rightToken.where));
      } else if (operatorToken.type === TokenType.PlusPlus) {
        leftNode = new ast.PostIncrement(leftNode, Where.enclose(leftNode.where, operatorToken.where));
      } else if (operatorToken.type === TokenType.HyphenHyphen) {
        leftNode = new ast.PostDecrement(leftNode, Where.enclose(leftNode.where, operatorToken.where));
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
          throw new ParseError("The property name after `.` is missing.", operatorToken.where);
        }
      }
    }
    return leftNode;
  }

  instantiate() {
    if (this.has(TokenType.New)) {
      const newToken = this.advance();
      if (!this.has(TokenType.Identifier)) {
        throw new ParseError("A class name is missing after `new`.", newToken.where);
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
      throw new ParseError(`A ${context} call's parameters must be enclosed in parentheses.`, Where.enclose(firstWhere, lastWhere));
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
    } else if (this.has(TokenType.Double)) {
      const token = this.advance() as TextToken;
      return new ast.Double(parseFloat(token.text), token.where);
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
    } else if (this.has(TokenType.LeftBracket)) {
      return this.arrayLiteral();
    } else if (this.has(TokenType.LeftParenthesis)) {
      const leftToken = this.advance();
      const expression = this.expression();
      if (!this.has(TokenType.RightParenthesis)) {
        throw new ParseError('A right parenthesis is missing.', Where.enclose(leftToken.where, expression.where));
      }
      const rightToken = this.advance(); // eat )
      return new ast.Association(expression, Where.enclose(leftToken.where, rightToken.where));
    } else {
      if (this.i < this.tokens.length) {
        throw new ParseError(`An unexpected token was encountered: ${this.tokens[this.i].toPretty(this.source)}.`, this.tokens[this.i].where);
      } else {
        throw new Error('The program ended unexpectedly.');
      }
    }
  }
}

export function parsePython(tokens: Token[], source: string) {
  return new PythonParser(tokens, source).parse();
}

export function parsePythonExpression(tokens: Token[], source: string) {
  return new PythonParser(tokens, source).expression();
}
