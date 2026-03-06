/**
 * Praxis Language Emitter
 * Converts AST nodes into Praxis pseudo-code.
 * Handles Praxis-specific syntax including typed declarations, procedural functions, and class-based OOP.
 */

import { ASTVisitor, Precedence } from '../visitor';
import type { Program, ClassDeclaration, FieldDeclaration, Constructor, MethodDeclaration, Block, Expression } from '../ast';

export class PraxisEmitter extends ASTVisitor {
    // Helper method: determines if a class is Java's Main class wrapper pattern
    /**
     * Check if a ClassDeclaration is Java's special Main class wrapper
     * (contains only a static main method)
     */
    private isJavaMainClass(classDecl: ClassDeclaration): boolean {
        if (classDecl.name !== 'Main') return false;
        const hasStaticMainMethod = classDecl.body.some(member => 
            member.type === 'MethodDeclaration' && 
            (member as MethodDeclaration).name === 'main' && 
            (member as MethodDeclaration).isStatic
        );
        return hasStaticMainMethod;
    }

    // Main entry point: processes the entire program by separating and emitting classes, functions, and main body
    visitProgram(program: Program): void {
        // Separate different types of statements from the program body
        const classes = program.body.filter(s => s.type === 'ClassDeclaration');
        const functions = program.body.filter(s => s.type === 'FunctionDeclaration');
        const mainBody = program.body.filter(s => s.type !== 'ClassDeclaration' && s.type !== 'FunctionDeclaration');

        // Identify the special Java Main class (if any) and separate regular classes
        const mainClass = classes.find(c => this.isJavaMainClass(c as ClassDeclaration));
        const otherClasses = classes.filter(c => !this.isJavaMainClass(c as ClassDeclaration));

        // Emit regular class definitions
        otherClasses.forEach(classDecl => { this.visitClassDeclaration(classDecl as ClassDeclaration); this.emit(''); });
        
        // Emit top-level function definitions
        functions.forEach(func => { this.visitFunctionDeclaration(func as any); this.emit(''); });
        
        // Emit all top-level statements (non-class, non-function code)
        mainBody.forEach(stmt => this.visitStatement(stmt));
        
        // Handle Java Main class by emitting its body directly without the class wrapper
        if (mainClass) {
            const mainClassDecl = mainClass as ClassDeclaration;
            const mainMethod = mainClassDecl.body.find(m => 
                m.type === 'MethodDeclaration' && (m as MethodDeclaration).name === 'main'
            ) as MethodDeclaration | undefined;
            
            if (mainMethod) {
                // Emit the main method's body directly without class wrapper
                this.visitBlock(mainMethod.body);
            }
        }
    }

    // Emits a class definition with its members and inheritance structure
    visitClassDeclaration(classDecl: ClassDeclaration): void {
        // Build class declaration with optional superclass
        const superClass = classDecl.superClass ? ` extends ${classDecl.superClass.name}` : '';
        this.emit(`class ${classDecl.name}${superClass}`);
        this.indent();
        this.context.symbolTable.enterScope();

        // Register field types in the symbol table
        classDecl.body.forEach(member => {
            if (member.type === 'FieldDeclaration') {
                // Infer field types if marked as auto
                let type = (member as any).fieldType;
                if (type === 'auto' && (member as any).initializer) { type = this.inferType((member as any).initializer); }
                this.context.symbolTable.set((member as any).name, type);
            }
        });

        // Emit all class members (fields, constructors, methods)
        classDecl.body.forEach(member => { this.visitStatement(member); this.emit(''); });
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit(`end class ${classDecl.name}`);
    }

    // Emits a field declaration with optional initializer
    visitFieldDeclaration(field: FieldDeclaration): void {
        // Determine field type (inferred or explicit)
        let type = field.fieldType === 'auto' && field.initializer ? this.inferType(field.initializer) : field.fieldType;
        if (type === 'auto') type = 'var';

        // Build field declaration line with optional initialization
        let line = `${type} ${field.name}`;
        if (field.initializer) { line += ` <- ${this.generateExpression(field.initializer, 0)}`; }
        this.emit(line);
    }

