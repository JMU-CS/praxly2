import { Type, Fruit, ArrayType, ClassType } from './type.js';
import { GlobalRuntime } from './runtime.js';

const NS = "http://www.w3.org/2000/svg";
const MD = "md__";  // id prefix
const MARGIN = 20;

/**
 * Superclass that doesn't draw anything; used during unit testing.
 */
export class Memdia {
  protected runtime: GlobalRuntime;

  /**
   * Constructs a new memory visualizer.
   * @param runtime The GlobalRuntime object holding program memory state.
   */
  constructor(runtime: GlobalRuntime) {
    // TODO remove this unused variable?
    this.runtime = runtime;
  }

  /**
   * Declares a new variable in the current memory context (overridden by subclasses).
   */
  declaration(_identifier: string, _variableType: Type): void { }

  /**
   * Assigns a value to an existing variable in the current memory context (overridden by subclasses).
   */
  assignment(_identifier: string, _rightFruit: Fruit): void { }

  /**
   * Visualizes a function call (overridden by subclasses).
   */
  functionCall(_identifier: string): void { }

  /**
   * Visualizes returning from a function (overridden by subclasses).
   */
  functionReturn(): void { }
}

/**
 * Subclass that actually draws the SVG elements in the browser.
 */
export class MemdiaSvg extends Memdia {
  protected svg: SVGSVGElement;

  /**
   * Constructs a new MemdiaSvg instance and initializes the SVG panel.
   * @param runtime The runtime environment storing memory state.
   */
  constructor(runtime: GlobalRuntime) {
    super(runtime);

    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');

    let panel = document.getElementById('memdia-panel') as HTMLElement;
    panel.innerHTML = "";
    panel.appendChild(this.svg);
  }

  /**
   * Renders a declaration for a new variable inside the most recent function.
   * @param identifier The variable name
   * @param variableType The declared type of the variable
   */
  override declaration(identifier: string, variableType: Type): void {
    const funcGroup = this.getCurrentFunction();
    const vars = funcGroup.querySelectorAll('.memdia-variable');
    const varGroup = this.renderVariableWithoutValue(funcGroup, identifier, variableType);

    funcGroup.appendChild(varGroup);

    const funcRect = funcGroup.querySelector('.func-rect') as SVGRectElement;
    if (funcRect) {
      // don't call function here
      funcRect.setAttribute('height', `${this.getFunctionRectHeight(vars.length + 1)}`);
    }
  }

  /**
   * Renders an assignment of a value to an existing variable.
   * @param identifier The variable name
   * @param rightFruit The value being assigned
   */
  override assignment(identifier: string, rightFruit: Fruit): void {
    const funcGroup = this.getCurrentFunction();
    const vars = funcGroup.querySelectorAll('.memdia-variable');
    for (const variable of vars) {
      const nameDiv = variable.querySelector('.var-name');
      if (nameDiv?.textContent === identifier) {
        if (rightFruit.value !== null) {
          if (
            rightFruit.type instanceof ArrayType ||
            rightFruit.type instanceof ClassType ||
            rightFruit.type.toString() === 'string'
          ) {
            this.setReferenceValueInRect(variable as SVGGElement);
          } else {
            this.setPrimitiveValueInRect(variable as SVGGElement, rightFruit);
          }
        } else {
          const existingText = variable.querySelector('.var-value');
          if (existingText) existingText.remove();
          const existingDot = variable.querySelector('.reference-value');
          if (existingDot) existingDot.remove();
        }
        return;
      }
    }
  }

