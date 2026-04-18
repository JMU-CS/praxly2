# Praxly2

**Praxly** is an educational programming environment designed to bridge the gap between pseudocode and standard programming languages. It allows users to write code in one language (Python, Java, Praxis, or CSP) and instantly:

- **Translate** it into another supported language
- **Visualize** the Abstract Syntax Tree (AST)
- **Execute** the code entirely within the browser

Praxly2 is a modern TypeScript rewrite of [Praxly](https://github.com/JMU-CS/praxly) featuring a robust compiler architecture with lexical analysis, parsing, interpretation, and code generation—all running securely in the browser with no backend required.

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

Unit tests primarily for compiler and AST:

```sh
npm run test
npm run test:run
```

Integration tests using headless selenium:

```sh
npm run test-browser
npm run test-browser -- --test "Print once"
npm run test-browser -- --from-index 120
```

Quality checks:

```sh
npm run prettier:check
npm run lint-staged:check
```

## Common npm Scripts

Use these commands during normal development:

```sh
npm run dev                # Start Vite dev server
npm run build              # Type-check and production build
npm run test               # Run Vitest in watch mode
npm run test:run           # Run Vitest once
npm run test-browser       # Run Selenium CSV suite (headless)
npm run test-browser:headed # Run Selenium suite in visible Chrome
npm run prettier:check     # Check formatting
npm run prettier:write     # Rewrite files with Prettier
npm run lint-staged:check  # Validate lint-staged config
```

Browser test script examples:

```sh
npm run test-browser -- --help
npm run test-browser -- --test "Print once"
npm run test-browser -- --from-index 120
npm run test-browser -- --filter "Array" --no-fail-fast
```

## Documentation

For a detailed architectural overview and onboarding guide, see [docs/README.md](docs/README.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup steps, quality checks, and pull request guidelines.

## License

Praxly2's source code is available under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). See [LICENSE](LICENSE) for details.
