/**
 * Guards the UI colour contrast floor.
 *
 * Sibling of text-size.test.ts, and the same shape: the value lives in the
 * `@theme` block in src/index.css, and this test keeps the call sites from
 * routing around it.
 *
 * Muted text used to be `text-slate-500`, which fails WCAG AA (4.5:1 for
 * normal-weight body text) on every surface this app paints: 4.23:1 on
 * slate-950, 3.74:1 on slate-900, 3.07:1 on slate-800. `text-slate-600` is
 * worse still. Both are banned; use `text-muted`, whose ratios are asserted
 * below against the three slate surfaces that host body text.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', 'src');

/** WCAG 2.1 AA, success criterion 1.4.3, normal-weight text. */
const MIN_RATIO = 4.5;

/**
 * Slate steps that appear as a text background, and the class that must clear
 * MIN_RATIO on each. slate-700 is deliberately absent: it backs buttons and
 * hovered menu rows only, which use slate-200/white.
 */
const SURFACES = ['slate-950', 'slate-900', 'slate-800'] as const;

/** Slate steps too dark to carry body text on any of SURFACES. */
const BANNED = ['text-slate-500', 'text-slate-600', 'placeholder-slate-500'];

/**
 * Blanks out comment bodies, keeping every newline so line numbers still line
 * up. The rationale comments in index.css name the banned classes, and the
 * scan would otherwise flag its own explanation.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (c) => ' '.repeat(c.length));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [path] : [];
  });
}

/** oklch(L C H) → linear-light sRGB, unclamped. */
function oklchToLinearRgb(L: number, C: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** WCAG relative luminance of an `oklch(L% C H)` string. */
function luminance(oklch: string): number {
  const m = oklch.match(/oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/);
  if (!m) throw new Error(`not an oklch() colour: ${oklch}`);

  const [r, g, b] = oklchToLinearRgb(Number(m[1]) / 100, Number(m[2]), Number(m[3])).map((c) =>
    Math.min(1, Math.max(0, c))
  );
  // Already linear-light, so the sRGB→linear step of the WCAG formula is a no-op.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Every `--color-*` / `--text-*` custom property Tailwind and index.css define. */
function palette(): Record<string, string> {
  const files = [
    join(SRC, 'index.css'),
    join(SRC, '..', 'node_modules', 'tailwindcss', 'theme.css'),
  ];
  const out: Record<string, string> = {};
  for (const file of files) {
    for (const [, name, value] of readFileSync(file, 'utf8').matchAll(
      /--color-([\w-]+):\s*(oklch\([^)]*\));/g
    )) {
      // index.css comes first and wins — a local @theme overrides Tailwind's.
      out[name] ??= value;
    }
  }
  return out;
}

describe('UI colour contrast', () => {
  it('uses no slate step too dark for body text', () => {
    const offenders: string[] = [];
    const pattern = new RegExp(`\\b(${BANNED.join('|')})\\b`, 'g');

    for (const file of sourceFiles(SRC)) {
      stripComments(readFileSync(file, 'utf8'))
        .split('\n')
        .forEach((line, i) => {
          for (const [cls] of line.matchAll(pattern)) {
            offenders.push(`${file.slice(SRC.length + 1)}:${i + 1}  ${cls}`);
          }
        });
    }

    expect(
      offenders,
      `Use text-muted (or a lighter slate) — these fail WCAG AA on our surfaces:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  it(`keeps --color-muted at ${MIN_RATIO}:1 or better on every text surface`, () => {
    const colors = palette();
    expect(colors.muted, 'index.css must define --color-muted in its @theme block').toBeDefined();

    for (const surface of SURFACES) {
      expect(
        contrast(colors.muted, colors[surface]),
        `--color-muted on bg-${surface}`
      ).toBeGreaterThanOrEqual(MIN_RATIO);
    }
  });

  it('sanity-checks the contrast maths against a known Tailwind pair', () => {
    const colors = palette();
    // Axe DevTools reports slate-500 on slate-900 as 3.74:1.
    expect(contrast(colors['slate-500'], colors['slate-900'])).toBeCloseTo(3.74, 1);
  });
});
