/**
 * High-level translation orchestrator that converts AST to target programming languages.
 * Analyzes the program for type and scope information, then dispatches to language-specific emitters.
 */

import type { Program, Statement, Expression, Block } from './ast';
import {
  type TargetLanguage,
  type TranslationContext,
  type SourceMap,
  SymbolTable,
  ASTVisitor,
} from './visitor';

import { JavaEmitter } from './java/emitter';
import { CSPEmitter } from './csp/emitter';
import { PythonEmitter } from './python/emitter';
import { PraxisEmitter } from './praxis/emitter';

export interface TranslationResult {
  code: string;
  sourceMap: SourceMap;
}

export class Translator {
  /**
   * Translates code between supported languages.
   */
  translate(program: Program, targetLang: TargetLanguage): string {
    const result = this.translateWithMap(program, targetLang);
    return result.code;
  }

  /**
   * Translates code between supported languages.
   */
  translateWithMap(program: Program, targetLang: TargetLanguage): TranslationResult {
    const context = this.analyze(program);

    let emitter: ASTVisitor;
    switch (targetLang) {
      case 'java':
        emitter = new JavaEmitter(context);
        break;
      case 'csp':
        emitter = new CSPEmitter(context);
        break;
      case 'python':
        emitter = new PythonEmitter(context);
        break;
      case 'praxis':
        emitter = new PraxisEmitter(context);
        break;
      default:
        throw new Error(`Unsupported target language: ${targetLang}`);
    }

    emitter.visitProgram(program);
    return {
      code: emitter.getGeneratedCode(),
      sourceMap: emitter.getSourceMap(),
    };
  }

