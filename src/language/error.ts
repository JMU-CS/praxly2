import {Where} from './where.js';

export class WhereError extends Error {
  where: Where;

  constructor(message: string, where: Where) {
    super(message);
    this.where = where;
  }
}

export class LexError extends WhereError {}

export class ParseError extends WhereError {}

export class EvaluateError extends WhereError {}
export class TypeError extends EvaluateError {}
export class IllegalIndexError extends EvaluateError {}

// export class UnlocatedError extends Error {
  // constructor(message: string) {
    // super(message);
  // }
// }
