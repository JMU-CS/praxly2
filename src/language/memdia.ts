import {Type, Fruit, ArrayType, ObjectType} from './type.js';

// put pure model, non-browser stuff here
export class Memdia {
  protected memory = new Map<string, {type: Type; value: Fruit | null}>();
  protected callStack: HTMLElement[] = [];
  protected hasFunctionRun = false;


  // Declares a new variable with a given type, and updates the diagram
  declaration(identifier: string, variableType: Type): void {
    if (this.memory.has(identifier)) {
      console.warn(`[memdia] Variable '${identifier}' is already declared.`);
      return;
    }

    this.memory.set(identifier, {type: variableType, value: null});
  }


  // Assigns a value to an existing variable, and updates the diagram
  assignment(identifier: string, rightFruit: Fruit): void {
    if (!this.memory.has(identifier)) {
      console.error(`[memdia] Variable '${identifier}' is not declared.`);
      return;
    }

    const entry = this.memory.get(identifier);
    if (entry) {
      entry.value = rightFruit;
    }
  }


  isInFunction(): boolean {
    return this.callStack.length > 0;
  }
}


// override methods that add SVG to the browser here
export class MemdiaSvg extends Memdia {
  // Ensures the memory panel element exists in the DOM and returns it
  getOrCreatePanel(): HTMLElement {
    let panel = document.getElementById('memory-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'memory-panel';

      const parent = document.getElementById('memdia-panel');
      if (parent) {
        parent.appendChild(panel);
      } else {
        console.warn('Could not find memdia, appending to body as fallback');
        document.body.appendChild(panel);
      }
    }
    return panel;
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
  startFunctionBox(name: string): void {
    this.hasFunctionRun = true;

    const panel = this.getOrCreatePanel();

    const wrapper = document.createElement('div');
    wrapper.className = 'function-wrapper';

    const funcName = document.createElement('div');
    funcName.className = 'function-name';
    funcName.textContent = name;

    const funcBox = document.createElement('div');
    funcBox.className = 'function-box';

    wrapper.appendChild(funcName);
    wrapper.appendChild(funcBox);
    panel.appendChild(wrapper);

    this.callStack.push(funcBox);
  }


  // Removes the most recently added function box from the diagram
  endFunctionBox(): void {
    const exitingBox = this.callStack.pop();
    exitingBox?.parentElement?.remove()
  }


  // Declares a variable inside the current (most recent) function box
  declarationInFunction(name: string, type: Type): void {
    if (this.callStack.length === 0) {
      console.error(`[memdia] No active function box.`);
      return;
    }

    const funcBox = this.callStack[this.callStack.length - 1];
    const varBox = this.renderPrimitiveVariableBox(name, type, null);
    funcBox.appendChild(varBox);
  }


  // Assigns a value to a variable inside the current function box
  assignmentInFunction(name: string, fruit: Fruit): void {
      if (this.callStack.length === 0) {
      console.error(`[memdia] No active function box.`);
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
    console.warn(`[memdia] Variable '${name}' not found in current function box.`);
  }


  // Clears and redraws the entire memory diagram based on current global memory state
  renderMemoryDiagram(): void {
    const panel = this.getOrCreatePanel();

    if (this.memory.size > 0 && this.callStack.length === 0) {
      panel.innerHTML = '';
      const box = this.renderScopeBox('main', this.memory);
      panel.appendChild(box);
    }
  }


  // Creates a box (function-style) for a given scope and its variables
  renderScopeBox(
    scopeName: string,
    variables: Map<string, {type: Type, value: Fruit | null}>): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'function-wrapper';

    const funcName = document.createElement('div');
    funcName.className = 'function-name';
    funcName.textContent = scopeName;

    const box = document.createElement('div');
    box.className = 'function-box';

    for (const [varName, {type, value}] of variables.entries()) {
      if (
        type instanceof ArrayType ||
        type instanceof ObjectType ||
        type.toString() === 'String'
      ) {
        box.appendChild(this.renderReferenceBox(varName, type));
      } else {
        box.appendChild(this.renderPrimitiveVariableBox(varName, type, value));
      }
    }

    wrapper.appendChild(funcName);
    wrapper.appendChild(box);
    return wrapper;
  }


  // Creates a reusable box layout for a variable (name, type, box)
  // The fillBox function customizes the content inside the box
  renderBaseVariableBox(
    name: string,
    type: Type,
    fillBox: (box: HTMLElement) => void): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'memory-variable';

    const varRow = document.createElement('div');
    varRow.className = 'var-row';

    const varName = document.createElement('div');
    varName.className = 'var-name';
    varName.textContent = name;

    const varColumn = document.createElement('div');
    varColumn.className = 'var-column';

    const varType = document.createElement('div');
    varType.className = 'var-type';
    varType.textContent = type.toString();

    const varBox = document.createElement('div');
    varBox.className = 'var-box';

    fillBox(varBox);

    varColumn.appendChild(varType);
    varColumn.appendChild(varBox);

    varRow.appendChild(varName);
    varRow.appendChild(varColumn);

    wrapper.appendChild(varRow);

    return wrapper;
  }


  // Renders a variable box for a primitive value (e.g. int, bool)
  renderPrimitiveVariableBox(
    name: string,
    type: Type,
    value: Fruit | null): HTMLElement {
    return this.renderBaseVariableBox(name, type, box => {
      if (value instanceof Fruit && value.value !== null) {
        box.textContent = type.serializeValue(value.value);
      }
    });
  }


  // Renders a variable box for a reference type (e.g. string, array, object) (dot shown inside the box for now)
  renderReferenceBox(name: string, type: Type): HTMLElement {
    return this.renderBaseVariableBox(name, type, box => {
      const dot = document.createElement('div');
      dot.className = 'reference-dot';
      box.appendChild(dot);
    })
  }
}
