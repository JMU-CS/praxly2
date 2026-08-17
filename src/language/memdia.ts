import type { TargetLanguage } from './visitor';

// One variable binding shown as a row in a diagram frame: name, current value, and its type label.
interface MemdiaSlot {
  name: string;
  value: unknown;
  typeLabel: string;
}

// One call frame/scope in the diagram: a name (function name, or 'main') and its slots.
interface MemdiaFrame {
  name: string;
  slots: MemdiaSlot[];
}

// Guesses a human-readable type label for a raw JS value, for slots that don't specify one explicitly.
function inferTypeLabel(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'double';
  return typeof value;
}

// Represents one memory diagram for one open panel. Create a separate instance per language/panel —
// all state (frames) lives on the instance, so multiple Memdia objects never share data.
export class Memdia {
  private language: TargetLanguage;
  // Stack of frames; starts with one 'main' frame so declarations have somewhere to go before any function call.
  private frames: MemdiaFrame[] = [{ name: 'main', slots: [] }];

  // Remembers which source language this diagram is built from.
  constructor(language: TargetLanguage) {
    this.language = language;
  }

  // Reports which source language this diagram was built from.
  getLanguage(): TargetLanguage {
    return this.language;
  }

  // Returns the frame currently on top of the stack (the active scope).
  private currentFrame(): MemdiaFrame {
    return this.frames[this.frames.length - 1];
  }

  // Writes a value into the current frame: updates the slot if the name already exists, else adds a new slot.
  private assignToCurrentFrame(name: string, value: unknown, typeLabel: string): void {
    const frame = this.currentFrame();
    const slot = frame.slots.find((s) => s.name === name);
    if (slot) {
      slot.value = value;
      slot.typeLabel = typeLabel;
    } else {
      frame.slots.push({ name, value, typeLabel });
    }
  }

  // Records a new variable in the current frame.
  declaration(name: string, value: unknown, typeLabel?: string): this {
    this.assignToCurrentFrame(name, value, typeLabel ?? inferTypeLabel(value));
    return this;
  }

  // Updates an existing variable's value in the current frame.
  assignment(name: string, value: unknown, typeLabel?: string): this {
    this.assignToCurrentFrame(name, value, typeLabel ?? inferTypeLabel(value));
    return this;
  }

  // Pushes a new frame for a function call, pre-filled with its parameters.
  functionCall(
    name: string,
    params: Array<{ name: string; value: unknown; typeLabel?: string }> = []
  ): this {
    this.frames.push({
      name,
      slots: params.map((param) => ({
        name: param.name,
        value: param.value,
        typeLabel: param.typeLabel ?? inferTypeLabel(param.value),
      })),
    });
    return this;
  }

  // Pops the current function's frame (if any) and records its return value in the caller's frame.
  functionReturn(name: string, value: unknown): this {
    if (this.frames.length > 1) this.frames.pop();
    this.assignToCurrentFrame(name ? `return ${name}` : 'return', value, inferTypeLabel(value));
    return this;
  }

  // Renders the current diagram state as a self-contained SVG string.
  toSvg(): string {
    const heap = new Map<string, HeapEntry>();
    const renderFrames: FrameState[] = this.frames.map((frame) => ({
      name: frame.name,
      slots: frame.slots.slice(0, MAX_STACK_SLOTS).map((slot) => ({
        name: slot.name,
        value: previewValue(slot.value, heap),
        typeLabel: slot.typeLabel,
      })),
    }));
    return renderMemorySnapshotSvg(renderFrames, heap);
  }
}

// ─── SVG rendering ──────────────────────────────────────────────────────────
// Layout constants and geometry below are ported from an earlier version of this
// file that rendered full diagrams (stack + heap + static fields + reference
// arrows). Only the stack-frame subset is wired up here; names/values are kept
// matching the original so heap/reference rendering can be reintroduced later
// as additions rather than a rewrite.

const MARGIN = 20;
const VAR_RECT_HEIGHT = 40;
const VAR_MIN_WIDTH = 38;
const VAR_VERTICAL_GAP = 35;

const FUNC_INNER_PADDING = 20;
const FUNC_NAME_DISTANCE = 30;
const FRAME_SLOT_TOP_PADDING = 12;

const NAME_CHAR_WIDTH = 6.5; // name labels use a proportional font; tighter than value text width
const NAME_BOX_GAP = 8;

const FUNC_MIN_HEIGHT = 80;
const FUNC_MIN_WIDTH = 60;

const MIN_CANVAS_HEIGHT = 180;
const MAX_STACK_SLOTS = 8;

