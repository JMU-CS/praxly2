import {Where} from './where.js';

export class WhereError extends Error {
  where: Where;

  constructor(message: string, where: Where) {
    super(message);
    this.where = where;
  }
}

// export class UnlocatedError extends Error {
  // constructor(message: string) {
    // super(message);
  // }
// }
