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
const HEAP_OBJECT_LABEL_HEIGHT = 16; // space above a string's box for the "String" label

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
  kind: 'array' | 'string';
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

const stringIds = new Map<string, string>();
let nextStringId = 1;

// Stable id per string value (not identity — strings aren't objects) so two
// variables holding the same text share one heap entry.
function idForString(value: string): string {
  const existing = stringIds.get(value);
  if (existing) return existing;
  const id = `s${nextStringId++}`;
  stringIds.set(value, id);
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

// A string element becomes its own heap-boxed reference, same as a top-level string
// variable. Nested arrays/objects inside a cell aren't linked out to their own heap
// entry yet — shown as a placeholder rather than crashing or misrendering.
function previewCellValue(el: unknown, heap: Map<string, HeapEntry>): SlotValue {
  if (typeof el === 'string') {
    const refId = idForString(el);
    if (!heap.has(refId)) heap.set(refId, buildStringHeapEntry(el));
    return { kind: 'reference', text: '', refId };
  }
  if (Array.isArray(el) || (el !== null && typeof el === 'object')) {
    return { kind: 'primitive', text: '[…]' };
  }
  return { kind: 'primitive', text: formatPrimitive(el) };
}

function buildArrayHeapEntry(value: unknown[], heap: Map<string, HeapEntry>): HeapEntry {
  const limit = Math.min(value.length, MAX_HEAP_FIELDS);
  const fields: HeapField[] = [];
  for (let i = 0; i < limit; i++) {
    fields.push({ key: String(i), value: previewCellValue(value[i], heap) });
  }
  if (value.length > limit) {
    fields.push({ key: '…', value: { kind: 'primitive', text: `+${value.length - limit}` } });
  }
  return { id: idFor(value), kind: 'array', label: inferArrayLabel(value), fields };
}

function buildStringHeapEntry(value: string): HeapEntry {
  return {
    id: idForString(value),
    kind: 'string',
    label: 'String',
    fields: [{ key: 'value', value: { kind: 'primitive', text: formatPrimitive(value) } }],
  };
}

// Converts a raw variable value into what a stack slot displays. Arrays and strings
// become a reference dot pointing at a heap entry (reusing the existing one if the
// same array is aliased, or the same string value appears elsewhere); everything
// else stays inline.
function previewValue(value: unknown, heap: Map<string, HeapEntry>): SlotValue {
  if (Array.isArray(value)) {
    const refId = idFor(value);
    if (!heap.has(refId)) heap.set(refId, buildArrayHeapEntry(value, heap));
    return { kind: 'reference', text: '', refId };
  }
  if (typeof value === 'string') {
    const refId = idForString(value);
    if (!heap.has(refId)) heap.set(refId, buildStringHeapEntry(value));
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
        valueContent = `<text x="${valueCX}" y="${centerY}" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="14" font-family="ui-sans-serif, system-ui">${escapeXml(slot.value.text)}</text>`;
      }

      return `
    <g>
      <text x="${rectX}" y="${typeLabelY}" dominant-baseline="auto" fill="#aaaaaa" font-size="12" font-family="Georgia, serif">${escapeXml(typeText)}</text>
      <text x="${nameX}" y="${centerY}" dominant-baseline="middle" text-anchor="end" fill="#ffffff" font-size="14" font-family="ui-monospace, SFMono-Regular, Consolas, monospace">${escapeXml(slot.name)}</text>
      <rect x="${rectX}" y="${rowY}" width="${rectW}" height="${VAR_RECT_HEIGHT}" fill="none" stroke="#ffffff" stroke-width="1" />
      ${valueContent}
    </g>`;
    })
    .join('\n');

  const svg = `
  <g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#ffffff" stroke-width="1" />
    <text x="${titleX}" y="${titleY}" dominant-baseline="middle" text-anchor="end" fill="#ffffff" font-size="14" font-family="Georgia, serif">${escapeXml(frame.name)}</text>
    ${slotsSvg}
  </g>`;

  return { svg, height, width, dotCentres };
}

interface RenderedHeapEntry {
  svg: string;
  height: number;
  width: number;
  /** Absolute {cx, cy} of the left-edge center — where an arrow arriving from the stack lands. */
  entryTarget: { cx: number; cy: number };
  /** Absolute {cx, cy} of the right-edge center — where an arrow arriving from elsewhere in the heap lands, so it never has to cross through another box to get here. */
  entryTargetRight: { cx: number; cy: number };
  /** Absolute {cx, cy} of every reference dot drawn inside this entry (e.g. a string element). */
  dotCentres: Array<{ refId: string; cx: number; cy: number }>;
}

