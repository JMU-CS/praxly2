import { Type, Fruit, ArrayType, ObjectType } from './type.js';
import { GlobalRuntime } from './evaluator.js';

const NS = "http://www.w3.org/2000/svg";

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
  functionCall(_scopeName: string): void { }

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
  protected currentScopeName: string = '';

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
   * Renders a declaration for a new variable inside the most recent function box.
   * @param identifier The variable name
   * @param variableType The declared type of the variable
   */
  override declaration(identifier: string, variableType: Type): void {
    const funcGroup = this.getCurrentFunction();
    const vars = funcGroup.querySelectorAll('.memdia-variable');
    const varBox = this.renderVariableBoxWithoutValue(this.currentScopeName, identifier, variableType);

    const index = vars.length;
    const yPos = this.getVariableYPosition(index);
    varBox.setAttribute('transform', `translate(20, ${yPos})`);

    funcGroup.appendChild(varBox);

    const funcBox = funcGroup.querySelector('.function-box') as SVGRectElement;
    if (funcBox) {
      funcBox.setAttribute('height', `${this.getFunctionBoxHeight(vars.length + 1)}`);
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
            rightFruit.type instanceof ObjectType ||
            rightFruit.type.toString() === 'string'
          ) {
            this.setReferenceValueInBox(variable as SVGGElement);
          } else {
            this.setPrimitiveValueInBox(variable as SVGGElement, rightFruit);
          }
        } else {
          const existingText = variable.querySelector('.primitive-value');
          if (existingText) existingText.remove();
          const existingDot = variable.querySelector('.reference-value');
          if (existingDot) existingDot.remove();
        }
        return;
      }
    }
  }

  getVariableYPosition(index: number): number {
    const boxHeight = 40;
    const verticalPadding = 30;
    return 60 + index * (boxHeight + verticalPadding);
  }

  getFunctionBoxHeight(varCount: number): number {
    return 60 + varCount * 40;
  }

  getFunctionBoxWidth(maxNameLength: number): number {
    const charWidth = 8;
    const minWidth = 100;
    return Math.max(minWidth, 50 + maxNameLength * charWidth);
  }

  /**
   * Renders a complete function scope box and its variables.
   * Box height is adjusted based on number of variables.
   *
   * @param scopeName The name of the function or scope
   * @returns The SVG group element representing the full scope
   */
  override functionCall(scopeName: string): SVGElement {
    this.currentScopeName = scopeName;

    const group = document.createElementNS(NS, 'g');
    group.setAttribute('class', 'memdia-function');

    const width = this.getFunctionBoxWidth(scopeName.length);

    const funcName = document.createElementNS(NS, 'text');
    funcName.setAttribute('class', 'function-name');
    funcName.textContent = scopeName;
    funcName.setAttribute('x', `${width / 2}`);
    funcName.setAttribute('y', '40');
    group.appendChild(funcName);

    const funcBox = document.createElementNS(NS, 'rect');
    funcBox.setAttribute('class', 'function-box');
    funcBox.setAttribute('x', '10');
    funcBox.setAttribute('y', '50');
    funcBox.setAttribute('width', `${width}`);
    funcBox.setAttribute('height', '60');
    group.appendChild(funcBox);

    return group;
  }

  /**
   * Removes the most recently added function call box from the diagram.
   */
  override functionReturn(): void {
    const exitingBox = this.getCurrentFunction();
    if (exitingBox != this.svg) {
      exitingBox?.parentElement?.remove();
    }
  }

  /**
   * Returns the most recent function group box (<g>) or the root SVG element if none exists.
   */
  getCurrentFunction(): SVGElement {
    const functions = this.svg.querySelectorAll('.memdia-function');
    return functions.length > 0
      ? functions[functions.length - 1] as SVGElement
      : this.svg;
  }

  /*
    // Clears and redraws the entire memory diagram based on current global memory state
    renderMemoryDiagram(): void {
      const panel = this.getOrCreatePanel();
      panel.innerHTML = '';

      const centerGroup = document.createElementNS(NS, 'g');
      centerGroup.setAttribute('transform', 'translate(50, 50)');

      const scopeBox = this.renderScopeBox("main", this.memory); // updated call if you want to test
      centerGroup.appendChild(scopeBox);
      panel.appendChild(centerGroup);
    }
  */

  /**
   * Renders an SVG group representing a variable with its name and type, but without assigning a value.
   * The variable with be uniquely identified by combining the function scope name and the variable name.
   * This is suitable for declaring primitive or reference variables.
   *
   * @param scopeName Name of the function or scope to which the variable belongs
   * @param name Variable name
   * @param type Variable type
   * @returns SVG group representing the variable
   */
  renderVariableBoxWithoutValue(
    scopeName: string,
    name: string,
    type: Type
  ): SVGGElement {
    const id = `${scopeName}.${name}`;
    const group = document.createElementNS(NS, 'g');
    group.setAttribute('id', id);
    group.setAttribute('class', 'memdia-variable');

    const boxX = 130;
    const boxY = 60;

    const varName = document.createElementNS(NS, 'text');
    varName.textContent = name;
    varName.setAttribute('class', 'var-name');
    varName.setAttribute('x', `${boxX - 7}`);
    varName.setAttribute('y', `${boxY + 25}`);
    group.appendChild(varName);

    const varType = document.createElementNS(NS, 'text');
    varType.textContent = type.toString();
    varType.setAttribute('class', 'var-type');
    varType.setAttribute('x', `${boxX}`);
    varType.setAttribute('y', `${boxY - 7}`);
    group.appendChild(varType);

    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', `${boxX}`);
    rect.setAttribute('y', `${boxY}`);
    rect.setAttribute('width', '40');
    rect.setAttribute('height', '40');
    rect.setAttribute('class', 'var-box');
    group.appendChild(rect);

    return group;
  }

  getBoxWidthForValue(valueStr: string): number {
    const charWidth = 8;
    const padding = 20;
    const minWidth = 40;
    return Math.max(minWidth, valueStr.length * charWidth + padding);
  }

  getCenteredTextX(boxWidth: number): number {
    return boxWidth / 2;
  }

  /**
   * Adds a primitive value (e.g., number, boolean, string) to a previously rendered variable box.
   * The value is displayed inside the box using the type's serialization method.
   *
   * @param variableGroup The SVG group returned by renderVariableBoxWithoutValue
   * @param fruit The Fruit object containing the value to assign (must be non-null)
   */
  setPrimitiveValueInBox(
    variableGroup: SVGGElement,
    fruit: Fruit
  ): void {
    if (!(fruit instanceof Fruit) || fruit.value === null) return;

    const box = variableGroup.querySelector('.var-box') as SVGRectElement;
    if (!box) return;

    const valueStr = fruit.type.serializeValue(fruit.value);

    const oldValueGroup = variableGroup.querySelector('.primitive-value-group');
    if (oldValueGroup) {
      oldValueGroup.remove();
    }

    const newBoxWidth = this.getBoxWidthForValue(valueStr);
    const currentBoxWidth = parseFloat(box.getAttribute('width') || '40');
    if (newBoxWidth > currentBoxWidth) {
      box.setAttribute('width', `${newBoxWidth}`);
    }

    const text = document.createElementNS(NS, 'text');
    text.textContent = valueStr;
    text.setAttribute('x', `${this.getCenteredTextX(newBoxWidth)}`);
    text.setAttribute('y', '20');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'primitive-value');

    const boxX = parseFloat(box.getAttribute('x') || '130');
    const boxY = parseFloat(box.getAttribute('y') || '60');

    const boxGroup = document.createElementNS(NS, 'g');
    boxGroup.setAttribute('class', 'primitive-value-group');
    boxGroup.setAttribute('transform', `translate(${boxX}, ${boxY})`);
    boxGroup.appendChild(text);

    variableGroup.appendChild(boxGroup);
  }

  /**
   * Adds a reference value indicator (a small black dot) inside the variable's SVG box.
   *
   * @param variableGroup The SVG group element representing the variable container.
   */
  setReferenceValueInBox(variableGroup: SVGGElement) {
    const box = variableGroup.querySelector('.var-box') as SVGRectElement;
    if (!box) return;

    const oldRef = variableGroup.querySelector('.reference-value-group');
    if (oldRef) {
      oldRef.remove();
    }

    const boxX = parseFloat(box.getAttribute('x') || '130');
    const boxY = parseFloat(box.getAttribute('y') || '60');

    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', '20');
    dot.setAttribute('cy', '20');
    dot.setAttribute('r', '4');
    dot.setAttribute('class', 'reference-dot');

    const dotGroup = document.createElementNS(NS, 'g');
    dotGroup.setAttribute('class', 'reference-value-group');
    dotGroup.setAttribute('transform', `translate(${boxX}, ${boxY})`);
    dotGroup.appendChild(dot);

    variableGroup.appendChild(dotGroup);
  }
}