const HEADER_HEIGHT = 28; // space reserved at top for the STACK/HEAP/DATA labels

const HEAP_COLUMN_MIN_WIDTH = 100; // reserved width for an empty HEAP or DATA column
const HEAP_LEFT_MARGIN = 40; // gap between adjacent columns (stack↔heap and heap↔data)

// Fixed distance from a divider to its neighboring column's title, on either side —
// matches STACK's original gap for an empty frame. Fixed rather than tracking a
// box's actual width for now; making a title stay centered as its own box grows is
// a later step.
const COLUMN_TITLE_GAP = FUNC_MIN_WIDTH / 2 + HEAP_LEFT_MARGIN / 2;

const MAX_HEAP_FIELDS = 6; // cap on array cells shown before a "+N" summary cell
const HEAP_VERTICAL_GAP = 10; // vertical gap between stacked heap entries
const HEAP_ARROW_COLOR = '#ffffff';
const REFERENCE_DOT_RADIUS = 3;

// Render-ready shapes: distinct from MemdiaFrame/MemdiaSlot above, which hold raw
// interpreter values. toSvg() converts MemdiaFrame[] into FrameState[] with each
// slot's value already formatted as SVG-ready display text.
interface SlotValue {
  kind: 'primitive' | 'reference';
  text: string;
  refId?: string;
}

interface StackSlot {
  name: string;
  value: SlotValue;
  typeLabel?: string;
}

interface FrameState {
  name: string;
  slots: StackSlot[];
}

interface HeapField {
  key: string;
  value: SlotValue;
}

interface HeapEntry {
  id: string;
  label: string;
  fields: HeapField[];
}

const objectIds = new WeakMap<object, string>();
let nextObjectId = 1;

// Stable id per array object so the same array (e.g. aliased by two variables)
// always maps to one heap entry.
function idFor(obj: object): string {
  const existing = objectIds.get(obj);
  if (existing) return existing;
  const id = `o${nextObjectId++}`;
  objectIds.set(obj, id);
  return id;
}

// Escapes text for safe embedding inside SVG markup.
function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

