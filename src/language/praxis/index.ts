// People have mixed opinions about barrel files like this one. I've seen two
// primary complaints: they can introduce circular dependencies when a library
// uses its own barrel file, and some bundlers are tricked into including
// everything referenced in the barrel file --- even if it's not used
// elsewhere. I think it's reasonable to use a barrel file here. The language
// library doesn't import from its own barrel file. And we need everything
// bundled.

export {lex} from './lexer.js';
export {parse, parseExpression} from './parser.js';
export {Generator} from './generator.js';
export {OutputFormatter} from './output-formatter.js';
export {plugin, lezerParser} from './highlighter.js';
export {praxlyTheme} from './theme.js';
