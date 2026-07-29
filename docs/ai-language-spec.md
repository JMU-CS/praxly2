# AI Tutor — language_spec Assembly

How the `{{language_spec}}` variable of the tutor prompt (see
[ai-system-prompt.md](ai-system-prompt.md), managed in Langfuse as
`praxly-tutor`) gets its value.

## Source of truth: `specs/`

The authoritative definitions of what each Praxly language supports live in
[`specs/`](../specs/) — one file per language plus the shared library. They are
maintained alongside the interpreter, so the prompt should inject them
verbatim rather than paraphrase them (a paraphrase drifts out of date; this
file used to be one and had already gone stale within a week).

For a request with source language L:

```
{{language_spec}} = contents of specs/<L>.md
                  + contents of specs/stdlib.md
```

| Editor language | Spec file             |
| --------------- | --------------------- |
| Praxis          | `specs/praxis.md`     |
| CSP             | `specs/csp.md`        |
| Java            | `specs/java.md`       |
| JavaScript      | `specs/javascript.md` |
| Python          | `specs/python.md`     |
| Blocks          | `specs/blocks.md`     |

`stdlib.md` is included for every language: it maps each built-in across all
five text languages and documents the semantic traps (CSP is 1-based and its
`RANDOM(a, b)` is inclusive on both ends; `substring` endpoint conventions;
integer division; print terminators; which spellings of string methods exist).
These traps are exactly what a tutor gets asked about, so the model needs the
whole table even when only one language is selected.

## Why not summarize?

- The specs are already written for exactly this audience: precise about what
  is supported, explicit about what is deliberately rejected, with correct
  example programs.
- They are small (4–10 KB each; spec + stdlib ≈ 15 KB) — well within prompt
  budget, per the project decision that the prompt may run long.
- Every future parser change lands in `specs/` by project convention, and the
  prompt inherits it with zero extra maintenance.

## Wiring

- **Langfuse playground testing (now):** paste `specs/<L>.md` + `specs/stdlib.md`
  into the `language_spec` variable by hand.
- **Backend (planned):** the backend fills `language_spec` from the request's
  `language` field using these same files. Open question for Vic/Dr. Mayfield:
  whether the backend vendors a copy of `specs/` or fetches from the repo.

## Tutor-specific cautions not in the specs

These belong in the prompt itself (already in the draft), not in `specs/`:

- Each exam spec has an **Extensions for Praxly** section. Those features run
  in Praxly but are NOT on the corresponding exam — when one comes up in an
  exam-prep context, the tutor should say so (e.g. CSP classes, Praxis
  `try/catch`).
- In Praxis, `/* ... */` is not a comment — it is the exam's _missing code
  placeholder_ (evaluates as a 0-valued stub). Fill-in-the-blank practice
  questions should use it exactly the way the exam does.
- Blocks has no functions, classes, or OOP — the tutor should suggest a text
  language when a student needs those.
