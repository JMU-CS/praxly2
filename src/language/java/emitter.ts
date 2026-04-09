/**
 * Java Language Emitter
 * Converts AST nodes into Java source code.
 * Handles Java-specific syntax including class declarations, method signatures,
 * access modifiers, and Java library methods like System.out.println, Arrays, etc.
 */

import { ASTVisitor, Precedence, SymbolTable } from '../visitor';
import type { Program, Statement, ClassDeclaration, FieldDeclaration, Constructor, MethodDeclaration, Block, For, Expression } from '../ast';

/**
 * Emitter for converting AST to Java source code.
 * Implements the ASTVisitor pattern to traverse and translate program structures.
 */
export class JavaEmitter extends ASTVisitor {
    private usesInput: boolean = false;

    /**
     * Check if program uses input() calls
     */
    private checkForInput(node: any): void {
        if (!node) return;
        if (node.type === 'CallExpression' && (node.callee as any).name === 'input') {
            this.usesInput = true;
        }
        if (node.type === 'CallExpression' && (node.callee as any).name === 'INPUT') {
            this.usesInput = true;
        }
        for (const key in node) {
            if (typeof node[key] === 'object' && node[key] !== null) {
                if (Array.isArray(node[key])) node[key].forEach((n: any) => this.checkForInput(n));
                else this.checkForInput(node[key]);
            }
        }
    }

    /**
     * Main entry point for translating a complete program.
     * Separates classes from functions and main body statements.
     * Generates a Main class wrapper for functions and top-level code.
     */
    visitProgram(program: Program): void {
        const classes = program.body.filter(s => s.type === 'ClassDeclaration');
        const functions = program.body.filter(s => s.type === 'FunctionDeclaration');
        const mainBody = program.body.filter(s => s.type !== 'ClassDeclaration' && s.type !== 'FunctionDeclaration');

        // Check if program uses input()
        this.checkForInput(program);

        classes.forEach(classDecl => {
            this.visitClassDeclaration(classDecl as ClassDeclaration);
            this.emit('');
        });

        if (functions.length > 0 || mainBody.length > 0) {
            // Add imports if input is used
            if (this.usesInput) {
                this.emit('import java.util.Scanner;');
                this.emit('');
            }

            this.context.symbolTable = new SymbolTable();
            this.emit('public class Main {');
            this.indent();

            functions.forEach(func => {
                this.visitFunctionDeclaration(func as any);
                this.emit('');
            });

            if (mainBody.length > 0) {
                this.emit('public static void main(String[] args) {');
                this.indent();
                
                // Initialize Scanner if input is used
                if (this.usesInput) {
                    this.emit('Scanner scanner = new Scanner(System.in);');
                }
                
                mainBody.forEach(stmt => this.visitStatement(stmt));
                this.dedent();
                this.emit('}');
            }

            this.dedent();
            this.emit('}');
        }
    }

    /**
     * Translates a class declaration to Java public class syntax.
     * Registers fields in the symbol table and emits all class members.
     * Handles optional superclass/inheritance.
     */
    visitClassDeclaration(classDecl: ClassDeclaration): void {
        const superClass = classDecl.superClass ? ` extends ${classDecl.superClass.name}` : '';
        this.emit(`public class ${classDecl.name}${superClass} {`);
        this.indent();
        this.context.symbolTable.enterScope();
        classDecl.body.forEach(member => {
            if (member.type === 'FieldDeclaration') {
                let type = (member as any).fieldType;
                if (type === 'auto' && (member as any).initializer) {
                    type = this.inferType((member as any).initializer);
                }
                this.context.symbolTable.set((member as any).name, type);
            }
        });
        classDecl.body.forEach(member => {
            this.visitStatement(member);
            this.emit('');
        });
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit('}');
    }

    /**
     * Translates a field declaration with access modifiers.
     * Includes type inference for auto types and optional initialization.
     * Outputs semicolon-terminated field declarations.
     */
    visitFieldDeclaration(field: FieldDeclaration): void {
        let line = `${field.access} `;
        if (field.isStatic) line += 'static ';
        let type = field.fieldType;
        if (type === 'auto') type = field.initializer ? this.inferType(field.initializer) : 'Object';
        line += `${type} ${field.name}`;
        if (field.initializer) {
            line += ` = ${this.generateExpression(field.initializer, 0)}`;
        }
        this.emit(`${line};`);
    }

