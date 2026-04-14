/**
 * Lezer-based grammar definition and syntax highlighting configuration for Praxis language.
 * Provides CodeMirror language support with keyword highlighting and syntax rules.
 */

import { styleTags, tags as t } from "@lezer/highlight";
import { parser } from "./praxis.grammar.js"; // Compiled via lezer-generator
import { LRLanguage, LanguageSupport } from "@codemirror/language";

export const praxisLanguage = LRLanguage.define({
    parser: parser.configure({
        props: [
            styleTags({
                // Keywords
                "class extends end procedure public private if else for while do repeat until return print new": t.keyword,

                // Praxis Logic Operators (and, or, not)
                "and or not": t.operatorKeyword,

                // Literals
                "Boolean": t.bool,
                "Null": t.null,
                "Number": t.number,
                "String": t.string,

                // Variables & Identifiers
                "Identifier": t.variableName,
                "Type/Identifier": t.typeName,
                "ProcName/Identifier": t.function(t.definition(t.variableName)),
                "CallExpression/Identifier": t.function(t.variableName),

                // Comments
                "LineComment BlockComment": t.comment,

                // Praxis Operators
                "AssignOp": t.definitionOperator,
                "Equals NotEquals Less Greater LessEqual GreaterEqual": t.compareOperator,
                "Plus Minus Multiply Divide Modulo": t.arithmeticOperator,

                // Punctuation
                "( )": t.paren,
                "[ ]": t.squareBracket,
                "{ }": t.brace,
                ".": t.derefOperator,
                ", ; ..": t.separator
            })
        ]
    }),
    languageData: {
        commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
        indentOnInput: /^\s*(?:else|end)$/  // Auto-dedent on block closures
    }
});

export function praxis() {
    return new LanguageSupport(praxisLanguage);
}