  /**
   * Renders a complete function group and its variables.
   * @param identifier The name of the function
   */
  override functionCall(identifier: string): void {

    const funcGroup = document.createElementNS(NS, 'g');
    funcGroup.setAttribute('id', `${MD}${identifier}`);
    funcGroup.setAttribute('class', 'memdia-function');

    const width = this.getFunctionRectWidth(identifier.length);

    const prevFunctions = this.svg.querySelectorAll('.memdia-function');
    let x = MARGIN;
    let y = MARGIN;

    if (prevFunctions.length > 0) {
    const prev = prevFunctions[prevFunctions.length - 1] as SVGGElement;
    const prevRect = prev.querySelector('.func-rect') as SVGRectElement;
    if (prevRect) {
      const prevY = parseFloat(prev.getAttribute('data-y') || '0');
      const prevHeight = parseFloat(prevRect.getAttribute('height') || '0');
      y = prevY + prevHeight + MARGIN;
    }
  }

    funcGroup.setAttribute('data-y', `${y}`);

    const funcName = document.createElementNS(NS, 'text');
    funcName.setAttribute('class', 'func-name');
    funcName.textContent = identifier;
    funcName.setAttribute('x', `${width / 2 + MARGIN}`);
    funcName.setAttribute('y', `${y + MARGIN}`);
    funcGroup.appendChild(funcName);

    const funcRect = document.createElementNS(NS, 'rect');
    funcRect.setAttribute('class', 'func-rect');
    funcRect.setAttribute('x', `${x}`);
    funcRect.setAttribute('y', `${y + 30}`);
    funcRect.setAttribute('width', `${width}`);
    funcRect.setAttribute('height', '60');
    funcGroup.appendChild(funcRect);

    this.svg.appendChild(funcGroup);
  }

  /**
   * Removes the most recently added function from the diagram.
   */
  override functionReturn(): void {
    const funcGroup = this.getCurrentFunction();
    if (funcGroup != this.svg) {
      funcGroup.parentElement?.remove();
    }
  }

  /**
   * Returns the most recent function group or the root SVG element if none exists.
   */
  getCurrentFunction(): SVGElement {
    const functions = this.svg.querySelectorAll('.memdia-function');
    return functions.length > 0
      ? functions[functions.length - 1] as SVGElement
      : this.svg;
  }

  /**
   * Calculate the Y position of the nth variable.
   */
  // getVariableYPosition(index: number): number {
  //   const rectHeight = 40;
  //   return MARGIN + index * (rectHeight + MARGIN);
  // }

  /**
   * Calculate function rectangle height based on the number of variables.
   */
  getFunctionRectHeight(varCount: number): number {
    return varCount * (40 + MARGIN) + MARGIN;
  }

  /**
   * Calculate function rectangle width based on the longest variable name.
   */
  getFunctionRectWidth(maxNameLength: number): number {
    const charWidth = 8;
    const minWidth = 100;
    const padding = 50;
    return Math.max(minWidth, maxNameLength * charWidth + padding);
  }

  /**
   * Calculate the width of a variable rectangle based on the value length.
   */
  getRectWidthForValue(valueStr: string): number {
    const charWidth = 8;
    const padding = 20;
    const minWidth = 40;
    return Math.max(minWidth, valueStr.length * charWidth + padding);
  }

  /**
   * Renders an SVG group representing a variable with its name and type, but without assigning a value.
   * The variable with be uniquely identified by combining the prefix, function name, and variable name.
   * This is suitable for declaring primitive or reference variables.
   *
   * @param funcGroup Name of the function to which the variable belongs
   * @param name Variable name
   * @param type Variable type
   * @returns SVG group representing the variable
   */
  renderVariableWithoutValue(funcGroup: SVGElement, name: string, type: Type): SVGGElement {

    const varGroup = document.createElementNS(NS, 'g');
    varGroup.setAttribute('id', `${funcGroup.getAttribute('id')}.${name}`);
    varGroup.setAttribute('class', 'memdia-variable');

    let funcX = 0;
    let funcY = 0;

    const funcRect = funcGroup.querySelector('.func-rect') as SVGRectElement;

    if (funcRect) {
      funcX = parseFloat(funcRect.getAttribute('x') ?? '0');
      funcY = parseFloat(funcRect.getAttribute('y') ?? '0');
    }

    const allVars = funcGroup.querySelectorAll('.memdia-variable');
    let rectX = funcX + MARGIN;
    let rectY = funcY + MARGIN;

    if (allVars.length > 0) {
      const prevVar = allVars[allVars.length - 1] as SVGGElement;
      const prevRect = prevVar.querySelector('.var-rect') as SVGRectElement;

      if (prevRect) {
        const prevY = parseFloat(prevRect.getAttribute('y') || '0');
        const prevHeight = parseFloat(prevRect.getAttribute('height') || '40');
        rectY = prevY + prevHeight + MARGIN;
      }
    }

    const varType = document.createElementNS(NS, 'text');
    varType.textContent = type.toString();
    varType.setAttribute('class', 'var-type');
    varType.setAttribute('x', `${rectX}`);
    varType.setAttribute('y', `${rectY - MARGIN / 2}`);
    varGroup.appendChild(varType);

    const varName = document.createElementNS(NS, 'text');
    varName.textContent = name;
    varName.setAttribute('class', 'var-name');
    varName.setAttribute('x', `${rectX - MARGIN / 2}`);
    varName.setAttribute('y', `${rectY + MARGIN}`);
    varGroup.appendChild(varName);

    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', `${rectX}`);
    rect.setAttribute('y', `${rectY}`);
    rect.setAttribute('width', '40');
    rect.setAttribute('height', '40');
    rect.setAttribute('class', 'var-rect');
    varGroup.appendChild(rect);

    return varGroup;
  }

