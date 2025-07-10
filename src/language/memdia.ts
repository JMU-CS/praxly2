import {Type, Fruit, ArrayType, ObjectType} from './type.js';

const NS = "http://www.w3.org/2000/svg";

// put pure model, non-browser stuff here
export class Memdia {
  protected memory = new Map<string, {type: Type; value: Fruit | null}>();
  protected callStack: SVGElement[] = [];
  //protected hasFunctionRun = false;

  // Declares a new variable with a given type, and updates the diagram
  declaration(identifier: string, variableType: Type): void {
    if (this.memory.has(identifier)) return;

    this.memory.set(identifier, {type: variableType, value: null});
  }

  // Assigns a value to an existing variable, and updates the diagram
  assignment(identifier: string, rightFruit: Fruit): void {
    if (!this.memory.has(identifier)) return;

    const entry = this.memory.get(identifier);
    if (entry) {
      entry.value = rightFruit;
    }
  }

  isInFunction(): boolean {
    return this.callStack.length > 0;
  }

  startFunctionBox(_name: string): void {}
  endFunctionBox(): void {}

  declarationInFunction(_name: string, _type: Type): void {}
  assignmentInFunction(_name: string, _fruit: Fruit): void {}
}

// override methods that add SVG to the browser here
export class MemdiaSvg extends Memdia {

  // Ensures the memory panel element exists in the DOM and returns it
  getOrCreatePanel(): SVGSVGElement {
    let svgPanel = document.getElementById('memory-panel') as SVGSVGElement | null;

    if (!svgPanel) {
      svgPanel = document.createElementNS(NS, 'svg');
      svgPanel.id = 'memory-panel';

      svgPanel.setAttribute('width', '100%');
      svgPanel.setAttribute('height', '100%');

      svgPanel.setAttribute('viewBox', '0 0 300 300');
      svgPanel.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      const parent = document.getElementById('memdia-panel');
      if (parent) {
        parent.appendChild(svgPanel);
      } else {
        //console.warn('Could not find memdia, appending to body as fallback');
        document.body.appendChild(svgPanel);
      }
    }
    return svgPanel;
  }


  override declaration(identifier: string, variableType: Type): void {
    super.declaration(identifier, variableType);
    this.renderMemoryDiagram();
  }


  override assignment(identifier: string, rightFruit: Fruit): void {
    super.assignment(identifier, rightFruit);
    this.renderMemoryDiagram();
  }


  // Creates and displays a new function box with the given name
  override startFunctionBox(name: string): void {
    //this.hasFunctionRun = true;

    const panel = this.getOrCreatePanel();

    const group = document.createElementNS(NS, 'g');
    panel.appendChild(group);

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

    this.callStack.push(group);
  }


  // Removes the most recently added function box from the diagram
  override endFunctionBox(): void {
    const exitingBox = this.callStack.pop();
    exitingBox?.parentElement?.remove()
  }


  // Declares a variable inside the current (most recent) function box
  override declarationInFunction(name: string, type: Type): void {
    if (this.callStack.length === 0) {
      //console.error(`[memdia] No active function box.`);
      return;
    }

    const funcBox = this.callStack[this.callStack.length - 1];
    const varBox = this.renderPrimitiveVariableBox(name, type, null);
    funcBox.appendChild(varBox);
  }


  // Assigns a value to a variable inside the current function box
  override assignmentInFunction(name: string, fruit: Fruit): void {
      if (this.callStack.length === 0) {
      //console.error(`[memdia] No active function box.`);
      return;
    }

    const funcBox = this.callStack[this.callStack.length - 1];
    const vars = funcBox.querySelectorAll('.memory-variable');
    for (const variable of vars) {
      const nameDiv = variable.querySelector('.var-name');
      const boxDiv = variable.querySelector('.var-box');
      if (nameDiv?.textContent === name && boxDiv) {
        boxDiv.textContent = fruit.value !== null
          ? fruit.type.serializeValue(fruit.value)
          : '';
        return;
      }
    }
    //console.warn(`[memdia] Variable '${name}' not found in current function box.`);
  }


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


  // Creates a box (function-style) for a given scope and its variables
  renderScopeBox(
    scopeName: string,
    variables: Map<string, {type: Type, value: Fruit | null}>): SVGElement {
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


    for (const [varName, {type, value}] of variables.entries()) {
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
    group.setAttribute('class', 'memory-variable');

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
