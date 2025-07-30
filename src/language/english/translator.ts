import {Visitor} from '../visitor.js';
import * as ast from '../ast.js';
import {precedence, associativity, Associativity} from './precedence.js';
import {Visibility} from '../type.js';

type ToStringable = {
  toString(): string;
}

type Formatter = {
  nestingLevel: number,
  indentation: string,
};

const formatting = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction",
});

export class Translator extends Visitor<Formatter, string> {

  // --------------------------------------------------------------------------
  // Primitives
  // --------------------------------------------------------------------------

  visitNull(_node: ast.Null, _formatter: Formatter): string {
    return 'null';
  }

  visitPrimitive<T extends ToStringable>(node: ast.Primitive<T>, _formatter: Formatter): string {
    return node.rawValue.toString();
  }

  visitInteger(node: ast.Integer, formatter: Formatter): string {
    return this.visitPrimitive<number>(node, formatter);
  }

  visitFloat(node: ast.Float, _formatter: Formatter): string {
    const floatFormatter = new Intl.NumberFormat('en-US', {
      minimumIntegerDigits: 1,
      minimumFractionDigits: 1
    });
    return floatFormatter.format(node.rawValue);
  }

  visitDouble(node: ast.Double, _formatter: Formatter): string {
    const floatFormatter = new Intl.NumberFormat('en-US', {
      minimumIntegerDigits: 1,
      minimumFractionDigits: 1
    });
    return floatFormatter.format(node.rawValue);
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

  visitPrefixUnaryOperator(node: ast.UnaryOperator, formatter: Formatter, operator: string): string {
    let operandPrecedence = precedence.get(node.operandNode.constructor);
    let nodePrecedence = precedence.get(node.constructor);

    let text = operator;
    let operandText = node.operandNode.visit(this, formatter);
    text += `${operandText}`;

    return text;
  }

  visitPostfixUnaryOperator(node: ast.UnaryOperator, formatter: Formatter, operator: string): string {
    let operandPrecedence = precedence.get(node.operandNode.constructor);
    let nodePrecedence = precedence.get(node.constructor);

    let text = ''
    if (operator === "++") {
      text += `increment ${node.operandNode.visit(this, formatter)} by 1`;
    } else {
      text += `decrement ${node.operandNode.visit(this, formatter)} by 1`;
    }

    return text;
  }

  visitAssociation(node: ast.Association, formatter: Formatter): string {
    let operandText = node.operandNode.visit(this, formatter);
    let text = `(${operandText})`;
    return text;
  }

  visitLogicalNegate(node: ast.LogicalNegate, formatter: Formatter): string {
    return this.visitPrefixUnaryOperator(node, formatter, 'not ');
  }

  visitArithmeticNegate(node: ast.ArithmeticNegate, formatter: Formatter): string {
    return this.visitPrefixUnaryOperator(node, formatter, '-');
  }

  visitBitwiseNegate(node: ast.BitwiseNegate, formatter: Formatter): string {
    return this.visitPrefixUnaryOperator(node, formatter, '~');
  }

  visitPostIncrement(node: ast.PostIncrement, formatter: Formatter): string {
    return this.visitPostfixUnaryOperator(node, formatter, '++');
  }

  visitPostDecrement(node: ast.PostDecrement, formatter: Formatter): string {
    return this.visitPostfixUnaryOperator(node, formatter, '--');
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
    return this.visitBinaryOperator(node, formatter, 'less than');
  }

  visitGreaterThan(node: ast.GreaterThan, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, 'is greater than');
  }

