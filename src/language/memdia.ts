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

const AMBIGUOUS_NUMERIC_TYPES = ['byte', 'short', 'long', 'float', 'double'];

// Duck-typed: a declared byte/short/long/float/double value tagged with its type (by
// interpreter.ts's snapshot for top-level variables, or by tagFloatingValue below for
// object fields), so it isn't mistaken for a plain int just because its value happens
// to be whole.
function isTypedNumber(value: unknown): value is { value: number; declaredType: string } {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['value'] === 'number' &&
    AMBIGUOUS_NUMERIC_TYPES.includes(obj['declaredType'] as string)
  );
}

// Duck-typed: a declared char value tagged the same way (by interpreter.ts's snapshot
// for top-level variables, or by tagFloatingValue below for object fields/array cells).
function isTypedChar(value: unknown): value is { value: string; declaredType: 'char' } {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['value'] === 'string' && obj['declaredType'] === 'char';
}

// Object fields aren't pre-tagged by interpreter.ts (only top-level variables are) —
// this applies the same tag using the field's already-known declared type instead.
function tagFloatingValue(value: unknown, declaredType: string | undefined): unknown {
  if (typeof value === 'string') return declaredType === 'char' ? { value, declaredType } : value;
  if (typeof value !== 'number') return value;
  if (!declaredType || !AMBIGUOUS_NUMERIC_TYPES.includes(declaredType)) return value;
  return { value, declaredType };
}

