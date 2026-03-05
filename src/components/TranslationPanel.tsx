import React, { useMemo } from 'react';
import { ArrowRightLeft, FileJson, X } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { ResizeHandle } from './ResizeHandle';
import { type SupportedLang } from './LanguageSelector';
import { getCodeMirrorExtensions, translateCode } from './editorUtils';
import { JSONTree } from './JSONTree';
import type { Program } from '../language/ast';

interface TranslationPanelProps {
    ast: Program | null;
    width: number;
    resizeActive: boolean;
    onResize: (e: React.MouseEvent) => void;
    onClose?: () => void;
}

type TranslationView = 'ast' | 'translation';

export const TranslationPanel: React.FC<TranslationPanelProps> = ({
    ast,
    width,
    resizeActive,
    onResize,
    onClose,
}) => {
    const [view, setView] = React.useState<TranslationView>('translation');
    const [targetLang, setTargetLang] = React.useState<SupportedLang>('python');

    const translation = useMemo(() => {
        return translateCode(ast, targetLang);
    }, [ast, targetLang]);

    return (
        <div
            className="flex shrink-0 border-r border-slate-800 min-w-0 relative group/translation"
            style={{ width }}
        >
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="h-10 bg-slate-900 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        {view === 'ast' ? (
                            <FileJson size={14} className="text-indigo-400" />
                        ) : (
                            <ArrowRightLeft size={14} className="text-indigo-400" />
                        )}
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                            {view === 'ast' ? 'AST' : 'Translation'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setView(view === 'ast' ? 'translation' : 'ast')}
                            className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                        >
                            {view === 'ast' ? 'Show Translation' : 'Show AST'}
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Language Selector (only for translation view) */}
                {view === 'translation' && (
                    <div className="border-b border-slate-800 px-4 py-2 bg-slate-900/50 flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-400">Translate to:</span>
                        <select
                            value={targetLang}
                            onChange={(e) => setTargetLang(e.target.value as SupportedLang)}
                            className="text-xs px-2 py-1 bg-slate-800 text-slate-200 rounded border border-slate-700 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="python">Python</option>
                            <option value="java">Java</option>
                            <option value="csp">CSP</option>
                            <option value="praxis">Praxis</option>
                        </select>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-auto">
                    {view === 'ast' ? (
                        <div className="p-4 text-xs font-mono">
                            {ast ? (
                                <JSONTree data={ast} />
                            ) : (
                                <div className="text-slate-700 italic">Valid code required...</div>
                            )}
                        </div>
                    ) : (
                        <CodeMirror
                            value={translation}
                            height="100%"
                            theme={vscodeDark}
                            extensions={getCodeMirrorExtensions(targetLang)}
                            readOnly={true}
                            editable={false}
                            className="text-xs h-full font-mono"
                        />
                    )}
                </div>
            </div>

            {/* Resize Handle */}
            <ResizeHandle direction="horizontal" isActive={resizeActive} onMouseDown={onResize} />
        </div>
    );
};
