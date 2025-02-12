import {Visitor} from '../visitor.js';
import * as ast from '../ast.js';
import {precedence, associativity, Associativity} from './precedence.js';

type ToStringable = {
  toString(): string;
}

type Formatter = {
  nestingLevel: number,
  indentation: string,
};

export class PraxlyGenerator extends Visitor<Formatter, string> {

  // --------------------------------------------------------------------------
  // Primitives
  // --------------------------------------------------------------------------

  visitPrimitive<T extends ToStringable>(node: ast.Primitive<T>, _formatter: Formatter): string {
    return node.rawValue.toString();
  }

  visitInteger(node: ast.Integer, formatter: Formatter): string {
    return this.visitPrimitive<number>(node, formatter);
  }

  visitFloat(node: ast.Float, formatter: Formatter): string {
    return this.visitPrimitive<number>(node, formatter);
  }

  visitBoolean(node: ast.Boolean, formatter: Formatter): string {
    return this.visitPrimitive<boolean>(node, formatter);
  }

  visitString(node: ast.String, _formatter: Formatter): string {
    return `"${node.rawValue}"`;
  }

  // --------------------------------------------------------------------------
  // Unary Operators
  // --------------------------------------------------------------------------

  visitUnaryOperator(node: ast.UnaryOperator, formatter: Formatter, _operator: string): string {
    let operandPrecedence = precedence.get(node.operandNode.constructor);
    let nodePrecedence = precedence.get(node.constructor);

    let text = '';
    let operandText = node.operandNode.visit(this, formatter);
    text = `(${operandText})`;

    return text;
  }

  visitLogicalNegate(node: ast.LogicalNegate, formatter: Formatter): string {
    return this.visitUnaryOperator(node, formatter, 'not ');
  }

  visitArithmeticNegate(node: ast.ArithmeticNegate, formatter: Formatter): string {
    return this.visitUnaryOperator(node, formatter, '-');
  }

  visitBitwiseNegate(node: ast.BitwiseNegate, formatter: Formatter): string {
    return this.visitUnaryOperator(node, formatter, '~');
  }

  // --------------------------------------------------------------------------
  // Binary Operators
  // --------------------------------------------------------------------------

  visitBinaryOperator(node: ast.BinaryOperator, formatter: Formatter, operator: string): string {
    let leftPrecedence = precedence.get(node.leftNode.constructor);
    let rightPrecedence = precedence.get(node.rightNode.constructor);
    let nodePrecedence = precedence.get(node.constructor);

    let text = '';
    let leftText = node.leftNode.visit(this, formatter);
    let rightText = node.rightNode.visit(this, formatter);

    // We need to parenthesize the left operand if it has lower precedence than
    // the operator. Or if they tie and are right-associative. For example:
    //   (a - b) * c
    //   (a ** b) ** c
    if (leftPrecedence < nodePrecedence ||
        (leftPrecedence == nodePrecedence && associativity.get(nodePrecedence) == Associativity.Right)) {
      text += `(${leftText})`;
    } else {
      text += leftText;
    }

    text += ` ${operator} `;

    // We need to parenthesize the right operand if it has lower precedence than
    // the operator. Or if they tie and are right-associative. For example:
    //   a * (b - c)
    //   a - (b - c)
    if (rightPrecedence < nodePrecedence ||
        (rightPrecedence == nodePrecedence && associativity.get(nodePrecedence) == Associativity.Left)) {
      text += `(${rightText})`;
    } else {
      text += rightText;
    }

    return text;
  }

