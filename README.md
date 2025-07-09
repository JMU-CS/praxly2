# Praxly2

Praxly2 is a rewrite of [Praxly](https://github.com/JMU-CS/praxly) in TypeScript.
The main goals of this project are:

* Implement a more robust architecture that uses the visitor pattern for code generation and program execution.
* Add language features that were not implemented in Praxly, such as multidimensional arrays, classes, and inheritance.
* Replace the [Ace](https://ace.c9.io/) editor with [CodeMirror](https://codemirror.net/) to improve accessibility and allow Praxly2 to run on mobile devices.
* Support additional programming languages, including [TExES][TEX] pseudocode, [CSP][CSP] pseudocode, Java, and Python.
* Provide new learning tools for program comprehension, such as code explanations and memory diagrams.

[TEX]: https://www.tx.nesinc.com/Content/StudyGuide/TX_SG_strategies_241.asp#stimulusQ
[CSP]: https://apcentral.collegeboard.org/media/pdf/ap-computer-science-principles-exam-reference-sheet.pdf#page=3

## Development

Install dependencies:
```
$ npm install
$ npm run parser
```

Note: Rerun `parser` whenever CodeMirror/lezer changes

To run locally:
```
$ npm run dev
```

To run the tests:
```
$ npm run test
```

## License

Praxly2's source code is available under [CC BY-NC-SA](https://creativecommons.org/licenses/by-nc-sa/4.0/).
