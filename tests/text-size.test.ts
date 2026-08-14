/**
 * Guards the UI type-size floor.
 *
 * The scale itself lives in the `@theme` block in src/index.css, so raising or
 * lowering a step is a one-line change there. Arbitrary bracket sizes
 * (`text-[10px]`) bypass those variables entirely, which is how the UI ended up
 * with 9–13px text scattered across 36 call sites. This test keeps them out.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', 'src');

/** Smallest px value any UI text may render at. */
const MIN_PX = 13;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [path] : [];
  });
}

describe('UI type scale', () => {
  it(`has no Tailwind arbitrary font size below ${MIN_PX}px`, () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const [, px] of line.matchAll(/\btext-\[(\d+)px\]/g)) {
            if (Number(px) < MIN_PX) {
              offenders.push(`${file.slice(SRC.length + 1)}:${i + 1}  text-[${px}px]`);
            }
          }
        });
    }

    expect(
      offenders,
      `Use a scale token (text-xs is ${MIN_PX}px) instead of an arbitrary size:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  it(`keeps the smallest scale token at ${MIN_PX}px`, () => {
    const css = readFileSync(join(SRC, 'index.css'), 'utf8');
    const match = css.match(/--text-xs:\s*([\d.]+)rem/);

    expect(match, 'index.css must define --text-xs in its @theme block').not.toBeNull();
    expect(Number(match![1]) * 16).toBeGreaterThanOrEqual(MIN_PX);
  });
});