// Renders a primitive value the way a memory diagram shows it (quoted strings, literal null/undefined).
function formatPrimitive(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

function inferArrayLabel(value: unknown[]): string {
  const first = value[0];
  const elemType =
    typeof first === 'number'
      ? Number.isInteger(first)
        ? 'int'
        : 'double'
      : typeof first === 'boolean'
        ? 'boolean'
        : typeof first === 'string'
          ? 'String'
          : 'Object';
  return `${elemType}[]`;
}

// Nested arrays/objects inside a cell aren't linked out to their own heap entry yet —
// shown as a placeholder rather than crashing or misrendering.
function previewCellValue(el: unknown): SlotValue {
  if (Array.isArray(el) || (el !== null && typeof el === 'object')) {
    return { kind: 'primitive', text: '[…]' };
  }
  return { kind: 'primitive', text: formatPrimitive(el) };
}

function buildArrayHeapEntry(value: unknown[]): HeapEntry {
  const limit = Math.min(value.length, MAX_HEAP_FIELDS);
  const fields: HeapField[] = [];
  for (let i = 0; i < limit; i++) {
    fields.push({ key: String(i), value: previewCellValue(value[i]) });
  }
  if (value.length > limit) {
    fields.push({ key: '…', value: { kind: 'primitive', text: `+${value.length - limit}` } });
  }
  return { id: idFor(value), label: inferArrayLabel(value), fields };
}

// Converts a raw variable value into what a stack slot displays. Arrays become a
// reference dot pointing at a heap entry (reusing the existing one if the same
// array object is aliased by another variable); everything else stays inline.
function previewValue(value: unknown, heap: Map<string, HeapEntry>): SlotValue {
  if (Array.isArray(value)) {
    const refId = idFor(value);
    if (!heap.has(refId)) heap.set(refId, buildArrayHeapEntry(value));
    return { kind: 'reference', text: '', refId };
  }
  return { kind: 'primitive', text: formatPrimitive(value) };
}

// Total box height for a frame: fits all its slots, or a fixed minimum when empty.
function getFrameHeight(frame: FrameState): number {
  if (frame.slots.length === 0) return FUNC_MIN_HEIGHT;
  const hasTypeLabels = frame.slots.some((s) => s.value.kind === 'primitive' && s.typeLabel);
  const top = FUNC_INNER_PADDING + (hasTypeLabels ? FRAME_SLOT_TOP_PADDING : 0);
  const bottom = FUNC_INNER_PADDING;
  return Math.max(
    FUNC_MIN_HEIGHT,
    top +
      frame.slots.length * VAR_RECT_HEIGHT +
      (frame.slots.length - 1) * VAR_VERTICAL_GAP +
      bottom
  );
}

// Width of a single value box, sized to fit its text.
function getRectWidthForValue(valueStr: string): number {
  return Math.max(VAR_MIN_WIDTH, valueStr.length * NAME_CHAR_WIDTH + FUNC_INNER_PADDING);
}

// Total box width for a frame: wide enough for its longest name/value pair.
function getFrameWidth(frame: FrameState): number {
  let maxNameWidth = 0;
  let maxRectWidth = 0;
  for (const slot of frame.slots) {
    maxNameWidth = Math.max(maxNameWidth, slot.name.length * NAME_CHAR_WIDTH);
    maxRectWidth = Math.max(maxRectWidth, getRectWidthForValue(slot.value.text));
  }
  return Math.max(
    FUNC_MIN_WIDTH,
    FUNC_INNER_PADDING + maxNameWidth + NAME_BOX_GAP + maxRectWidth + FUNC_INNER_PADDING
  );
}

interface RenderedFrame {
  svg: string;
  height: number;
  width: number;
  /** Absolute {cx, cy} of every reference dot drawn in this frame, keyed by target heap entry. */
  dotCentres: Array<{ refId: string; cx: number; cy: number }>;
}

// Draws one frame box: its name label plus one row per slot (type, name, value).
// A reference-kind slot draws a dot instead of value text, and no type label above
// it — the type is shown once, above the heap box the dot points to.
function renderFrame(frame: FrameState, x: number, y: number): RenderedFrame {
  const height = getFrameHeight(frame);
  const width = getFrameWidth(frame);
  const titleX = x - 14;
  const titleY = y + height / 2;

  const hasTypeLabels = frame.slots.some((s) => s.value.kind === 'primitive' && s.typeLabel);
  const slotRowOffset = FUNC_INNER_PADDING + (hasTypeLabels ? FRAME_SLOT_TOP_PADDING : 0);
  const maxNameWidth = frame.slots.reduce(
    (m, s) => Math.max(m, s.name.length * NAME_CHAR_WIDTH),
    0
  );

  const dotCentres: Array<{ refId: string; cx: number; cy: number }> = [];

  const slotsSvg = frame.slots
    .map((slot, index) => {
      const rowY = y + slotRowOffset + index * (VAR_RECT_HEIGHT + VAR_VERTICAL_GAP);
      const centerY = rowY + VAR_RECT_HEIGHT / 2;
      const rectW = getRectWidthForValue(slot.value.text);
      const rectX = x + FUNC_INNER_PADDING + maxNameWidth + NAME_BOX_GAP;
      const valueCX = rectX + rectW / 2;
      const nameX = rectX - NAME_BOX_GAP;
      const typeLabelY = Math.max(y + 10, rowY - 4);
      const typeText = slot.value.kind === 'reference' ? '' : (slot.typeLabel ?? 'var');

      let valueContent: string;
      if (slot.value.kind === 'reference') {
        dotCentres.push({ refId: slot.value.refId!, cx: valueCX, cy: centerY });
        valueContent = `<circle cx="${valueCX}" cy="${centerY}" r="${REFERENCE_DOT_RADIUS}" fill="#ffffff" />`;
      } else {
        valueContent = `<text x="${valueCX}" y="${centerY}" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="12" font-family="ui-sans-serif, system-ui">${escapeXml(slot.value.text)}</text>`;
      }

      return `
    <g>
      <text x="${rectX}" y="${typeLabelY}" dominant-baseline="auto" fill="#aaaaaa" font-size="10" font-family="Georgia, serif">${escapeXml(typeText)}</text>
      <text x="${nameX}" y="${centerY}" dominant-baseline="middle" text-anchor="end" fill="#ffffff" font-size="12" font-family="ui-monospace, SFMono-Regular, Consolas, monospace">${escapeXml(slot.name)}</text>
      <rect x="${rectX}" y="${rowY}" width="${rectW}" height="${VAR_RECT_HEIGHT}" fill="none" stroke="#ffffff" stroke-width="1" />
      ${valueContent}
    </g>`;
    })
    .join('\n');

  const svg = `
  <g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#ffffff" stroke-width="1" />
    <text x="${titleX}" y="${titleY}" dominant-baseline="middle" text-anchor="end" fill="#ffffff" font-size="12" font-family="Georgia, serif">${escapeXml(frame.name)}</text>
    ${slotsSvg}
  </g>`;

  return { svg, height, width, dotCentres };
}

interface RenderedHeapEntry {
  svg: string;
  height: number;
  width: number;
  /** Absolute {cx, cy} of the left-edge center — where an arrow into this entry lands. */
  entryTarget: { cx: number; cy: number };
}

// Draws one heap entry (array only, for now): its element-type label above, then
// cells side by side with index labels below — same shape as the old full renderer's
// array box, just without the object/string/heap-to-heap cases.
function renderHeapEntry(entry: HeapEntry, x: number, y: number): RenderedHeapEntry {
  const cellH = VAR_RECT_HEIGHT;
  const typeLabelHeight = 14;
  const indexLabelHeight = 16;

  const cellWidths = entry.fields.map((f) => getRectWidthForValue(f.value.text));
  const totalWidth = cellWidths.reduce((sum, w) => sum + w, 0);
  const cellTop = y + typeLabelHeight;
  const cellCentreY = cellTop + cellH / 2;

  let cellX = x;
  const cellsSvg = entry.fields
    .map((field, i) => {
      const cw = cellWidths[i];
      const cellCX = cellX + cw / 2;
      const cellSvg = `
    <g>
      <rect x="${cellX}" y="${cellTop}" width="${cw}" height="${cellH}" fill="none" stroke="#ffffff" stroke-width="1" />
      <text x="${cellCX}" y="${cellCentreY}" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="12" font-family="ui-sans-serif, system-ui">${escapeXml(field.value.text)}</text>
      <text x="${cellCX}" y="${cellTop + cellH + indexLabelHeight - 2}" dominant-baseline="auto" text-anchor="middle" fill="#aaaaaa" font-size="10" font-family="ui-monospace, SFMono-Regular, Consolas, monospace">${escapeXml(field.key)}</text>
    </g>`;
      cellX += cw;
      return cellSvg;
    })
    .join('\n');

  const svg = `
  <g>
    <text x="${x}" y="${cellTop - 4}" dominant-baseline="auto" fill="#aaaaaa" font-size="10" font-family="Georgia, serif">${escapeXml(entry.label)}</text>
    ${cellsSvg}
  </g>`;

  return {
    svg,
    height: typeLabelHeight + cellH + indexLabelHeight,
    width: totalWidth,
    entryTarget: { cx: x, cy: cellCentreY },
  };
}

// Lays out every frame in a vertical stack, the HEAP column beside it (populated with
// array entries and their reference arrows, or the empty-column placeholder if there
// are none), and — only when the caller actually has some — a DATA column (the old
// file's "static" column, renamed per your note) to the right of HEAP. Everything is
// wrapped in one self-contained <svg> document.
function renderMemorySnapshotSvg(
  frames: FrameState[],
  heap: Map<string, HeapEntry> = new Map(),
  hasData: boolean = false
): string {
  const maxNameWidth = frames.reduce((m, f) => Math.max(m, f.name.length * NAME_CHAR_WIDTH), 0);
  const stackX = Math.max(MARGIN + FUNC_NAME_DISTANCE, maxNameWidth + 18);

  let stackY = MARGIN + HEADER_HEIGHT;
  let maxStackWidth = 0;
  const rendered: RenderedFrame[] = [];
  const allDotCentres: Array<{ refId: string; cx: number; cy: number }> = [];
  for (const frame of frames) {
    const rf = renderFrame(frame, stackX, stackY);
    rendered.push(rf);
    allDotCentres.push(...rf.dotCentres);
    stackY += rf.height + MARGIN;
    maxStackWidth = Math.max(maxStackWidth, rf.width);
  }

  const stackColumnRight = stackX + maxStackWidth;
  const heapDividerX = stackColumnRight + HEAP_LEFT_MARGIN / 2;
  const heapX = stackColumnRight + HEAP_LEFT_MARGIN;

  // Lay out each heap entry, vertically centered on the dot that points to it (an
  // aliased array with two dots aligns to whichever one is found first — its second
  // arrow just lands on the same target for now).
  let heapCursorY = MARGIN + HEADER_HEIGHT;
  let maxHeapWidth = 0;
  const heapSvgParts: string[] = [];
  const heapTargets = new Map<string, { cx: number; cy: number }>();
  const heapEntryCenterOffset = 14 + VAR_RECT_HEIGHT / 2; // renderHeapEntry's typeLabelHeight + half cell
  for (const [refId, entry] of heap) {
    const dot = allDotCentres.find((d) => d.refId === refId);
    const alignedY = dot ? dot.cy - heapEntryCenterOffset : heapCursorY;
    const rh = renderHeapEntry(entry, heapX, alignedY);
    heapSvgParts.push(rh.svg);
    heapTargets.set(refId, rh.entryTarget);
    heapCursorY = alignedY + rh.height + HEAP_VERTICAL_GAP;
    maxHeapWidth = Math.max(maxHeapWidth, rh.width);
  }

  const heapColumnRight = heap.size > 0 ? heapX + maxHeapWidth : heapX + HEAP_COLUMN_MIN_WIDTH;
  const dataDividerX = heapColumnRight + HEAP_LEFT_MARGIN / 2;
  const dataX = heapColumnRight + HEAP_LEFT_MARGIN;

  const canvasWidth = Math.max(
    (hasData ? dataX + HEAP_COLUMN_MIN_WIDTH : heapColumnRight) + MARGIN,
    260
  );
  const canvasHeight = Math.max(MIN_CANVAS_HEIGHT, Math.max(stackY, heapCursorY) + MARGIN);
  const framesSvg = rendered.map((rf) => rf.svg).join('\n');
  const heapEntriesSvg = heapSvgParts.join('\n');

  // Reference arrows: stack dot -> the heap entry it points to.
  const arrowsSvg = allDotCentres
    .map(({ refId, cx, cy }) => {
      const target = heapTargets.get(refId);
      if (!target) return '';
      return `<path d="M ${cx} ${cy} L ${target.cx} ${target.cy}" fill="none" stroke="${HEAP_ARROW_COLOR}" stroke-width="1" marker-end="url(#refArrow)" />`;
    })
    .join('\n');

  const headerY = MARGIN + 8; // raised up a bit for more gap above the boxes below
  const dividerBottom = canvasHeight - MARGIN / 2;
  // Bold + underlined to match the column headers in the original design.
  const headerAttrs =
    'font-weight="bold" text-decoration="underline" font-size="12" font-family="ui-sans-serif, system-ui" letter-spacing="1"';
  const divider = (x: number) =>
    `<line x1="${x}" y1="${MARGIN}" x2="${x}" y2="${dividerBottom}" stroke="#ffffff" stroke-width="1" stroke-dasharray="4,4" />`;

  // Before anything has run, a column's title sits a fixed distance from its divider
  // (COLUMN_TITLE_GAP) for a clean, symmetric empty state. Once a column actually has
  // content, its title re-centers over that content's real width instead. DATA stays
  // on the fixed gap until static-field rendering exists.
  const stackHasContent = frames.some((f) => f.slots.length > 0);
  const stackTitleX = stackHasContent
    ? stackX + maxStackWidth / 2
    : heapDividerX - COLUMN_TITLE_GAP;

  const heapHasContent = heap.size > 0;
  const heapTitleX = heapHasContent ? heapX + maxHeapWidth / 2 : heapDividerX + COLUMN_TITLE_GAP;

  const dataHeaderSvg = hasData
    ? `<text x="${dataDividerX + COLUMN_TITLE_GAP}" y="${headerY}" text-anchor="middle" fill="#ffffff" ${headerAttrs}>DATA</text>
  ${divider(dataDividerX)}`
    : '';

  // No background rect here on purpose — the SVG stays transparent so the MemDia
  // panel's own navy background (MemDia.tsx's bg-slate-900/80) shows through instead
  // of clashing with a separately-colored box.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <defs>
    <marker id="refArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
      <path d="M0 0L10 5L0 10" fill="${HEAP_ARROW_COLOR}" />
    </marker>
  </defs>
  <text x="${stackTitleX}" y="${headerY}" text-anchor="middle" fill="#ffffff" ${headerAttrs}>STACK</text>
  <text x="${heapTitleX}" y="${headerY}" text-anchor="middle" fill="#ffffff" ${headerAttrs}>HEAP</text>
  ${divider(heapDividerX)}
  ${dataHeaderSvg}
  ${framesSvg}
  ${heapEntriesSvg}
  ${arrowsSvg}
</svg>`;
}

// Renders a memory diagram directly from a flat variable dict (e.g. the debugger's
// currentVariables), for callers with no Memdia instance wired up — MemDia.tsx uses
// this to show a live diagram from data it already receives.
export function renderMemoryDiagramFromVariables(currentVariables: Record<string, any>): string {
  const heap = new Map<string, HeapEntry>();
  const slots: StackSlot[] = Object.entries(currentVariables)
    .slice(0, MAX_STACK_SLOTS)
    .map(([name, value]) => ({
      name,
      value: previewValue(value, heap),
      typeLabel: inferTypeLabel(value),
    }));
  return renderMemorySnapshotSvg([{ name: 'main', slots }], heap);
}
