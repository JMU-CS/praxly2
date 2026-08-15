---
name: add-ui-feature
description: Add or change UI in the Praxly2 editor, embed player, or account page — panes, toolbar controls, side panels, dialogs, keyboard shortcuts, layout and resize behavior, and example programs. Use when deciding which hook or component owns a piece of state, or where a new control belongs.
---

# Adding a UI feature to Praxly2

The three pages are **composition only**. Behavior lives in hooks; layout lives
in components. Before adding state to a page, find the hook that already owns
that concern — nearly always there is one.

## Where things live

```
src/pages/
  EditorPage.tsx    ~390 lines — wires hooks to panes, owns only code/sourceLang/toggles
  EmbedPage.tsx     ~165 lines — layout switch (?to= present or not)
  AccountPage.tsx   ~ 70 lines — nav + section switch

src/hooks/            ← behavior
  useCodeParsing        source text → AST, AST → translation (+ source map)
  useCodeDebugger       step-through state machine
  useProgramRunner      plain (non-debug) run that can pause on input() and resume
  useEditorExecution    editor: parse-on-type, run, debug, console, pane highlighting
  useEmbedExecution     embed: the same, minus panels
  useEditorLayout       pane widths/heights, the width budget, every resize drag
  useTranslationPanels  which panels are open, columns/stacking, drag-and-drop
  useMemDiaPanes        per-pane memory-diagram height + open/closed
  useEditorSession      localStorage persistence (code, lang, open panels, toggles)
  useEditorMenus        header dropdowns + click-outside
  useEditorShortcuts    F5 / Shift+F5 / F10
  useAiSelection        highlight-to-chat selection + button coords
  useOpenCodeBridge     "Open in editor" from an AI chat code block
  useEmbedLinkImport    ?code= / ?targetLang= on an editor link
  useEmbedData          ?code= (v2) and #code= (v1) on an embed link
  usePanelSourceMaps    refresh panel source maps when the AST changes
  useHighlightedEditor  CodeMirror view ref + debug line highlighting
  useTextSize           Settings → text size
  useDragWidth          single-divider width drag (embed)
  useAccountData        account profile/usage/chats + status banner

src/components/
  editor/    SourcePane, TranslationPaneItem, TranslationPanelGrid, AddPanelStrip,
             AiSidePanel, EditorHeader, EditorDialogs, AskAiButton, MemDia,
             BlocklyPane(+Lazy), layoutConstants.ts, types.ts
  embed/     EmbedSourcePane, EmbedTranslationPane, EmbedOutput, EmbedActions,
             StdinPrompt, EmbedErrorScreen
  account/   AccountHeader, AccountNav, SignedOutCard, StatusBanner, Avatar,
             HomeSection, PersonalSection, SecuritySection, AiSettingsSection,
             ProfileSection, DataSection, UsageCard, ChatHistoryCard, styles.ts
  ai/        ChatThread, HistoryPanel, Markdown, ApiKeyGate, byok.ts
  OutputPanel, HighlightableCodeMirror, JSONTree, VariableFrames,
  ConfirmModal, ResizeHandle, LanguageLogo, LanguageSelector

src/utils/   panelLayout, languageSwitch, aiPanelContext, debugHandlers,
             editorUtils, codemirrorConfig, embedCodec, sampleCodes, demoPrograms
```

Despite its name, `LanguageSelector.tsx` exports **no component** — only the
`SupportedLang` type and `LANG_LABELS`. The live language pickers are
`SOURCE_OPTIONS` in `SourcePane.tsx` and `PANEL_LANGS` in `AddPanelStrip.tsx`.

## State rules

- **No global store for editor state.** Zustand (`src/store/appStore.ts`) is used
  only for chat sessions, AI prefs, BYOK settings, and the editor bridge — not
  for the program, panels, or layout.
- **Behavior goes in a hook, not the page.** If you are about to add a
  `useState` to `EditorPage.tsx`, first check whether an existing hook owns that
  concern. The page holds only `code`, `sourceLang`, the two panel toggles, the
  pending-dialog flags, and `embedCopied`.
- **Pure transforms go in `src/utils/`**, not in a hook — that is what makes
  them testable without a DOM (`panelLayout.ts` is the model).
- Hooks return an object; the page spreads it into panes as props.

### Which hook owns what

| You want to…                                           | Touch                                                                |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| change how code runs or what the console shows         | `useEditorExecution` / `useEmbedExecution`                           |
| change run-with-`input()` behavior in **both** pages   | `useProgramRunner`                                                   |
| change pane sizing, resize limits, or the width budget | `useEditorLayout` + `components/editor/layoutConstants.ts`           |
| add/remove/rearrange translation panels                | `useTranslationPanels` (+ `utils/panelLayout.ts` for the pure rules) |
| change what survives a reload                          | `useEditorSession`                                                   |
| add a keyboard shortcut                                | `useEditorShortcuts`                                                 |
| add a header dropdown                                  | `useEditorMenus` + `EditorHeader`                                    |

