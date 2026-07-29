/**
 * Deciding what happens to the user's program when they change the source
 * language: translate it if the result is usable, otherwise say so and let the
 * caller ask before discarding it.
 */

import type { Program } from '../language/ast';
import type { SupportedLang } from '../components/LanguageSelector';
import type { SourceMap } from '../hooks/useCodeParsing';

type ParseCode = (lang: SupportedLang, input: string) => Program | null;
type GetTranslation = (
  ast: Program | null,
  lang: SupportedLang
) => { code: string; sourceMap: SourceMap };

/** What to do with the editor's contents when switching to another language. */
export type LanguageSwitchPlan =
  /** Nothing worth keeping — open an empty program in the new language. */
  | { kind: 'empty' }
  /** The program survived the round trip; open this text instead. */
  | { kind: 'translated'; code: string }
  /** No working translation exists — confirm before discarding the program. */
  | { kind: 'untranslatable' };

/** Emitters signal an unavailable translation with these comment prefixes. */
const FAILURE_PREFIXES = ['// Translation to', '// Valid source code required'];

export function planLanguageSwitch(
  code: string,
  from: SupportedLang,
  to: SupportedLang,
  parseCode: ParseCode,
  getTranslation: GetTranslation
): LanguageSwitchPlan {
  try {
    const sourceForTranslation = from === 'ast' ? 'python' : from;
    // An empty program — blank text, or e.g. a Blocks workspace whose JSON
    // holds no blocks — has nothing to translate; switch straight away.
    const parsed = code.trim() ? parseCode(sourceForTranslation, code) : null;
    if (!parsed || parsed.body.length === 0) return { kind: 'empty' };

    const translated = getTranslation(parsed, to).code;
    if (!translated?.trim() || FAILURE_PREFIXES.some((p) => translated.startsWith(p))) {
      return { kind: 'untranslatable' };
    }

    // A translation that the target's own parser rejects is no use either.
    try {
      parseCode(to, translated);
    } catch {
      return { kind: 'untranslatable' };
    }

    return { kind: 'translated', code: translated };
  } catch {
    // The current source doesn't parse, so it can't be translated either.
    return { kind: 'untranslatable' };
  }
}
