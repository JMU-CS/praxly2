This directory documents the scope of each language Praxly supports. Three of the specs are
rewritten from the original standardized-exam references; the rest describe Praxly's own
supported subsets and shared library.

Exam-based specs (with an **Extensions for Praxly** section noting anything added beyond the
original reference):

* [csp.md](csp.md) — https://apcentral.collegeboard.org/media/pdf/ap-computer-science-principles-exam-reference-sheet.pdf
* [java.md](java.md) — https://apcentral.collegeboard.org/media/pdf/ap-computer-science-a-java-quick-reference.pdf
* [praxis.md](praxis.md) — https://praxis.ets.org/on/demandware.static/-/Library-Sites-ets-praxisLibrary/default/pdfs/5652.pdf#page=21

Praxly-defined subsets (JavaScript and Python are not tied to an exam, so these describe what
the parser/interpreter supports and explicitly rejects):

* [javascript.md](javascript.md)
* [python.md](python.md)
* [blocks.md](blocks.md) — the visual Blockly language, a procedural/untyped subset for
  middle-school and AP CSP courses

Cross-cutting reference:

* [stdlib.md](stdlib.md) — the shared built-in library, with a table mapping every built-in
  function/method across all five languages plus notes on semantic differences.

The interpreter supports the union of the language features described in these files, along with
the common library of built-in functions. Blocks (Blockly) implements a deliberate procedural,
non-OOP subset of them — see [blocks.md](blocks.md).