// Guesses a human-readable type label for a raw JS value, for slots that don't specify one explicitly.
function inferTypeLabel(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (isTypedNumber(value)) return value.declaredType;
  if (isTypedChar(value)) return value.declaredType;
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

const NAME_CHAR_WIDTH = 6.5; // fallback estimate only — see measureText below
const NAME_BOX_GAP = 8;

// SVG has no built-in way to ask "how wide will this text render," so box/column widths
// have always had to estimate it from character count — which drifts for long text and
// gets worse the longer the text is. A canvas (available in the live browser app) gives
// the real rendered width instead; Node-based scripts/tests, which have no DOM, fall
// back to the old per-character estimate.
const NAME_FONT = '14px ui-monospace, SFMono-Regular, Consolas, monospace'; // slot/field names, array index labels
const VALUE_FONT = '14px ui-sans-serif, system-ui'; // text inside value boxes
const LABEL_FONT = '13px Georgia, serif'; // type labels, heap entry labels — 13px floor matches --text-xs
const FRAME_TITLE_FONT = '14px Georgia, serif'; // frame name titles — must match renderFrame's
// title text's actual font-size (14), unlike LABEL_FONT's 13px, or a long name under-reserves
// column width and clips against the SVG's left edge.
const RETURNED_LABEL_TEXT = 'returned';
const RETURNED_LABEL_FONT = 'italic 13px Georgia, serif'; // must match renderFrame's "returned" sub-label

let measureCtx: CanvasRenderingContext2D | null | undefined;
function measureText(
  text: string,
  font: string,
  fallbackCharWidth: number = NAME_CHAR_WIDTH
): number {
  if (measureCtx === undefined) {
    measureCtx =
      typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  }
  if (!measureCtx) return text.length * fallbackCharWidth;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

// The widest slot/field name in a set of rows — shared by every place that lays out a
// frame-style box (stack frames, object heap entries) so the name column's reserved
// width always matches what the rows themselves used to position their name text.
function maxSlotNameWidth(slots: { name: string }[]): number {
  return slots.reduce((m, s) => Math.max(m, measureText(s.name, NAME_FONT)), 0);
}

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
const HEAP_VERTICAL_GAP = VAR_VERTICAL_GAP; // vertical gap between stacked heap entries — matches the gap between field rows inside one box
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
  /** True for a call that already returned — its box is drawn dimmed, with a
   *  small "returned" sub-label, instead of erased outright. */
  returned?: boolean;
}

interface HeapField {
  key: string;
  value: SlotValue;
  typeLabel?: string;
}

interface HeapEntry {
  id: string;
  kind: 'array' | 'string' | 'object';
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
  if (isTypedNumber(value)) {
    const isFloating = value.declaredType === 'double' || value.declaredType === 'float';
    return isFloating && Number.isInteger(value.value) ? `${value.value}.0` : String(value.value);
  }
  if (isTypedChar(value)) {
    // The null character (Java's '\0') has no visible glyph — embedding it raw would
    // render as blank/invisible in the SVG. Show the readable escape instead.
    const display = value.value === '\u0000' ? '\\0' : value.value;
    return `'${display}'`;
  }
  return String(value);
}

function inferArrayLabel(value: unknown[]): string {
  // interpreter.ts tags a declared byte/short/long/float/double array (a hidden,
  // non-enumerable property on the array itself, not a copy — see TypedNumber in
  // interpreter.ts).
  const tagged = (value as { __declaredElementType?: string }).__declaredElementType;
  if (tagged) return `${tagged}[]`;
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

function buildStringHeapEntry(value: string): HeapEntry {
  return {
    id: idForString(value),
    kind: 'string',
    label: 'String',
    fields: [{ key: 'value', value: { kind: 'primitive', text: formatPrimitive(value) } }],
  };
}

// Duck-typed detection of the interpreter's JavaInstance shape — kept decoupled from
// interpreter.ts (memdia.ts imports nothing from it) rather than importing the type.
function isJavaInstance(value: unknown): value is {
  klass: { name: string; fieldTypes?: Map<string, string> };
  fields: Map<string, unknown>;
} {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    obj['fields'] instanceof Map &&
    obj['klass'] !== undefined &&
    typeof (obj['klass'] as Record<string, unknown>)?.['name'] === 'string'
  );
}

function buildArrayHeapEntry(
  value: unknown[],
  heap: Map<string, HeapEntry>,
  seen: WeakSet<object>,
  elementType?: string
): HeapEntry {
  const limit = Math.min(value.length, MAX_HEAP_FIELDS);
  const fields: HeapField[] = [];
  for (let i = 0; i < limit; i++) {
    fields.push({
      key: String(i),
      value: previewValue(tagFloatingValue(value[i], elementType), heap, seen),
    });
  }
  if (value.length > limit) {
    fields.push({ key: '…', value: { kind: 'primitive', text: `+${value.length - limit}` } });
  }
  return {
    id: idFor(value),
    kind: 'array',
    label: elementType ? `${elementType}[]` : inferArrayLabel(value),
    fields,
  };
}

function buildObjectHeapEntry(
  instance: {
    klass: { name: string; fieldTypes?: Map<string, string> };
    fields: Map<string, unknown>;
  },
  heap: Map<string, HeapEntry>,
  seen: WeakSet<object>
): HeapEntry {
  const limit = Math.min(instance.fields.size, MAX_HEAP_FIELDS);
  const fields: HeapField[] = [];
  let i = 0;
  for (const [key, value] of instance.fields) {
    if (i >= limit) break;
    const typeLabel = instance.klass.fieldTypes?.get(key) ?? inferTypeLabel(value);
    fields.push({
      key,
      value: previewValue(value, heap, seen, typeLabel),
      typeLabel,
    });
    i++;
  }
  if (instance.fields.size > limit) {
    fields.push({
      key: '…',
      value: { kind: 'primitive', text: `+${instance.fields.size - limit}` },
    });
  }
  return { id: idFor(instance), kind: 'object', label: instance.klass.name, fields };
}

// Converts a raw variable/field/element value into what its slot displays. Arrays,
// strings, and object instances become a reference dot pointing at a heap entry
// (reusing the existing one if aliased); everything else stays inline. `seen` guards
// against infinite recursion on circular object references (e.g. a node whose field
// points back to an ancestor) — arrays and strings can't form cycles, only objects.
function previewValue(
  value: unknown,
  heap: Map<string, HeapEntry>,
  seen: WeakSet<object> = new WeakSet(),
  declaredType?: string
): SlotValue {
  if (Array.isArray(value)) {
    const refId = idFor(value);
    if (!heap.has(refId) && !seen.has(value)) {
      seen.add(value);
      // A field's declared type (passed in explicitly) wins; otherwise fall back to
      // interpreter.ts's tag on the array itself (top-level variables).
      const elementType =
        declaredType?.replace(/\[\]$/, '') ??
        (value as { __declaredElementType?: string }).__declaredElementType;
      heap.set(refId, buildArrayHeapEntry(value, heap, seen, elementType));
      seen.delete(value);
    }
    return { kind: 'reference', text: '', refId };
  }
  // A declared char is a primitive in Java, even though it's a plain JS string
  // internally — only treat a string as a real String reference when it isn't one.
  if (typeof value === 'string' && declaredType !== 'char') {
    const refId = idForString(value);
    if (!heap.has(refId)) heap.set(refId, buildStringHeapEntry(value));
    return { kind: 'reference', text: '', refId };
  }
  if (isJavaInstance(value)) {
    const refId = idFor(value);
    if (!heap.has(refId) && !seen.has(value)) {
      seen.add(value);
      heap.set(refId, buildObjectHeapEntry(value, heap, seen));
      seen.delete(value);
    }
    return { kind: 'reference', text: '', refId };
  }
  return { kind: 'primitive', text: formatPrimitive(tagFloatingValue(value, declaredType)) };
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
  return Math.max(VAR_MIN_WIDTH, measureText(valueStr, VALUE_FONT) + FUNC_INNER_PADDING);
}

// Rough width estimate for a heap entry's own label text, so a sparse entry (an empty
// array, a one-character string) still reserves enough width for its own label — the
// label sits above the entry's content and would otherwise be free to render past
// whatever width the content alone claims, clipping at the canvas edge.
function estimateLabelWidth(label: string): number {
  return measureText(label, LABEL_FONT);
}

// Total height of an object heap entry (label + field rows). Pulled out as its own
// function because the top-level layout pass needs to know an object's height *before*
// rendering it, to align its vertical center with the stack dot pointing at it — must
// stay in sync with the box-height math inside renderHeapEntry's object branch.
function getObjectEntryHeight(entry: HeapEntry): number {
  const firstFieldHasTypeLabel =
    entry.fields.length > 0 &&
    entry.fields[0].value.kind === 'primitive' &&
    !!entry.fields[0].typeLabel;
  const slotRowOffset = FUNC_INNER_PADDING + (firstFieldHasTypeLabel ? FRAME_SLOT_TOP_PADDING : 0);
  const boxHeight = Math.max(
    FUNC_MIN_HEIGHT,
    slotRowOffset +
      entry.fields.length * VAR_RECT_HEIGHT +
      Math.max(0, entry.fields.length - 1) * VAR_VERTICAL_GAP +
      FUNC_INNER_PADDING
  );
  return HEAP_OBJECT_LABEL_HEIGHT + boxHeight;
}

// Total box width for a frame: wide enough for its longest name/value pair.
function getFrameWidth(frame: FrameState): number {
  const maxNameWidth = maxSlotNameWidth(frame.slots);
  const maxRectWidth = frame.slots.reduce(
    (m, slot) => Math.max(m, getRectWidthForValue(slot.value.text)),
    0
  );
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

  // A returned call's box is dimmed rather than erased — its locals are gone in
  // reality (see interpreter.ts's lastReturnedFrame), but showing them grayed
  // out here is what makes "eligible for garbage collection" visible at all.
  const strokeColor = frame.returned ? '#555555' : '#ffffff';
  const textColor = frame.returned ? '#888888' : '#ffffff';
  const typeLabelColor = frame.returned ? '#666666' : '#aaaaaa';
  const returnedLabel = frame.returned
    ? `<text x="${titleX}" y="${titleY + 16}" dominant-baseline="middle" text-anchor="end" fill="#888888" font-size="13" font-style="italic" font-family="Georgia, serif">${RETURNED_LABEL_TEXT}</text>`
    : '';

  const hasTypeLabels = frame.slots.some((s) => s.value.kind === 'primitive' && s.typeLabel);
  const slotRowOffset = FUNC_INNER_PADDING + (hasTypeLabels ? FRAME_SLOT_TOP_PADDING : 0);
  const maxNameWidth = maxSlotNameWidth(frame.slots);

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
        valueContent = `<circle cx="${valueCX}" cy="${centerY}" r="${REFERENCE_DOT_RADIUS}" fill="${textColor}" />`;
      } else {
        valueContent = `<text x="${valueCX}" y="${centerY}" dominant-baseline="middle" text-anchor="middle" fill="${textColor}" font-size="14" font-family="ui-sans-serif, system-ui">${escapeXml(slot.value.text)}</text>`;
      }

      return `
    <g>
      <text x="${rectX}" y="${typeLabelY}" dominant-baseline="auto" fill="${typeLabelColor}" font-size="13" font-family="Georgia, serif">${escapeXml(typeText)}</text>
      <text x="${nameX}" y="${centerY}" dominant-baseline="middle" text-anchor="end" fill="${textColor}" font-size="14" font-family="ui-monospace, SFMono-Regular, Consolas, monospace">${escapeXml(slot.name)}</text>
      <rect x="${rectX}" y="${rowY}" width="${rectW}" height="${VAR_RECT_HEIGHT}" fill="none" stroke="${strokeColor}" stroke-width="1" />
      ${valueContent}
    </g>`;
    })
    .join('\n');

  const svg = `
  <g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${strokeColor}" stroke-width="1" />
    <text x="${titleX}" y="${titleY}" dominant-baseline="middle" text-anchor="end" fill="${textColor}" font-size="14" font-family="Georgia, serif">${escapeXml(frame.name)}</text>
    ${returnedLabel}
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
// same shape as a stack slot's value box). Objects draw their fields the same way a
// stack frame draws slots (name left, type label above the value box, value box
// right). Arrays lay their element-type label above cells side by side with index
// labels below. Any of the three can draw a reference dot instead of inline
// content — a cell/field pointing at its own heap entry. Every branch's width is
// floored by its own label's width so a sparse entry (an empty array, a
// one-character string) never renders its label past its own edge.
function renderHeapEntry(entry: HeapEntry, x: number, y: number): RenderedHeapEntry {
  if (entry.kind === 'string') {
    const valueText = entry.fields[0]?.value.text ?? '""';
    const boxW = Math.max(getRectWidthForValue(valueText), estimateLabelWidth(entry.label));
    const boxH = VAR_RECT_HEIGHT;
    const boxTop = y + HEAP_OBJECT_LABEL_HEIGHT;
    const centerY = boxTop + boxH / 2;
    const svg = `
  <g>
    <text x="${x}" y="${y + HEAP_OBJECT_LABEL_HEIGHT - 4}" dominant-baseline="auto" fill="#aaaaaa" font-size="13" font-family="Georgia, serif">${escapeXml(entry.label)}</text>
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

  if (entry.kind === 'object') {
    const slots: StackSlot[] = entry.fields.map((f) => ({
      name: f.key,
      value: f.value,
      typeLabel: f.typeLabel,
    }));
    const width = Math.max(
      getFrameWidth({ name: entry.label, slots }),
      estimateLabelWidth(entry.label)
    );
    const totalHeight = getObjectEntryHeight(entry);
    const boxHeight = totalHeight - HEAP_OBJECT_LABEL_HEIGHT;
    const boxY = y + HEAP_OBJECT_LABEL_HEIGHT;
    const firstSlotHasTypeLabel =
      slots.length > 0 && slots[0].value.kind === 'primitive' && !!slots[0].typeLabel;
    const slotRowOffset = FUNC_INNER_PADDING + (firstSlotHasTypeLabel ? FRAME_SLOT_TOP_PADDING : 0);
    const maxNameWidth = maxSlotNameWidth(slots);

    const dotCentres: Array<{ refId: string; cx: number; cy: number }> = [];
    const slotsSvg = slots
      .map((slot, index) => {
        const rowY = boxY + slotRowOffset + index * (VAR_RECT_HEIGHT + VAR_VERTICAL_GAP);
        const centerY = rowY + VAR_RECT_HEIGHT / 2;
        const typeText = slot.value.kind === 'reference' ? '' : (slot.typeLabel ?? '');
        const rectW = getRectWidthForValue(slot.value.text);
        const rectX = x + FUNC_INNER_PADDING + maxNameWidth + NAME_BOX_GAP;
        const valueCX = rectX + rectW / 2;
        const nameX = rectX - NAME_BOX_GAP;
        const typeLabelY = Math.max(boxY + FUNC_INNER_PADDING - 2, rowY - 4);

        let valueContent: string;
        if (slot.value.kind === 'reference') {
          dotCentres.push({ refId: slot.value.refId!, cx: valueCX, cy: centerY });
          valueContent = `<circle cx="${valueCX}" cy="${centerY}" r="${REFERENCE_DOT_RADIUS}" fill="#ffffff" />`;
        } else {
          valueContent = `<text x="${valueCX}" y="${centerY}" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="14" font-family="ui-sans-serif, system-ui">${escapeXml(slot.value.text)}</text>`;
        }

        return `
    <g>
      <text x="${rectX}" y="${typeLabelY}" dominant-baseline="auto" fill="#aaaaaa" font-size="13" font-family="Georgia, serif">${escapeXml(typeText)}</text>
      <text x="${nameX}" y="${centerY}" dominant-baseline="middle" text-anchor="end" fill="#ffffff" font-size="14" font-family="ui-monospace, SFMono-Regular, Consolas, monospace">${escapeXml(slot.name)}</text>
      <rect x="${rectX}" y="${rowY}" width="${rectW}" height="${VAR_RECT_HEIGHT}" fill="none" stroke="#ffffff" stroke-width="1" />
      ${valueContent}
    </g>`;
      })
      .join('\n');

    const svg = `
  <g>
    <text x="${x}" y="${y + HEAP_OBJECT_LABEL_HEIGHT - 4}" dominant-baseline="auto" fill="#aaaaaa" font-size="13" font-family="Georgia, serif">${escapeXml(entry.label)}</text>
    <rect x="${x}" y="${boxY}" width="${width}" height="${boxHeight}" fill="none" stroke="#ffffff" stroke-width="1" />
    ${slotsSvg}
  </g>`;

    const midY = boxY + boxHeight / 2;
    return {
      svg,
      height: totalHeight,
      width,
      entryTarget: { cx: x, cy: midY },
      entryTargetRight: { cx: x + width, cy: midY },
      dotCentres,
    };
  }

  const cellH = VAR_RECT_HEIGHT;
  const typeLabelHeight = 14;
  const indexLabelHeight = 16;

  const cellWidths = entry.fields.map((f) => getRectWidthForValue(f.value.text));
  const totalWidth = Math.max(
    cellWidths.reduce((sum, w) => sum + w, 0),
    estimateLabelWidth(entry.label)
  );
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
      <text x="${cellCX}" y="${cellTop + cellH + indexLabelHeight - 2}" dominant-baseline="auto" text-anchor="middle" fill="#aaaaaa" font-size="13" font-family="ui-monospace, SFMono-Regular, Consolas, monospace">${escapeXml(field.key)}</text>
    </g>`;
      cellX += cw;
      return cellSvg;
    })
    .join('\n');

  const svg = `
  <g>
    <text x="${x}" y="${cellTop - 4}" dominant-baseline="auto" fill="#aaaaaa" font-size="13" font-family="Georgia, serif">${escapeXml(entry.label)}</text>
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
  const maxNameWidth = frames.reduce((m, f) => {
    const nameWidth = measureText(f.name, FRAME_TITLE_FONT);
    const returnedLabelWidth = f.returned
      ? measureText(RETURNED_LABEL_TEXT, RETURNED_LABEL_FONT)
      : 0;
    return Math.max(m, nameWidth, returnedLabelWidth);
  }, 0);
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

  // An object field that's itself a string/array is placed beside the object rather
  // than below it (old code's "inline" placement) — they all share one column, wide
  // enough for the widest object, so it doesn't jump around per-object.
  let maxObjectWidth = 0;
  for (const entry of heap.values()) {
    if (entry.kind !== 'object') continue;
    const slots: StackSlot[] = entry.fields.map((f) => ({
      name: f.key,
      value: f.value,
      typeLabel: f.typeLabel,
    }));
    maxObjectWidth = Math.max(
      maxObjectWidth,
      Math.max(getFrameWidth({ name: entry.label, slots }), estimateLabelWidth(entry.label))
    );
  }
  const INLINE_CHILD_GAP = 24;
  const inlineChildX =
    heapX + (maxObjectWidth > 0 ? maxObjectWidth : HEAP_COLUMN_MIN_WIDTH) + INLINE_CHILD_GAP;

  // Matches renderHeapEntry's own label-height + half-cell math for each kind. Objects
  // never call this — they don't attempt dot-centering at all (see the top-level loop
  // below) — so there's no object case here.
  function heapEntryCenterOffsetFor(entry: HeapEntry): number {
    if (entry.kind === 'string') return HEAP_OBJECT_LABEL_HEIGHT + VAR_RECT_HEIGHT / 2;
    return 14 + VAR_RECT_HEIGHT / 2; // array
  }

  // Space an entry's own label reserves above its box (arrays use a shorter one than
  // strings/objects). A fallback gap is measured from the *previous* entry's box
  // bottom, but the next entry's own Y is its footprint top, not its box top — without
  // subtracting this back out, the label height would silently add onto the intended
  // gap, making the visible box-to-box spacing bigger than HEAP_VERTICAL_GAP.
  function heapEntryLabelHeight(entry: HeapEntry): number {
    return entry.kind === 'array' ? 14 : HEAP_OBJECT_LABEL_HEIGHT;
  }

  // Lay out each heap entry. An entry a stack dot points to directly is placed first,
  // aligned to that dot; whatever its own cells/fields point to in turn is placed right
  // after — below it in the same column for an array's elements, or beside it in the
  // shared inline column for an object's string/array fields. Below-placement is
  // clamped to the running cursor so a parent-plus-children column can't overlap an
  // earlier one; inline placement doesn't touch that cursor at all, since it shares
  // vertical space with its parent rather than stacking after it.
  const HEAP_START_Y = MARGIN + HEADER_HEIGHT; // level with the top of the first stack frame
  let heapCursorY = HEAP_START_Y;
  let inlineCursorY = HEAP_START_Y; // tracks the shared inline column separately from the main one
  let maxHeapWidth = 0; // width of entries in the main column only — used to center the HEAP title
  let heapRightEdge = heapX; // rightmost edge of anything placed, including inline children — used for canvas width so nothing clips
  let heapBottomEdge = MARGIN + HEADER_HEIGHT; // deepest bottom edge of anything placed, including inline children
  const heapSvgParts: string[] = [];
  const heapTargets = new Map<
    string,
    { left: { cx: number; cy: number }; right: { cx: number; cy: number } }
  >();
  const placedRefIds = new Set<string>();
  // Only entries sitting beside their own row (an object field) get a straight arrow —
  // nothing sits between them and their parent. Entries stacked below something in the
  // inline column (e.g. an inline array's own elements) still need the curved routing,
  // same as the main column, since a box can end up between them.
  const besideRowRefIds = new Set<string>();
  const heapInternalDots: Array<{ refId: string; cx: number; cy: number }> = [];

  function placeHeapEntry(
    refId: string,
    entry: HeapEntry,
    entryX: number,
    entryY: number,
    isInline: boolean
  ) {
    const rh = renderHeapEntry(entry, entryX, entryY);
    heapSvgParts.push(rh.svg);
    heapTargets.set(refId, { left: rh.entryTarget, right: rh.entryTargetRight });
    placedRefIds.add(refId);
    heapInternalDots.push(...rh.dotCentres);
    heapRightEdge = Math.max(heapRightEdge, entryX + rh.width);
    heapBottomEdge = Math.max(heapBottomEdge, entryY + rh.height);
    if (!isInline) {
      heapCursorY = entryY + rh.height; // raw bottom edge — no gap baked in, so the next
      // entry only gets pushed down when it would actually overlap, never just for padding.
      maxHeapWidth = Math.max(maxHeapWidth, rh.width);
    } else {
      inlineCursorY = Math.max(inlineCursorY, entryY + rh.height);
    }

    for (const { refId: childRefId, cy: childDotCy } of rh.dotCentres) {
      if (placedRefIds.has(childRefId)) continue;
      const childEntry = heap.get(childRefId);
      if (!childEntry) continue;
      const childIsRefKind = childEntry.kind === 'string' || childEntry.kind === 'array';
      if (entry.kind === 'object' && childIsRefKind) {
        // A field has its own row to itself — center exactly on it, as before.
        const childY = childDotCy - heapEntryCenterOffsetFor(childEntry);
        besideRowRefIds.add(childRefId);
        placeHeapEntry(childRefId, childEntry, inlineChildX, childY, true);
      } else if (isInline && childIsRefKind) {
        // Chained from an already-inline entry (e.g. an inline array's own elements,
        // which sit side by side at the same height and can't each center on their own
        // dot without overlapping) — stack top-to-bottom in the shared inline column
        // instead, same align-if-clear/gap-fallback rule as the main column uses.
        const childY = Math.max(
          inlineCursorY + HEAP_VERTICAL_GAP - heapEntryLabelHeight(childEntry),
          childDotCy + HEAP_VERTICAL_GAP
        );
        placeHeapEntry(childRefId, childEntry, inlineChildX, childY, true);
      } else {
        const childY = Math.max(
          heapCursorY + HEAP_VERTICAL_GAP - heapEntryLabelHeight(childEntry),
          childDotCy + HEAP_VERTICAL_GAP
        );
        placeHeapEntry(childRefId, childEntry, heapX, childY, false);
      }
    }
  }

  for (const [refId, entry] of heap) {
    if (placedRefIds.has(refId)) continue;
    const dot = allDotCentres.find((d) => d.refId === refId);
    if (!dot) continue; // only reachable through a parent entry — placed when the parent is
    let alignedY: number;
    if (entry.kind === 'object') {
      // Objects never center on their dot — doing so would shift an already-placed
      // object down every time a later stack variable adds a new dot above it, which
      // is more disorienting than useful. They just pack from the running cursor
      // instead; the very first one needs no gap before it, since the cursor already
      // starts level with the top of the stack frame.
      alignedY =
        heapCursorY === HEAP_START_Y
          ? heapCursorY
          : heapCursorY + HEAP_VERTICAL_GAP - heapEntryLabelHeight(entry);
    } else {
      // Use the exact dot-aligned position whenever it doesn't require backing up past
      // the previous entry (any amount of natural clearance is enough, even a few px —
      // alignment wins). Only when it would actually overlap does a real gap get added;
      // without this, that case would otherwise land flush against the previous entry.
      const desiredY = dot.cy - heapEntryCenterOffsetFor(entry);
      alignedY =
        desiredY >= heapCursorY
          ? desiredY
          : heapCursorY + HEAP_VERTICAL_GAP - heapEntryLabelHeight(entry);
    }
    placeHeapEntry(refId, entry, heapX, alignedY, false);
  }

  const heapColumnRight = heap.size > 0 ? heapX + maxHeapWidth : heapX;
  const dataDividerX = heapColumnRight + HEAP_LEFT_MARGIN / 2;
  const dataX = heapColumnRight + HEAP_LEFT_MARGIN;

  const canvasWidth = Math.max(
    (hasData ? dataX + HEAP_COLUMN_MIN_WIDTH : Math.max(heapColumnRight, heapRightEdge)) + MARGIN,
    260
  );
  const canvasHeight = Math.max(MIN_CANVAS_HEIGHT, Math.max(stackY, heapBottomEdge) + MARGIN);
  const framesSvg = rendered.map((rf) => rf.svg).join('\n');
  const heapEntriesSvg = heapSvgParts.join('\n');

  // Reference arrows. Stack dots have a clear shot into the left edge of their target,
  // so they stay straight lines. Dots inside a heap entry (e.g. a string array's cells)
  // target the right edge instead — reserving the left edge for stack arrows — and arc
  // out to the right so the line never has to cross through another box stacked between
  // it and its target.
  const ARROW_BULGE = 56; // clears the array's width before the curve is allowed to dip toward its target
  const ARROW_TARGET_GAP = 8; // vertical spread between multiple arrowheads sharing one target edge

  function curvedArrowPath(x1: number, y1: number, x2: number, y2: number): string {
    const c1x = x1 + ARROW_BULGE; // stays level with the source briefly, clearing what's directly below it
    const c2x = x2 + ARROW_BULGE / 2; // shorter runway into the target, just enough for a leftward entry
    return `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
  }

  type ArrowSource = {
    refId: string;
    cx: number;
    cy: number;
    side: 'left' | 'right';
    curved: boolean;
    yOffset: number;
  };
  const arrowSources: ArrowSource[] = [
    ...allDotCentres.map((d) => ({ ...d, side: 'left' as const, curved: false, yOffset: 0 })),
    ...heapInternalDots.map((d) => {
      const besideRow = besideRowRefIds.has(d.refId);
      // A beside-row child sits immediately next to its parent — nothing to cross, so a
      // straight line into the left edge is enough (no need for the curved routing).
      return {
        ...d,
        side: (besideRow ? 'left' : 'right') as 'left' | 'right',
        curved: !besideRow,
        yOffset: 0,
      };
    }),
  ];

  // When more than one arrow converges on the same target edge (e.g. two variables
  // pointing at the same string), landing on the exact same point makes them cross like
  // an X. Spread their endpoints evenly around the target's true center instead.
  const targetGroups = new Map<string, ArrowSource[]>();
  for (const s of arrowSources) {
    if (!heapTargets.has(s.refId)) continue;
    const key = `${s.refId}|${s.side}`;
    if (!targetGroups.has(key)) targetGroups.set(key, []);
    targetGroups.get(key)!.push(s);
  }
  for (const group of targetGroups.values()) {
    const start = -((group.length - 1) * ARROW_TARGET_GAP) / 2;
    group.forEach((s, i) => (s.yOffset = start + i * ARROW_TARGET_GAP));
  }

  const arrowsSvg = arrowSources
    .map((s) => {
      const target = heapTargets.get(s.refId);
      if (!target) return '';
      const endpoint = s.side === 'left' ? target.left : target.right;
      const ty = endpoint.cy + s.yOffset;
      const path = s.curved
        ? curvedArrowPath(s.cx, s.cy, endpoint.cx, ty)
        : `M ${s.cx} ${s.cy} L ${endpoint.cx} ${ty}`;
      return `<path d="${path}" fill="none" stroke="${HEAP_ARROW_COLOR}" stroke-width="1" marker-end="url(#refArrow)" />`;
    })
    .join('\n');

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

  const heapHeaderSvg = heapHasContent
    ? `<text x="${heapTitleX}" y="${headerY}" text-anchor="middle" fill="#ffffff" ${headerAttrs}>HEAP</text>
  ${divider(heapDividerX)}`
    : '';

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
  ${heapHeaderSvg}
  ${dataHeaderSvg}
  ${framesSvg}
  ${heapEntriesSvg}
  ${arrowsSvg}
</svg>`;
}

