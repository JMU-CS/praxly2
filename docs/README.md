# Praxly2 Documentation

## src

* main.ts --
* praxly-theme.ts --
* vite-env.d.ts --

### src/language

* ast.ts -- model classes for internal representation
* error.ts -- Praxly error message with a location
* evaluator.ts -- visitor for evaluating the AST
* fruit.ts --
* lexer.ts -- abstract lexer with utility methods
* objectifier.ts -- visitor for serializing the IR
* parser.ts -- abstract parser with utility methods
* symbol-map.ts -- map ast nodes to strings for error messages
* token.ts -- enum and classes for representing tokens
* type.ts --
* visitor.ts -- abstract class with visit method for each ast node
* where.ts -- source code locations for error messages

### src/language/praxis

Note: Duplicate these files for each language

* praxis/generator.ts -- generate praxis code from IR
* praxis/highlighter.ts
* praxis/lexer.ts -- concrete class to lex praxis pseudocode
* praxis/lezer.grammar --
* praxis/parser.ts -- concrete class to parse praxis pseudocode
* praxis/precedence.ts -- language specific precedence and associativity
* praxis/symbol-map.ts -- language specific overrides for symbol map

### src/sandbox

* lezer-praxis.ts --
