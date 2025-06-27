import {Type, Fruit, ArrayType, ObjectType} from './type.js';

class Memdia {
  // put pure model, non-browser stuff here
}

class MemdiaSvg {
  // override methods that add SVG to the browser here
}

const memory = new Map<string, {type: Type; value: Fruit | null}>();
export const callStack: HTMLElement[] = [];
let hasFunctionRun = false;

// Ensures the memory panel element exists in the DOM and returns it
function getOrCreatePanel(): HTMLElement {
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

export function isInFunction(): boolean {
  return callStack.length > 0;
}

// ==== GLOBAL MEMORY ====

// Declares a new variable with a given type, and updates the diagram
export function declaration(identifier: string, variableType: Type): void {
  if (memory.has(identifier)) {
    console.warn(`[memdia] Variable '${identifier}' is already declared.`);
    return;
  }

  memory.set(identifier, {type: variableType, value: null});
  renderMemoryDiagram();
}


// Assigns a value to an existing variable, and updates the diagram
export function assignment(identifier: string, rightFruit: Fruit): void {
  if (!memory.has(identifier)) {
    console.error(`[memdia] Variable '${identifier}' is not declared.`);
    return;
  }

  const entry = memory.get(identifier);
  if (entry) {
    entry.value = rightFruit;
    renderMemoryDiagram();
  }
}

//==== FUNCTION BOX HANDLING ====

// Creates and displays a new function box with the given name
export function startFunctionBox(name: string): void {
  hasFunctionRun = true;

  const panel = getOrCreatePanel();

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

  callStack.push(funcBox);
}


// Removes the most recently added function box from the diagram
export function endFunctionBox(): void {
  const exitingBox = callStack.pop();
  exitingBox?.parentElement?.remove()
}


// Declares a variable inside the current (most recent) function box
export function declarationInFunction(name: string, type: Type): void {
  if (callStack.length === 0) {
    console.error(`[memdia] No active function box.`);
    return;
  }

  const funcBox = callStack[callStack.length - 1];
  const varBox = renderPrimitiveVariableBox(name, type, null);
  funcBox.appendChild(varBox);
}


// Assigns a value to a variable inside the current function box
export function assignmentInFunction(name: string, fruit: Fruit): void {
    if (callStack.length === 0) {
    console.error(`[memdia] No active function box.`);
    return;
  }

  const funcBox = callStack[callStack.length - 1];
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


//==== MEMORY DIAGRAM RENDERING ====

// Clears and redraws the entire memory diagram based on current global memory state
function renderMemoryDiagram(): void {
  const panel = getOrCreatePanel();

  if (memory.size > 0 && callStack.length === 0) {
    panel.innerHTML = '';
    const box = renderScopeBox('main', memory);
    panel.appendChild(box);
  }
}

// Creates a box (function-style) for a given scope and its variables
function renderScopeBox(
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
        box.appendChild(renderReferenceBox(varName, type));
      } else {
        box.appendChild(renderPrimitiveVariableBox(varName, type, value));
      }
    }

    wrapper.appendChild(funcName);
    wrapper.appendChild(box);
    return wrapper;
  }


// Creates a reusable box layout for a variable (name, type, box)
// The fillBox function customizes the content inside the box
function renderBaseVariableBox(
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
function renderPrimitiveVariableBox(
  name: string,
  type: Type,
  value: Fruit | null): HTMLElement {
    return renderBaseVariableBox(name, type, box => {
      if (value instanceof Fruit && value.value !== null) {
        box.textContent = type.serializeValue(value.value);
    }
  });
}


// Renders a variable box for a reference type (e.g. string, array, object) (dot shown inside the box for now)
function renderReferenceBox(name: string, type: Type): HTMLElement {
  return renderBaseVariableBox(name, type, box => {
    const dot = document.createElement('div');
    dot.className = 'reference-dot';
    box.appendChild(dot);
  })
}
