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

  visitCharacter(node: ast.Character, _formatter: Formatter): string {
    // TODO
    return `'${node.rawValue}'`;
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
    return this.visitBinaryOperator(node, formatter, 'plus');
  }

  visitSubtract(node: ast.Subtract, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, 'subtract');
  }

  visitMultiply(node: ast.Multiply, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, 'multiply');
  }

  visitDivide(node: ast.Divide, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, 'divided by');
  }

  visitRemainder(node: ast.Remainder, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, 'get the remainder');
  }

  visitPower(node: ast.Power, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, 'raise');
  }

  visitLessThan(node: ast.LessThan, formatter: Formatter): string {
    return this.visitBinaryOperator(node, formatter, 'is less than');
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
    let text = '';

    if (node.rightNode instanceof ast.Instantiation) {
      return `${this.visitInstantiation(node.rightNode, formatter)} and assign it a variable named ${node.identifier}.`;
    }

    // variable with a specific type and a value
    if ((node.variableType && node.rightNode) && (node.variableType.text !== "Any")) {
      text += `Declare a ${node.variableType} named ${node.identifier} with the value ${node.rightNode.visit(this, formatter)}.`;
    } else if (node.variableType.text === "Any" && node.rightNode) {
      // variable with no specific type and a value
      text += `Declare a variable named ${node.identifier} with the value ${node.rightNode.visit(this, formatter)}.`;
    } else if (node.variableType.text !== "Any" && !(node.rightNode)) {
      // variable with a specific type and no a value
      text += `Declare a ${node.variableType} named ${node.identifier}.`;
    }

    return text;
  }

  visitVariable(node: ast.Variable, _formatter: Formatter): string {
    return node.identifier;
  }

  visitBlock(node: ast.Block, formatter: Formatter): string {
    return node.statements.map(statement => {
      return `${statement.visit(this, formatter)}`;
    }).join('\n');
  }

  visitPrint(node: ast.Print, formatter: Formatter): string {
    return `print ${node.operandNode.visit(this, formatter)}`;
  }

  visitIf(node: ast.If, formatter: Formatter): string {
    let text = `if ${node.conditionNodes[0].visit(this, formatter)}`;

    text += ` then ${node.thenBlocks[0].visit(this, formatter)}`;
    for (let i = 1; i < node.conditionNodes.length; ++i) {
      text += `, if ${node.conditionNodes[i].visit(this, formatter)} `;
      text +=`then ${node.thenBlocks[i].visit(this, formatter)}`;
    }
    text += '.';
    if (node.elseBlock) {
      text += ` Otherwise ${node.elseBlock.visit(this, formatter)}.`;
    }

    return text;
  }

  visitWhile(node: ast.While, formatter: Formatter): string {
    let text = `While ${node.conditionNode.visit(this, formatter)}, `;
    text += formatting.format(node.body.statements.map(statement => statement.visit(this, formatter))) + '.';
    return text;
  }

  visitDoWhile(node: ast.DoWhile, formatter: Formatter): string {
    let text = formatting.format(node.body.statements.filter(statement => !(statement instanceof ast.LineComment)).map(statement => `${statement.visit(this, formatter)}`));
    text += " at least once.";
    text += ` Then check if ${node.conditionNode.visit(this, formatter)}. If it's true, repeat.`;
    return text;
  }

  visitRepeatUntil(node: ast.RepeatUntil, formatter: Formatter): string {
    let text = "Continue to "; // "Continue to repeat" ?
    text += formatting.format(node.body.statements.filter(statement => !(statement instanceof ast.LineComment)).map(statement => `${statement.visit(this, formatter)}`));
    text += ` until ${node.conditionNode.visit(this, formatter)}`;
    return text;
  }

  visitBlockAsSequence(node: ast.Block, formatter: Formatter): string {
    return node.statements.map(statement => statement.visit(this, formatter)).join(', ');
  }

  visitFor(node: ast.For, formatter: Formatter): string {
    let text = ''

    text += `${node.initializationNode?.visit(this, formatter)}`;
    text += ` As long as ${node.conditionNode.visit(this, formatter)},`;
    text += ` ${formatting.format(node.body.statements.filter(statement => !(statement instanceof ast.LineComment)).map(statement => statement.visit(this, formatter)))}.`;
    text += ` After each loop ${node.incrementBlock.visit(this, formatter)}.`;

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
    let text = `Define a function named ${node.identifier}`;

    if (node.formals.length > 0) {
      text += ` that takes ${node.formals.length} arguments, ${formatting.format(node.formals.map(formal => formal.identifier))}`;
    } else {
      text += ` that takes no arguments`;
    }

    if (node.returnType.text === "void") {
      text += `, and does not return a value.`;
    } else {
      text += `, and returns a ${node.returnType}.`;
    }

    text += ` Inside the function ${formatting.format(node.body.statements.map(statement => statement.visit(this, formatter)))}.`;

    return text;
  }

  visitFunctionCall(node: ast.FunctionCall, formatter: Formatter): string {
    return `Call the function ${node.identifier} with ${formatting.format(node.actuals.map(actual => actual.visit(this, formatter)))}.`;
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
    // return `{${node.elementNodes.map(elementNode => elementNode.visit(this, formatter)).join(', ')}}`;
    return `${formatting.format(node.elementNodes.map(element => element.visit(this, formatter)))}`;
  }

  visitArrayDeclaration(node: ast.ArrayDeclaration, formatter: Formatter): string {
    let text = ''

    // empty array
    if ((node.rightNode as ast.ArrayLiteral).elementNodes.length == 0) {
      text += `Declare an empty array with the type ${node.variableType}.`;
    }

    if (node.variableType.text === "Any") {
      text += `Declare an array with the elements ${node.rightNode?.visit(this, formatter)}.`;
    }

    text += `Declare an array of type ${node.variableType.text.slice(0, -2)} with the elements ${node.rightNode?.visit(this, formatter)}.`;

    return text;
  }

  visitArraySubscript(node: ast.ArraySubscript, formatter: Formatter): string {
    return `The element at index ${node.indexNode.visit(this,formatter)} of ${node.arrayNode.visit(this, formatter)}`;
  }

  visitMember(node: ast.Member, formatter: Formatter): string {
    return `the ${node.receiverNode.visit(this, formatter)} of the ${node.identifier}`;
  }

  // --------------------------------------------------------------------------
  // Classes
  // --------------------------------------------------------------------------

  visitClassDefinition(node: ast.ClassDefinition, formatter: Formatter): string {
    let text = `Define a class named ${node.identifier}`;
    if (node.superclass) {
      text += ` that extends the ${node.superclass} class.`;
    } else {
      text += '.';
    }

    const instances = node.instanceVariableDeclarations.length, methods = node.methodDefinitions.length;

    if (instances > 0 && methods > 0) {
      text += ` It includes ${instances == 1 ? '1 instance vairable' : 'instance variables'}, ${formatting.format(node.instanceVariableDeclarations.map(declaration => declaration.visit(this, formatter)))}`;
      text += `, and ${methods == 1 ? "a method" : `${methods} methods`} called ${formatting.format(node.methodDefinitions.map(definition => definition.visit(this, formatter)))}.`;
    } else if (instances > 0 && methods == 0) {
      // instances variables but no methods
      text += ` It includes ${instances == 1 ? '1 instance vairable' : 'instance variables'}, ${formatting.format(node.instanceVariableDeclarations.map(declaration => declaration.visit(this, formatter)))}.`;
    } else if (instances == 0 && methods > 0) {
      // methods but no instance variables
      text += ` It has ${methods == 1 ? "1 method" : `${methods} methods`} called ${formatting.format(node.methodDefinitions.map(definition => definition.visit(this, formatter)))}.`;
    }
     // have more text explaining the methods ?

    return text;
  }

  visitInstanceVariableDeclaration(node: ast.InstanceVariableDeclaration, formatter: Formatter): string {
    let text = 'a ';
    if (node.visibility === Visibility.Public) {
      text += `public variable `;
    } else if (node.visibility === Visibility.Private) {
      text += `private variable `;
    } else {
      text += " variable ";
    }

    text += `named "${node.identifier}" `;

    if (node.variableType) {
      text += `of type ${node.variableType} `;
    }
    if (node.valueNode) {
      text += `with the value ${node.valueNode.visit(this, formatter)}`;
    }

    return text;
  }

  visitMethodDefinition(node: ast.MethodDefinition, formatter: Formatter): string {
    let text = `${node.identifier} `;

    if (node.formals.length === 0) {
      text += `that takes no parameters.`;
    } else {
      text += `that takes ${node.formals.length} parameters, ${formatting.format(node.formals.map(formal => formal.identifier))}.`;
    }

    text += ` When called, the method will ${formatting.format(node.body.statements.map(statement => statement.visit(this, formatter)))}`;

    return text;
  }

  visitInstantiation(node: ast.Instantiation, _formatter: Formatter): string {
    return `Create a new instance of a ${node.identifier}`;
  }

  visitMethodCall(node: ast.MethodCall, formatter: Formatter): string {
    // TODO: parenthesize receiver maybe
    // return `${node.receiverNode.visit(this, formatter)}.${node.identifier}(${node.actuals.map(actual => actual.visit(this, formatter)).join(', ')})`;
    return `Call the ${node.identifier} method on ${node.receiverNode.visit(this, formatter)}`;
  }

  // --------------------------------------------------------------------------
}
