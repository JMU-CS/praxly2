# Praxly2

## Development

Install dependencies:
```
$ npm install
```

To run locally:
```
$ npm run dev
```

## Source Files

* ast.ts -- model classes for internal representation
* evaluator.ts -- visitor for evaluating the AST
* exception.ts -- Praxly error message with a location
* lexer.ts -- abstract lexer with utility methods
* objectifier.ts -- visitor for serializing the IR
* parser.ts -- abstract parser with utility methods
* symbol-map.ts -- map ast nodes to strings for error messages
* token.ts -- enum and classes for representing tokens
* visitor.ts -- abstract class with visit method for each ast node
* where.ts -- source code locations for error messages

### Each Language

* praxis/generator.ts -- generate praxis code from IR
* praxis/lexer.ts -- concrete class to lex praxis pseudocode
* praxis/parser.ts -- concrete class to parse praxis pseudocode
* praxis/precedence.ts -- language specific precedence and associativity
* praxis/symbol-map.ts -- language specific overrides for symbol map
