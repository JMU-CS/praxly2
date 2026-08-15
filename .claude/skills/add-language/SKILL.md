---
name: add-language
description: Add a new source/target language (lexer, parser, emitter) to Praxly2 and wire it through the Universal AST, translator, and editor UI. Use when adding or removing a language, adding a target the translator can emit, or debugging why a newly added language does not appear in the pickers.
---

# Adding a language to Praxly2

Every language in Praxly2 is three files plus a handful of registrations. The
compiler work is the easy part to get right; the registrations are where people
lose time, because missing one fails silently in a different layer.

Read [`specs/`](../../../specs/) for the language you are adding **before**
writing the lexer — it is the authority on what the language accepts, and it
must be updated in the same change if you alter behavior.
[`docs/ADDING_A_LANGUAGE.md`](../../../docs/ADDING_A_LANGUAGE.md) has longer
code examples; this skill is the integration path.

## The one invariant

**Parsers may only produce node types already defined in `src/language/ast.ts`.**
There is no such thing as a language-specific AST node. If your language has a
construct the Universal AST can't express, either desugar it into existing nodes
in the parser, or add the node to the AST and update _every_ emitter,
`interpreter.ts`, `visitor.ts`, and `translator.ts` — see "Adding an AST node"
at the bottom.

## 1. Write the language module

```
src/language/<lang>/
  lexer.ts    class <Lang>Lexer  { tokenize(): Token[] }
  parser.ts   class <Lang>Parser { parse(): Program }
  emitter.ts  class <Lang>Emitter extends ASTVisitor
```

`src/language/java/` is the most complete reference. Blocks
(`src/language/blocks/`) is deliberately _not_ a model to copy — its source is
Blockly workspace JSON, so it uses `toAst.ts`/`fromAst.ts` instead of a
lexer/parser/emitter and bypasses the emitter dispatch entirely.

**Lexer**

- Import `Token` from `'../lexer'`.
- Terminate the stream with `{ type: 'EOF', value: '', start: this.pos }`.
- Match multi-character operators (`==`, `!=`, `<=`, `>=`) **before** their
  single-character prefixes, or `==` lexes as two `=`.
- Skip whitespace and comments without emitting tokens. Comments that must
  survive into translations are handled by `src/language/comments.ts`, not here.
- Python's lexer is the odd one out: it converts indentation into virtual `{}`
  and `;` tokens so the parser can treat it as brace-delimited. Copy that
  approach only if your language is indentation-sensitive.

**Parser**

- Import `generateId` from `'../ast'`. **Every node needs `id: generateId()`** —
  the debugger and source maps are keyed on it, and a missing id silently
  disables line highlighting for that construct.
- Recursive descent, lowest precedence at the top of the call tree:
  `assignment → logicalOr → logicalAnd → equality → comparison → term → factor
→ unary → postfix → primary`.
- Normalize operators to Universal AST spelling: logical operators become
  `'and'`/`'or'`/`'not'`; not-equal becomes `'!='`. Emitters translate back out.
- Use `synchronize()` to skip to the next statement after a parse error.

**Emitter**

- Extend `ASTVisitor` from `'../visitor'` and implement all 21 abstract
  `visit*` methods (`tsc` will list any you miss — that is the checklist).
- Build output with `this.emit(line, nodeId?)`, `this.indent()`, `this.dedent()`.
- Pass the node id to `emit()` for any statement you want to be debuggable; that
  is what populates the `SourceMap` the debugger highlights from.
- Use `this.escapeString(value, quote?)` for string literals so backslashes,
  quotes, and newlines re-parse instead of breaking the output across lines.
- Guard expression precedence with the `Precedence` constants from `visitor.ts`.

## 2. Register the language (6 places)

Miss one and the failure looks unrelated, so work down the list.

| #   | File                                      | Change                                                    | Symptom if missed                                              |
| --- | ----------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | `src/language/visitor.ts`                 | add to the `TargetLanguage` union                         | `tsc` error in `translator.ts`                                 |
| 2   | `src/language/translator.ts`              | import the emitter + add a `case` in `translateWithMap()` | runtime `Unsupported target language`                          |
| 3   | `src/components/LanguageSelector.tsx`     | add to `SupportedLang` **and** `LANG_LABELS`              | `tsc` error (`LANG_LABELS` is an exhaustive `Record`)          |
| 4   | `src/components/editor/SourcePane.tsx`    | add to `SOURCE_OPTIONS`                                   | language can't be picked as a _source_                         |
| 5   | `src/components/editor/AddPanelStrip.tsx` | add to `PANEL_LANGS`                                      | no icon in the left rail, can't open as a _translation panel_  |
| 6   | `src/utils/editorUtils.ts`                | add a `case` to `getCodeMirrorExtensions()`               | no syntax highlighting (falls through to `[]`, which is valid) |

