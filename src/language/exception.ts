import {Where} from './where.js';

export class WhereError extends Error {
  where: Where;

  constructor(message: string, where: Where) {
    super(message);
    this.where = where;
  }
}