    /**
     * Translates a constructor with parameters and body.
     * Uses a temporary class name placeholder.
     * Registers parameters in a local scope.
     */
    visitConstructor(ctor: Constructor): void {
        const className = 'TempClass';
        const params = ctor.params.map(p => `${p.paramType} ${p.name}`).join(', ');
        this.emit(`public ${className}(${params}) {`);
        this.indent();
        this.context.symbolTable.enterScope();
        ctor.params.forEach(p => this.context.symbolTable.set(p.name, p.paramType));
        this.visitBlock(ctor.body);
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit('}');
    }

    /**
     * Translates a method declaration with access modifiers and return type.
     * Handles static and instance methods with proper Java method signatures.
     * Registers method parameters in a local symbol table scope.
     */
    visitMethodDeclaration(method: MethodDeclaration): void {
        let line = `${method.access} `;
        if (method.isStatic) line += 'static ';
        let returnType = method.returnType === 'auto' ? 'Object' : method.returnType;
        line += `${returnType} ${method.name}(`;
        line += method.params.map(p => `${p.paramType} ${p.name}`).join(', ') + ')';
        this.emit(`${line} {`);
        this.indent();
        this.context.symbolTable.enterScope();
        method.params.forEach(p => this.context.symbolTable.set(p.name, p.paramType));
        this.visitBlock(method.body);
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit('}');
    }

    /**
     * Translates a block of statements.
     * Called for method bodies, constructor bodies, and control flow blocks.
     */
    visitBlock(block: Block): void {
        block.body.forEach(stmt => this.visitStatement(stmt));
    }

    /**
     * Translates a print statement to System.out.println.
     * Concatenates multiple expressions with string separators.
     */
    visitPrint(stmt: any): void {
        const args = stmt.expressions.map((e: any) => this.generateExpression(e, 0));
        this.emit(`System.out.println(${args.join(' + " " + ')});`, stmt.id);
    }

    /**
     * Translates variable assignments and declarations.
     * Handles tuple unpacking, member assignments, and type inference.
     * Generates proper Java variable declarations with type information.
     */
    visitAssignment(stmt: any): void {
        // Handle tuple unpacking: y, z = 4, 5
        if (stmt.target && stmt.target.type === 'ArrayLiteral') {
            const targets = stmt.target.elements;
            const valueExpr = stmt.value;
            
            if (valueExpr.type === 'ArrayLiteral') {
                // Both sides are arrays - unpack each element to corresponding target
                const values = valueExpr.elements;
                for (let i = 0; i < targets.length; i++) {
                    const target = targets[i];
                    const value = values[i];
                    
                    if (target.type === 'Identifier') {
                        const varName = target.name;
                        const valStr = this.generateExpression(value, 0);
                        let type = this.inferType(value);
                        if (type === 'var') type = 'Object';
                        
                        if (this.context.symbolTable.get(varName) === undefined) {
                            this.emit(`${type} ${varName} = ${valStr};`, stmt.id);
                            this.context.symbolTable.set(varName, type);
                        } else {
                            this.emit(`${varName} = ${valStr};`, stmt.id);
                        }
                    }
                }
            }
            return;
        }

        const targetStr = stmt.target ? this.generateExpression(stmt.target, 0) : stmt.name;

        if (stmt.varType && stmt.declaredWithoutInitializer) {
            this.emit(`${stmt.varType} ${targetStr};`, stmt.id);
            this.context.symbolTable.set(stmt.name, stmt.varType);
            return;
        }

        const rVal = this.generateExpression(stmt.value, 0);
        let initVal = rVal;
        if (stmt.value.type === 'ArrayLiteral') {
            initVal = initVal.replace(/^new \w+\[\] /, '');
        }

        // Handle member/field assignments (e.g., this.count = value or obj.field = value)
        if (stmt.isMemberAssignment && stmt.memberExpr) {
            const memberTargetStr = this.generateExpression(stmt.memberExpr, 0);
            this.emit(`${memberTargetStr} = ${rVal};`, stmt.id);
            return;
        }

        if (stmt.varType) {
            this.emit(`${stmt.varType} ${targetStr} = ${initVal};`, stmt.id);
            this.context.symbolTable.set(stmt.name, stmt.varType);
        } else if (stmt.target && stmt.target.type !== 'Identifier') {
            this.emit(`${targetStr} = ${rVal};`, stmt.id);
        } else if (this.context.symbolTable.get(stmt.name) !== undefined) {
            this.emit(`${targetStr} = ${rVal};`, stmt.id);
        } else {
            let type = this.inferType(stmt.value);
            if (type === 'var') type = 'Object';
            this.emit(`${type} ${targetStr} = ${initVal};`, stmt.id);
            this.context.symbolTable.set(stmt.name, type);
        }
    }

