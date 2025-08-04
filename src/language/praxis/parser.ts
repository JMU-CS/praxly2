import {Parser} from '../parser.js';
import {Token, TextToken, TokenType} from '../token.js';
import {Where} from '../where.js';
import {ParseError} from '../error.js';
import * as ast from '../ast.js';
import {Type, LazyClassType, ArrayType, SizedArrayType, Visibility} from '../type.js';

// https://praxis.ets.org/on/demandware.static/-/Library-Sites-ets-praxisLibrary/default/pdfs/5652.pdf

enum BlockMode {
  Curly,
  End,
};

class PraxisParser extends Parser {
  tokenTypeToNode: Map<TokenType, new (leftNode: ast.Node, rightNode: ast.Node, where: Where) => ast.Expression>;

  constructor(tokens: Token[], source: string) {
    super(tokens, source);
    this.tokenTypeToNode = new Map([
      [TokenType.Plus, ast.Add],
      [TokenType.Hyphen, ast.Subtract],
      [TokenType.Asterisk, ast.Multiply],
      [TokenType.ForwardSlash, ast.Divide],
      [TokenType.Percent, ast.Remainder],
      [TokenType.DoubleAsterisk, ast.Power],
      [TokenType.DoubleLessThan, ast.LeftShift],
      [TokenType.DoubleGreaterThan, ast.RightShift],
      [TokenType.LessThan, ast.LessThan],
      [TokenType.GreaterThan, ast.GreaterThan],
      [TokenType.LessThanOrEqual, ast.LessThanOrEqual],
      [TokenType.GreaterThanOrEqual, ast.GreaterThanOrEqual],
      [TokenType.DoubleEqual, ast.Equal],
      [TokenType.NotEqual, ast.NotEqual],
      [TokenType.Circumflex, ast.Xor],
      [TokenType.Ampersand, ast.BitwiseAnd],
      [TokenType.Pipe, ast.BitwiseOr],
      [TokenType.And, ast.LogicalAnd],
      [TokenType.Or, ast.LogicalOr],
    ]);
  }

