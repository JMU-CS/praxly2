import {parser} from "../../../build/language/praxis/lezer-parser.js";
import {foldNodeProp, foldInside, indentNodeProp, LRLanguage, LanguageSupport} from "@codemirror/language";
import {styleTags, tags as t} from "@lezer/highlight";
// import {completeFromList} from "@codemirror/autocomplete"

// https://lezer.codemirror.net/docs/ref/#highlight.tags
export let parserWithMetadata = parser.configure({
  props: [
    styleTags({
      For: t.keyword,
      End: t.keyword,
      Print: t.keyword,
      Identifier: t.variableName,
      Type: t.typeName,
      String: t.string,
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
    }),
    indentNodeProp.add({
      // Block: context => context.column(context.node.from) + context.unit,
      For: context => context.column(context.node.from) + context.unit,
      While: context => context.column(context.node.from) + context.unit,
      If: context => context.column(context.node.from) + context.unit,
      Else: context => context.column(context.node.from) + context.unit,
      Class: context => context.column(context.node.from) + context.unit,
    }),
    // foldNodeProp.add({
      // For: foldInside,
      // While: foldInside,
      // If: foldInside,
      // Else: foldInside,
      // Class: foldInside,
    // }),
  ]
});

export const praxisLanguage = LRLanguage.define({
  name: 'praxis',
  parser: parserWithMetadata,
  languageData: {
    // commentTokens: {line: "//"}
  }
});

export function praxis() {
  return new LanguageSupport(praxisLanguage);
};