    // Emits a constructor definition with parameters and body
    visitConstructor(ctor: Constructor): void {
        // Format parameter list
        const params = ctor.params.map(p => `${p.paramType} ${p.name}`).join(', ');
        this.emit(`procedure new(${params})`);
        this.indent();
        this.context.symbolTable.enterScope();
        // Register constructor parameters in symbol table
        ctor.params.forEach(p => this.context.symbolTable.set(p.name, p.paramType || 'auto'));
        this.visitBlock(ctor.body);
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit(`end new`);
    }

    // Emits a method declaration with parameters, return type, and body
    // Emits a method declaration with parameters, return type, and body
    visitMethodDeclaration(method: MethodDeclaration): void {
        // Normalize return types (auto/void become procedure)
        let returnType = method.returnType === 'auto' ? 'procedure' : method.returnType;
        if (returnType === 'void') returnType = 'procedure';

        // Format parameter list with types
        const params = method.params.map(p => { const type = p.paramType === 'auto' ? '' : `${p.paramType} `; return `${type}${p.name}`.trim(); }).join(', ');

        this.emit(`${returnType} ${method.name}(${params})`);
        this.indent();
        this.context.symbolTable.enterScope();
        // Register method parameters in symbol table
        method.params.forEach(p => this.context.symbolTable.set(p.name, p.paramType || 'auto'));
        this.visitBlock(method.body);
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit(`end ${method.name}`);
    }

    // Visits all statements in a block
    visitBlock(block: Block): void { block.body.forEach(stmt => this.visitStatement(stmt)); }

    // Emits a print statement with comma-separated arguments
    // Emits a print statement with comma-separated arguments
    visitPrint(stmt: any): void {
        // Convert expressions to strings and join them
        const args = stmt.expressions.map((e: any) => this.generateExpression(e, 0));
        this.emit(`print(${args.join(', ')})`, stmt.id);
    }

    // Emits variable assignments, including tuple unpacking and member assignments
    visitAssignment(stmt: any): void {
        // Handle tuple unpacking: y, z = 4, 5
        if (stmt.target && stmt.target.type === 'ArrayLiteral') {
            const targets = stmt.target.elements;
            const valueExpr = stmt.value;
            
            // Check if right side is also an array for unpacking
            if (valueExpr.type === 'ArrayLiteral') {
                // Unpack each value to corresponding target variable
                const values = valueExpr.elements;
                for (let i = 0; i < targets.length; i++) {
                    // Assign each value to its corresponding target
                    const target = targets[i];
                    const value = values[i];
                    
                    if (target.type === 'Identifier') {
                        const varName = target.name;
                        const valStr = this.generateExpression(value, 0);
                        let type = this.inferType(value);
                        if (type === 'var') type = 'int';
                        
                        // Declare new variable or assign to existing one
                        if (this.context.symbolTable.get(varName) === undefined) {
                            this.emit(`${type} ${varName} <- ${valStr}`, stmt.id);
                            this.context.symbolTable.set(varName, type);
                        } else {
                            this.emit(`${varName} <- ${valStr}`, stmt.id);
                        }
                    }
                }
            }
            return;
        }

        // Convert right-hand side to string
        const rVal = this.generateExpression(stmt.value, 0);
        let initVal = rVal;
        // Normalize array literal formatting
        if (stmt.value.type === 'ArrayLiteral') {
            initVal = initVal.replace(/^new \w+\[\] /, '');
            if (initVal.startsWith('[') && initVal.endsWith(']')) { initVal = '{' + initVal.slice(1, -1) + '}'; }
        }
        
        // Handle assignments to object fields
        if (stmt.isMemberAssignment && stmt.memberExpr) {
            const targetStr = this.generateExpression(stmt.memberExpr, 0);
            this.emit(`${targetStr} <- ${rVal}`, stmt.id);
            return;
        }
        
        const targetStr = stmt.target ? this.generateExpression(stmt.target, 0) : stmt.name;
        if (stmt.varType) {
            this.emit(`${stmt.varType} ${targetStr} <- ${initVal}`, stmt.id);
            this.context.symbolTable.set(stmt.name, stmt.varType);
        } else if (stmt.target && stmt.target.type !== 'Identifier') {
            this.emit(`${targetStr} <- ${rVal}`, stmt.id);
        } else if (this.context.symbolTable.get(stmt.name) !== undefined) {
            this.emit(`${targetStr} <- ${rVal}`, stmt.id);
        } else {
            let type = this.inferType(stmt.value);
            if (type === 'var') type = 'int';
            this.emit(`${type} ${targetStr} <- ${initVal}`, stmt.id);
            this.context.symbolTable.set(stmt.name, type);
        }
    }