`LANG_LABELS` being a `Record<SupportedLang, string>` is deliberate: adding to
the union without adding a label is a compile error, which is the one
registration you cannot forget.

Then wire parsing:

**`src/hooks/useCodeParsing.ts`** — add the import and a `case` in `parseCode()`:

```typescript
case '<lang>':
  tokens = new <Lang>Lexer(input).tokenize();
  return new <Lang>Parser(tokens).parse();
```

`getTranslation()` in the same hook routes through `Translator` and needs no
change once step 2 is done.

Two allow-lists also gate embed links, and are easy to overlook because they are
plain string arrays rather than typed unions:

- `VALID_TARGET_LANGS` in `src/hooks/useEmbedLinkImport.ts` — `?targetLang=` on
  an editor link
- `VALID_TO_LANGS` in `src/pages/EmbedPage.tsx` — `?to=` on an embed link

## 3. Syntax highlighting (optional)

CodeMirror ships grammars for Java, Python, and JavaScript. CSP and Praxis use
Lezer grammars instead:

- `src/language/<lang>/<lang>.grammar` — compiled to `.grammar.js` by the Vite
  plugin (`resolve.extensions` in `vite.config.js` lists `.grammar`)
- `src/language/<lang>/lezer.ts` — wraps the compiled grammar as an extension
- return it from `getCodeMirrorExtensions()`

Returning `[]` is fine while you get the compiler working; the pane renders as
plain text.

## 4. Demo program and tests

- Add `examples/demo.<ext>` exercising every node your parser can produce, and
  register it in `src/utils/demoPrograms.ts` (`DEMO_PROGRAMS`). See
  `examples/README.md` for the coverage policy. `tests/round-trip.test.ts` picks
  it up and translates it to every target, asserting output equivalence — this
  is the strongest signal that your emitter is faithful.
- Add `tests/<lang>.test.ts`. See the **add-tests** skill.
- Optionally add entries to `EXAMPLE_PROGRAMS` in `src/utils/sampleCodes.ts`
  (note its `ExampleLanguage` type is narrower than `SupportedLang` — text
  languages only).

## Adding an AST node

Only if the Universal AST genuinely can't express the construct. Update, in
order, and let `tsc` drive you:

1. `src/language/ast.ts` — the node type
2. `src/language/visitor.ts` — `abstract visitX()` + the dispatch `case`
3. every emitter under `src/language/*/emitter.ts` (5 of them)
4. `src/language/interpreter.ts` — execution
5. `src/language/translator.ts` — recurse into the body in `analyzeBlock`, or
   type inference silently skips anything nested inside your node
6. `src/language/blocks/fromAst.ts` + `toAst.ts` if it should be representable
   as a block

## Verify

```bash
npx tsc --noEmit      # exhaustive-switch errors are your checklist
npm run test:run      # unit + round-trip
npm run test-browser  # Selenium csv/ suite — needs Chrome; not part of test:run
```

Do **not** edit `csv/praxly.test.csv`; it is the original regression corpus.

## Checklist

- [ ] `lexer.ts` — operators longest-match-first, ends with `EOF`
- [ ] `parser.ts` — correct precedence, `generateId()` on every node
- [ ] `emitter.ts` — all 21 `visit*` implemented, `emit(line, nodeId)` for statements
- [ ] `TargetLanguage` + `translator.ts` case
- [ ] `SupportedLang` + `LANG_LABELS`
- [ ] `SOURCE_OPTIONS` + `PANEL_LANGS`
- [ ] `getCodeMirrorExtensions()` case
- [ ] `useCodeParsing.ts` case
- [ ] `VALID_TARGET_LANGS` + `VALID_TO_LANGS` if embed links should carry it
- [ ] `examples/demo.<ext>` + `DEMO_PROGRAMS`
- [ ] `tests/<lang>.test.ts`
- [ ] `specs/<lang>.md` written or updated
- [ ] `tsc`, `test:run`, `test-browser` all green