  visitAdd(node: ast.Add, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '+');
  }

  visitSubtract(node: ast.Subtract, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '-');
  }

  visitMultiply(node: ast.Multiply, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '*');
  }

  visitDivide(node: ast.Divide, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '/');
  }

  visitRemainder(node: ast.Remainder, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '%');
  }

  visitPower(node: ast.Power, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '**');
  }

  visitLessThan(node: ast.LessThan, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '<');
  }

  visitGreaterThan(node: ast.GreaterThan, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '>');
  }

  visitLessThanOrEqual(node: ast.LessThanOrEqual, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '<=');
  }

  visitGreaterThanOrEqual(node: ast.GreaterThanOrEqual, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '>=');
  }

  visitEqual(node: ast.Equal, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '==');
  }

  visitNotEqual(node: ast.NotEqual, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '!=');
  }

  visitLogicalAnd(node: ast.LogicalAnd, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, 'and');
  }

  visitLogicalOr(node: ast.LogicalAnd, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, 'or');
  }

  visitBitwiseAnd(node: ast.BitwiseAnd, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '&');
  }

  visitBitwiseOr(node: ast.BitwiseAnd, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '|');
  }

  visitXor(node: ast.Xor, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '^');
  }

  visitLeftShift(node: ast.LeftShift, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '<<');
  }

  visitRightShift(node: ast.RightShift, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, '>>');
  }

  // --------------------------------------------------------------------------
  // Variables
  // --------------------------------------------------------------------------

  visitAssignment(node: ast.Assignment, formatter: Formatter): string {
    return `${node.leftNode.visit(this, formatter)} = ${node.rightNode.visit(this, formatter)}`;
  }

  visitDeclaration(node: ast.Declaration, formatter: Formatter): string {
    let text = `${node.variableType} ${node.identifier}`;
    if (node.rightNode) {
      text += ` = ${node.rightNode.visit(this, formatter)}`;
    }
    return text;
  }

  visitVariable(node: ast.Variable, _formatter: Formatter): string {
    return node.identifier;
  }

  visitBlock(node: ast.Block, formatter: Formatter): string {
    return node.statements.map(statement => {
      return `${formatter.indentation.repeat(formatter.nestingLevel)}${statement.visit(this, formatter)}\n`;
    }).join('');
  }

  visitPrint(node: ast.Print, formatter: Formatter): string {
    return `print(${node.operandNode.visit(this, formatter)})`;
  }

  visitIf(node: ast.If, formatter: Formatter): string {
    let text = `if (${node.conditionNode.visit(this, formatter)})\n`;
    text += node.thenBlock.visit(this, {...formatter, nestingLevel: formatter.nestingLevel + 1});
    if (node.elseBlock) {
      text += `${formatter.indentation.repeat(formatter.nestingLevel)}else\n`;
      text += node.elseBlock.visit(this, {...formatter, nestingLevel: formatter.nestingLevel + 1});
    }
    text += `${formatter.indentation.repeat(formatter.nestingLevel)}end if`;
    return text;
  }

  visitWhile(node: ast.While, formatter: Formatter): string {
    let text = `while (${node.conditionNode.visit(this, formatter)})\n`;
    text += node.body.visit(this, {...formatter, nestingLevel: formatter.nestingLevel + 1});
    text += `${formatter.indentation.repeat(formatter.nestingLevel)}end while`;
    return text;
  }

  visitDoWhile(node: ast.DoWhile, formatter: Formatter): string {
    let text = "do\n";
    text += node.body.visit(this, {...formatter, nestingLevel: formatter.nestingLevel + 1});
    text += `${formatter.indentation.repeat(formatter.nestingLevel)}while (${node.conditionNode.visit(this, formatter)})`;
    return text;
  }

  visitRepeatUntil(node: ast.RepeatUntil, formatter: Formatter): string {
    let text = "repeat\n";
    text += node.body.visit(this, {...formatter, nestingLevel: formatter.nestingLevel + 1});
    text += `${formatter.indentation.repeat(formatter.nestingLevel)}unless (${node.conditionNode.visit(this, formatter)})`;
    return text;
  }

  visitBlockAsSequence(node: ast.Block, formatter: Formatter): string {
    return node.statements.map(statement => statement.visit(this, formatter)).join(', ');
  }

  visitFor(node: ast.For, formatter: Formatter): string {
    let text = `for (${node.initializationNode?.visit(this, formatter) ?? ''}; ${node.conditionNode.visit(this, formatter)}; ${this.visitBlockAsSequence(node.incrementBlock, formatter)})\n`;
    text += node.body.visit(this, {...formatter, nestingLevel: formatter.nestingLevel + 1});
    text += `${formatter.indentation.repeat(formatter.nestingLevel)}end for`;
    return text;
  }

  visitFunctionDefinition(node: ast.FunctionDefinition, formatter: Formatter): string {
    let text = `${node.returnType} ${node.identifier}(${node.formals.map(formal => formal.identifier).join(', ')})\n`;
    text += node.body.visit(this, {...formatter, nestingLevel: formatter.nestingLevel + 1});
    text += `${formatter.indentation.repeat(formatter.nestingLevel)}end ${node.identifier}`;
    return text;
  }

  visitFunctionCall(node: ast.FunctionCall, formatter: Formatter): string {
    return `${node.identifier}(${node.actuals.map(actual => actual.visit(this, formatter)).join(', ')})`;
  }

  visitReturn(node: ast.Return, formatter: Formatter): string {
    let text = `return`;
    if (node.operandNode) {
      text += ` ${node.operandNode.visit(this, formatter)}`;
    }
    return text;
  }

  visitLineComment(node: ast.LineComment, _formatter: Formatter): string {
    return `// ${node.text}`;
  }

  // --------------------------------------------------------------------------
  // Arrays
  // --------------------------------------------------------------------------

  visitArrayLiteral(node: ast.ArrayLiteral, formatter: Formatter): string {
    return `{${node.elementNodes.map(elementNode => elementNode.visit(this, formatter)).join(', ')}}`;
  }

  visitArrayDeclaration(node: ast.ArrayDeclaration, formatter: Formatter): string {
    return this.visitDeclaration(node, formatter);
  }

  visitArraySubscript(node: ast.ArraySubscript, formatter: Formatter): string {
    let operandPrecedence = precedence.get(node.arrayNode.constructor);
    let nodePrecedence = precedence.get(node.constructor);

    let text = node.arrayNode.visit(this, formatter);
    if (operandPrecedence < nodePrecedence) {
      text = `(${text})`;
    }
    text += `[${node.indexNode.visit(this, formatter)}]`;
    return text;
  }

  visitArrayLength(node: ast.ArrayLength, formatter: Formatter): string {
    let operandPrecedence = precedence.get(node.arrayNode.constructor);
    let nodePrecedence = precedence.get(node.constructor);

    let text = node.arrayNode.visit(this, formatter);
    if (operandPrecedence < nodePrecedence) {
      text = `(${text})`;
    }
    text += '.length';
    return text;
  }

  // --------------------------------------------------------------------------
}