  /**
   * Runs analyze.
   */
  private analyze(program: Program): TranslationContext {
    const context: TranslationContext = {
      symbolTable: new SymbolTable(),
      functionReturnTypes: new Map(),
      functionParamTypes: new Map(),
      mutableCollections: new Set(),
      collectionElementTypes: new Map(),
      inferredVariableTypes: new Map(),
    };

    /**
     * Runs to boxed java type.
     */
    const toBoxedJavaType = (type: string): string => {
      switch (type) {
        case 'int':
          return 'Integer';
        case 'double':
          return 'Double';
        case 'boolean':
          return 'Boolean';
        case 'char':
          return 'Character';
        case 'long':
          return 'Long';
        case 'float':
          return 'Float';
        case 'short':
          return 'Short';
        case 'byte':
          return 'Byte';
        default:
          return type;
      }
    };

    /**
     * Runs get collection element type.
     */
    const getCollectionElementType = (type: string): string => {
      if (type.endsWith('[]')) return type.slice(0, -2);
      if (type.startsWith('ArrayList<') && type.endsWith('>')) {
        return type.slice('ArrayList<'.length, -1);
      }
      return type;
    };

    /**
     * Runs set collection element type.
     */
    const setCollectionElementType = (name: string, newType: string) => {
      const normalized = newType === 'var' ? 'Object' : newType;
      const existing = context.collectionElementTypes?.get(name);
      if (!existing) {
        context.collectionElementTypes?.set(name, normalized);
        return;
      }
      if (existing !== normalized) {
        context.collectionElementTypes?.set(name, 'Object');
      }
    };

    /**
     * Runs get assignment name.
     */
    const getAssignmentName = (stmt: any): string | null => {
      if (stmt.target?.type === 'Identifier') {
        return stmt.target.name;
      }
      if (typeof stmt.name === 'string' && stmt.name && stmt.name !== 'unknown') {
        return stmt.name;
      }
      return null;
    };

    /**
     * Runs infer type.
     */
    const inferType = (expr: Expression): string => {
      switch (expr.type) {
        case 'Literal':
          if (typeof expr.value === 'boolean') return 'boolean';
          if (typeof expr.value === 'string') return 'String';
          if (typeof expr.value === 'number') {
            if (expr.raw && (expr.raw.includes('.') || expr.raw.toLowerCase().includes('e')))
              return 'double';
            return 'int';
          }
          return 'Object';
        case 'Identifier':
          return context.symbolTable.get(expr.name) || 'var';
        case 'BinaryExpression':
          if (['>', '<', '>=', '<=', '==', '!=', 'and', 'or'].includes(expr.operator))
            return 'boolean';
          const left = inferType(expr.left);
          if (left === 'double') return 'double';
          return 'int';
        case 'UnaryExpression':
          if (expr.operator === 'not' || expr.operator === '!') return 'boolean';
          return inferType(expr.argument);
        case 'NewExpression':
          return (expr as any).className || 'Object';
        case 'IndexExpression':
          const objType = inferType(expr.object);
          if (objType.endsWith('[]')) return objType.slice(0, -2);
          if (objType.startsWith('ArrayList<') && objType.endsWith('>')) {
            return objType.slice('ArrayList<'.length, -1);
          }
          return 'var';
        case 'CallExpression':
          const calleeNameForAnalysis = (expr.callee as any).name;
          if (calleeNameForAnalysis === 'range') return 'int[]';
          if (calleeNameForAnalysis === 'len' || calleeNameForAnalysis === 'LENGTH') return 'int';
          if (calleeNameForAnalysis === 'input' || calleeNameForAnalysis === 'INPUT')
            return 'String';
          if (calleeNameForAnalysis && context.functionReturnTypes.has(calleeNameForAnalysis))
            return context.functionReturnTypes.get(calleeNameForAnalysis)!;
          return 'var';
        case 'ArrayLiteral':
          if (expr.elements && expr.elements.length > 0) {
            return inferType(expr.elements[0]) + '[]';
          }
          return 'Object[]';
        default:
          return 'var';
      }
    };

    /**
     * Runs analyze mutable collections.
     */
    const analyzeMutableCollections = (node: any) => {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'Assignment') {
        const assignmentName = getAssignmentName(node);
        if (assignmentName && node.value?.type === 'ArrayLiteral') {
          const inferredElementType =
            node.value.elements.length > 0 ? inferType(node.value.elements[0]) : 'Object';
          setCollectionElementType(assignmentName, inferredElementType);
        }

        if (assignmentName && node.value?.type === 'Identifier') {
          const aliasedElementType = context.collectionElementTypes?.get(node.value.name);
          if (aliasedElementType) {
            setCollectionElementType(assignmentName, aliasedElementType);
          }
        }
      }

      if (node.type === 'CallExpression') {
        if (node.callee?.type === 'MemberExpression') {
          const objectExpr = node.callee.object;
          const methodName = node.callee.property?.name;

          if (objectExpr?.type === 'Identifier' && typeof methodName === 'string') {
            const collectionName = objectExpr.name;
            if (['append', 'insert', 'extend', 'pop', 'remove', 'sort'].includes(methodName)) {
              context.mutableCollections?.add(collectionName);
            }

            if (methodName === 'append' && node.arguments.length >= 1) {
              setCollectionElementType(collectionName, inferType(node.arguments[0]));
            } else if (methodName === 'insert' && node.arguments.length >= 2) {
              setCollectionElementType(collectionName, inferType(node.arguments[1]));
            } else if (methodName === 'extend' && node.arguments.length >= 1) {
              setCollectionElementType(
                collectionName,
                getCollectionElementType(inferType(node.arguments[0]))
              );
            }
          }
        } else {
          const calleeName = node.callee?.name;
          if (
            typeof calleeName === 'string' &&
            ['APPEND', 'INSERT', 'EXTEND'].includes(calleeName)
          ) {
            const collectionArg = node.arguments[0];
            if (collectionArg?.type === 'Identifier') {
              const collectionName = collectionArg.name;
              context.mutableCollections?.add(collectionName);

              if (calleeName === 'APPEND' && node.arguments.length >= 2) {
                setCollectionElementType(collectionName, inferType(node.arguments[1]));
              } else if (calleeName === 'INSERT' && node.arguments.length >= 3) {
                setCollectionElementType(collectionName, inferType(node.arguments[2]));
              } else if (calleeName === 'EXTEND' && node.arguments.length >= 2) {
                setCollectionElementType(
                  collectionName,
                  getCollectionElementType(inferType(node.arguments[1]))
                );
              }
            }
          }
        }
      }

      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          value.forEach((entry) => analyzeMutableCollections(entry));
        } else if (value && typeof value === 'object') {
          analyzeMutableCollections(value);
        }
      }
    };

    /**
     * Runs analyze block.
     */
    const analyzeBlock = (statements: Statement[]) => {
      statements.forEach((stmt) => {
        if (stmt.type === 'Assignment') {
          const assignmentName = getAssignmentName(stmt);
          const explicitType = (stmt as any).varType;
          let type = explicitType && explicitType !== 'auto' ? explicitType : inferType(stmt.value);

          if (assignmentName && context.mutableCollections?.has(assignmentName)) {
            const elementType =
              context.collectionElementTypes?.get(assignmentName) ||
              getCollectionElementType(type) ||
              'Object';
            type = `ArrayList<${toBoxedJavaType(elementType)}>`;
          }

          if (assignmentName && type !== 'var') {
            context.symbolTable.set(assignmentName, type);
            context.inferredVariableTypes?.set(assignmentName, type);
          }
        }
        if (stmt.type === 'If') {
          analyzeBlock(stmt.thenBranch.body);
          if (stmt.elseBranch) analyzeBlock(stmt.elseBranch.body);
        }
        if (stmt.type === 'While' || stmt.type === 'DoWhile' || stmt.type === 'RepeatUntil')
          analyzeBlock(stmt.body.body);
        if (stmt.type === 'For') analyzeBlock(stmt.body.body);
      });
    };

    /**
     * Runs analyze calls.
     */
    const analyzeCalls = (node: any) => {
      if (!node) return;
      if (node.type === 'CallExpression') {
        const funcName = node.callee?.name;
        const argTypes = node.arguments.map((arg: Expression) => inferType(arg));
        if (funcName && !context.functionParamTypes.has(funcName)) {
          context.functionParamTypes.set(funcName, argTypes);
        }
      }
      for (const key in node) {
        if (typeof node[key] === 'object' && node[key] !== null) {
          if (Array.isArray(node[key])) node[key].forEach((c: any) => analyzeCalls(c));
          else analyzeCalls(node[key]);
        }
      }
    };

    /**
     * Runs analyze return type.
     */
    const analyzeReturnType = (block: Block): string => {
      for (const stmt of block.body) {
        if (stmt.type === 'Return') return stmt.value ? inferType(stmt.value) : 'void';
        if (stmt.type === 'If') {
          const t = analyzeReturnType(stmt.thenBranch);
          if (t !== 'void') return t;
          if (stmt.elseBranch) {
            const e = analyzeReturnType(stmt.elseBranch);
            if (e !== 'void') return e;
          }
        }
      }
      return 'void';
    };

    const functions = program.body.filter((s) => s.type === 'FunctionDeclaration');

    // Multi-pass dependency resolution for chained nested procedures (max_two -> max_three)
    let changed = true;
    let passLimit = 10;
    while (changed && passLimit-- > 0) {
      changed = false;
      functions.forEach((func: any) => {
        const oldType = context.functionReturnTypes.get(func.name) || 'void';
        const newType = analyzeReturnType(func.body);
        if (oldType !== newType && newType !== 'var' && newType !== 'void') {
          context.functionReturnTypes.set(func.name, newType);
          changed = true;
        }
      });
    }

    analyzeMutableCollections(program);
    analyzeBlock(program.body);
    analyzeCalls(program);

    return context;
  }
}