// Draws one heap entry. Strings are a single box (type label above, value inside —
// same shape as a stack slot's value box). Arrays lay their element-type label above
// cells side by side with index labels below, and a cell holding a string draws a
// reference dot instead of inline text. Same shapes as the old full renderer's
// string/array cases, just without the object/heap-to-heap cases.
function renderHeapEntry(entry: HeapEntry, x: number, y: number): RenderedHeapEntry {
  if (entry.kind === 'string') {
    const valueText = entry.fields[0]?.value.text ?? '""';
    const boxW = getRectWidthForValue(valueText);
    const boxH = VAR_RECT_HEIGHT;
    const boxTop = y + HEAP_OBJECT_LABEL_HEIGHT;
    const centerY = boxTop + boxH / 2;
    const svg = `
  <g>
    <text x="${x}" y="${y + HEAP_OBJECT_LABEL_HEIGHT - 4}" dominant-baseline="auto" fill="#aaaaaa" font-size="12" font-family="Georgia, serif">${escapeXml(entry.label)}</text>
    <rect x="${x}" y="${boxTop}" width="${boxW}" height="${boxH}" fill="none" stroke="#ffffff" stroke-width="1" />
    <text x="${x + boxW / 2}" y="${centerY}" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="14" font-family="ui-sans-serif, system-ui">${escapeXml(valueText)}</text>
  </g>`;
    return {
      svg,
      height: HEAP_OBJECT_LABEL_HEIGHT + boxH,
      width: boxW,
      entryTarget: { cx: x, cy: centerY },
      entryTargetRight: { cx: x + boxW, cy: centerY },
      dotCentres: [],
    };
  }

  const cellH = VAR_RECT_HEIGHT;
  const typeLabelHeight = 14;
  const indexLabelHeight = 16;

  const cellWidths = entry.fields.map((f) => getRectWidthForValue(f.value.text));
  const totalWidth = cellWidths.reduce((sum, w) => sum + w, 0);
  const cellTop = y + typeLabelHeight;
  const cellCentreY = cellTop + cellH / 2;

  let cellX = x;
  const dotCentres: Array<{ refId: string; cx: number; cy: number }> = [];
  const cellsSvg = entry.fields
    .map((field, i) => {
      const cw = cellWidths[i];
      const cellCX = cellX + cw / 2;

      let valueContent: string;
      if (field.value.kind === 'reference') {
        dotCentres.push({ refId: field.value.refId!, cx: cellCX, cy: cellCentreY });
        valueContent = `<circle cx="${cellCX}" cy="${cellCentreY}" r="${REFERENCE_DOT_RADIUS}" fill="#ffffff" />`;
      } else {
        valueContent = `<text x="${cellCX}" y="${cellCentreY}" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="14" font-family="ui-sans-serif, system-ui">${escapeXml(field.value.text)}</text>`;
      }

      const cellSvg = `
    <g>
      <rect x="${cellX}" y="${cellTop}" width="${cw}" height="${cellH}" fill="none" stroke="#ffffff" stroke-width="1" />
      ${valueContent}
      <text x="${cellCX}" y="${cellTop + cellH + indexLabelHeight - 2}" dominant-baseline="auto" text-anchor="middle" fill="#aaaaaa" font-size="12" font-family="ui-monospace, SFMono-Regular, Consolas, monospace">${escapeXml(field.key)}</text>
    </g>`;
      cellX += cw;
      return cellSvg;
    })
    .join('\n');

  const svg = `
  <g>
    <text x="${x}" y="${cellTop - 4}" dominant-baseline="auto" fill="#aaaaaa" font-size="12" font-family="Georgia, serif">${escapeXml(entry.label)}</text>
    ${cellsSvg}
  </g>`;

  return {
    svg,
    height: typeLabelHeight + cellH + indexLabelHeight,
    width: totalWidth,
    entryTarget: { cx: x, cy: cellCentreY },
    entryTargetRight: { cx: x + totalWidth, cy: cellCentreY },
    dotCentres,
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

  // Lay out each heap entry. An entry a stack dot points to directly is placed first,
  // aligned to that dot; whatever its own cells point to in turn (e.g. a string inside
  // an array) is placed right after, directly below it in the same column. Placement
  // is clamped to the running cursor so a parent-plus-children column can't overlap
  // an earlier one.
  let heapCursorY = MARGIN + HEADER_HEIGHT;
  let maxHeapWidth = 0;
  const heapSvgParts: string[] = [];
  const heapTargets = new Map<
    string,
    { left: { cx: number; cy: number }; right: { cx: number; cy: number } }
  >();
  const placedRefIds = new Set<string>();
  const heapInternalDots: Array<{ refId: string; cx: number; cy: number }> = [];

  function placeHeapEntry(refId: string, entry: HeapEntry, alignedY: number) {
    const rh = renderHeapEntry(entry, heapX, alignedY);
    heapSvgParts.push(rh.svg);
    heapTargets.set(refId, { left: rh.entryTarget, right: rh.entryTargetRight });
    placedRefIds.add(refId);
    heapInternalDots.push(...rh.dotCentres);
    heapCursorY = alignedY + rh.height; // raw bottom edge — no gap baked in, so the next
    // entry only gets pushed down when it would actually overlap, never just for padding.
    maxHeapWidth = Math.max(maxHeapWidth, rh.width);

    for (const { refId: childRefId, cy: childDotCy } of rh.dotCentres) {
      if (placedRefIds.has(childRefId)) continue;
      const childEntry = heap.get(childRefId);
      if (!childEntry) continue;
      const childY = Math.max(heapCursorY + HEAP_VERTICAL_GAP, childDotCy + HEAP_VERTICAL_GAP);
      placeHeapEntry(childRefId, childEntry, childY);
    }
  }

  for (const [refId, entry] of heap) {
    if (placedRefIds.has(refId)) continue;
    const dot = allDotCentres.find((d) => d.refId === refId);
    if (!dot) continue; // only reachable through a parent entry — placed when the parent is
    // Matches renderHeapEntry's own label-height + half-cell math for each kind.
    const heapEntryCenterOffset =
      (entry.kind === 'string' ? HEAP_OBJECT_LABEL_HEIGHT : 14) + VAR_RECT_HEIGHT / 2;
    const alignedY = Math.max(heapCursorY, dot.cy - heapEntryCenterOffset);
    placeHeapEntry(refId, entry, alignedY);
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

  // Reference arrows. Stack dots have a clear shot into the left edge of their target,
  // so they stay straight lines. Dots inside a heap entry (e.g. a string array's cells)
  // target the right edge instead — reserving the left edge for stack arrows — and arc
  // out to the right so the line never has to cross through another box stacked between
  // it and its target.
  const ARROW_BULGE = 56; // clears the array's width before the curve is allowed to dip toward its target

  function curvedArrowPath(x1: number, y1: number, x2: number, y2: number): string {
    const c1x = x1 + ARROW_BULGE; // stays level with the source briefly, clearing what's directly below it
    const c2x = x2 + ARROW_BULGE / 2; // shorter runway into the target, just enough for a leftward entry
    return `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
  }

  const stackArrowsSvg = allDotCentres
    .map(({ refId, cx, cy }) => {
      const target = heapTargets.get(refId);
      if (!target) return '';
      return `<path d="M ${cx} ${cy} L ${target.left.cx} ${target.left.cy}" fill="none" stroke="${HEAP_ARROW_COLOR}" stroke-width="1" marker-end="url(#refArrow)" />`;
    })
    .join('\n');

  const heapArrowsSvg = heapInternalDots
    .map(({ refId, cx, cy }) => {
      const target = heapTargets.get(refId);
      if (!target) return '';
      return `<path d="${curvedArrowPath(cx, cy, target.right.cx, target.right.cy)}" fill="none" stroke="${HEAP_ARROW_COLOR}" stroke-width="1" marker-end="url(#refArrow)" />`;
    })
    .join('\n');

  const arrowsSvg = `${stackArrowsSvg}\n${heapArrowsSvg}`;

  const headerY = MARGIN + 8; // raised up a bit for more gap above the boxes below
  const dividerBottom = canvasHeight - MARGIN / 2;
  // Bold + underlined to match the column headers in the original design.
  const headerAttrs =
    'font-weight="bold" text-decoration="underline" font-size="14" font-family="ui-sans-serif, system-ui" letter-spacing="1"';
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