  select(tokens: TokenType[]): TokenType | null {
    if (this.i < this.tokens.length) {
      const token = this.tokens[this.i];
      if (tokens.includes(token.type)) {
        this.advance();
        return token.type;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  hasTwoIdentifiers() {
    return this.has(TokenType.Identifier) && this.hasAhead(TokenType.Identifier, 1);
  }

  parse(): ast.Block {
    // for (let i = 0; i < this.tokens.length; ++i) {
      // console.log(this.tokens[i].toPretty(this.source));
    // }

    const statements = [];
    let blank = this.skipLinebreaks();
    if (blank.n > 0) {
      statements.push(new ast.Blank(blank.n, blank.where));
    }
    while (this.hasOtherwise(TokenType.EndOfSource)) {
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
        return new SizedArrayType(this.arrayType(elementType), size, true, Where.enclose(elementType.where, rightToken.where));
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
    const firstLetter = scalarTypeToken.text.charAt(0);

    let type;
    if (firstLetter === firstLetter.toUpperCase()) {
      type = new LazyClassType(scalarTypeToken.text, scalarTypeToken.where);
    } else {
      type = new Type(scalarTypeToken.text, scalarTypeToken.where);
    }

    // Gobble up arrays.
    if (this.has(TokenType.LeftBracket)) {
      type = this.arrayType(type);
    }

    return type;
  }

  topLevelStatement(): ast.Statement {
    if (this.hasTwoIdentifiers() && this.hasAhead(TokenType.LeftParenthesis, 2)) {
      const defineNode = this.functionDefinition();
      this.statementLinebreak();
      return defineNode;
    } else if (this.hasTwoIdentifiers() && this.hasAhead(TokenType.Linebreak, 2) && this.hasAhead(TokenType.Indent, 3)) {
      throw new ParseError("This function is missing parentheses.", this.tokens[this.i + 1].where);
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
      throw new ParseError("The class name is missing.", classToken.where);
    }
    const classIdentifierToken = this.advance() as TextToken;
    let lastWhere = classIdentifierToken.where;

    let superclass = null;
    if (this.has(TokenType.Extends)) {
      const extendsToken = this.advance();
      if (!this.has(TokenType.Identifier)) {
        throw new ParseError("The superclass name is missing.", extendsToken.where);
      }
      const superclassToken = this.advance() as TextToken;
      lastWhere = superclassToken.where;
      superclass = superclassToken.text;
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
        let visibility = null;
        let firstWhere = null;
        if (this.has(TokenType.Public) || this.has(TokenType.Private)) {
          const visibilityToken = this.advance(); // eat public/private
          visibility = visibilityToken.type === TokenType.Public ? Visibility.Public : Visibility.Private;
          lastWhere = visibilityToken.where;
          firstWhere = visibilityToken.where;
        }

        if (this.has(TokenType.Indent)) {
          throw new ParseError("The code has stray indentation.", this.tokens[this.i].where);
        } else if (!this.has(TokenType.Identifier)) {
          throw new ParseError("A type is missing.", this.tokens[this.i].where);
        }
        const type = this.type();
        firstWhere = firstWhere ?? type.where;

        if (!this.has(TokenType.Identifier)) {
          throw new ParseError("A name is missing after this type.", lastWhere);
        }

        if (this.hasAhead(TokenType.LeftParenthesis, 1)) {
          const core = this.subroutineCore('method', Where.enclose(type.where, lastWhere));
          const declaration = new ast.MethodDefinition(core.identifier, core.formals, type, core.block, visibility, Where.enclose(firstWhere, core.block.where));
          methodDefinitions.push(declaration);
        } else {
          const memberIdentifierToken = this.advance() as TextToken;

          // The original Praxis document says nothing about how instance
          // variables are initialized. On the outside through public access?
          // On the inside through a constructor? On the inside through direct
          // assignment in the declaration? For the time being, let's allow
          // direct assignment, since that's simplest and doesn't depend on
          // visibility.

          let rightNode = null;
          if (this.has(TokenType.Equal)) {
            this.advance();
            rightNode = this.expression();
          } else if (this.has(TokenType.Linebreak) && this.hasAhead(TokenType.Indent, 1)) {
            throw new ParseError("This method is missing parentheses.", memberIdentifierToken.where);
          }

          const declaration = new ast.InstanceVariableDeclaration(memberIdentifierToken.text, type, visibility, rightNode, Where.enclose(firstWhere, memberIdentifierToken.where));
          instanceVariableDeclarations.push(declaration);
        }

        this.skipLinebreaks();
      }

      if (!this.has(TokenType.Unindent)) {
        throw new ParseError("The class must be closed.", lastWhere);
      }
      this.advance();
    }

    if (!this.has(TokenType.End) || !this.hasAhead(TokenType.Class, 1) || !this.hasAhead(TokenType.Identifier, 2) || (this.tokens[this.i + 2] as TextToken).text !== classIdentifierToken.text) {
      throw new ParseError(`The class must be closed with \`end class ${classIdentifierToken.text}\`.`, Where.enclose(classToken.where, lastWhere));
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
      const type = this.type();
      if (!this.has(TokenType.Identifier)) {
        throw new ParseError("A parameter is missing its name.", type.where);
      }
      const identifierToken = this.advance() as TextToken;
      latestToken = identifierToken;
      formals.push(new ast.Formal(identifierToken.text, type));
      while (this.has(TokenType.Comma)) {
        this.advance();
        const type = this.type();
        if (!this.has(TokenType.Identifier)) {
          throw new ParseError(`A ${context} must have both a type and a name.`, type.where);
        }
        const identifierToken = this.advance() as TextToken;
        latestToken = identifierToken;
        formals.push(new ast.Formal(identifierToken.text, type));
      }
    }

    if (!this.has(TokenType.RightParenthesis)) {
      throw new ParseError(`A ${context}'s parameter must be enclosed in parentheses.`, Where.enclose(firstWhere, latestToken.where));
    }
    const rightToken = this.advance(); // eat )

    const [block, blockMode] = this.block(true, 'function definition', Where.enclose(firstWhere, rightToken.where), TokenType.End);

    if (blockMode === BlockMode.End) {
      if (!this.has(TokenType.End) || !this.hasAhead(TokenType.Identifier, 1) || (this.tokens[this.i + 1] as TextToken).text !== identifierToken.text) {
        throw new ParseError(`The ${context} must be closed with \`end ${identifierToken.text}\`.`, block.where);
      }
      this.advance();
      const endToken = this.advance();
      // TODO: need lastWhere of end token?
    }

    return {
      identifier: identifierToken.text,
      formals,
      block,
    };
  }

  functionDefinition(): ast.FunctionDefinition {
    const type = this.type();
    const core = this.subroutineCore('function', type.where);
    return new ast.FunctionDefinition(core.identifier, core.formals, type, core.block, Where.enclose(type.where, core.block.where));
  }

  block(inFunctionDefinition: boolean, contextLabel: string, contextWhere: Where, ...endTokenTypes: TokenType[]): [ast.Block, BlockMode] {
    if (this.has(TokenType.LeftCurly)) {
      return [this.curlyBlock(inFunctionDefinition, contextLabel, contextWhere), BlockMode.Curly];
    } else {
      return [this.indentedBlock(inFunctionDefinition, contextLabel, contextWhere, endTokenTypes), BlockMode.End]
    }
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

  indentedBlock(inFunctionDefinition: boolean, contextLabel: string, contextWhere: Where, endTokenTypes: TokenType[]) {
    if (!this.has(TokenType.Linebreak)) {
      throw new ParseError(`A linebreak is missing after the header of this ${contextLabel}.`, contextWhere);
    }
    this.advance();

    this.skipLinebreaks();

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
    } else if (!this.hasAny(...endTokenTypes)) {
      throw new ParseError(`The block in this ${contextLabel} is not indented.`, contextWhere);
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
    } else if (this.hasArrayWithoutIndex()) {
      statement = this.arrayDeclaration();
    } else if (this.hasArrayWithRange()) {
      statement = this.arrayDeclaration();
    } else if (this.has(TokenType.Return)) {
      statement = this.returnStatement(inFunctionDefinition);
    } else {
      statement = this.otherStatement();
    }

    if (this.has(TokenType.Semicolon)) {
      const semicolonToken = this.advance();
      statement.hasSemicolon = true;
    }

    // Skip past any trailing comment.
    if (this.has(TokenType.LineComment)) {
      statement.comment = (this.advance() as TextToken).text;
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
    const type = this.type();

    if (!this.has(TokenType.Identifier)) {
      throw new ParseError("This array declaration is missing a variable name.", type.where);
    }
    const identifierToken = this.advance() as TextToken;

    if (!this.has(TokenType.Equal)) {
      throw new ParseError("This array declaration is missing an assignment.", Where.enclose(type.where, identifierToken.where));
    }
    const equalToken = this.advance(); // eat =

    if (!this.has(TokenType.LeftCurly)) {
      throw new ParseError("This array declaration is missing an array literal enclosed in {}.", Where.enclose(type.where, equalToken.where));
    }

    const rightNode = this.expression();

    return new ast.ArrayDeclaration(identifierToken.text, type as ArrayType, rightNode, Where.enclose(type.where, rightNode.where));
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
      throw new ParseError("This array literal is missing its `}`.", lastWhere);
    }
    const rightToken = this.advance(); // eat }

    return new ast.ArrayLiteral(elementNodes, Where.enclose(leftToken.where, rightToken.where));
  }

  returnStatement(inFunctionDefinition: boolean): ast.Return {
    const returnToken = this.advance();

    if (!inFunctionDefinition) {
      throw new ParseError(`A return statement must be within a function.`, returnToken.where);
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

  ifStatement(inFunctionDefinition: boolean): ast.Statement {
    const conditionNodes = [];
    const thenBlocks = [];

    const ifToken = this.advance();
    const conditionNode = this.parenthesizedExpression(ifToken.where, "An if statement's condition").node;
    let thenBlock;
    let blockMode;
    [thenBlock, blockMode] = this.block(inFunctionDefinition, 'if statement', Where.enclose(ifToken.where, conditionNode.where), TokenType.Else, TokenType.End);
    let lastWhere = thenBlock.where;
    conditionNodes.push(conditionNode);
    thenBlocks.push(thenBlock);

    while (this.has(TokenType.Else) && this.hasAhead(TokenType.If, 1)) {
      this.advance(); // eat else
      const ifToken = this.advance();
      const conditionNode = this.parenthesizedExpression(ifToken.where, "An else-if statement's condition").node;
      [thenBlock, blockMode] = this.block(inFunctionDefinition, 'else-if statement', Where.enclose(ifToken.where, conditionNode.where), TokenType.Else, TokenType.End);
      lastWhere = thenBlock.where;
      conditionNodes.push(conditionNode);
      thenBlocks.push(thenBlock);
    }

    let elseBlock = null;
    if (this.has(TokenType.Else)) {
      const elseToken = this.advance();
      [elseBlock, blockMode] = this.block(inFunctionDefinition, 'else branch', elseToken.where, TokenType.End);
      lastWhere = elseBlock.where;
    }

    if (blockMode === BlockMode.End) {
      if (!this.has(TokenType.End) || !this.hasAhead(TokenType.If, 1)) {
        throw new ParseError(`The if statement must be closed with \`end if\`.`, Where.enclose(ifToken.where, lastWhere));
      }
      this.advance();
      const endToken = this.advance();
      lastWhere = endToken.where;
    }

    return new ast.If(conditionNodes, thenBlocks, elseBlock, Where.enclose(ifToken.where, lastWhere));
  }

  whileStatement(inFunctionDefinition: boolean): ast.Statement {
    const whileToken = this.advance();
    const conditionNode = this.parenthesizedExpression(whileToken.where, "A while statement's condition").node;

    const [block, blockMode] = this.block(inFunctionDefinition, 'while loop', Where.enclose(whileToken.where, conditionNode.where), TokenType.End);
    let lastWhere = block.where;

    if (blockMode === BlockMode.End) {
      if (!this.has(TokenType.End) || !this.hasAhead(TokenType.While, 1)) {
        throw new ParseError(`The loop must be closed with \`end while\`.`, block.where);
      }
      this.advance();
      const endToken = this.advance();
      lastWhere = endToken.where;
    }

    return new ast.While(conditionNode, block, Where.enclose(whileToken.where, lastWhere));
  }

  forStatement(inFunctionDefinition: boolean): ast.Statement {
    const forToken = this.advance();
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

    const [block, blockMode] = this.block(inFunctionDefinition, 'for loop', Where.enclose(forToken.where, rightToken.where), TokenType.End);
    lastWhere = block.where;

    if (blockMode === BlockMode.End) {
      if (!this.has(TokenType.End) || !this.hasAhead(TokenType.For, 1)) {
        throw new ParseError(`The loop must be closed with \`end for\`.`, block.where);
      }
      this.advance();
      const endToken = this.advance();
      lastWhere = endToken.where;
    }

    return new ast.For(initializationNode, conditionNode, incrementBlock, block, Where.enclose(forToken.where, lastWhere));
  }

  doStatement(inFunctionDefinition: boolean): ast.Statement {
    const doToken = this.advance();
    const [block, _] = this.block(inFunctionDefinition, 'do-while loop', doToken.where, TokenType.While);

    if (!this.has(TokenType.While)) {
      throw new ParseError(`The loop must be closed with \`while\` and a condition.`, block.where);
    }
    const whileToken = this.advance(); // eat while

    const conditionNode = this.parenthesizedExpression(whileToken.where, "A do loop's condition").node;

    return new ast.DoWhile(block, conditionNode, Where.enclose(doToken.where, conditionNode.where));
  }

  repeatStatement(inFunctionDefinition: boolean): ast.Statement {
    const repeatToken = this.advance();
    const [block, _] = this.block(inFunctionDefinition, 'repeat-until loop', repeatToken.where, TokenType.Until);

    if (!this.has(TokenType.Until)) {
      throw new ParseError(`The loop must be closed with \`until\` and a condition.`, block.where);
    }
    const untilToken = this.advance(); // eat while

    const conditionNode = this.parenthesizedExpression(repeatToken.where, "A repeat loop's condition").node;

    return new ast.RepeatUntil(block, conditionNode, Where.enclose(repeatToken.where, conditionNode.where));
  }

  printStatement(): ast.Print {
    const printToken = this.advance();
    const parameterNode = this.expression();

    let hasSemicolon = false;
    if (this.has(TokenType.Semicolon)) {
      const semicolonToken = this.advance();
      hasSemicolon = true;
    }

    // In Praxly, what character comes after the print is determined by a
    // trailing comment. The comment text may be "space" or "nothing". Any
    // other text leads to linebreak.
    let trailer = "\n";
    if (this.has(TokenType.LineComment)) {
      // Don't advance past the comment token. The statement parser will affix
      // it to the statement node so it can be reconstructed during
      // translation.
      const commentToken = this.tokens[this.i] as TextToken;
      if (commentToken.text.toLowerCase() === 'space') {
        trailer = ' ';
      } else if (commentToken.text.toLowerCase() === 'nothing') {
        trailer = '';
      }
    }

    let statement = new ast.Print(parameterNode, trailer, Where.enclose(printToken.where, parameterNode.where));
    statement.hasSemicolon = hasSemicolon;

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

  binaryOperator(tokens: TokenType[], higher: () => ast.Expression) {
    let left = higher.call(this);
    let tokenType = this.select(tokens);
    // Since the type can be 0, we must explicitly compare to null.
    while (tokenType !== null) {
      const right = higher.call(this);
      const ctor = this.tokenTypeToNode.get(tokenType)!;
      left = new ctor(left, right, Where.enclose(left.where, right.where));
      tokenType = this.select(tokens);
    }
    return left;
  }

  logicalOr(): ast.Expression {
    return this.binaryOperator([TokenType.Or], this.logicalAnd);
  }

  logicalAnd(): ast.Expression {
    return this.binaryOperator([TokenType.And], this.bitwiseOr);
  }

  bitwiseOr(): ast.Expression {
    return this.binaryOperator([TokenType.Pipe], this.xor);
  }

  xor(): ast.Expression {
    return this.binaryOperator([TokenType.Circumflex], this.bitwiseAnd);
  }

  bitwiseAnd(): ast.Expression {
    return this.binaryOperator([TokenType.Ampersand], this.equality);
  }

  equality(): ast.Expression {
    return this.binaryOperator([TokenType.DoubleEqual, TokenType.NotEqual], this.relational);
  }

  relational(): ast.Expression {
    return this.binaryOperator([TokenType.LessThan, TokenType.GreaterThan, TokenType.LessThanOrEqual, TokenType.GreaterThanOrEqual], this.shift);
  }

  shift(): ast.Expression {
    return this.binaryOperator([TokenType.DoubleLessThan, TokenType.DoubleGreaterThan], this.additive);
  }

  additive(): ast.Expression {
    return this.binaryOperator([TokenType.Plus, TokenType.Hyphen], this.multiplicative);
  }

  multiplicative(): ast.Expression {
    return this.binaryOperator([TokenType.Asterisk, TokenType.ForwardSlash, TokenType.Percent], this.power);
  }

  power(): ast.Expression {
    return this.binaryOperator([TokenType.DoubleAsterisk], this.prefixUnary);
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
    while (this.hasAny(TokenType.LeftBracket, TokenType.Period, TokenType.DoublePlus, TokenType.DoubleHyphen)) {
      const operatorToken = this.advance();
      if (operatorToken.type === TokenType.LeftBracket) {
        const indexNode = this.expression();
        if (!this.has(TokenType.RightBracket)) {
          throw new ParseError("The right bracket of this index is missing.", Where.enclose(operatorToken.where, indexNode.where));
        }
        const rightToken = this.advance();
        leftNode = new ast.ArraySubscript(leftNode, indexNode, Where.enclose(leftNode.where, rightToken.where));
      } else if (operatorToken.type === TokenType.DoublePlus) {
        leftNode = new ast.PostIncrement(leftNode, Where.enclose(leftNode.where, operatorToken.where));
      } else if (operatorToken.type === TokenType.DoubleHyphen) {
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
    } else if (this.has(TokenType.Character)) {
      const token = this.advance() as TextToken;
      return new ast.Character(token.text, token.where);
    } else if (this.has(TokenType.String)) {
      const token = this.advance() as TextToken;
      return new ast.String(token.text, token.where);
    } else if (this.has(TokenType.True)) {
      const token = this.advance();
      return new ast.Boolean(true, token.where);
    } else if (this.has(TokenType.False)) {
      const token = this.advance();
      return new ast.Boolean(false, token.where);
    } else if (this.has(TokenType.Null)) {
      const token = this.advance();
      return new ast.Null(token.where);
    } else if (this.has(TokenType.Identifier)) {
      return this.variable();
    } else if (this.has(TokenType.LeftCurly)) {
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
        if (this.has(TokenType.Indent)) {
          throw new ParseError("The code has stray indentation.", this.tokens[this.i].where);
        } else {
          throw new ParseError(`An expression is missing.`, this.tokens[this.i].where);
        }
      } else {
        throw new Error('The program ended unexpectedly.');
      }
    }
  }
}

export function parse(tokens: Token[], source: string) {
  return new PraxisParser(tokens, source).parse();
}

export function parseExpression(tokens: Token[], source: string) {
  return new PraxisParser(tokens, source).expression();
}
