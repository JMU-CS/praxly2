import { styleTags, tags as t } from "@lezer/highlight";
import { parser } from "./csp.grammar.js"; // Compiled via lezer-generator
import { LRLanguage, LanguageSupport } from "@codemirror/language";

export const cspLanguage = LRLanguage.define({
    parser: parser.configure({
        props: [
            styleTags({
                // CSP and Custom OOP Keywords
                "IF ELSE REPEAT UNTIL TIMES FOR EACH IN PROCEDURE RETURN DISPLAY INPUT CLASS CONSTRUCTOR EXTENDS NEW PUBLIC PRIVATE THIS": t.keyword,

                // Logic Operators
                "AND OR NOT": t.operatorKeyword,

                // Literals
                "Boolean": t.bool,
                "Null": t.null,
                "Number": t.number,
                "String": t.string,

                // Variables & Identifiers
                "Identifier": t.variableName,
                "ProcedureDeclaration/Identifier": t.function(t.definition(t.variableName)),
                "CallExpression/Identifier": t.function(t.variableName),

                // Comments
                "LineComment": t.lineComment,

                // CSP Arithmetic and Relational Operators
                "AssignOp": t.definitionOperator,
                "Eq Neq Lt Gt Lte Gte": t.compareOperator,
                "Plus Minus Multiply Divide MOD": t.arithmeticOperator,

                // Punctuation
                "( )": t.paren,
                "[ ]": t.squareBracket,
                "{ }": t.brace,
                ".": t.derefOperator,
                ",": t.separator
            })
        ]
    }),
    languageData: {
        commentTokens: { line: "//" },
        indentOnInput: /^\s*\}$/  // Auto-dedent on block closures
    }
});

export function csp() {
    return new LanguageSupport(cspLanguage);
}
