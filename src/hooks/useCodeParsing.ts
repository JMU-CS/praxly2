/**
 * useCodeParsing hook that provides code parsing and translation functionality.
 * Parses source code into AST and translates the AST to target languages.
 */

import { useCallback } from 'react';
import type { Program } from '../language/ast';
import type { SupportedLang } from '../components/LanguageSelector';
import { Lexer as PythonLexer } from '../language/python/lexer';
import { Parser as PythonParser } from '../language/python/parser';
import { JavaLexer } from '../language/java/lexer';
import { JavaParser } from '../language/java/parser';
import { CSPLexer } from '../language/csp/lexer';
import { CSPParser } from '../language/csp/parser';
import { PraxisLexer } from '../language/praxis/lexer';
import { PraxisParser } from '../language/praxis/parser';
import { Translator } from '../language/translator';

export type SourceMap = Map<string, number>;

/**
 * Custom hook for parsing code and getting translations
 */
export const useCodeParsing = () => {
    const parseCode = useCallback((lang: SupportedLang, input: string): Program | null => {
        if (lang === 'ast') return null;
        try {
            let tokens;
            let parser;
            switch (lang) {
                case 'java':
                    tokens = new JavaLexer(input).tokenize();
                    parser = new JavaParser(tokens);
                    return parser.parse();
                case 'csp':
                    tokens = new CSPLexer(input).tokenize();
                    parser = new CSPParser(tokens);
                    return parser.parse();
                case 'praxis':
                    tokens = new PraxisLexer(input).tokenize();
                    parser = new PraxisParser(tokens, input);
                    return parser.parse();
                case 'python':
                default:
                    tokens = new PythonLexer(input).tokenize();
                    parser = new PythonParser(tokens);
                    return parser.parse();
            }
        } catch (e: any) {
            throw new Error(e.message);
        }
    }, []);

    const getTranslation = useCallback(
        (ast: Program | null, target: SupportedLang): { code: string; sourceMap: SourceMap } => {
            if (!ast) return { code: "// Valid source code required...", sourceMap: new Map() };
            if (target === 'ast') return { code: JSON.stringify(ast, null, 2), sourceMap: new Map() };

            const translator = new Translator();
            try {
                return translator.translateWithMap(ast, target as any);
            } catch (e) {
                return { code: `// Translation to ${target} not available.`, sourceMap: new Map() };
            }
        },
        []
    );

    return { parseCode, getTranslation };
};