## Common tasks

**Toolbar button** — render it in `EditorHeader.tsx`, pass a handler prop from
`EditorPage`. If it mutates program state, the handler should call into
`useEditorExecution` (`run`, `debugStart`, `clearConsole`, `stopSession`) rather
than reimplementing the reset.

**Keyboard shortcut** — add it to `useEditorShortcuts`. It reads handlers through
a ref so the `document` listener registers once and never goes stale; follow that
pattern instead of adding a second listener.

**New side panel** — model it on `AiSidePanel`: render it conditionally in
`EditorPage`'s `<main>`, add a toggle to `AddPanelStrip`, and if it takes
horizontal space, add its width to the reserved budget in `useEditorLayout`
(`getContentAvailableWidth` / `getMaxSourceWidth`) so the pane row still fills
exactly.

**Confirmation dialog** — add the pending state to `EditorPage`, render through
`EditorDialogs.tsx`, and use `ConfirmModal`. All three existing dialogs follow
the same "pending value is non-null while the dialog is open" shape.

**New pane content** — `TranslationPaneItem` renders three ways (`ast` → `JSONTree`,
`blocks` → `BlocklyPaneLazy`, otherwise `HighlightableCodeMirror`). Extend that
switch; `TranslationPanelGrid` handles columns, stacking, and the elastic last
column and should not need changes.

**Layout / resize** — all pixel budgets are in
`components/editor/layoutConstants.ts`. The invariant to preserve: the row's
width is `viewport − ADD_STRIP_WIDTH − (AI panel if open)`, split between the
source pane and root panels, with the **last column elastic** so a drag can never
expose bare background.

**Example program** — add to `EXAMPLE_PROGRAMS` in `src/utils/sampleCodes.ts`:

```typescript
{
  id: string; // unique kebab-case
  title: string;
  description: string;
  category: 'fundamentals' | 'conditionals' | 'loops' | 'functions';
  lang: ExampleLanguage; // text languages only — no 'blocks'/'ast'
  code: string;
}
```

Per-language _demos_ are different: they come from `examples/demo.*` via
`src/utils/demoPrograms.ts` and are covered by the round-trip tests.

**CodeMirror behavior** — add a `StateField`/`Extension` in
`src/utils/codemirrorConfig.ts`, then include it where the pane builds its
extensions (`sourceExtensions` in `EditorPage`, `HighlightableCodeMirror` for
read-only panes). Debug highlighting already works via `highlightedLinesField` +
`dispatchLineHighlighting`; reuse `useHighlightedEditor` rather than wiring a new
view ref.

**Adding a language to the UI** — see the **add-language** skill; the UI half is
`SupportedLang` + `LANG_LABELS`, `SOURCE_OPTIONS`, `PANEL_LANGS`, and
`getCodeMirrorExtensions()`.

## Styling

- Tailwind utility classes only — no CSS modules, no styled-components, no
  `style={{}}` except for computed geometry (pane widths, drag offsets, absolute
  positions).
- Dark theme: `bg-slate-950` page, `slate-900` chrome, `indigo-*` accents,
  `emerald-*` for memory diagrams, `red-*` for errors.
- Copy the focus-ring constant used in neighbouring components
  (`focus-visible:ring-2 focus-visible:ring-indigo-400 …`) rather than inventing
  one.
- Editor text size comes from the `--praxly-font-size` CSS variable
  (`useTextSize`); Blockly panes take the numeric px value as a prop.
- No emojis unless explicitly asked.

## Accessibility

The existing panes set these consistently — match them:
`aria-label` on icon-only buttons, `aria-expanded`/`aria-haspopup` +
`role="listbox"`/`role="option"` on dropdowns, `aria-pressed` on toggles,
`aria-live="polite"` on output, and `aria-hidden` on decorative icons and resize
handles.

## Verify

```bash
npx tsc --noEmit   # strict, with noUnusedLocals/noUnusedParameters
npm run test:run
npm run dev        # http://localhost:5173/v2/editor
```

There is no DOM test environment, so UI changes are verified in a browser — use
the **verify** skill to drive Chrome via Selenium. Extract anything worth
asserting into `src/utils/` so it can be unit-tested without rendering.

## Checklist

- [ ] Behavior landed in a hook (or an existing one), not inline in the page
- [ ] Pure logic extracted to `src/utils/` where it could be unit-tested
- [ ] No new global store for editor state
- [ ] Tailwind only; matches the dark theme and neighbouring focus rings
- [ ] ARIA attributes match the surrounding components
- [ ] If it consumes width: added to the `useEditorLayout` budget
- [ ] `npx tsc --noEmit` clean
- [ ] Driven in a real browser
