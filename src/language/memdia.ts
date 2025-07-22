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

  /**
   * Constructs a new MemdiaSvg instance and initializes the SVG panel.
   * @param runtime The runtime environment storing memory state.
   */
  constructor(runtime: GlobalRuntime) {
    super(runtime);

    // create the top-level SVG element
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.setAttribute('viewBox', '0 0 300 300');
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Clear and attach the SVG to the memdia container in the DOM.
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
    const funcBox = this.getCurrentFunction();
    const varBox = this.renderPrimitiveVariableBox(identifier, identifier, variableType, null);
    funcBox.appendChild(varBox);
  }

  /**
   * Renders an assignment of a value to an existing variable.
   * @param identifier The variable name
   * @param rightFruit The value being assigned
   */
  override assignment(identifier: string, rightFruit: Fruit): void {
    const funcBox = this.getCurrentFunction();
    const vars = funcBox.querySelectorAll('.memdia-variable');
    for (const variable of vars) {
      const nameDiv = variable.querySelector('.var-name');
      const boxDiv = variable.querySelector('.var-box');
      if (nameDiv?.textContent === identifier && boxDiv) {
        boxDiv.textContent = rightFruit.value !== null
          ? rightFruit.type.serializeValue(rightFruit.value)
          : '';
        return;
      }
    }
  }

  getVariableYPosition(index: number): number {
    return 60 + index * 40;
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
   * @param variables Map of variable names to their types and values
   * @returns The SVG group element representing the full scope
   */
  override functionCall(
    scopeName: string
  ): SVGElement {
    let variables: Map<string, { type: Type, value: Fruit | null }> = new Map();
    const group = document.createElementNS(NS, 'g');
    group.setAttribute('class', 'memdia-function');

    // Find max variable name length for width calculation
    let maxNameLength = scopeName.length;
    for (const varName of variables.keys()) {
      if (varName.length > maxNameLength) maxNameLength = varName.length;
    }

    // Calculate dynamic dimensions
    const varCount = variables.size;
    const height = this.getFunctionBoxHeight(varCount);
    const width = this.getFunctionBoxWidth(maxNameLength);

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
    funcBox.setAttribute('height', `${height}`);
    group.appendChild(funcBox);

    // Add variables dynamically positioned inside the function box
    let index = 0;
    for (const [varName, { type, value }] of variables.entries()) {
      let varGroup: SVGElement;
      if (
        type instanceof ArrayType ||
        type instanceof ObjectType ||
        type.toString() === 'String'
      ) {
        // varGroup = this.renderReferenceBox(scopeName, varName, type);
        // Placeholder until renderReferenceBox is implemented
        varGroup = document.createElementNS(NS, 'g');
      } else {
        varGroup = this.renderPrimitiveVariableBox(scopeName + '.' + varName, varName, type, value);
      }

      // Position variable group vertically inside the function box
      varGroup.setAttribute('transform', `translate(20, ${this.getVariableYPosition(index)})`);
      group.appendChild(varGroup);
      index++;
    }

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
   * Renders a variable box with name, type, and (if primitive) its value.
   * Suitable for primitives (int, bool, etc). Reference variables should be handled separately.
   *
   * @param id Unique ID for the SVG group
   * @param name Variable name
   * @param type Variable type
   * @param fruit Value to display (assumes primitive)
   * @returns SVG group representing the variable
   */
  renderPrimitiveVariableBox(
    id: string,
    name: string,
    type: Type,
    fruit: Fruit | null
  ): SVGGElement {
    const group = document.createElementNS(NS, 'g');
    group.setAttribute('id', id);
    group.setAttribute('class', 'memdia-variable');

    const nameX = 115;
    const nameY = 84;
    const boxX = 130;
    const boxY = 60;

    const varName = document.createElementNS(NS, 'text');
    varName.textContent = name;
    varName.setAttribute('class', 'var-name');
    varName.setAttribute('x', `${nameX}`);
    varName.setAttribute('y', `${nameY}`);
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

    const boxGroup = document.createElementNS(NS, 'g');
    boxGroup.setAttribute('transform', `translate(${boxX}, ${boxY})`);

    if (fruit instanceof Fruit && fruit.value !== null) {
      const text = document.createElementNS(NS, 'text');
      text.textContent = type.serializeValue(fruit.value);
      text.setAttribute('x', `${boxX+20}`);
      text.setAttribute('y', `${boxY+20}`);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('class', 'primitive-value');
      boxGroup.appendChild(text);
    }

    group.appendChild(boxGroup)
    return group;
  }

  /*
    // Renders a variable box for a reference type (e.g., arrays, objects, strings).
    // Currently displays a black dot to indicate a reference.
    renderReferenceBox(scopeName: string, name: string, type: Type): SVGGElement {
      const id = `${scopeName}.${name}`;
      return this.renderPrimitiveVariableBox(id, name, type, boxGroup => {
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', '20');
        dot.setAttribute('cy', '20');
        dot.setAttribute('r', '4');
        dot.setAttribute('fill', 'black');
        boxGroup.appendChild(dot);
      })
    }
  */
}
