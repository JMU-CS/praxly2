/**
 * The set of languages the editor knows about, and their display names.
 *
 * This is the single source of truth for `SupportedLang` — every pane, hook,
 * and translation dispatch is typed against it. Note that `ast` and `blocks`
 * are *view* languages: both are valid panel targets, but neither is a text
 * source with a lexer/parser pair (Blocks' "source" is Blockly workspace JSON,
 * and `ast` is a read-only rendering of the parse tree).
 *
 * The pickers that render these live with their panes:
 *   - `SOURCE_OPTIONS` in `editor/SourcePane.tsx`    — source-language dropdown
 *   - `PANEL_LANGS`    in `editor/AddPanelStrip.tsx` — translation panel rail
 */

export type SupportedLang = 'python' | 'java' | 'csp' | 'praxis' | 'javascript' | 'blocks' | 'ast';

/**
 * Display names shared by every language picker and dialog.
 *
 * `ast` reads as "Parse Tree" in the UI: teachers and students recognize that,
 * where the acronym is opaque to anyone who hasn't taken a compilers course.
 * Spots with room for it spell out "Parse Tree (AST)" so the real term is still
 * discoverable.
 */
export const LANG_LABELS: Record<SupportedLang, string> = {
  ast: 'Parse Tree',
  blocks: 'Blocks',
  csp: 'CSP',
  java: 'Java',
  javascript: 'JavaScript',
  praxis: 'Praxis',
  python: 'Python',
};