    /**
     * Translates if-else statements with else-if chains.
     * Properly unrolls nested if blocks into else-if syntax.
     * Manages symbol table scopes for each branch.
     */
    visitIf(stmt: any): void {
        this.emit(`if (${this.generateExpression(stmt.condition, 0)}) {`, stmt.id);
        this.indent();
        this.context.symbolTable.enterScope();
        this.visitBlock(stmt.thenBranch);
        this.context.symbolTable.exitScope();
        this.dedent();

        let currentElse = stmt.elseBranch;

        // Unroll nested if blocks into else-if chains for compact syntax
        while (currentElse && currentElse.body.length === 1 && currentElse.body[0].type === 'If') {
            const elifStmt = currentElse.body[0];
            this.emit(`} else if (${this.generateExpression(elifStmt.condition, 0)}) {`);
            this.indent();
            this.context.symbolTable.enterScope();
            this.visitBlock(elifStmt.thenBranch);
            this.context.symbolTable.exitScope();
            this.dedent();
            currentElse = elifStmt.elseBranch;
        }

        if (currentElse) {
            this.emit(`} else {`);
            this.indent();
            this.context.symbolTable.enterScope();
            this.visitBlock(currentElse);
            this.context.symbolTable.exitScope();
            this.dedent();
            this.emit(`}`);
        } else {
            this.emit(`}`);
        }
    }

    /**
     * Translates while loop with condition and body.
     * Manages symbol table scope for loop variables.
     */
    visitWhile(stmt: any): void {
        this.emit(`while (${this.generateExpression(stmt.condition, 0)}) {`, stmt.id);
        this.indent();
        this.context.symbolTable.enterScope();
        this.visitBlock(stmt.body);
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit('}');
    }

    /**
     * Translates do-while loop (body executes before condition check).
     * Body guaranteed to execute at least once.
     */
    visitDoWhile(stmt: any): void {
        this.emit(`do {`);
        this.indent();
        this.context.symbolTable.enterScope();
        this.visitBlock(stmt.body);
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit(`} while (${this.generateExpression(stmt.condition, 0)});`);
    }

    /**
     * Translates switch statement with case labels and default clause.
     * Automatically adds break statements to prevent fallthrough.
     * Avoids breaks only when already present or for final case.
     */
    visitSwitch(stmt: any): void {
        this.emit(`switch (${this.generateExpression(stmt.discriminant, 0)}) {`);
        this.indent();
        this.context.symbolTable.enterScope();
        
        stmt.cases.forEach((caseStmt: any, index: number) => {
            // Emit case label or default clause
            if (caseStmt.test) {
                this.emit(`case ${this.generateExpression(caseStmt.test, 0)}:`);
            } else {
                this.emit(`default:`);
            }
            this.indent();
            // Emit all statements within this case
            caseStmt.consequent.forEach((s: Statement) => this.visitStatement(s));
            
            // Add break unless case already has one to prevent fallthrough
            if (caseStmt.consequent.length > 0 && caseStmt.consequent[caseStmt.consequent.length - 1].type === 'Break') {
                // Already has break, no need to add
            } else if (index < stmt.cases.length - 1) {
                // Not the last case, add break to prevent fallthrough
                this.emit('break;');
            } else if (caseStmt.test) {
                // Last case but not default, add break anyway for consistency
                this.emit('break;');
            }
            
            this.dedent();
        });
        
        this.context.symbolTable.exitScope();
        this.dedent();
        this.emit('}');
    }

