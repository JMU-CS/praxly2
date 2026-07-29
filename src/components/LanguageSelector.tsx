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

/** Display names shared by every language picker and dialog. */
export const LANG_LABELS: Record<SupportedLang, string> = {
  ast: 'AST',
  blocks: 'Blocks',
  csp: 'CSP',
  java: 'Java',
  javascript: 'JavaScript',
  praxis: 'Praxis',
  python: 'Python',
};
