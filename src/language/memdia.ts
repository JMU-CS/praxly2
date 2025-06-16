import {Type, Fruit} from './type.js';

export function declaration(identifier: string, variableType: Type): void {
  console.log("declaration", identifier, variableType);
}

export function assignment(identifier: string, rightFruit: Fruit): void {
  console.log("assignment", identifier, rightFruit);
}
