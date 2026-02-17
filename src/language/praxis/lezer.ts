import { styleTags, tags as t } from "@lezer/highlight";
import { parser } from "./praxis.grammar.js";
import { LRLanguage, LanguageSupport } from "@codemirror/language";

export const praxisLanguage = LRLanguage.define({
    parser: parser.configure({
        props: [
            styleTags({
                // Keywords
                "Procedure Function If Then Else While Do For To Step In Return Print Call End": t.keyword,
                "Mod And Or Not": t.operatorKeyword,

                // Literals
                "String": t.string,
                "Number": t.number,
                "Boolean": t.bool,
                "ArrayLiteral": t.squareBracket,

                // Identifiers
                "Identifier": t.variableName,
                "ProcedureDeclaration/Identifier": t.function(t.definition(t.variableName)),
                "CallExpression/Identifier": t.function(t.variableName),

                // Operators & Punctuation
                "Arrow AssignOp": t.definitionOperator,
                "AddOp MultOp CompareOp": t.arithmeticOperator,
                "LineComment HashComment": t.lineComment,
                "( )": t.paren,
                "[ ]": t.squareBracket,
                ",": t.separator
            })
        ]
    }),
    languageData: {
        commentTokens: { line: "//" },
        indentOnInput: /^\s*(?:else|end)$/  // Auto-dedent on 'else' or 'end'
    }
});

export function praxis() {
    return new LanguageSupport(praxisLanguage);
}
