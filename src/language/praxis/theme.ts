import {EditorView} from '@codemirror/view';
import {HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import {tags} from "@lezer/highlight";

// https://kelvinkoko.github.io/cm6-theme-editor/

const background = '#1e1e1e';
const foreground = '#9cdcfe';
const caret = '#c6c6c6';
const selection = '#00b1ff4a';
const selectionMatch = '#72a1ff59';
const lineHighlight = '#ffffff0f';
const gutterBackground = '#1e1e1e';
const gutterForeground = '#838383';
const gutterActiveForeground = '#ffffff';
const keywordColor = '#569cd6';
const controlKeywordColor = '#c586c0';
const variableColor = '#9cdcfe';
const classTypeColor = '#4ec9b0';
const functionColor = '#dcdcaa';
const numberColor = '#b5cea8';
const operatorColor = '#d4d4d4';
const regexpColor = '#d16969';
const stringColor = '#FFFF00'; //'#ce9178';
const commentColor = '#6a9955';
const invalidColor = '#ff0000';

const theme = {
  ".cm-scroller": {
    "overflow": "auto"
  },
  ".cm-wrap": {
    "height": "100%"
  },
  "&": {
    "backgroundColor": background,
    "color": foreground,
    fontFamily: 'Menlo, Monaco, Consolas, "Andale Mono", "Ubuntu Mono", "Courier New", monospace',
  },
  ".cm-content": {
    "caretColor": "#0000FF",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: caret,
  },
  ".cm-selectionBackground": {
    backgroundColor: `${selection} !important`,
  },
  // "&.cm-focused .cm-selectionBackground, ::selection": {
    // backgroundColor: selection,
    // opacity: 1,
  // },
  ".cm-activeLine": {
    backgroundColor: lineHighlight,
  },
  ".cm-searchMatch": {
    "backgroundColor": selectionMatch,
  },
  ".cm-gutters": {
    backgroundColor: gutterBackground,
    color: gutterForeground,
  },
  '.cm-activeLineGutter': {
    color: gutterActiveForeground,
  },
}

const highlightStyles = HighlightStyle.define([   
  {
    tag: [tags.keyword],
    color: "#5e81ac"
  },
  {
    tag: [tags.function(tags.variableName)],
    color: "#5e81ac"
  },
  {
    tag: [tags.variableName],
    color: "#d08770"
  },
  {
    tag: [tags.brace],
    color: "#8fbcbb"
  },
  {
    tag: [tags.annotation],
    color: "#d30102"
  },
  {
    tag: [tags.typeName],
    color: "#ebcb8b",
  },
  {
    tag: [tags.className],
    color: "#ebcb8b"
  },
  {
    tag: [tags.operator, tags.operatorKeyword],
    color: "#a3be8c"
  },
  {
    tag: [tags.squareBracket],
    color: "#8fbcbb"
  },
  {
    tag: [tags.angleBracket],
    color: "#8fbcbb"
  },
  {
    tag: [tags.number],
    color: numberColor
  },
  // {
    // tag: [tags.string],
    // color: stringColor,
  // },
  {
    tag: [tags.operator, tags.punctuation, tags.separator, tags.url, tags.escape, tags.regexp],
    color: operatorColor,
  },
]);

export const praxlyTheme = [
  EditorView.theme(theme, {dark: true}),
  syntaxHighlighting(highlightStyles)
];
