export class Type {
  text: string;

  constructor(text: string) {
    this.text = text;
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
}

export const typeMap: {[index: string]: Type} = {
  'int': Type.Integer,
  'float': Type.Float,
  'double': Type.Double,
  'void': Type.Void,
  'boolean': Type.Boolean,
  'String': Type.String,
};

export class ArrayType extends Type {
  elementType: Type;

  constructor(elementType: Type, size: number | null = null) {
    super(`${elementType.text}[${size === null ? '' : size}]`);
    this.elementType = elementType;
  }

  serializeValue(value: any): string {
    return `{${(value as Fruit[]).map(element => element.type.serializeValue(element.value)).join(', ')}}`;
  }

  covers(that: Type): boolean {
    return that instanceof ArrayType && this.elementType.covers(that.elementType);
  }
}

export class SizedArrayType extends ArrayType {
  size: number;

  constructor(elementType: Type, size: number) {
    super(elementType, size);
    this.size = size;
  }

  fitsFruit(fruit: Fruit) {
    // Assumes typecheck has already been done. Only examines size.
    return fruit.value.length === this.size &&
           (!(this.elementType instanceof SizedArrayType) ||
            fruit.value.every((element: Fruit) => (this.elementType as SizedArrayType).fitsFruit(element)));
  }
}

export class ObjectType extends Type {
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