    /**
     * Emits break statement to exit loop or switch.
     */
    visitBreak(_stmt: any): void {
        this.emit('break;');
    }

    /**
     * Emits continue statement to skip to next loop iteration.
     */
    visitContinue(_stmt: any): void {
        this.emit('continue;');
    }

    /**
     * Translates for loops in multiple formats:
     * 1. C-style: for(init; condition; update)
     * 2. Range-based: handles range(start, end, step) calls
     * 3. Enumerate-style: for(idx, val) in enumerate(arr)
     * 4. Iterator-based: for(item : collection)
     * Also handles optional for-else fallback.
     */
    visitFor(stmt: For): void {
        // Handle C-style for loop: for(type var = init; condition; update)
        if (stmt.init && stmt.condition && stmt.update) {
            this.context.symbolTable.enterScope();
            let initCode = '';
            let initCodes: string[] = [];
            
            // Process initialization - can be single assignment or array of assignments
            if (stmt.init.type === 'Assignment') {
                const initStmt = stmt.init as any;
                const rVal = this.generateExpression(initStmt.value, 0);
                let type = initStmt.varType || this.inferType(initStmt.value);
                if (type === 'var') type = 'int';
                initCode = `${type} ${initStmt.name} = ${rVal}`;
                this.context.symbolTable.set(initStmt.name, type);
            } else if (Array.isArray(stmt.init)) {
                // Handle multiple initialization statements
                const stmts = stmt.init as any;
                initCodes = stmts.map((s: any) => {
                    if (s.type === 'Assignment') {
                        const rVal = this.generateExpression(s.value, 0);
                        let type = s.varType || this.inferType(s.value);
                        if (type === 'var') type = 'int';
                        this.context.symbolTable.set(s.name, type);
                        return `${type} ${s.name} = ${rVal}`;
                    }
                    return this.generateExpression((s as any).expression, 0);
                });
                initCode = initCodes.join(', ');
            } else if ((stmt.init as any)?.type === 'Block') {
                // Handle Block node as initialization (legacy support)
                const blockStmt = stmt.init as any;
                initCodes = blockStmt.body.map((s: any) => {
                    if (s.type === 'Assignment') {
                        const rVal = this.generateExpression(s.value, 0);
                        let type = s.varType || this.inferType(s.value);
                        if (type === 'var') type = 'int';
                        this.context.symbolTable.set(s.name, type);
                        return `${type} ${s.name} = ${rVal}`;
                    }
                    return this.generateExpression((s as any).expression, 0);
                });
                initCode = initCodes.join(', ');
            } else {
                initCode = this.generateExpression((stmt.init as any).expression, 0);
            }

            // Generate condition expression
            const condCode = this.generateExpression(stmt.condition, 0);

            // Process update clause - can be single or multiple statements
            let updateCode = '';
            let updateCodes: string[] = [];
            if (stmt.update.type === 'Assignment') {
                const updateStmt = stmt.update as any;
                const updateTarget = updateStmt.target ? this.generateExpression(updateStmt.target, 0) : updateStmt.name;
                updateCode = `${updateTarget} = ${this.generateExpression(updateStmt.value, 0)}`;
            } else if (Array.isArray(stmt.update)) {
                // Handle multiple update statements
                const stmts = stmt.update as any;
                updateCodes = stmts.map((s: any) => {
                    if (s.type === 'ExpressionStatement') {
                        return this.generateExpression(s.expression, 0);
                    }
                    return this.generateExpression((s as any).expression, 0);
                });
                updateCode = updateCodes.join(', ');
            } else if ((stmt.update as any)?.type === 'Block') {
                // Handle Block node as update (legacy support)
                const blockStmt = stmt.update as any;
                updateCodes = blockStmt.body.map((s: any) => {
                    if (s.type === 'ExpressionStatement') {
                        return this.generateExpression(s.expression, 0);
                    }
                    return this.generateExpression((s as any).expression, 0);
                });
                updateCode = updateCodes.join(', ');
            } else {
                updateCode = this.generateExpression((stmt.update as any).expression, 0);
            }

            this.emit(`for (${initCode}; ${condCode}; ${updateCode}) {`, stmt.id);
            this.indent();
            this.visitBlock(stmt.body);
            this.dedent();
            this.emit('}');
            this.context.symbolTable.exitScope();
        } else if (stmt.iterable.type === 'CallExpression' && (stmt.iterable as any).callee.name === 'range') {
            // Handle range(start, end, step) - converts to C-style loop
            const args = (stmt.iterable as any).arguments;
            let start = '0', end = '0', step = '1';
            // Parse range arguments based on argument count
            if (args.length === 1) { end = this.generateExpression(args[0], 0); }
            else if (args.length === 2) { start = this.generateExpression(args[0], 0); end = this.generateExpression(args[1], 0); }
            else if (args.length === 3) { start = this.generateExpression(args[0], 0); end = this.generateExpression(args[1], 0); step = this.generateExpression(args[2], 0); }

            // Emit as C-style for loop with integer bounds
            this.emit(`for (int ${stmt.variable} = ${start}; ${stmt.variable} < ${end}; ${stmt.variable} += ${step}) {`, stmt.id);
            this.indent(); this.visitBlock(stmt.body); this.dedent(); this.emit('}');
        } else if (stmt.variables && stmt.variables.length > 1 && stmt.iterable.type === 'CallExpression' && (stmt.iterable as any).callee.name === 'enumerate') {
            // Handle enumerate(arr) - converts to indexed loop with values
            const arr = this.generateExpression((stmt.iterable as any).arguments[0], 0);
            const idx = stmt.variables[0];
            const val = stmt.variables[1];
            this.emit(`for (int ${idx} = 0; ${idx} < ${arr}.length; ${idx}++) {`);
            this.indent();
            // Infer array element type from the array itself
            let varType = this.inferType((stmt.iterable as any).arguments[0]);
            if (varType.endsWith('[]')) varType = varType.slice(0, -2); else varType = 'var';
            // Declare loop variable and assign current element
            this.emit(`${varType} ${val} = ${arr}[${idx}];`);
            this.visitBlock(stmt.body);
            this.dedent();
            this.emit('}');
        } else {
            // Handle iterator-based for loop: for(type var : iterable)
            let varType = 'var';
            const iterType = this.inferType(stmt.iterable);
            // Extract element type from iterable array type
            if (iterType.endsWith('[]')) varType = iterType.slice(0, -2);
            else if (iterType === 'int[]') varType = 'int';

            this.emit(`for (${varType} ${stmt.variable} : ${this.generateExpression(stmt.iterable, 0)}) {`);
            this.indent();
            this.context.symbolTable.enterScope();
            this.context.symbolTable.set(stmt.variable, varType);
            this.visitBlock(stmt.body);
            this.context.symbolTable.exitScope();
            this.dedent();
            this.emit('}');
        }

        // Handle Python for-else (executes if loop completes without break)
        if (stmt.elseBranch) {
            this.emit('// for-else fallback');
            this.visitBlock(stmt.elseBranch);
        }
    }