  /**
   * Adds a primitive value (e.g., number, boolean) to a previously rendered variable group.
   * The value is displayed inside the rectangle using the type's serialization method.
   *
   * @param variableGroup The SVG group returned by renderVariableWithoutValue
   * @param fruit The Fruit object containing the value to assign (must be non-null)
   */
  setPrimitiveValueInRect(variableGroup: SVGGElement, fruit: Fruit): void {
    if (!(fruit instanceof Fruit) || fruit.value === null) return;

    const varRect = variableGroup.querySelector('.var-rect') as SVGRectElement;
    if (!varRect) return;

    const valueStr = fruit.type.serializeValue(fruit.value);

    const existingValue = variableGroup.querySelector('.var-value');
    if (existingValue) existingValue.remove();

    const newRectWidth = this.getRectWidthForValue(valueStr);
    const currRectWidth = parseFloat(varRect.getAttribute('width') || '40');
    const rectHeight = parseFloat(varRect.getAttribute('height') || '40');

    if (newRectWidth > currRectWidth) {
      varRect.setAttribute('width', `${newRectWidth}`);
    }

    const rectX = parseFloat(varRect.getAttribute('x') || '0');
    const rectY = parseFloat(varRect.getAttribute('y') || '0');

    const text = document.createElementNS(NS, 'text');
    text.textContent = valueStr;
    text.setAttribute('class', 'var-value');
    text.setAttribute('x', `${rectX + newRectWidth / 2}`);
    text.setAttribute('y', `${rectY + rectHeight / 2 + 2}`);
    text.setAttribute('text-anchor', 'middle');

    variableGroup.appendChild(text);
  }

  /**
   * Adds a reference value indicator (a small black dot) inside the variable's rectangle.
   *
   * @param variableGroup The SVG group element representing the variable container.
   */
  setReferenceValueInRect(variableGroup: SVGGElement): void {
    const varRect = variableGroup.querySelector('.var-rect') as SVGRectElement;
    if (!varRect) return;

    const oldRef = variableGroup.querySelector('.reference-value-group');
    oldRef?.remove();

    const rectX = parseFloat(varRect.getAttribute('x') || '0');
    const rectY = parseFloat(varRect.getAttribute('y') || '0');
    const rectWidth = parseFloat(varRect.getAttribute('width') || '40');
    const rectHeight = parseFloat(varRect.getAttribute('height') || '40');

    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', `${rectWidth / 2}`);
    dot.setAttribute('cy', `${rectHeight / 2}`);
    dot.setAttribute('r', '4');
    dot.setAttribute('class', 'reference-dot');

    const dotGroup = document.createElementNS(NS, 'g');
    dotGroup.setAttribute('class', 'reference-value-group');
    dotGroup.setAttribute('transform', `translate(${rectX}, ${rectY})`);
    dotGroup.appendChild(dot);

    variableGroup.appendChild(dotGroup);
  }
}
