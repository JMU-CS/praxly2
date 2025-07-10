import { Type, Fruit, ArrayType, ObjectType } from './type.js';
import { GlobalRuntime } from './evaluator.js';

const NS = "http://www.w3.org/2000/svg";

/**
 * Superclass that doesn't draw anything; used during unit testing.
 */
export class Memdia {
  protected runtime: GlobalRuntime;

  constructor(runtime: GlobalRuntime) {
    this.runtime = runtime;
  }

  // Declares a new variable with a given type, and updates the diagram
  declaration(_identifier: string, _variableType: Type): void { }

  // Assigns a value to an existing variable, and updates the diagram
  assignment(_identifier: string, _rightFruit: Fruit): void { }

  functionCall(_name: string): void { }
  functionReturn(): void { }
}

/**
 * Subclass that actually draws the SVG elements in the browser.
 */
export class MemdiaSvg extends Memdia {
  protected svg: SVGSVGElement;

  constructor(runtime: GlobalRuntime) {
    super(runtime);

    // create the top-level svg element
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.setAttribute('viewBox', '0 0 300 300');
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // add the svg to the memdia div
    let panel = document.getElementById('memdia-panel') as HTMLElement;
    panel.innerHTML = "";
    panel.appendChild(this.svg);
  }

  // Declares a variable inside the current (most recent) function box
  override declaration(identifier: string, variableType: Type): void {
    const funcBox = this.getCurrentFunction();
    const varBox = this.renderPrimitiveVariableBox(identifier, variableType, null);
    funcBox.appendChild(varBox);
  }

  // Assigns a value to a variable inside the current function box
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
    //console.warn(`[memdia] Variable '${name}' not found in current function box.`);
  }

  // Creates and displays a new function box with the given name
  override functionCall(name: string): void {

    const group = document.createElementNS(NS, 'g');
    group.setAttribute('class', 'memdia-function');
    this.svg.appendChild(group);

    const funcName = document.createElementNS(NS, 'text');
    funcName.setAttribute("class", "function-name");
    funcName.textContent = name;
    funcName.setAttribute('x', '10');
    funcName.setAttribute('y', '20');
    group.appendChild(funcName);

    const funcBox = document.createElementNS(NS, 'rect');
    funcBox.setAttribute("class", "function-box");
    funcBox.setAttribute('x', '10');
    funcBox.setAttribute('y', '30');
    funcBox.setAttribute('width', '200');
    funcBox.setAttribute('height', '100');
    group.appendChild(funcBox);
  }

  // Removes the most recently added function box from the diagram
  override functionReturn(): void {
    const exitingBox = this.getCurrentFunction();
    if (exitingBox != this.svg) {
      exitingBox?.parentElement?.remove();
    }
  }

  getCurrentFunction(): SVGElement {
    // TODO need find the "last" function rectangle
    // if there are no functions, return this.svg
    return this.svg;
  }

  /*
    // Clears and redraws the entire memory diagram based on current global memory state
    renderMemoryDiagram(): void {
      const panel = this.getOrCreatePanel();

      const centerGroup = document.createElementNS(NS, 'g');
      centerGroup.setAttribute('transform', 'translate(50, 50)');

      const scopeBox = this.renderScopeBox("main", this.memory);
      centerGroup.appendChild(scopeBox);
      panel.appendChild(centerGroup);

      if (this.memory.size > 0 && this.callStack.length === 0) {
        panel.innerHTML = '';
        const box = this.renderScopeBox('main', this.memory);
        panel.appendChild(box);
      }
    }
  */

  // Creates a box (function-style) for a given scope and its variables
  renderScopeBox(
    scopeName: string,
    variables: Map<string, { type: Type, value: Fruit | null }>): SVGElement {
    const group = document.createElementNS(NS, 'g');

    const funcName = document.createElementNS(NS, 'text');
    funcName.setAttribute('class', 'function-name');
    funcName.textContent = scopeName;
    funcName.setAttribute('x', '75');
    funcName.setAttribute('y', '80');
    group.appendChild(funcName);

    const funcBox = document.createElementNS(NS, 'rect');
    funcBox.setAttribute('class', 'function-box');
    funcBox.setAttribute('x', '100');
    funcBox.setAttribute('y', '30');
    funcBox.setAttribute('width', '100');
    funcBox.setAttribute('height', '100');
    group.appendChild(funcBox);

    for (const [varName, { type, value }] of variables.entries()) {
      let varGroup: SVGElement;
      if (
        type instanceof ArrayType ||
        type instanceof ObjectType ||
        type.toString() === 'String'
      ) {
        varGroup = this.renderReferenceBox(varName, type);
      } else {
        varGroup = this.renderPrimitiveVariableBox(varName, type, value);
      }

      group.appendChild(varGroup);
    }

    return group;
  }

  // Creates a reusable box layout for a variable (name, type, box)
  // The fillBox function customizes the content inside the box
  renderBaseVariableBox(
    name: string,
    type: Type,
    fillBox: (boxGroup: SVGGElement) => void): SVGGElement {
    const group = document.createElementNS(NS, 'g');
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
    fillBox(boxGroup);
    group.appendChild(boxGroup)

    return group;
  }

  // Renders a variable box for a primitive value (e.g. int, bool)
  renderPrimitiveVariableBox(
    name: string,
    type: Type,
    value: Fruit | null): SVGGElement {
    return this.renderBaseVariableBox(name, type, boxGroup => {
      if (value instanceof Fruit && value.value !== null) {
        const text = document.createElementNS(NS, 'text');
        text.textContent = type.serializeValue(value.value);
        text.setAttribute('x', '20');
        text.setAttribute('y', '20');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', 'primitive-value');
        boxGroup.appendChild(text);
      }
    });
  }

  // Renders a variable box for a reference type (e.g. string, array, object) (dot shown inside the box for now)
  renderReferenceBox(name: string, type: Type): SVGGElement {
    return this.renderBaseVariableBox(name, type, boxGroup => {
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', '20');
      dot.setAttribute('cy', '20');
      dot.setAttribute('r', '4');
      dot.setAttribute('fill', 'black');
      boxGroup.appendChild(dot);
    })
  }
}