    /**
     * Translates function declaration to static method.
     * Uses function metadata (param types, return type) from context.
     * Registers parameters in local scope.
     */
    visitFunctionDeclaration(stmt: any): void {
        this.context.symbolTable.enterScope();
        const paramTypes = this.context.functionParamTypes.get(stmt.name) || [];

        stmt.params.forEach((p: any, i: number) => {
            let type = p.paramType && p.paramType !== 'var' && p.paramType !== 'auto' ? p.paramType : paramTypes[i];
            if (!type || type === 'var' || type === 'auto') type = 'Object';
            this.context.symbolTable.set(p.name, type);
        });

        const params = stmt.params.map((p: any, i: number) => {
            let type = p.paramType && p.paramType !== 'var' && p.paramType !== 'auto' ? p.paramType : paramTypes[i];
            if (!type || type === 'var' || type === 'auto') type = 'Object';
            return `${type} ${p.name}`;
        }).join(', ');

        let returnType = stmt.returnType && stmt.returnType !== 'auto' ? stmt.returnType : (this.context.functionReturnTypes.get(stmt.name) || 'void');
        this.emit(`public static ${returnType} ${stmt.name}(${params}) {`);
        this.indent();
        this.visitBlock(stmt.body);
        this.dedent();
        this.emit('}');
        this.context.symbolTable.exitScope();
    }

