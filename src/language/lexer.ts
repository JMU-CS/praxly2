/**
 * Base lexer types and interfaces.
 * Defines token types and structure used by language-specific lexers.
 */

// Handles tokenization and indentation
export type TokenType =
  | 'KEYWORD'
  | 'IDENTIFIER'
  | 'NUMBER'
  | 'STRING'
  | 'CHAR'
  | 'BOOLEAN'
  | 'OPERATOR'
  | 'PUNCTUATION'
  | 'PLACEHOLDER'
  | 'NEWLINE'
  | 'INDENT'
  | 'DEDENT'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  start: number;
}
