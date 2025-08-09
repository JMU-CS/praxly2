import {parser} from "../../../build/language/praxis/lezer-parser.js";
import {foldNodeProp, foldInside, indentNodeProp, LRLanguage, LanguageSupport, delimitedIndent} from "@codemirror/language";
import {styleTags, tags as t} from "@lezer/highlight";
// import {completeFromList} from "@codemirror/autocomplete"

// https://lezer.codemirror.net/docs/ref/#highlight.tags
export let lezerParser = parser.configure({
  props: [
    styleTags({
      And: t.keyword,
      Class: t.keyword,
      Do: t.keyword,
      Else: t.keyword,
      End: t.keyword,
      Extends: t.keyword,
      False: t.keyword,
      For: t.keyword,
      If: t.keyword,
      New: t.keyword,
      Repeat: t.keyword,
      Until: t.keyword,
      Return: t.keyword,
      While: t.keyword,
      Null: t.keyword,
      Public: t.keyword,
      Private: t.keyword,
      Print: t.keyword,

      Identifier: t.variableName,

      Type: t.typeName,

      String: t.string,
      Character: t.character,

      Plus: t.operator,
      Equal: t.operator,
      LessThan: t.operator,
      LessThanOrEqual: t.operator,
      GreaterThan: t.operator,
      GreaterThanOrEqual: t.operator,
      DoubleLessThan: t.operator,
      DoubleGreaterThan: t.operator,

      LineComment: t.lineComment,

      LeftParenthesis: t.paren,
      RightParenthesis: t.paren,

      Integer: t.integer,
      Void: t.keyword,
    }),

    // delimitedIndent must be paired with indentOnInput to effect automatic
    // unindenting. The align parameter should generally be false. If it's true
    // or absent, the indent pushes in to align past the opening token.
    indentNodeProp.add({
      // Block: context => context.column(context.node.from) + context.unit,
      For: delimitedIndent({
        closing: 'end',
        align: false,
      }),
      While: delimitedIndent({
        closing: 'end',
        align: false,
      }),
      If: delimitedIndent({
        closing: 'end',
        align: false,
      }),
      Else: delimitedIndent({
        closing: 'end',
        align: false,
      }),
      Class: delimitedIndent({
        closing: 'end',
        align: false,
      }),
      SubroutineDefinition: delimitedIndent({
        closing: 'end',
        align: false,
      }),
      Do: delimitedIndent({
        closing: 'while',
        align: false,
      }),
      Repeat: delimitedIndent({
        closing: 'until',
        align: false,
      }),
    }),

    foldNodeProp.add({
      For: foldInside,
      While: foldInside,
      If: foldInside,
      Else: foldInside,
      ElseIf: foldInside,
      Class: foldInside,
      Repeat: foldInside,
      Do: foldInside,
    }),
  ],
  // strict: true,
});

// CodeMirror links:
// https://marijnhaverbeke.nl/blog/indent-from-tree.html
// https://thetrevorharmon.com/blog/learning-codemirror/

export const praxisLanguage = LRLanguage.define({
  name: 'praxis',
  parser: lezerParser,
  languageData: {
    commentTokens: {line: "//"},
    indentOnInput: /^\s*(until|end|while|\})$/,
  }
});

export function plugin() {
  return new LanguageSupport(praxisLanguage);
};
