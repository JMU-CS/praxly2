# Praxly2

**Praxly** is an educational programming environment designed to bridge the gap between pseudocode and standard programming languages. It allows users to write code in one language (Python, Java, Praxis, or CSP) and instantly:

- **Translate** it into another supported language
- **Visualize** the Abstract Syntax Tree (AST)
- **Execute** the code entirely within the browser

Praxly2 is a modern TypeScript rewrite featuring a robust compiler architecture with lexical analysis, parsing, interpretation, and code generation—all running securely in the browser with no backend required.

### Features

- **Universal AST**: All languages parse to the same intermediate representation
- **Multi-language support**: Python, Java, CSP (pseudocode), and Praxis
- **Real-time translation**: See code translated live as you type
- **Code execution**: Run programs directly in the browser
- **AST visualization**: Explore how your code is structured
- **Modern editor**: Built with CodeMirror for syntax highlighting and accessibility

## Quick Start

Install dependencies:
```
npm install
```

Start the development server:
```
npm run dev
```

Then open your browser to the URL provided (typically `http://localhost:5173/v2/`).

## Running Tests

```
npm run test
```

## Documentation

For a detailed architectural overview and onboarding guide, see [docs/README.md](docs/README.md).

## License

Praxly2's source code is available under [CC BY-NC-SA](https://creativecommons.org/licenses/by-nc-sa/4.0/).
