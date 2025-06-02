interface RowColumn {
  column: number;
  row: number;
}

export class Where {
  start: number;
  end: number;

  constructor(start: number, end: number) {
    this.start = start;
    this.end = end;
  }

  toRowColumn(_source: string): RowColumn {
    return {
      column: 0,
      row: 0,
    }
  }

  text(source: string): string {
    return source.substring(this.start, this.end);
  }

  static enclose(a: Where, b: Where) {
    return new Where(a.start, b.end);
  }

  static Nowhere = new Where(-1, -1);
}