// Structurally typed rather than imported from interpreter.ts: interpreter.ts
// imports Memdia from this file, so the reverse import would be circular.
interface CallStackFrame {
  name: string;
  variables: Record<string, any>;
  returned?: boolean;
}

// Renders a memory diagram from the debugger's full call stack — one frame per
// active function/method call, in the same box-per-frame layout renderMemorySnapshotSvg
// already supports. Java's empty 'global' wrapper frame is dropped once 'main' is
// also present; a lone 'global' frame (no function ever called, or a language with
// no main-wrapper) is relabeled 'main' so a plain variables-only program still
// looks exactly like it did before methods existed. One shared heap Map across all
// frames so a reference aliased between two frames (e.g. an object passed into a
// method) still dedupes to a single heap box.
//
// Accepts either the pre-methods flat variables map (still used by every caller
// that never touches multi-frame state) or the debugger's per-frame call stack,
// so adding methods didn't require widening every pass-through prop's type —
// only the two call sites that actually track a call stack pass one.
// Shown instead of the full STACK/HEAP layout when callStack is genuinely
// empty — before any Run, or right after Debug is initialized but before its
// first Step. A real (even mostly-empty) frame always exists from the first
// step onward, so this only ever appears in that "nothing has happened yet" window.
// Blank, but sized to the same 260×MIN_CANVAS_HEIGHT baseline as a normal
// near-empty diagram, so the panel doesn't visibly shrink.
function renderPlaceholderSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="${MIN_CANVAS_HEIGHT}" viewBox="0 0 260 ${MIN_CANVAS_HEIGHT}"></svg>`;
}

export function renderMemoryDiagramFromCallStack(
  currentVariables: Record<string, any> | CallStackFrame[]
): string {
  const callStack: CallStackFrame[] = Array.isArray(currentVariables)
    ? currentVariables
    : [{ name: 'main', variables: currentVariables }];
  if (callStack.length === 0) {
    return renderPlaceholderSvg();
  }
  const heap = new Map<string, HeapEntry>();
  const nonEmpty = callStack.filter((f) => Object.keys(f.variables).length > 0);
  const shown =
    nonEmpty.length > 0
      ? nonEmpty
      : [callStack[callStack.length - 1] ?? { name: 'main', variables: {} }];

  const frames: FrameState[] = shown.map((frame) => ({
    name: frame.name === 'global' && shown.length === 1 ? 'main' : frame.name,
    returned: frame.returned,
    slots: Object.entries(frame.variables)
      .slice(0, MAX_STACK_SLOTS)
      .map(([name, value]) => ({
        name,
        value: previewValue(value, heap),
        typeLabel: inferTypeLabel(value),
      })),
  }));
  return renderMemorySnapshotSvg(frames, heap);
}
