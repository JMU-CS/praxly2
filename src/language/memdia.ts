import { Type, Fruit, ArrayType, ClassType } from './type.js';
import { GlobalRuntime } from './runtime.js';

const NS = "http://www.w3.org/2000/svg";
const MD = "md__";  // id prefix

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

    const yPos = this.getVariableYPosition(vars.length);
    varGroup.setAttribute('transform', `translate(20, ${yPos})`);

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

    const id = `${MD}${identifier}`;
    const funcGroup = document.createElementNS(NS, 'g');
    funcGroup.setAttribute('id', id);
    funcGroup.setAttribute('class', 'memdia-function');

    const width = this.getFunctionRectWidth(identifier.length);

    const funcName = document.createElementNS(NS, 'text');
    funcName.setAttribute('class', 'func-name');
    funcName.textContent = identifier;
    funcName.setAttribute('x', `${width / 2}`);
    funcName.setAttribute('y', '40');
    funcGroup.appendChild(funcName);

    const funcRect = document.createElementNS(NS, 'rect');
    funcRect.setAttribute('class', 'func-rect');
    funcRect.setAttribute('x', '10');
    funcRect.setAttribute('y', '50');
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
  getVariableYPosition(index: number): number {
    const rectHeight = 40;
    const verticalPadding = 30;
    return 60 + index * (rectHeight + verticalPadding);
  }

  /**
   * Calculate function rectangle height based on the number of variables.
   */
  getFunctionRectHeight(varCount: number): number {
    return 60 + varCount * 40;
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
    const id = `${funcGroup.getAttribute('id')}.${name}`;
    const group = document.createElementNS(NS, 'g');
    group.setAttribute('id', id);
    group.setAttribute('class', 'memdia-variable');

    const rectX = 130;  // TODO relative to function's X and Y
    const rectY = 60;

    const varName = document.createElementNS(NS, 'text');
    varName.textContent = name;
    varName.setAttribute('class', 'var-name');
    varName.setAttribute('x', `${rectX - 7}`);
    varName.setAttribute('y', `${rectY + 20}`);
    group.appendChild(varName);

    const varType = document.createElementNS(NS, 'text');
    varType.textContent = type.toString();
    varType.setAttribute('class', 'var-type');
    varType.setAttribute('x', `${rectX}`);
    varType.setAttribute('y', `${rectY - 7}`);
    group.appendChild(varType);

    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', `${rectX}`);
    rect.setAttribute('y', `${rectY}`);
    rect.setAttribute('width', '40');
    rect.setAttribute('height', '40');
    rect.setAttribute('class', 'var-rect');
    group.appendChild(rect);

    return group;
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

    // Remove the previous value if exists
    if (variableGroup.children.length > 3) {
      variableGroup.lastChild?.remove();
    }

    const newRectWidth = this.getRectWidthForValue(valueStr);
    const currRectWidth = parseFloat(varRect.getAttribute('width') || '40');
    if (newRectWidth > currRectWidth) {
      varRect.setAttribute('width', `${newRectWidth}`);
    }

    const text = document.createElementNS(NS, 'text');
    text.textContent = valueStr;
    text.setAttribute('x', `${newRectWidth / 2}`);  // centered
    text.setAttribute('y', '20');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'var-value');

    const rectX = parseFloat(varRect.getAttribute('x') || '130');
    const rectY = parseFloat(varRect.getAttribute('y') || '60');

    variableGroup.appendChild(text);
  }

  /**
   * Adds a reference value indicator (a small black dot) inside the variable's rectangle.
   *
   * @param variableGroup The SVG group element representing the variable container.
   */
  setReferenceValueInRect(variableGroup: SVGGElement) {
    const varRect = variableGroup.querySelector('.var-rect') as SVGRectElement;

    const oldRef = variableGroup.querySelector('.reference-value-group');
    oldRef?.remove();

    const rectX = parseFloat(varRect.getAttribute('x') || '130');
    const rectY = parseFloat(varRect.getAttribute('y') || '60');

    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', '20');
    dot.setAttribute('cy', '20');
    dot.setAttribute('r', '4');
    dot.setAttribute('class', 'reference-dot');

    const dotGroup = document.createElementNS(NS, 'g');
    dotGroup.setAttribute('class', 'reference-value-group');
    dotGroup.setAttribute('transform', `translate(${rectX}, ${rectY})`);
    dotGroup.appendChild(dot);

    variableGroup.appendChild(dotGroup);
  }
}
