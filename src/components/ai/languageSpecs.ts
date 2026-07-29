import praxis from '../../../specs/praxis.md?raw';
import csp from '../../../specs/csp.md?raw';
import java from '../../../specs/java.md?raw';
import javascript from '../../../specs/javascript.md?raw';
import python from '../../../specs/python.md?raw';
import blocks from '../../../specs/blocks.md?raw';
import stdlib from '../../../specs/stdlib.md?raw';

/**
 * The authoritative language definitions (specs/) bundled into the app so they
 * stay in sync with the repo on every build. Sent with each chat request to
 * fill the Langfuse prompt's {{language_spec}} variable, so the tutor only ever
 * describes what Praxly actually supports for the selected language.
 */
const SPECS: Record<string, string> = { praxis, csp, java, javascript, python, blocks };

/**
 * Combined spec for every open language: each distinct language's spec plus the
 * shared stdlib (included once at the end). Sending all open panels' specs lets
 * the tutor answer questions that compare languages. Unknown/duplicate
 * languages are skipped; returns '' when none of the languages have a spec.
 */
export function languageSpecFor(languages: Array<string | undefined>): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const lang of languages) {
    const key = lang?.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const spec = SPECS[key];
    if (spec) parts.push(spec);
  }
  return parts.length > 0 ? `${parts.join('\n\n---\n\n')}\n\n${stdlib}` : '';
}
