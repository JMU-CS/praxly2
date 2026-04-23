# Skill: Add a UI Feature

Guide for adding new UI features to Praxly's editor. Read `docs/COMPONENT_REFERENCE.md` for component API details.

## Architecture

```
src/
  pages/
    EditorPage.tsx       ← main IDE page; owns all editor state
    LandingPage.tsx      ← landing/home page
    EmbedPage.tsx        ← embeddable iframe version
  components/
    editor/              ← editor-specific sub-components
      EditorHeader.tsx   ← toolbar, run/debug buttons, example picker
      SourcePane.tsx     ← left source editor panel
      TranslationPaneItem.tsx ← right-side translation panels
      AddPanelStrip.tsx  ← the strip for adding new panels
      AiSidePanel.tsx    ← AI assistant side panel
      types.ts           ← shared Panel type
    LanguageSelector.tsx ← language dropdown (defines SupportedLang)
    CodeEditorPanel.tsx  ← CodeMirror wrapper used by all editors
    OutputPanel.tsx      ← program output display
    TranslationPanel.tsx ← individual translated code panel
    ResizeHandle.tsx     ← draggable resize divider
    HighlightableCodeMirror.tsx ← CodeMirror with line highlighting
  hooks/
    useCodeParsing.ts    ← parses source → AST, generates translations
    useCodeDebugger.ts   ← step-through debug state machine
  utils/
    editorUtils.ts       ← CodeMirror extensions per language
    sampleCodes.ts       ← example programs
    embedCodec.ts        ← URL encode/decode for share links
    codemirrorConfig.ts  ← CodeMirror state fields, transactions
    debugHandlers.ts     ← source map → line highlighting logic
```

## State management rules

- **No global store** — all state lives in `EditorPage.tsx` via `useState`
- **Pass down via props** — child components receive callbacks and state as props
- **Extract logic to hooks** — if state logic is complex or reused, put it in `src/hooks/`
- **React 19 / functional components only** — no class components

## Adding a new panel type or editor feature

1. If it needs new state, add `useState` in `EditorPage.tsx`
2. If it adds a new button/control to the top toolbar, edit `EditorHeader.tsx`
3. If it modifies how source code is parsed or translated, update `useCodeParsing.ts`
4. If it adds a new side panel, add it alongside `AiSidePanel.tsx` and wire its toggle in `EditorPage.tsx`
5. If it modifies how translation panels work, edit `TranslationPaneItem.tsx` or `TranslationPanel.tsx`

## Styling

- **Tailwind CSS utility classes only** — no CSS modules, no `style={{}}` blocks, no styled-components
- **Dark theme** — `bg-slate-950` background; use `slate-*`, `zinc-*`, `sky-*` for accents
- **No emojis** unless the user explicitly asks
- Match the visual style of existing components; copy patterns from nearby components

## Adding a new language to the UI

When adding a new language (frontend/UI side only — see `add-language.md` for the compiler side):

1. Add to `SupportedLang` union in `src/components/LanguageSelector.tsx`
2. Add to the `langs` array inside `LanguageSelector.tsx` (controls what appears in the dropdown)
3. Add to `PANEL_LANGS` in `src/components/editor/AddPanelStrip.tsx`
4. Add a `case` to `getCodeMirrorExtensions()` in `src/utils/editorUtils.ts`

## Adding a new example program

Edit `src/utils/sampleCodes.ts`. Each example has:

```typescript
{
  id: string; // unique kebab-case id
  title: string;
  description: string;
  category: 'fundamentals' | 'functions' | 'classes' | 'algorithms';
  lang: SupportedLang; // the source language
  code: string; // the program text
}
```

## Adding a keyboard shortcut or toolbar button

1. Add the handler in `EditorPage.tsx` or the relevant hook
2. Render the button in `EditorHeader.tsx`
3. Wire `onKeyDown` at the `EditorPage` level for keyboard shortcuts
4. Follow the existing icon/button patterns (`<button className="...">` with Tailwind)

## CodeMirror integration

`CodeEditorPanel.tsx` and `HighlightableCodeMirror.tsx` wrap CodeMirror 6. To add new editor behavior:

- Add a `StateField` or `Extension` in `src/utils/codemirrorConfig.ts`
- Pass it into the `extensions` array in `CodeEditorPanel.tsx`
- Line highlighting is done via `dispatchLineHighlighting()` and the `highlightedLinesField` state field

## Checklist

- [ ] New state added to `EditorPage.tsx` if needed
- [ ] Props threaded down to child components (or extracted to a hook if complex)
- [ ] Tailwind only — no inline styles
- [ ] No global store introduced
- [ ] `npx tsc --noEmit` — zero errors
- [ ] Feature tested in the browser at `http://localhost:5173/v2/editor`