    // Emits if-else statements with optional else-if chains
    visitIf(stmt: any): void {
        // Emit if condition
        this.emit(`if (${this.generateExpression(stmt.condition, 0)})`, stmt.id);
        this.indent();
        this.context.symbolTable.enterScope();
        this.visitBlock(stmt.thenBranch);
        this.context.symbolTable.exitScope();
        this.dedent();

        // Emit else-if chain
        let currentElse = stmt.elseBranch;
        while (currentElse && currentElse.body.length === 1 && currentElse.body[0].type === 'If') {
            const elifStmt = currentElse.body[0];
            this.emit(`else if (${this.generateExpression(elifStmt.condition, 0)})`);
            this.indent();
            this.context.symbolTable.enterScope();
            this.visitBlock(elifStmt.thenBranch);
            this.context.symbolTable.exitScope();
            this.dedent();
            currentElse = elifStmt.elseBranch;
        }

        // Emit final else block if present
        if (currentElse) {
            this.emit('else');
            this.indent();
            this.context.symbolTable.enterScope();
            this.visitBlock(currentElse);
            this.context.symbolTable.exitScope();
            this.dedent();
        }
        this.emit('end if');
    }

    // Emits while loop with condition and body
    visitWhile(stmt: any): void {
        this.emit(`while (${this.generateExpression(stmt.condition, 0)})`, stmt.id);
        this.indent(); this.context.symbolTable.enterScope(); this.visitBlock(stmt.body); this.context.symbolTable.exitScope(); this.dedent();
        this.emit('end while');
    }

    // Emits do-while loop with body executed before condition check
    visitDoWhile(stmt: any): void {
        this.emit(`do`);
        this.indent(); this.context.symbolTable.enterScope(); this.visitBlock(stmt.body); this.context.symbolTable.exitScope(); this.dedent();
        this.emit(`while (${this.generateExpression(stmt.condition, 0)})`);
    }

    // Emits switch statement with cases and default branch
    visitSwitch(stmt: any): void {
        this.emit(`switch (${this.generateExpression(stmt.discriminant, 0)})`);
        this.indent();
        stmt.cases.forEach((caseStmt: any) => {
            // Emit case label or default
            if (caseStmt.test) {
                this.emit(`case ${this.generateExpression(caseStmt.test, 0)}:`);
            } else {
                this.emit(`default:`);
            }
            this.indent();
            // Emit case body statements
            caseStmt.consequent.forEach((s: any) => this.visitStatement(s));
            this.dedent();
        });
        this.dedent();
        this.emit('end switch');
    }

    // Emits break statement to exit loop or switch
    visitBreak(_stmt: any): void {
        this.emit('break');
    }

    // Emits continue statement to skip to next loop iteration
    visitContinue(_stmt: any): void {
        this.emit('continue');
    }

