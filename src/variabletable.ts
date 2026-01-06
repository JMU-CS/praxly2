import { GlobalRuntime } from './language/runtime.js';
import { Type, Fruit, ArrayType, ClassType } from './language/type.js';

export class VariableTable {
  // runtime holds all variables while the program runs
  private runtime: GlobalRuntime;

  // tbody where we insert rows
  private tbody: HTMLTableSectionElement;

  // matches embed id Variable-table
  private static readonly TBODY_ID = 'Variable-table';

  constructor(runtime: GlobalRuntime, tbodyId: string = VariableTable.TBODY_ID) {
    this.runtime = runtime;

    const tbody = document.getElementById(tbodyId) as HTMLTableSectionElement | null;
    if (!tbody) {
      throw new Error(`VariableTable: missing tbody ${tbodyId}`);
    }

    this.tbody = tbody;
  }

  // rebuild the table from the runtime
  // wipe so no duplicate values
  refresh(): void {
    this.tbody.innerHTML = '';

    // only showing globals for now
    const vars = this.getFrameVariables(this.runtime);

    for (const [name, cell] of vars) {
      const type = this.getCellType(cell);
      const value = this.getCellValue(cell);

      const tr = document.createElement('tr');
      tr.appendChild(this.td(name));
      tr.appendChild(this.td(type?.toString() ?? ''));
      tr.appendChild(this.td(this.formatValue(type, value)));
      tr.appendChild(this.td('global'));

      this.tbody.appendChild(tr);
    }
  }

  private td(text: string): HTMLTableCellElement {
    const td = document.createElement('td');
    td.textContent = text;
    return td;
  }

  // runtime stores vars in variableBindings
  private getFrameVariables(frame: any): Array<[string, any]> {
    const vars = frame?.variableBindings;
    if (!vars) return [];
    return vars instanceof Map ? [...vars.entries()] : Object.entries(vars);
  }

  private getCellType(cell: any): Type | null {
    if (!cell) return null;
    if (cell instanceof Fruit) return cell.type ?? null;
    if (cell.type instanceof Type) return cell.type;
    return null;
  }

  private getCellValue(cell: any): any {
    if (!cell) return null;
    if (cell instanceof Fruit) return cell.value;
    if ('value' in cell) return cell.value;
    return null;
  }

  private formatValue(type: Type | null, value: any): string {
    if (value == null) return '';
    if (!type) return String(value);

    // refs just show ref
    if (this.isReferenceType(type)) {
      return type.toString() === 'string'
        ? type.serializeValue(value)
        : 'ref';
    }

    return type.serializeValue(value);
  }

  private isReferenceType(type: Type): boolean {
    return (
      type instanceof ArrayType ||
      type instanceof ClassType ||
      type.toString() === 'string'
    );
  }
}
