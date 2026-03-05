import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { praxis } from '../language/praxis/lezer';
import { csp } from '../language/csp/lezer';
import type { SupportedLang } from '../components/LanguageSelector';
import { Translator } from '../language/translator';
import type { Program } from '../language/ast';

export const getCodeMirrorExtensions = (lang: SupportedLang | 'json'): any[] => {
    const baseExtensions: any[] = [];

    switch (lang) {
        case 'java':
            baseExtensions.push(java());
            break;
        case 'python':
            baseExtensions.push(python());
            break;
        case 'praxis':
            baseExtensions.push(praxis());
            break;
        case 'csp':
            baseExtensions.push(csp());
            break;
    }

    return baseExtensions;
};

export const translateCode = (ast: Program | null, targetLang: SupportedLang): string => {
    if (!ast) return '// Valid source code required...';
    if (targetLang === 'ast') return JSON.stringify(ast, null, 2);

    const translator = new Translator();
    try {
        return translator.translate(ast, targetLang as any);
    } catch (e) {
        return `// Translation to ${targetLang} not available.`;
    }
};
