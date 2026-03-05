import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Play, Home, Copy, Check, AlertCircle } from 'lucide-react';

import { decodeEmbed, generateEmbedHTML, copyToClipboard, type EmbedData } from '../utils/embedCodec';
import { Lexer as PythonLexer } from '../language/python/lexer';
import { Parser as PythonParser } from '../language/python/parser';
import { JavaLexer } from '../language/java/lexer';
import { JavaParser } from '../language/java/parser';
import { CSPLexer } from '../language/csp/lexer';
import { CSPParser } from '../language/csp/parser';
import { PraxisLexer } from '../language/praxis/lexer';
import { PraxisParser } from '../language/praxis/parser';
import { Interpreter } from '../language/interpreter';
import type { Program } from '../language/ast';
import { CodeEditorPanel } from '../components/CodeEditorPanel';
import { TranslationPanel } from '../components/TranslationPanel';

export default function EmbedPage() {
    const [searchParams] = useSearchParams();
    const [embedData, setEmbedData] = useState<EmbedData | null>(null);
    const [output, setOutput] = useState<string[]>([]);
    const [ast, setAst] = useState<Program | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [translationWidth, setTranslationWidth] = useState(() => {
        const outputWidth = 320; // w-80
        const availableWidth = window.innerWidth - outputWidth;
        return Math.max(200, availableWidth / 2);
    });
    const [showOutput, setShowOutput] = useState(true);
    const [showTranslation, setShowTranslation] = useState(false);
    const [resizingIdx, setResizingIdx] = useState<'translation' | null>(null);

    // Decode the embed data on mount
    useEffect(() => {
        const code = searchParams.get('code');
        if (!code) {
            setError('No code provided in URL');
            return;
        }

        const decoded = decodeEmbed(code);
        if (!decoded) {
            setError('Failed to decode embed data');
            return;
        }

        setEmbedData(decoded);
    }, [searchParams]);

    // Parse code when embed data changes
    useEffect(() => {
        if (!embedData) return;

        try {
            let tokens;
            let parser;
            const input = embedData.code;

            switch (embedData.lang) {
                case 'java':
                    tokens = new JavaLexer(input).tokenize();
                    parser = new JavaParser(tokens);
                    setAst(parser.parse());
                    break;
                case 'csp':
                    tokens = new CSPLexer(input).tokenize();
                    parser = new CSPParser(tokens);
                    setAst(parser.parse());
                    break;
                case 'praxis':
                    tokens = new PraxisLexer(input).tokenize();
                    parser = new PraxisParser(tokens);
                    setAst(parser.parse());
                    break;
                case 'python':
                default:
                    tokens = new PythonLexer(input).tokenize();
                    parser = new PythonParser(tokens);
                    setAst(parser.parse());
                    break;
            }
            setError(null);
        } catch (e: any) {
            setError(e.message);
            setAst(null);
        }
    }, [embedData]);

    const handleRun = useCallback(() => {
        if (!embedData || !ast) return;

        setError(null);
        setOutput([]);
        try {
            const interpreter = new Interpreter();
            const results = interpreter.interpret(ast);
            setOutput(results);
        } catch (e: any) {
            setError(e.message);
            setOutput([]);
        }
    }, [embedData, ast]);

    const handleCopyEmbed = async () => {
        if (!searchParams.get('code')) return;
        const embedCode = generateEmbedHTML(searchParams.get('code')!);
        const success = await copyToClipboard(embedCode);
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (resizingIdx === null) return;

            if (resizingIdx === 'translation') {
                setTranslationWidth((prev) => Math.max(200, prev - e.movementX));
            }
        };

        const handleMouseUp = () => setResizingIdx(null);

        if (resizingIdx !== null) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingIdx]);

    if (!embedData) {
        return (
            <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans">
                <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center px-4 shrink-0">
                    <Link to="/v2/" className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                        <Home size={20} />
                    </Link>
                </header>
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-4">
                        <AlertCircle size={48} className="mx-auto text-red-500 opacity-50" />
                        <div>
                            <h2 className="text-xl font-bold text-red-400 mb-2">{error || 'No Code Found'}</h2>
                            <p className="text-slate-400">The embed data could not be loaded. Please check the URL.</p>
                        </div>
                        <Link to="/v2/editor" className="inline-block mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold transition-colors">
                            Go to Editor
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
            {/* Header */}
            <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 z-[200]">
                <div className="flex items-center gap-3">
                    <Link to="/v2/" className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <Home size={20} />
                    </Link>
                    <div className="h-6 w-px bg-slate-800" />
                    <h1 className="font-semibold text-sm text-slate-300">Praxly Embed - {embedData.lang.toUpperCase()}</h1>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowTranslation(!showTranslation)}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all bg-slate-700 hover:bg-slate-600 text-slate-200"
                        title="Toggle translation view"
                    >
                        ↔ Translate
                    </button>
                    <button
                        onClick={handleCopyEmbed}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                            copied
                                ? 'bg-green-600/20 text-green-400'
                                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                        }`}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied!' : 'Copy Embed'}
                    </button>
                    <button
                        onClick={handleRun}
                        className="flex items-center gap-2 px-4 py-1.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-md shadow-lg shadow-green-900/20 transition-all"
                    >
                        <Play size={16} fill="currentColor" /> Run
                    </button>
                </div>
            </header>

            <main className="flex-1 flex min-h-0">
                {/* Source Code Editor */}
                <CodeEditorPanel
                    value={embedData.code}
                    onChange={() => {}} // Embed source is immutable
                    language={embedData.lang}
                    title="SOURCE"
                    readOnly={true}
                    editable={false}
                />

                {/* Translation/AST Panel */}
                {showTranslation && (
                    <TranslationPanel
                        ast={ast}
                        width={translationWidth}
                        resizeActive={resizingIdx === 'translation'}
                        onResize={(e) => {
                            setResizingIdx('translation');
                            e.preventDefault();
                        }}
                        onClose={() => setShowTranslation(false)}
                    />
                )}

                {/* Console Output */}
                {showOutput && (
                    <div className="w-80 flex flex-col min-w-0 border-l border-slate-800">
                        <div className="h-10 bg-slate-900 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Output</span>
                            <button
                                onClick={() => setShowOutput(false)}
                                className="p-1 text-slate-600 hover:text-slate-400 transition-colors"
                                title="Hide output"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-slate-950 leading-6">
                            {error && (
                                <div className="text-red-400 mb-3 p-3 bg-red-950/30 rounded border border-red-900/50">
                                    <span className="font-bold">Error:</span> {error}
                                </div>
                            )}
                            {output.length === 0 && !error ? (
                                <div className="text-slate-700 italic opacity-40">Run code to see output...</div>
                            ) : (
                                output.map((line, idx) => (
                                    <div key={idx} className="flex gap-4 border-b border-slate-900/40 last:border-0 py-0.5">
                                        <span className="text-slate-700 select-none w-6 text-right flex-shrink-0">
                                            {idx + 1}
                                        </span>
                                        <span className="text-slate-300 break-all">{line}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Output Toggle (when hidden) */}
                {!showOutput && (
                    <button
                        onClick={() => setShowOutput(true)}
                        className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-300 text-xs font-semibold uppercase tracking-widest transition-colors border-l border-slate-800 flex items-center justify-center"
                        title="Show output"
                    >
                        ▶
                    </button>
                )}
            </main>
        </div>
    );
}