    // Emits for loops (C-style, iterator-based, and range-based)
    // Emits for loops (C-style, iterator-based, and range-based)
    visitFor(stmt: any): void {
        // Handle C-style for loop: for (init; condition; update)
        if (stmt.init && stmt.condition && stmt.update) {
            this.context.symbolTable.enterScope();
            // Generate initialization code
            let initCode = '';
            if (stmt.init.type === 'Assignment') {
                const rVal = this.generateExpression(stmt.init.value, 0);
                let type = stmt.init.varType || this.inferType(stmt.init.value);
                if (type === 'var') type = 'int';
                initCode = `${type} ${stmt.init.name} <- ${rVal}`;
                this.context.symbolTable.set(stmt.init.name, type);
            } else { initCode = this.generateExpression(stmt.init.expression, 0); }
            // Generate condition and update code
            const condCode = this.generateExpression(stmt.condition, 0);
            let updateCode = '';
            if (stmt.update.type === 'Assignment') {
                const updateTarget = stmt.update.target ? this.generateExpression(stmt.update.target, 0) : stmt.update.name;
                updateCode = `${updateTarget} <- ${this.generateExpression(stmt.update.value, 0)}`;
            } else { updateCode = this.generateExpression(stmt.update.expression, 0); }

            this.emit(`for (${initCode}; ${condCode}; ${updateCode})`, stmt.id);
            this.indent(); this.visitBlock(stmt.body); this.dedent();
            this.emit('end for');
            this.context.symbolTable.exitScope();
        } else if (stmt.iterable.type === 'CallExpression' && (stmt.iterable as any).callee.name === 'range') {
            // Handle range(start, end [, step]) for loops
            // Handle range(start, end [, step]) for loops
            const args = (stmt.iterable as any).arguments;
            // Parse range arguments (start, end, step)
            let start = '0', end = '0', step = '1';
            if (args.length === 1) { end = this.generateExpression(args[0], 0); }
            else if (args.length === 2) { start = this.generateExpression(args[0], 0); end = this.generateExpression(args[1], 0); }
            else if (args.length === 3) { start = this.generateExpression(args[0], 0); end = this.generateExpression(args[1], 0); step = this.generateExpression(args[2], 0); }
            
            // Convert range to C-style for loop
            this.emit(`for (int ${stmt.variable} <- ${start}; ${stmt.variable} < ${end}; ${stmt.variable} <- ${stmt.variable} + ${step})`, stmt.id);
            this.indent(); this.visitBlock(stmt.body); this.dedent();
            this.emit('end for');
        } else if (stmt.variables && stmt.variables.length > 1 && stmt.iterable.type === 'CallExpression' && (stmt.iterable as any).callee.name === 'enumerate') {
            // Handle enumerate(arr) for loops: for idx, val in enumerate(arr)
            const arr = this.generateExpression((stmt.iterable as any).arguments[0], 0);
            const idx = stmt.variables[0];
            const val = stmt.variables[1];
            
            // Convert enumerate to indexed for loop
            this.emit(`for (int ${idx} <- 0; ${idx} < ${arr}.length; ${idx} <- ${idx} + 1)`, stmt.id);
            this.indent();
            this.emit(`var ${val} <- ${arr}[${idx}]`);
            this.visitBlock(stmt.body);
            this.dedent();
            this.emit('end for');
        } else {
            // Handle generic iterator-based for loop
            this.emit(`for ${stmt.variable} in ${this.generateExpression(stmt.iterable, 0)}`, stmt.id);
            this.indent();
            this.context.symbolTable.enterScope();
            this.context.symbolTable.set(stmt.variable, 'var');
            this.visitBlock(stmt.body);
            this.context.symbolTable.exitScope();
            this.dedent();
            this.emit('end for');
        }
    }

    // Emits function declaration with parameters and body
    // Emits function declaration with parameters and body
    visitFunctionDeclaration(stmt: any): void {
        this.context.symbolTable.enterScope();

        // Format parameter list with optional types
        const params = stmt.params.map((p: any) => { const type = p.paramType && p.paramType !== 'auto' ? `${p.paramType} ` : ''; return `${type}${p.name}`; }).join(', ');

        this.emit(`procedure ${stmt.name}(${params})`);
        this.indent(); this.visitBlock(stmt.body); this.dedent();
        this.emit(`end ${stmt.name}`);
        this.context.symbolTable.exitScope();
    }

