# Skill: Add a New Language

Complete checklist for adding a new source/target language (e.g., JavaScript, C++, Go) to Praxly.

Read `.github/CLAUDE.md` and `docs/ADDING_A_LANGUAGE.md` before starting — they have code examples. This file is the integration checklist; those files have the implementation detail.

## 1. Create the language module

```
src/language/<lang>/
  lexer.ts    — class <Lang>Lexer { tokenize(): Token[] }
  parser.ts   — class <Lang>Parser { parse(): Program }
  emitter.ts  — class <Lang>Emitter extends ASTVisitor { ... }
```

Copy an existing language as a starting point. `src/language/java/` is the most complete example.

### Lexer requirements

- Import `Token` from `'../lexer'`
- End token stream with `{ type: 'EOF', value: '', start: this.pos }`
- Match multi-character operators (`==`, `!=`, `<=`, `>=`) **before** single-character ones
- Skip whitespace and comments (don't emit tokens for them)

### Parser requirements

- Import `generateId` from `'../ast'` — every AST node needs `id: generateId()`
- Recursive descent: lower-precedence rules call higher-precedence rules
- Precedence order (low → high): assignment → logicalOr → logicalAnd → equality → comparison → term → factor → unary → postfix → primary
- Normalize operators to Universal AST conventions: logical ops become `'and'`/`'or'`/`'not'`, not-equal becomes `'!='`

### Emitter requirements

- Extend `ASTVisitor` from `'../visitor'`
- Implement `visitRepeatUntil` — it's abstract in `ASTVisitor`
- Use `this.emit(line, nodeId?)`, `this.indent()`, `this.dedent()` for output
- `generateExpression(expr, minPrecedence)` — use `Precedence` constants from `visitor.ts`
- Call `this.recordSourceMap(nodeId, lineNumber)` for statements you want debuggable

## 2. Register in `src/language/visitor.ts`

Add your language to `TargetLanguage`:

```typescript
// Before
export type TargetLanguage = 'java' | 'python' | 'csp' | 'praxis';
// After
export type TargetLanguage = 'java' | 'python' | 'csp' | 'praxis' | '<lang>';
```

## 3. Register in `src/language/translator.ts`

```typescript
// Add import
import { <Lang>Emitter } from './<lang>/emitter';

// Add case in translateWithMap()
case '<lang>': emitter = new <Lang>Emitter(context); break;
```

## 4. Wire into the UI parsing hook

**`src/hooks/useCodeParsing.ts`**

```typescript
import { <Lang>Lexer } from '../language/<lang>/lexer';
import { <Lang>Parser } from '../language/<lang>/parser';

// In parseCode() switch:
case '<lang>':
  tokens = new <Lang>Lexer(input).tokenize();
  return new <Lang>Parser(tokens).parse();
```

## 5. Wire into the UI type system (4 places)

**`src/components/LanguageSelector.tsx`** — `SupportedLang` union type + add to the `langs` array in the component

**`src/components/editor/AddPanelStrip.tsx`** — add to `PANEL_LANGS` array

**`src/utils/editorUtils.ts`** — add a `case '<lang>':` to `getCodeMirrorExtensions()` (return `[]` if no CodeMirror extension exists, or install `@codemirror/lang-<lang>`)

**`src/hooks/useCodeParsing.ts`** — also handles `getTranslation()` which already routes through `Translator` — no change needed there beyond the import/case above

## 6. (Optional) Syntax highlighting

If a Lezer grammar is needed for CSP/Praxis-style custom highlighting:

- Create `src/language/<lang>/<lang>.grammar`
- Create `src/language/<lang>/lezer.ts` that imports the compiled `.grammar.js`
- Return the Lezer extension from `getCodeMirrorExtensions()`

## 7. Write tests

See `.github/skills/add-tests.md`. Minimum: lexer tokenization, parser AST shape, round-trip translation to at least one other language.

## Checklist

- [ ] `src/language/<lang>/lexer.ts` — handles all operators, keywords, strings, comments; ends with EOF
- [ ] `src/language/<lang>/parser.ts` — correct precedence; all nodes use `generateId()`
- [ ] `src/language/<lang>/emitter.ts` — implements all `abstract visit*` methods from `ASTVisitor`
- [ ] `src/language/visitor.ts` — `TargetLanguage` union updated
- [ ] `src/language/translator.ts` — import + switch case added
- [ ] `src/hooks/useCodeParsing.ts` — import + switch case added
- [ ] `src/components/LanguageSelector.tsx` — `SupportedLang` union + `langs` array updated
- [ ] `src/components/editor/AddPanelStrip.tsx` — `PANEL_LANGS` updated
- [ ] `src/utils/editorUtils.ts` — `getCodeMirrorExtensions()` case added
- [ ] `tests/<lang>.test.ts` — lexer, parser, and integration tests written
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm test` — all tests pass
