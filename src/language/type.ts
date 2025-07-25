import {Where} from './where.js';

export class Type {
  text: string;
  where: Where;

  constructor(text: string, where: Where = Where.Nowhere) {
    this.text = text;
    this.where = where;
  }

  equals(that: Type): boolean {
    return this.text === that.text;
  }

  covers(that: Type): boolean {
    return this.text === that.text;
  }

  toString(): string {
    return this.text;
  }

  serializeValue(value: any): string {
    return value.toString();
  }

  static Integer = new Type('int');
  static Float = new Type('float');
  static Double = new Type('double');
  static Void = new Type('void');
  static Boolean = new Type('boolean');
  static String = new Type('String');
  static IntegerRange = new Type('IntegerRange');
  static Null = new Type('null');
  static Any: Type;
}

export const typeMap: {[index: string]: Type} = {
  'int': Type.Integer,
  'float': Type.Float,
  'double': Type.Double,
  'void': Type.Void,
  'boolean': Type.Boolean,
  'String': Type.String,
};

export class AnyType extends Type {
  constructor() {
    super('Any');
  }

  covers(_that: Type): boolean {
    return true;
  }
}

export class ArrayType extends Type {
  elementType: Type;

  // If elementType is an array, we want:
  // itemType[parentSize][childSize]
  //
  // itemType[grandParentSize][parentSize][childSize]

  constructor(elementType: Type, size: string | null = null, where: Where = Where.Nowhere) {
    super(`${elementType.text}[${size ?? ''}]`, where);
    this.elementType = elementType;
  }

  serializeValue(value: any): string {
    return `${(value as Fruit[]).map(element => element.type.serializeValue(element.value)).join(', ')}`;
  }

  brackets(): string {
    return '[]';
  }

  toString(): string {
    let bracketChain = this.brackets();
    let nestedType = this.elementType;
    while (nestedType instanceof ArrayType) {
      bracketChain += nestedType.brackets();
      nestedType = nestedType.elementType;
    }
    return `${nestedType}${bracketChain}`;
  }

  equals(that: Type) {
    return that instanceof ArrayType && this.elementType.equals(that.elementType);
  }

  covers(that: Type): boolean {
    // Make arrays invariant because this code is dangerous:
    //   sub[] subs = {sub0, sub1, sub2}
    //   super[] supers = subs
    //   supers[0] = newSuper
    // Covariance allows a non-sub to be inserted.
    return this.equals(that);
  }
}

export class SizedArrayType extends ArrayType {
  size: number;
  hasRange: boolean;

  constructor(elementType: Type, size: number, hasRange: boolean = false, where: Where = Where.Nowhere) {
    super(elementType, hasRange ? `0..${size - 1}` : `${size}`, where);
    this.size = size;
    this.hasRange = hasRange;
  }

  brackets(): string {
    if (this.hasRange) {
      return `[0..${this.size - 1}]`;
    } else {
      return `[${this.size}]`;
    }
  }

  equals(that: Type): boolean {
    return super.equals(that) && that instanceof SizedArrayType && this.size === that.size;
  }
}

export class ObjectType extends Type {
  covers(that: Type): boolean {
    return this.text === that.text || that === Type.Null;
  }
}

export class UnionType extends Type {
  options: Type[];

  constructor(options: Type[]) {
    super(`(${options.map(option => option.text).join(' | ')})`);
    this.options = options;
  }

  covers(that: Type): boolean {
    // TODO: cover other union type
    return this.options.some(option => option.covers(that));
  }
}

export const NumberType = new UnionType([Type.Double, Type.Float, Type.Integer]);

export class Fruit {
  type: Type;
  value: any;

  constructor(type: Type, value: any = null) {
    this.type = type;
    this.value = value;
  }

  toString(): string {
    return this.value.toString();
  }
}

Type.Any = new AnyType();
