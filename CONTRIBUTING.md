# Contributing to Praxly2

Thanks for your interest in improving Praxly2.

## Project Scope

Praxly2 is a browser-based educational compiler/translator for Python, Java, CSP pseudocode, and Praxis pseudocode. All languages parse into a shared Universal AST.

Before opening a pull request, please read:

- `docs/COMPILER_PIPELINE.md`
- `docs/COMPONENT_REFERENCE.md`
- `docs/ADDING_A_LANGUAGE.md` (if your change adds language features)

## Getting Started

1. Fork the repository and create a feature branch.
2. Install dependencies:

```bash
npm install
```

3. Start the dev server:

```bash
npm run dev
```

## Quality Checks

Run these before opening a PR:

```bash
npm run prettier:check
npm run lint-staged:check
npm run test:run
npm run build
```

For browser integration tests:

```bash
npm run test-browser
```

Useful Selenium options:

```bash
npm run test-browser -- --test "Test Name"
npm run test-browser -- --from "Test Name"
npm run test-browser:headed
```

## Coding Guidelines

- Keep all parsers emitting the Universal AST from `src/language/ast.ts`.
- Avoid language-specific AST node additions.
- Use recursive-descent parser structure and existing error-recovery patterns.
- Keep changes focused and avoid unrelated formatting churn in the same PR.
- Add or update tests in `tests/*.test.ts` for behavior changes.

## Pull Request Checklist

- [ ] My change is focused and documented in the PR description.
- [ ] I added or updated tests for new behavior.
- [ ] `npm run prettier:check` passes.
- [ ] `npm run lint-staged:check` passes.
- [ ] `npm run test:run` passes.
- [ ] `npm run build` passes.

## Commit Message Guidance

Use clear, imperative commit messages. Example:

- `Fix Java constructor detection for class translation`
- `Add regression test for Java-to-Python class calls`

## Questions

If behavior is unclear, open an issue with:

- Source language and target language
- Input code sample
- Expected output
- Actual output or error message
