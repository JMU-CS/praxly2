This directory contains the original language specifications downloaded from the following sources:

* **CSP**: https://apcentral.collegeboard.org/media/pdf/ap-computer-science-principles-exam-reference-sheet.pdf
* **Java**: https://apcentral.collegeboard.org/media/pdf/ap-computer-science-a-java-quick-reference.pdf
* **Praxis**: https://praxis.ets.org/on/demandware.static/-/Library-Sites-ets-praxisLibrary/default/pdfs/5652.pdf#page=21

The most relevant information from each PDF has been rewritten as Markdown, making it easier to use as context for AI agents:

* [csp.md](csp.md)
* [java.md](java.md)
* [praxis.md](praxis.md)

Each Markdown file includes an **Extensions for Praxly** section that documents features added beyond the original language specification.

The interpreter supports the union of the language features described in the Markdown files, along with a common library of built-in functions.

The other language front ends (Blocks, JavaScript, and Python) implement only the features needed to support this shared language definition.