  visitLessThanOrEqual(node: ast.LessThanOrEqual, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, "is less than or equal to");
  }

  visitGreaterThanOrEqual(node: ast.GreaterThanOrEqual, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, "is greater than or equal to");
  }

  visitEqual(node: ast.Equal, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, 'is equal to');
  }

  visitNotEqual(node: ast.NotEqual, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, "is not equal to");
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

  // maybeSemicolon(node: ast.Statement, text: string): string {
  //   if (node.hasSemicolon) {
  //     text += ';';
  //   }
  //   if (node.comment) {
  //     text += ' // ' + node.comment;
  //   }
  //   return text;
  // }

  visitAssignment(node: ast.Assignment, formatter: Formatter): string {
    return `Assign ${node.leftNode.visit(this,formatter)} to the value ${node.rightNode.visit(this, formatter)}`;
  }

  visitDeclaration(node: ast.Declaration, formatter: Formatter): string {
    let text = `Declare ${node.identifier}`;

    if (node.variableType && node.rightNode) {
      text += ` as a ${node.variableType} with value ${node.rightNode.visit(this, formatter)}`;
    } else if (node.variableType) {
      text += ` as a ${node.variableType}`;
    } else if (node.rightNode) {
      text += ` with value ${node.rightNode.visit(this, formatter)}`;
    }

    return text;
  }

  visitVariable(node: ast.Variable, _formatter: Formatter): string {
    return node.identifier;
  }

  visitBlock(node: ast.Block, formatter: Formatter): string {
    return node.statements.map(statement => {
      return `${formatter.indentation.repeat(formatter.nestingLevel)}${statement.visit(this, formatter)} `;
    }).join('');
  }

  visitPrint(node: ast.Print, formatter: Formatter): string {
    // "print node to the screen"
    return `print ${node.operandNode.visit(this, formatter)}`;
  }

  visitIf(node: ast.If, formatter: Formatter): string {
    let text = `if ${node.conditionNodes[0].visit(this, formatter)}`;

    text += ` then ${node.thenBlocks[0].visit(this, formatter)}`;
    for (let i = 1; i < node.conditionNodes.length; ++i) {
      text += `if ${node.conditionNodes[i].visit(this, formatter)} `;
      text +=`then ${node.thenBlocks[i].visit(this, formatter)}`;
    }
    if (node.elseBlock) {
      text += `otherwise ${node.elseBlock.visit(this, formatter)}`;
    }

    return text;
  }

  visitWhile(node: ast.While, formatter: Formatter): string {
    let text = `while ${node.conditionNode.visit(this, formatter)} `;
    text += node.body.visit(this, formatter);
    return text;
  }

  visitDoWhile(node: ast.DoWhile, formatter: Formatter): string {
    let text = "do "; // change
    // text += node.body.visit(this, formatter);
    text += formatting.format(node.body.statements.filter(statement => !(statement instanceof ast.LineComment)).map(statement => `${statement.visit(this, formatter)}`));
    text += ` while ${node.conditionNode.visit(this, formatter)}`;
    return text;
  }

  visitRepeatUntil(node: ast.RepeatUntil, formatter: Formatter): string {
    let text = "repeat ";
    // text += node.body.visit(this, formatter);
    text += formatting.format(node.body.statements.filter(statement => !(statement instanceof ast.LineComment)).map(statement => `${statement.visit(this, formatter)}`));
    text += ` until ${node.conditionNode.visit(this, formatter)}`;
    return text;
  }

  visitBlockAsSequence(node: ast.Block, formatter: Formatter): string {
    return node.statements.map(statement => statement.visit(this, formatter)).join(', ');
  }

  visitFor(node: ast.For, formatter: Formatter): string {
    // console.log(node.initializationNode, node.conditionNode, node.incrementBlock, node.body);
    // let text = `for (${node.initializationNode?.visit(this, formatter) ?? ''}; ${node.conditionNode.visit(this, formatter)}; ${this.visitBlockAsSequence(node.incrementBlock, formatter)})\n`;
    // text += node.body.visit(this, {...formatter, nestingLevel: formatter.nestingLevel + 1});
    // text += `${formatter.indentation.repeat(formatter.nestingLevel)}end for`;
    // return text;
    let text = ''
    const start = node.initializationNode instanceof ast.Declaration ? node.initializationNode.rightNode?.visit(this, formatter) : '';

    if (node.conditionNode instanceof ast.LessThan) {
      let end = node.conditionNode.rightNode.visit(this, formatter);
      text += `Count from ${start} to ${end} and `;
    }

    text += formatting.format(node.body.statements.filter(statement => !(statement instanceof ast.LineComment)).map(statement => `${statement.visit(this, formatter)}`));

    // console.log(start);

    // Count from start to end
    // let text = `Count from ${start} to ${} and `

    return text;
  }

  visitForEach(_node: ast.ForEach, _formatter: Formatter): string {
    return 'UNSUPPORTED';
  }

  visitExpressionStatement(node: ast.ExpressionStatement, formatter: Formatter): string {
    let text = node.expressionNode.visit(this, formatter);
    return text;
  }

  visitFunctionDefinition(node: ast.FunctionDefinition, formatter: Formatter): string {
    let text = `${node.returnType} ${node.identifier}(${node.formals.map(formal => `${formal.type} ${formal.identifier}`).join(', ')})\n`;
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
    } else {
      text += `nothing`
    }
    return text;
  }

  // --------------------------------------------------------------------------
  // Weirdos
  // --------------------------------------------------------------------------

  visitBlank(node: ast.Blank, _formatter: Formatter): string {
    // The containing block puts a linebreak after every statement, so we shave
    // one off the count.
    return "\n".repeat(node.count - 1);
  }

  visitLineComment(node: ast.LineComment, _formatter: Formatter): string {
    return `// ${node.text}`;
  }

  // --------------------------------------------------------------------------
  // Range
  // --------------------------------------------------------------------------

  visitRangeLiteral(_node: ast.RangeLiteral, _formatter: Formatter): string {
    return 'UNSUPPORTED';
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

  visitMember(node: ast.Member, formatter: Formatter): string {
    let operandPrecedence = precedence.get(node.receiverNode.constructor);
    let nodePrecedence = precedence.get(node.constructor);

    let text = node.receiverNode.visit(this, formatter);
    if (operandPrecedence < nodePrecedence) {
      text = `(${text})`;
    }
    text += `.${node.identifier}`;
    return text;
  }

  // --------------------------------------------------------------------------
  // Classes
  // --------------------------------------------------------------------------

  visitClassDefinition(node: ast.ClassDefinition, formatter: Formatter): string {
    let text = `class ${node.identifier}`;
    if (node.superclass) {
      text += ` extends ${node.superclass}`;
    }
    text += "\n";

    text += node.instanceVariableDeclarations.map(declaration => `${formatter.indentation.repeat(formatter.nestingLevel + 1)}${declaration.visit(this, {...formatter, nestingLevel: formatter.nestingLevel + 1})}\n`).join('');

    if (node.instanceVariableDeclarations.length > 0 && node.methodDefinitions.length > 0) {
      text += "\n";
    }

    text += node.methodDefinitions.map(definition => `${formatter.indentation.repeat(formatter.nestingLevel + 1)}${definition.visit(this, {...formatter, nestingLevel: formatter.nestingLevel + 1})}\n`).join('\n');
    text += `${formatter.indentation.repeat(formatter.nestingLevel)}end class ${node.identifier}`;

    return text;
  }

  visitInstanceVariableDeclaration(node: ast.InstanceVariableDeclaration, formatter: Formatter): string {
    let text = 'Declare a ';
    if (node.visibility === Visibility.Public) {
      text += `public variable `;
    } else if (node.visibility === Visibility.Private) {
      text += `private variable `;
    } else {
      text += "variable ";
    }

    text += `named ${node.identifier} `;

    if (node.variableType) {
      text += `of type ${node.variableType} `;
    }
    if (node.valueNode) {
      text += `with the value ${node.valueNode.visit(this, formatter)}`;
    }

    return text;
  }

  visitMethodDefinition(node: ast.MethodDefinition, formatter: Formatter): string {
    let text = `${node.returnType} ${node.identifier}(${node.formals.map(formal => `${formal.type} ${formal.identifier}`).join(', ')})\n`;
    text += node.body.visit(this, {...formatter, nestingLevel: formatter.nestingLevel + 1});
    text += `${formatter.indentation.repeat(formatter.nestingLevel)}end ${node.identifier}`;
    return text;
  }

  visitInstantiation(node: ast.Instantiation, _formatter: Formatter): string {
    return `new ${node.identifier}`;
  }

  visitMethodCall(node: ast.MethodCall, formatter: Formatter): string {
    // TODO: parenthesize receiver maybe
    return `${node.receiverNode.visit(this, formatter)}.${node.identifier}(${node.actuals.map(actual => actual.visit(this, formatter)).join(', ')})`;
  }

  // --------------------------------------------------------------------------
}
