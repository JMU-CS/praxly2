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
    const renderFrames: FrameState[] = this.frames.map((frame) => ({
      name: frame.name,
      slots: frame.slots.slice(0, MAX_STACK_SLOTS).map((slot) => ({
        name: slot.name,
        value: { text: formatPrimitive(slot.value) },
        typeLabel: slot.typeLabel,
      })),
    }));
    return renderMemorySnapshotSvg(renderFrames);
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

// Render-ready shapes: distinct from MemdiaFrame/MemdiaSlot above, which hold raw
// interpreter values. toSvg() converts MemdiaFrame[] into FrameState[] with each
// slot's value already formatted as SVG-ready display text.
interface SlotValue {
  text: string;
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

// Total box height for a frame: fits all its slots, or a fixed minimum when empty.
function getFrameHeight(frame: FrameState): number {
  if (frame.slots.length === 0) return FUNC_MIN_HEIGHT;
  const hasTypeLabels = frame.slots.some((s) => s.typeLabel);
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
}

// Draws one frame box: its name label plus one row per slot (type, name, value).
function renderFrame(frame: FrameState, x: number, y: number): RenderedFrame {
  const height = getFrameHeight(frame);
  const width = getFrameWidth(frame);
  const titleX = x - 14;
  const titleY = y + height / 2;

  const hasTypeLabels = frame.slots.some((s) => s.typeLabel);
  const slotRowOffset = FUNC_INNER_PADDING + (hasTypeLabels ? FRAME_SLOT_TOP_PADDING : 0);
  const maxNameWidth = frame.slots.reduce(
    (m, s) => Math.max(m, s.name.length * NAME_CHAR_WIDTH),
    0
  );

  const slotsSvg = frame.slots
    .map((slot, index) => {
      const rowY = y + slotRowOffset + index * (VAR_RECT_HEIGHT + VAR_VERTICAL_GAP);
      const centerY = rowY + VAR_RECT_HEIGHT / 2;
      const rectW = getRectWidthForValue(slot.value.text);
      const rectX = x + FUNC_INNER_PADDING + maxNameWidth + NAME_BOX_GAP;
      const valueCX = rectX + rectW / 2;
      const nameX = rectX - NAME_BOX_GAP;
      const typeLabelY = Math.max(y + 10, rowY - 4);

      return `
    <g>
      <text x="${rectX}" y="${typeLabelY}" dominant-baseline="auto" fill="#aaaaaa" font-size="10" font-family="Georgia, serif">${escapeXml(slot.typeLabel ?? 'var')}</text>
      <text x="${nameX}" y="${centerY}" dominant-baseline="middle" text-anchor="end" fill="#ffffff" font-size="12" font-family="ui-monospace, SFMono-Regular, Consolas, monospace">${escapeXml(slot.name)}</text>
      <rect x="${rectX}" y="${rowY}" width="${rectW}" height="${VAR_RECT_HEIGHT}" fill="none" stroke="#ffffff" stroke-width="1" />
      <text x="${valueCX}" y="${centerY}" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="12" font-family="ui-sans-serif, system-ui">${escapeXml(slot.value.text)}</text>
    </g>`;
    })
    .join('\n');

  const svg = `
  <g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#ffffff" stroke-width="1" />
    <text x="${titleX}" y="${titleY}" dominant-baseline="middle" text-anchor="end" fill="#ffffff" font-size="12" font-family="Georgia, serif">${escapeXml(frame.name)}</text>
    ${slotsSvg}
  </g>`;

  return { svg, height, width };
}

// Lays out every frame in a vertical stack, an always-visible HEAP column beside it
// (empty until heap/reference support returns), and — only when the caller actually
// has some — a DATA column (the old file's "static" column, renamed per your note)
// to the right of HEAP. Everything is wrapped in one self-contained <svg> document.
function renderMemorySnapshotSvg(frames: FrameState[], hasData: boolean = false): string {
  const maxNameWidth = frames.reduce((m, f) => Math.max(m, f.name.length * NAME_CHAR_WIDTH), 0);
  const stackX = Math.max(MARGIN + FUNC_NAME_DISTANCE, maxNameWidth + 18);

  let stackY = MARGIN + HEADER_HEIGHT;
  let maxStackWidth = 0;
  const rendered: RenderedFrame[] = [];
  for (const frame of frames) {
    const rf = renderFrame(frame, stackX, stackY);
    rendered.push(rf);
    stackY += rf.height + MARGIN;
    maxStackWidth = Math.max(maxStackWidth, rf.width);
  }

  const stackColumnRight = stackX + maxStackWidth;
  const heapDividerX = stackColumnRight + HEAP_LEFT_MARGIN / 2;
  const heapX = stackColumnRight + HEAP_LEFT_MARGIN;
  const heapColumnRight = heapX + HEAP_COLUMN_MIN_WIDTH;
  const dataDividerX = heapColumnRight + HEAP_LEFT_MARGIN / 2;
  const dataX = heapColumnRight + HEAP_LEFT_MARGIN;

  const canvasWidth = Math.max(
    (hasData ? dataX + HEAP_COLUMN_MIN_WIDTH : heapColumnRight) + MARGIN,
    260
  );
  const canvasHeight = Math.max(MIN_CANVAS_HEIGHT, stackY + MARGIN);
  const framesSvg = rendered.map((rf) => rf.svg).join('\n');

  const headerY = MARGIN + 8; // raised up a bit for more gap above the boxes below
  const dividerBottom = canvasHeight - MARGIN / 2;
  // Bold + underlined to match the column headers in the original design.
  const headerAttrs =
    'font-weight="bold" text-decoration="underline" font-size="12" font-family="ui-sans-serif, system-ui" letter-spacing="1"';
  const divider = (x: number) =>
    `<line x1="${x}" y1="${MARGIN}" x2="${x}" y2="${dividerBottom}" stroke="#ffffff" stroke-width="1" stroke-dasharray="4,4" />`;

  // Before anything has run, every column's title sits the same fixed distance from
  // its divider (COLUMN_TITLE_GAP) for a clean, symmetric empty state. Once a column
  // actually has content, its title re-centers over that content's real width instead.
  // Only STACK can have content in this trimmed renderer today — HEAP/DATA stay on
  // the fixed gap until heap/array/object rendering exists, at which point they get
  // the same has-content check STACK uses here.
  const stackHasContent = frames.some((f) => f.slots.length > 0);
  const stackTitleX = stackHasContent
    ? stackX + maxStackWidth / 2
    : heapDividerX - COLUMN_TITLE_GAP;

  const dataHeaderSvg = hasData
    ? `<text x="${dataDividerX + COLUMN_TITLE_GAP}" y="${headerY}" text-anchor="middle" fill="#ffffff" ${headerAttrs}>DATA</text>
  ${divider(dataDividerX)}`
    : '';

  // No background rect here on purpose — the SVG stays transparent so the MemDia
  // panel's own navy background (MemDia.tsx's bg-slate-900/80) shows through instead
  // of clashing with a separately-colored box.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <text x="${stackTitleX}" y="${headerY}" text-anchor="middle" fill="#ffffff" ${headerAttrs}>STACK</text>
  <text x="${heapDividerX + COLUMN_TITLE_GAP}" y="${headerY}" text-anchor="middle" fill="#ffffff" ${headerAttrs}>HEAP</text>
  ${divider(heapDividerX)}
  ${dataHeaderSvg}
  ${framesSvg}
</svg>`;
}

// Renders a memory diagram directly from a flat variable dict (e.g. the debugger's
// currentVariables), for callers with no Memdia instance wired up — MemDia.tsx uses
// this to show a live diagram from data it already receives.
export function renderMemoryDiagramFromVariables(currentVariables: Record<string, any>): string {
  const slots: StackSlot[] = Object.entries(currentVariables)
    .slice(0, MAX_STACK_SLOTS)
    .map(([name, value]) => ({
      name,
      value: { text: formatPrimitive(value) },
      typeLabel: inferTypeLabel(value),
    }));
  return renderMemorySnapshotSvg([{ name: 'main', slots }]);
}