    /**
     * Emits return statement with optional return value.
     */
    visitReturn(stmt: any): void {
        this.emit(`return ${stmt.value ? this.generateExpression(stmt.value, 0) : ''};`, stmt.id);
    }

    /**
     * Emits a standalone expression statement with terminating semicolon.
     */
    visitExpressionStatement(stmt: any): void {
        this.emit(`${this.generateExpression(stmt.expression, 0)};`, stmt.id);
    }

    /**
     * Translates try-catch-finally statement.
     * Handles multiple catch blocks for different exception types.
     * Supports optional finally block.
     */
    visitTry(stmt: any): void {
        this.emit('try {');
        this.indent(); this.visitBlock(stmt.body); this.dedent();
        this.emit('}');
        
        stmt.handlers.forEach((handler: any) => {
            if (handler.exceptionType) {
                if (handler.varName) {
                    this.emit(`catch (${handler.exceptionType} ${handler.varName}) {`);
                } else {
                    this.emit(`catch (Exception e) {`);
                }
            } else {
                this.emit(`catch (Exception e) {`);
            }
            this.indent(); this.visitBlock(handler.body); this.dedent();
            this.emit('}');
        });
        
        if (stmt.finallyBlock) {
            this.emit('finally {');
            this.indent(); this.visitBlock(stmt.finallyBlock); this.dedent();
            this.emit('}');
        }
    }