    // Emits return statement with optional return value
    visitReturn(stmt: any): void { this.emit(`return ${stmt.value ? this.generateExpression(stmt.value, 0) : ''}`, stmt.id); }

    // Emits standalone expression statement
    visitExpressionStatement(stmt: any): void { this.emit(this.generateExpression(stmt.expression, 0), stmt.id); }

    // Emits try-catch-finally block with exception handlers
    visitTry(stmt: any): void {
        this.emit('try');
        this.indent(); this.visitBlock(stmt.body); this.dedent();
        
        // Emit catch handlers with optional exception types and variable bindings
        stmt.handlers.forEach((handler: any) => {
            if (handler.exceptionType) {
                this.emit(`catch ${handler.exceptionType}${handler.varName ? ` as ${handler.varName}` : ''}`);
            } else {
                this.emit(`catch`);
            }
            this.indent(); this.visitBlock(handler.body); this.dedent();
        });
        
        // Emit optional finally block
        if (stmt.finallyBlock) {
            this.emit('finally');
            this.indent(); this.visitBlock(stmt.finallyBlock); this.dedent();
        }
        this.emit('end try');
    }

    // Converts AST expression nodes to Praxis language code with operator precedence handling
    // Converts AST expression nodes to Praxis language code with operator precedence handling
    generateExpression(expr: Expression, parentPrecedence: number): string {
        let output = '';
        let currentPrecedence = 99;

        // Generate code based on expression type
        switch (expr.type) {
            case 'Literal':
                // Convert literal values (null, strings, booleans, numbers)
                if (expr.value === null) output = 'null';
                else if (typeof expr.value === 'string') {
                    // Strip Python string prefixes (f, r, b)
                    const strVal = expr.value.startsWith('f') || expr.value.startsWith('r') || expr.value.startsWith('b')
                        ? expr.value.substring(1) : expr.value;
                    output = `"${strVal}"`;
                } else if (typeof expr.value === 'boolean') output = expr.value ? 'true' : 'false';
                else output = String(expr.value);
                break;
            case 'Identifier':
                // Output variable/identifier names as-is
                output = expr.name;
                break;
            case 'ThisExpression':
                // Reference to current object
                output = 'this';
                break;
            case 'NewExpression':
                // Object instantiation with constructor call
                currentPrecedence = Precedence.Instantiation;
                const args = expr.arguments.map(a => this.generateExpression(a, 0)).join(', ');
                output = `new ${expr.className}(${args})`;
                break;
            case 'IndexExpression':
                // Array/list indexing and slicing
                currentPrecedence = Precedence.Member;
                const objExpr = this.generateExpression(expr.object, currentPrecedence);
                
                // Helper function to convert index expression to Praxis, handling negative indices
                const convertIndexPraxis = (idx: any): string => {
                    if (!idx) return '0';
                    if (idx.type === 'Literal' && typeof idx.value === 'number' && idx.value < 0) {
                        // Convert negative indices: arr[-1] becomes arr[arr.length - 1]
                        const absIdx = Math.abs(idx.value);
                        return `${objExpr}.length - ${absIdx}`;
                    } else if (idx.type === 'UnaryExpression' && idx.operator === '-' && idx.argument.type === 'Literal') {
                        // Handle unary minus operator on index
                        const val = idx.argument.value as number;
                        return `${objExpr}.length - ${val}`;
                    } else {
                        // Handle mixed expressions and base conversion
                        let indexExpr = idx;
                        if (indexExpr.type === 'BinaryExpression' && 
                            indexExpr.operator === '-' && 
                            indexExpr.right.type === 'Literal' && 
                            indexExpr.right.value === 1) {
                            // This is a 0-based index converted from 1-based, use the original
                            indexExpr = indexExpr.left;
                        }
                        return this.generateExpression(indexExpr, 0);
                    }
                };
                
                // Handle array slicing (start:end) vs single element access
                if (expr.indexEnd) {
                    // Array slicing: arr[start:end]
                    const startE = convertIndexPraxis(expr.index);
                    const endE = convertIndexPraxis(expr.indexEnd);
                    output = `${objExpr}.SLICE(${startE}, ${endE})`;
                } else {
                    // Single index access
                    const idxStr = convertIndexPraxis(expr.index);
                    output = `${objExpr}[${idxStr}]`;
                }
                break;
            case 'MemberExpression':
                // Object property/field access
                currentPrecedence = Precedence.Member;
                output = `${this.generateExpression(expr.object, currentPrecedence)}.${expr.property.name}`;
                break;
            case 'BinaryExpression':
                // Binary operations with operator precedence handling and mapping to Praxis operators
                const opMap: Record<string, { op: string, prec: number }> = {
                    // Logical operators
                    'or': { op: 'or', prec: Precedence.LogicalOr }, 
                    'and': { op: 'and', prec: Precedence.LogicalAnd },
                    // Equality operators (== becomes =)
                    '==': { op: '=', prec: Precedence.Equality }, 
                    '!=': { op: '!=', prec: Precedence.Equality },
                    // Relational operators
                    '<': { op: '<', prec: Precedence.Relational }, 
                    '>': { op: '>', prec: Precedence.Relational },
                    '<=': { op: '<=', prec: Precedence.Relational }, 
                    '>=': { op: '>=', prec: Precedence.Relational },
                    // Arithmetic operators
                    '+': { op: '+', prec: Precedence.Additive }, 
                    '-': { op: '-', prec: Precedence.Additive },
                    '*': { op: '*', prec: Precedence.Multiplicative }, 
                    '/': { op: '/', prec: Precedence.Multiplicative },
                    // Modulo and exponentiation
                    '%': { op: 'mod', prec: Precedence.Multiplicative },
                    '**': { op: '^', prec: Precedence.Multiplicative },
                    // Range operator
                    '..': { op: '..', prec: Precedence.Relational }
                };
                const opData = opMap[expr.operator] || { op: expr.operator, prec: 0 };
                currentPrecedence = opData.prec;
                // Generate both sides and combine with mapped operator
                output = `${this.generateExpression(expr.left, currentPrecedence)} ${opData.op} ${this.generateExpression(expr.right, currentPrecedence)}`;
                break;
            case 'UnaryExpression':
                // Unary prefix operators (!, not, -) with proper precedence
                currentPrecedence = Precedence.Unary;
                let op = expr.operator === '!' || expr.operator === 'not' ? 'not ' : expr.operator;
                output = `${op}${this.generateExpression(expr.argument, currentPrecedence)}`;
                break;
            case 'UpdateExpression':
                // Pre/post increment/decrement operators (++ and --)
                const argStr = this.generateExpression((expr as any).argument, Precedence.Unary);
                if ((expr as any).operator === '++') {
                    output = `${argStr}++`;
                } else {
                    output = `${argStr}--`;
                }
                break;
            case 'CallExpression':
                // Function/method calls with argument processing and special case for len()
                currentPrecedence = Precedence.Call;
                // Handle method calls vs function calls
                const calleeStr = (expr.callee as any).type === 'MemberExpression'
                    ? this.generateExpression(expr.callee as any, 0)
                    : (expr.callee as any).name;
                
                // Special case: len() builtin translates to .length property
                if ((calleeStr === 'len' || calleeStr === 'LENGTH') && expr.arguments.length === 1) {
                    output = `${this.generateExpression(expr.arguments[0], 0)}.length`;
                    break;
                }
                
                // Generate regular function call with arguments
                const args2 = expr.arguments.map(a => this.generateExpression(a, 0)).join(', ');
                output = `${calleeStr}(${args2})`;
                break;
            case 'ArrayLiteral':
                // Array literal with curly braces formatted syntax
                const elems = expr.elements.map(e => this.generateExpression(e, 0)).join(', ');
                output = `{${elems}}`;
                break;
        }
        return (currentPrecedence < parentPrecedence) ? `(${output})` : output;
    }
}
