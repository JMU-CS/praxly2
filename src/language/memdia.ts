import { Type, Fruit, ArrayType, ClassType } from './type.js';
import { GlobalRuntime } from './runtime.js';

const NS = "http://www.w3.org/2000/svg";
const MD = "md__";  // id prefix

// Layout constants
const MARGIN = 20;

const VAR_RECT_HEIGHT = 40;
const VAR_MIN_WIDTH = 40;
const VAR_VERTICAL_GAP = 35;

const FUNC_INNER_PADDING = 20;
const FUNC_NAME_DISTANCE = 30;

const CHAR_WIDTH = 8;

const FUNC_MIN_HEIGHT = 90;
const FUNC_MIN_WIDTH = 100;

const REFERENCE_DOT_RADIUS = 4;

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

    const panel = document.getElementById('memdia-panel') as HTMLElement;
    panel.innerHTML = "";
    panel.appendChild(this.svg);

    this.functionCall('main');
  }

  /**
   * Renders a declaration for a new variable inside the most recent function.
   * @param identifier The variable name
   * @param variableType The declared type of the variable
   */
  override declaration(identifier: string, variableType: Type): void {
    const funcGroup = this.getCurrentFunction();

    // Skip if we're at the root SVG (no function frame)
    if (funcGroup === this.svg) {
      console.warn('Cannot declare variable without a function frame');
      return;
    }

    const varGroup = this.renderVariableWithoutValue(funcGroup, identifier, variableType);
    funcGroup.appendChild(varGroup);

    const funcRect = funcGroup.querySelector('.func-rect') as SVGRectElement;
    const funcName = funcGroup.querySelector('.func-name') as SVGTextElement;
    this.updateFunctionRect(funcGroup, funcRect, funcName);
  }

  /**
   * Renders an assignment of a value to an existing variable.
   * @param identifier The variable name
   * @param rightFruit The value being assigned
   */
  override assignment(identifier: string, rightFruit: Fruit): void {
    const funcGroup = this.getCurrentFunction();
    const variable = this.findVariable(funcGroup, identifier);

    if (!variable) return;

    if (rightFruit.value !== null) {
      if (this.isReferenceType(rightFruit.type)) {
        this.setReferenceValueInRect(variable);
      } else {
        this.setPrimitiveValueInRect(variable, rightFruit);
      }
    } else {
      this.clearVariableValue(variable);
    }

    const funcRect = funcGroup.querySelector('.func-rect') as SVGRectElement;
    const funcName = funcGroup.querySelector('.func-name') as SVGTextElement;
    this.updateFunctionRect(funcGroup, funcRect, funcName);
  }

  /**
   * Renders a complete function group and its variables.
   * @param identifier The name of the function
   */
  override functionCall(identifier: string): void {
    console.log('Creating function frame for:', identifier);
    const funcGroup = document.createElementNS(NS, 'g');
    funcGroup.setAttribute('id', `${MD}${identifier}`);
    funcGroup.setAttribute('class', 'memdia-function');

    const y = this.getNextFunctionY();
    funcGroup.setAttribute('data-y', `${y}`);

    // Add function rectangle
    const funcRect = this.createRect(
      MARGIN + FUNC_NAME_DISTANCE,
      y,
      FUNC_MIN_WIDTH,
      FUNC_MIN_HEIGHT,
      'func-rect'
    );
    funcGroup.appendChild(funcRect);

    // Add function name
    const funcName = this.createText(
      identifier,
      'func-name',
      MARGIN,
      y + FUNC_MIN_HEIGHT / 2
    );
    funcName.setAttribute('text-anchor', 'start');
    funcGroup.appendChild(funcName);

    this.svg.appendChild(funcGroup);

    this.updateFunctionRect(funcGroup, funcRect, funcName);
  }

  /**
   * Removes the most recently added function from the diagram.
   */
  override functionReturn(): void {
    const funcGroup = this.getCurrentFunction();
    if (funcGroup !== this.svg) {
      funcGroup.remove();
    }
  }

  // ========== Helper Methods ==========

  /**
   * Returns the most recent function group or the root SVG element if none exists.
   */
  private getCurrentFunction(): SVGElement {
    const functions = this.svg.querySelectorAll('.memdia-function');
    return functions.length > 0
      ? functions[functions.length - 1] as SVGElement
      : this.svg;
  }

  /**
   * Finds a variable by name within a function group.
   * @param funcGroup The function group to search within.
   * @param identifier The variable name to find.
   * @returns The variable's SVG group element, or null if not found.
   */
  private findVariable(funcGroup: SVGElement, identifier: string): SVGGElement | null {
    const vars = funcGroup.querySelectorAll('.memdia-variable');
    for (const variable of vars) {
      const nameDiv = variable.querySelector('.var-name');
      if (nameDiv?.textContent === identifier) {
        return variable as SVGGElement;
      }
    }
    return null;
  }

  /**
   * Checks if a type should be displayed as a reference (arrays, objects, strings).
   * @param type The type to check.
   * @returns True if the type is a reference type, false otherwise.
   */
  private isReferenceType(type: Type): boolean {
    return type instanceof ArrayType ||
      type instanceof ClassType ||
      type.toString() === 'string';
  }

  /**
  * Removes any displayed value (text or reference dot) from a variable.
  * @param variableGroup The variable's SVG group element.
  */
  private clearVariableValue(variableGroup: SVGGElement): void {
    const existingText = variableGroup.querySelector('.var-value');
    if (existingText) existingText.remove();

    const existingDot = variableGroup.querySelector('.reference-value-group');
    if (existingDot) existingDot.remove();
  }

  /**
   * Calculates the Y position for the next function to be rendered.
   * @returns The Y coordinate where the next function should be placed.
   */
  private getNextFunctionY(): number {
    const prevFunctions = this.svg.querySelectorAll('.memdia-function');

    if (prevFunctions.length === 0) return MARGIN;

    const prev = prevFunctions[prevFunctions.length - 1] as SVGElement;
    const prevRect = prev.querySelector('.func-rect') as SVGRectElement;

    if (prevRect) {
      const prevY = parseFloat(prev.getAttribute('data-y') || '0');
      const prevHeight = parseFloat(prevRect.getAttribute('height') || '0');
      return prevY + prevHeight + MARGIN;
    }

    return MARGIN;
  }

  /**
   * Calculates the Y position for the next variable within a function.
   * @param funcGroup The function group containing the variables.
   * @param funcRect The function's rectangle element.
   * @returns The Y coordinate where the next variable should be placed.
   */
  private getNextVariableY(funcGroup: SVGElement, funcRect: SVGRectElement): number {
    const allVars = funcGroup.querySelectorAll('.memdia-variable');
    const funcY = parseFloat(funcRect?.getAttribute('y') || '0');

    if (allVars.length === 0) {
      return funcY + FUNC_INNER_PADDING + (MARGIN / 2);
    }

    const prevVar = allVars[allVars.length - 1] as SVGGElement;
    const prevRect = prevVar.querySelector('.var-rect') as SVGRectElement;

    const prevY = parseFloat(prevRect.getAttribute('y') || '0');
    const prevH = parseFloat(prevRect.getAttribute('height') || `${VAR_RECT_HEIGHT}`);

    return prevY + prevH + VAR_VERTICAL_GAP;
  }

  /**
   * Extracts the position and dimensions from an SVG rectangle element.
   * @param rect The rectangle element to extract bounds from.
   * @returns An object containing x, y, width, and height values.
   */
  private getRectBounds(rect: SVGRectElement) {
    return {
      x: parseFloat(rect.getAttribute('x') || '0'),
      y: parseFloat(rect.getAttribute('y') || '0'),
      width: parseFloat(rect.getAttribute('width') || `${VAR_RECT_HEIGHT}`),
      height: parseFloat(rect.getAttribute('height') || `${VAR_RECT_HEIGHT}`),
    };
  }

  /**
   * Calculate function rectangle height based on the number of variables.
   */
  private getFunctionRectHeight(funcGroup: SVGElement): number {
    const funcRect = funcGroup.querySelector('.func-rect') as SVGRectElement;
    const vars = funcGroup.querySelectorAll('.memdia-variable');

    if (vars.length === 0) return FUNC_MIN_HEIGHT;

    const funcY = parseFloat(funcRect?.getAttribute('y') || '0');
    let bottomMost = funcY;

    vars.forEach(v => {
      const rect = v.querySelector('.var-rect') as SVGRectElement;
      if (rect) {
        const rectBottom = parseFloat(rect.getAttribute('y') || '0') +
                           parseFloat(rect.getAttribute('height') || `${VAR_RECT_HEIGHT}`);
        bottomMost = Math.max(bottomMost, rectBottom);
      }
    });

    // Calculate height: from top of function to bottom of last variable, plus bottom padding
    const height = (bottomMost - funcY) + FUNC_INNER_PADDING;
    return Math.max(FUNC_MIN_HEIGHT, height);
  }

  /**
   * Calculate function rectangle width based on the actual content of variables and values.
   * Adds uniform padding on left and right.
   */
  private getFunctionRectWidth(funcGroup: SVGElement): number {
    const funcRect = funcGroup.querySelector('.func-rect') as SVGRectElement;
    if (!funcRect) return FUNC_MIN_WIDTH;

    const funcX = parseFloat(funcRect.getAttribute('x') || '0');

    let maxRight = funcX;

    // Measure how far each variable extends to the right
    const vars = funcGroup.querySelectorAll('.memdia-variable');
    vars.forEach(v => {
      const rect = v.querySelector('.var-rect') as SVGRectElement;
      const valueText = v.querySelector('.var-value') as SVGTextElement;

      if (rect) {
        const rectX = parseFloat(rect.getAttribute('x') ?? '0');
        const rectW = parseFloat(rect.getAttribute('width') ?? VAR_RECT_HEIGHT.toString());
        let right = rectX + rectW;

        if (valueText && valueText.textContent) {
          const valueWidth = valueText.textContent.length * CHAR_WIDTH;
          right = Math.max(right, rectX + valueWidth + 10);
        }

        maxRight = Math.max(maxRight, right);
      }
    });

    // Minimal width for function name
    const funcName = funcGroup.querySelector('.func-name') as SVGTextElement;
    if (funcName && funcName.textContent) {
      const nameWidth = funcName.textContent.length * CHAR_WIDTH;
      const nameRight = MARGIN + nameWidth;
      maxRight = Math.max(maxRight, nameRight);
    }

    const calculatedWidth = (maxRight - funcX) + FUNC_INNER_PADDING;
    return Math.max(FUNC_MIN_WIDTH, calculatedWidth);
  }

  /**
   * Calculate the width of a variable rectangle based on the value length.
   */
  private getRectWidthForValue(valueStr: string): number {
    const padding = FUNC_INNER_PADDING;
    return Math.max(VAR_MIN_WIDTH, valueStr.length * CHAR_WIDTH + padding);
  }

  /**
   * Updates the function rectangle to fit its content and re-centers the name.
   * Should be called whenever variables are added, removed, or values change.
   */
  private updateFunctionRect(funcGroup: SVGElement, funcRect: SVGRectElement, funcName: SVGTextElement): void {
    const width = this.getFunctionRectWidth(funcGroup);
    const height = this.getFunctionRectHeight(funcGroup);

    funcRect.setAttribute('width', `${width}`);
    funcRect.setAttribute('height', `${height}`);

    const rectY = parseFloat(funcRect.getAttribute('y') || '0');
    funcName.setAttribute('y', `${rectY + height / 2}`);
    funcName.setAttribute('dominant-baseline', 'middle');
  }

  // ========== SVG Creation Helpers ==========

  /**
   * Creates an SVG text element with the specified attributes.
   * @param content The text content to display.
   * @param className The CSS class for styling.
   * @param x The x-coordinate position.
   * @param y The y-coordinate position.
   * @returns A new SVG text element.
   */
  private createText(content: string, className: string, x: number, y: number): SVGTextElement {
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('class', className);
    text.textContent = content;
    text.setAttribute('x', `${x}`);
    text.setAttribute('y', `${y}`);
    return text;
  }

  /**
   * Creates an SVG rectangle element with the specified attributes.
   * @param x The x-coordinate position.
   * @param y The y-coordinate position.
   * @param width The width of the rectangle.
   * @param height The height of the rectangle.
   * @param className The CSS class for styling.
   * @returns A new SVG rectangle element.
   */
  private createRect(x: number, y: number, width: number, height: number, className: string): SVGRectElement {
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('class', className);
    rect.setAttribute('x', `${x}`);
    rect.setAttribute('y', `${y}`);
    rect.setAttribute('width', `${width}`);
    rect.setAttribute('height', `${height}`);
    return rect;
  }

  // ========== Variable Rendering ==========

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
  private renderVariableWithoutValue(funcGroup: SVGElement, name: string, type: Type): SVGGElement {
    const varGroup = document.createElementNS(NS, 'g');
    varGroup.setAttribute('id', `${funcGroup.getAttribute('id')}.${name}`);
    varGroup.setAttribute('class', 'memdia-variable');

    const funcRect = funcGroup.querySelector('.func-rect') as SVGRectElement;
    const funcX = parseFloat(funcRect.getAttribute('x') || '0');

    const rectY = this.getNextVariableY(funcGroup, funcRect);

    const nameWidth = name.length * CHAR_WIDTH + 5;

    // Rectangle starts after the name + gap
    const rectX = funcX + FUNC_INNER_PADDING + nameWidth + 5;

    // Add variable rectangle
    const rect = this.createRect(
      rectX,
      rectY,
      VAR_RECT_HEIGHT,
      VAR_RECT_HEIGHT,
      'var-rect'
    );
    varGroup.appendChild(rect);

    // Add type label
    const varType = this.createText(
      type.toString(),
      'var-type',
      rectX,
      rectY - MARGIN / 2
    );
    varGroup.appendChild(varType);

    // Add variable name
    const varName = this.createText(
      name,
      'var-name',
      rectX - 10,
      rectY + VAR_RECT_HEIGHT / 2
    );
    varName.setAttribute('text-anchor', 'end');
    varName.setAttribute('dominant-baseline', 'middle');
    varGroup.appendChild(varName);

    return varGroup;
  }

  /**
   * Adds a primitive value (e.g., number, boolean) to a previously rendered variable group.
   * The value is displayed inside the rectangle using the type's serialization method.
   *
   * @param variableGroup The SVG group returned by renderVariableWithoutValue
   * @param fruit The Fruit object containing the value to assign (must be non-null)
   */
  private setPrimitiveValueInRect(variableGroup: SVGGElement, fruit: Fruit): void {
    if (!(fruit instanceof Fruit) || fruit.value === null) return;

    const varRect = variableGroup.querySelector('.var-rect') as SVGRectElement;
    if (!varRect) return;

    const valueStr = fruit.type.serializeValue(fruit.value);
    const existingValue = variableGroup.querySelector('.var-value');
    if (existingValue) existingValue.remove();

    const newWidth = this.getRectWidthForValue(valueStr);
    varRect.setAttribute('width', `${newWidth}`);

    const bounds = this.getRectBounds(varRect);

    const text = this.createText(
      valueStr,
      'var-value',
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2 + 2
    );
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');

    variableGroup.appendChild(text);
  }

  /**
   * Adds a reference value indicator (a small black dot) inside the variable's rectangle.
   *
   * @param variableGroup The SVG group element representing the variable container.
   */
  private setReferenceValueInRect(variableGroup: SVGGElement): void {
    const varRect = variableGroup.querySelector('.var-rect') as SVGRectElement;
    if (!varRect) return;

    const oldRef = variableGroup.querySelector('.reference-value-group');
    oldRef?.remove();

    const bounds = this.getRectBounds(varRect);

    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', `${bounds.width / 2}`);
    dot.setAttribute('cy', `${bounds.height / 2}`);
    dot.setAttribute('r', `${REFERENCE_DOT_RADIUS}`);
    dot.setAttribute('class', 'reference-dot');

    const dotGroup = document.createElementNS(NS, 'g');
    dotGroup.setAttribute('class', 'reference-value-group');
    dotGroup.setAttribute('transform', `translate(${bounds.x}, ${bounds.y})`);
    dotGroup.appendChild(dot);

    variableGroup.appendChild(dotGroup);
  }
}