    /**
     * Converts AST expression nodes to Java code with proper operator precedence.
     * Handles literal values, identifiers, operators, function calls, and type coercions.
     * @param expr - The AST expression to convert
     * @param parentPrecedence - Operator precedence of the parent expression (for parenthesis insertion)
     * @returns Java source code representation of the expression
     */
    generateExpression(expr: Expression, parentPrecedence: number): string {
        let output = '';
        let currentPrecedence = 99;

        switch (expr.type) {
            case 'Literal':
                // Handle null, string, boolean, and numeric literals
                if (expr.value === null || expr.raw === '"None"') output = 'null';
                else if (typeof expr.value === 'string') {
                    const strVal = expr.value.startsWith('f') || expr.value.startsWith('r') || expr.value.startsWith('b')
                        ? expr.value.substring(1) : expr.value;
                    output = `"${strVal}"`;
                } else if (typeof expr.value === 'boolean') output = expr.value.toString();
                else output = String(expr.value);
                break;
            case 'Identifier':
                // Output variable/field names as-is
                output = expr.name;
                break;
            case 'ThisExpression':
                // Reference to current object instance
                output = 'this';
                break;
            case 'NewExpression':
                // Object instantiation with constructor call
                currentPrecedence = Precedence.Instantiation;
                const args = expr.arguments.map(a => this.generateExpression(a, 0)).join(', ');
                output = `new ${expr.className}(${args})`;
                break;
            case 'IndexExpression':
                // Array/list element access and slicing
                currentPrecedence = Precedence.Member;
                const objE = this.generateExpression(expr.object, currentPrecedence);
                
                // Convert indices to Java-compatible form, handling negative indices
                const convertIndex = (idx: any): string => {
                    if (!idx) return '0';
                    if (idx.type === 'Literal' && typeof idx.value === 'number' && idx.value < 0) {
                        // Convert negative indices: nums[-1] becomes nums[nums.length - 1]
                        const absIdx = Math.abs(idx.value);
                        return `${objE}.length - ${absIdx}`;
                    } else if (idx.type === 'UnaryExpression' && idx.operator === '-' && idx.argument.type === 'Literal') {
                        // Handle unary minus operator: -1 becomes length - 1
                        const val = idx.argument.value as number;
                        return `${objE}.length - ${val}`;
                    } else {
                        // Regular index access without negative handling
                        return this.generateExpression(idx, 0);
                    }
                };
                
                // Handle array slicing vs single element access
                if (expr.indexEnd) {
                    // Array slicing: Arrays.copyOfRange(array, start, end)
                    const startE = convertIndex(expr.index);
                    const endE = convertIndex(expr.indexEnd);
                    output = `Arrays.copyOfRange(${objE}, ${startE}, ${endE})`;
                } else {
                    // Single element access
                    const indexExpr = convertIndex(expr.index);
                    output = `${objE}[${indexExpr}]`;
                }
                break;
            case 'MemberExpression':
                // Object property/method access (obj.property)
                currentPrecedence = Precedence.Member;
                output = `${this.generateExpression(expr.object, currentPrecedence)}.${expr.property.name}`;
                break;
            case 'BinaryExpression':
                // Handle power operator as special case using Math.pow()
                if (expr.operator === '**') {
                    currentPrecedence = Precedence.Exponential;
                    const base = this.generateExpression(expr.left, currentPrecedence);
                    const exponent = this.generateExpression(expr.right, currentPrecedence);
                    output = `Math.pow(${base}, ${exponent})`;
                    break;
                }
                
                // Operator mapping from source language to Java syntax
                const opMap: Record<string, { op: string, prec: number }> = {
                    // Logical operators
                    'or': { op: '||', prec: Precedence.LogicalOr }, 
                    'and': { op: '&&', prec: Precedence.LogicalAnd },
                    // Equality operators
                    '==': { op: '==', prec: Precedence.Equality }, 
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
                    '%': { op: '%', prec: Precedence.Multiplicative },
                    // Bitwise operators
                    '&': { op: '&', prec: Precedence.BitwiseAnd }, 
                    '|': { op: '|', prec: Precedence.BitwiseOr },
                    '^': { op: '^', prec: Precedence.Xor }, 
                    '<<': { op: '<<', prec: Precedence.Shift },
                    '>>': { op: '>>', prec: Precedence.Shift }, 
                    '>>>': { op: '>>>', prec: Precedence.Shift },
                    // Other operators
                    '..': { op: '..', prec: Precedence.Relational }
                };
                
                // Special handling for string comparison using .equals() method
                if ((expr.operator === '==' || expr.operator === '!=')) {
                    const leftType = this.inferType(expr.left);
                    const rightType = this.inferType(expr.right);
                    
                    // Use .equals() for string comparison instead of == operator
                    if (leftType === 'String' || rightType === 'String') {
                        const leftStr = this.generateExpression(expr.left, Precedence.Call);
                        const rightStr = this.generateExpression(expr.right, Precedence.Call);
                        
                        // Generate string equality check method call
                        if (expr.operator === '==') {
                            output = `${leftStr}.equals(${rightStr})`;
                        } else {
                            output = `!${leftStr}.equals(${rightStr})`;
                        }
                        currentPrecedence = Precedence.Equality;
                        break;
                    }
                }
                
                // Lookup operator and generate binary expression
                const opData = opMap[expr.operator] || { op: expr.operator, prec: 0 };
                currentPrecedence = opData.prec;
                // Generate expression with both operands
                output = `${this.generateExpression(expr.left, currentPrecedence)} ${opData.op} ${this.generateExpression(expr.right, currentPrecedence)}`;
                break;
            case 'UnaryExpression':
                // Unary prefix operators (!, not, -, +)
                currentPrecedence = Precedence.Unary;
                // Map source language not operator to Java !
                let op = expr.operator === 'not' ? '!' : expr.operator;
                output = `${op}${this.generateExpression(expr.argument, currentPrecedence)}`;
                break;
            case 'UpdateExpression':
                // Pre/post increment (++) and decrement (--) operators
                currentPrecedence = Precedence.Unary;
                const argStr = this.generateExpression((expr as any).argument, currentPrecedence);
                // Handle prefix vs postfix operators
                if ((expr as any).prefix) {
                    output = `${(expr as any).operator}${argStr}`;
                } else {
                    output = `${argStr}${(expr as any).operator}`;
                }
                break;
            case 'CallExpression':
                // Function/method calls with argument substitution
                currentPrecedence = Precedence.Call;
                // Collect argument expressions
                let calleeStr = '';
                const argsF = expr.arguments.map(a => this.generateExpression(a, 0));

                // Handle method calls (obj.method()) vs function calls (func())
                if ((expr.callee as any).type === 'MemberExpression') {
                    const memberExpr = expr.callee as any;
                    const obj = this.generateExpression(memberExpr.object, 0);
                    const method = memberExpr.property.name;

                    // Map source language methods to Java ArrayList/String methods
                    if (method === 'append') output = `${obj}.add(${argsF[0]})`;
                    else if (method === 'insert') output = `${obj}.add(${argsF[0]}, ${argsF[1]})`;
                    else if (method === 'remove') output = `${obj}.remove((Object)${argsF[0]})`;
                    else if (method === 'pop') output = argsF.length > 0 ? `${obj}.remove(${argsF[0]})` : `${obj}.remove(${obj}.size() - 1)`;
                    else if (method === 'extend') output = `${obj}.addAll(${argsF[0]})`;
                    else if (method === 'sort') output = `Collections.sort(${obj})`;
                    else if (method === 'lower') output = `${obj}.toLowerCase()`;
                    else if (method === 'upper') output = `${obj}.toUpperCase()`;
                    else if (method === 'replace') output = `${obj}.replace(${argsF[0]}, ${argsF[1]})`;
                    // Default method call
                    else output = `${obj}.${method}(${argsF.join(', ')})`;
                    break;
                } else {
                    // Function call (not method)
                    calleeStr = (expr.callee as any).name;
                }

                // Handle global/builtin function calls with special mapping
                if (calleeStr === 'LENGTH' || calleeStr === 'len') {
                    // length() becomes .length property access
                    output = `${this.generateExpression(expr.arguments[0], 0)}.length`;
                    break;
                }
                // Handle input() function - map to Scanner.nextLine()
                if (calleeStr === 'input' || calleeStr === 'INPUT') {
                    // Print prompt if provided
                    if (argsF.length > 0) {
                        output = `(System.out.print(${argsF[0]}), scanner.nextLine()).substring(0)`;
                    } else {
                        output = `scanner.nextLine()`;
                    }
                    break;
                }
                // Map uppercase method names (from other languages) to Java equivalents
                if (calleeStr === 'APPEND' && argsF.length === 2) { output = `${argsF[0]}.add(${argsF[1]})`; break; }
                if (calleeStr === 'INSERT' && argsF.length === 3) { output = `${argsF[0]}.add(${argsF[1]} - 1, ${argsF[2]})`; break; }
                if (calleeStr === 'REMOVE' && argsF.length === 2) { output = `${argsF[0]}.remove(${argsF[1]} - 1)`; break; }

                // Default function call
                output = `${calleeStr}(${argsF.join(', ')})`;
                break;
            case 'ArrayLiteral':
                // Array literal with Java array initialization syntax
                const type = this.inferType(expr);
                // Extract base type from array type (remove [] suffix)
                const baseType = type.endsWith('[]') ? type.slice(0, -2) : 'Object';
                // Generate array elements and wrap in new Type[] { ... }
                const elems = expr.elements.map(e => this.generateExpression(e, 0)).join(', ');
                output = `new ${baseType}[] {${elems}}`;
                break;
            case 'ConditionalExpression':
                // Ternary operator: condition ? consequent : alternate
                currentPrecedence = Precedence.Conditional;
                const test = this.generateExpression((expr as any).test, currentPrecedence);
                const consequent = this.generateExpression((expr as any).consequent, currentPrecedence);
                const alternate = this.generateExpression((expr as any).alternate, currentPrecedence);
                output = `${test} ? ${consequent} : ${alternate}`;
                break;
            case 'CompoundAssignment':
                // Compound assignment: +=, -=, *=, /=, etc.
                const target = (expr as any).name;
                const value = this.generateExpression((expr as any).value, 0);
                output = `${target} ${(expr as any).operator}= ${value}`;
                break;
        }
        // Wrap in parentheses if precedence is lower than parent to ensure correct evaluation order
        return (currentPrecedence < parentPrecedence) ? `(${output})` : output;
    }
}
