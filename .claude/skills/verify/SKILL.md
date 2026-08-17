---
name: verify
description: Build, launch, and drive Praxly2 in a real browser to verify changes end-to-end.
---

# Verifying Praxly2 changes

## Launch

```bash
npm run dev -- --port 5199   # serves http://localhost:5199/v2/
```

The app is a pure-frontend Vite SPA. Keycloak init runs against a remote
server but the app renders regardless (`finally` in `src/main.tsx`);
without a login the AI panel shows a sign-in prompt — that's expected.

## Drive it (selenium)

`selenium-webdriver` is a devDependency; there is deliberately **no
`chromedriver` package**. Selenium Manager (built into selenium-webdriver)
downloads a chromedriver matching whatever Chrome is installed and caches it
under `~/.cache/selenium`, so nothing needs re-pinning when Chrome updates.
Don't reintroduce the `chromedriver` npm package — `npm run` puts
`node_modules/.bin` on `PATH`, so a pinned driver shadows Selenium Manager and
breaks on the next Chrome release. Run scripts from the repo root so
`require('selenium-webdriver')` resolves.

Gotchas learned the hard way:

- Use `/v2/editor?...` for query params. `/v2/` redirects to `/v2/editor`
  with `replace` and **drops the query string**.
- Seed the editor via the embed codec instead of typing:
  `LZ.compressToEncodedURIComponent(JSON.stringify({ code, lang }))`
  (`lz-string` is in node_modules) → `?code=<encoded>&targetLang=<lang>`
  opens the editor with that source and a translation panel.
- CodeMirror: click `.cm-content`, then send keys.
- Blockly panes: workspace is `.blocklySvg`; count blocks with
  `.blocklySvg g[data-id]`; toolbox rows are `.blocklyToolboxCategory`
  (click via a dispatched `pointerdown` — a plain selenium click gets
  intercepted by the category row div); flyout blocks are
  `.blocklyFlyout g[data-id]`.
- AI panel root is the div with class `z-[140]`; the add-panel strip is
  `.add-panel-dropdown`. Both have a `cursor-col-resize` handle child
  that resizes the AI panel (drag with Actions API and compare
  `getRect().width`).
- Run button: `//button[contains(., 'Run')]`; console output text is
  readable from `main`'s text.
- Blockly's own dialogs are custom Praxly modals: `.fixed.z-\[400\]` overlay
  with an `input` inside. After creating a variable, Blockly closes the
  flyout — re-open the category before counting/dragging its blocks.
- The Settings → text size control is `input[type='range']` inside the
  settings dropdown; drive it with arrow keys. Block text size should track
  it (theme is rebuilt per size — see the theme-name note in
  `src/language/blocks/blockDefs.ts`: Blockly caches injected CSS by theme
  name, so a same-name theme swap never updates fonts).

## Flows worth driving

1. Load python via embed URL with `targetLang=blocks` → blocks panel
   renders; type in the source → block count changes (realtime).
2. Source-language dropdown (`.source-lang-dropdown button`) → switch to
   Blocks → toolbox + editable workspace appear; press Run → console
   output proves blocks JSON → AST → interpreter.
3. AI panel (bot button `button[title='Open AI Assistant']`): both
   resize handles, header icons, auto-created chat (needs auth for the
   chat itself).
4. `/v2/account` — dark slate/indigo theme, matches editor.
