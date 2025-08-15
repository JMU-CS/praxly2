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
  static Character = new Type('char');
  static IntegerRange = new Type('IntegerRange');
  static Null = new Type('null');
  static Internal = new Type('internal');
  static Any: Type;
  static String: ClassType;
}

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

export class LazyClassType extends Type {
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

export class FormalType {
  identifier: string;
  type: Type;

  constructor(identifier: string, type: Type) {
    this.identifier = identifier;
    this.type = type;
  }
}

export class FunctionType {
  formals: FormalType[];
  returnType: Type;

  constructor(formals: FormalType[], returnType: Type) {
    this.formals = formals;
    this.returnType = returnType;
  }
}

export enum Visibility {
  Public,
  Private,
}

export class MethodType {
  formals: FormalType[];
  returnType: Type;
  visibility: Visibility;

  constructor(formals: FormalType[], returnType: Type, visibility: Visibility) {
    this.formals = formals;
    this.returnType = returnType;
    this.visibility = visibility;
  }
}

export class InstanceVariableType {
  type: Type;
  visibility: Visibility;
  initialValue: string | number | boolean | null;

  constructor(type: Type, visibility: Visibility, initialValue: any) {
    this.type = type;
    this.visibility = visibility;
    this.initialValue = initialValue;
  }
}

export class ClassType extends Type {
  superclass: ClassType | null;
  instanceVariableTypes: Map<string, InstanceVariableType>;
  constructorType: MethodType | null;
  instanceMethodTypes: Map<string, MethodType>;
  where: Where;

  constructor(name: string, superclass: ClassType | null, where: Where) {
    super(name);
    this.superclass = superclass;
    this.constructorType = null;
    this.instanceVariableTypes = new Map();
    this.instanceMethodTypes = new Map();
    this.where = where;
  }

  instanceVariable(identifier: string): InstanceVariableType | null {
    let instanceVariableType = this.instanceVariableTypes.get(identifier);
    if (instanceVariableType) {
      return instanceVariableType;
    } else if (this.superclass) {
      return this.superclass.instanceVariable(identifier);
    } else {
      return null;
    }
  }

  instanceMethod(identifier: string): MethodType | null {
    let methodType = this.instanceMethodTypes.get(identifier);
    if (methodType) {
      return methodType;
    } else if (this.superclass) {
      return this.superclass.instanceMethod(identifier);
    } else {
      return null;
    }
  }

  covers(that: Type): boolean {
    if (that === Type.Null) {
      return true;
    } else if (!(that instanceof ClassType)) {
      return false;
    }

    let thatAncestor: ClassType | null = that;
    while (thatAncestor) {
      if (this === thatAncestor) {
        return true;
      }
      thatAncestor = thatAncestor.superclass;
    }

    return false;
  }
}

export class StringType extends ClassType {
  constructor() {
    super('String', null, Where.Nowhere);

    this.instanceVariableTypes.set('text', new InstanceVariableType(Type.Internal, Visibility.Private, null));

    this.instanceMethodTypes.set('length', new MethodType([], Type.Integer, Visibility.Public));
    this.instanceMethodTypes.set('substring', new MethodType([
      new FormalType('start', Type.Integer),
      new FormalType('end', Type.Integer),
    ], this, Visibility.Public));
    this.instanceMethodTypes.set('charAt', new MethodType([
      new FormalType('index', Type.Integer),
    ], Type.Character, Visibility.Public));
    this.instanceMethodTypes.set('indexOf', new MethodType([
      new FormalType('c', Type.Character),
    ], Type.Integer, Visibility.Public));
    this.instanceMethodTypes.set('lastIndexOf', new MethodType([
      new FormalType('c', Type.Character),
    ], Type.Integer, Visibility.Public));
  }
}

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
Type.String = new StringType();
