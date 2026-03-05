import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Play, AlertCircle, FastForward, Square, ChevronDown } from 'lucide-react';
import { Decoration, EditorView } from '@codemirror/view';
import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';

import { decodeEmbed, encodeEmbed, type EmbedData } from '../utils/embedCodec';
import { Lexer as PythonLexer } from '../language/python/lexer';
import { Parser as PythonParser } from '../language/python/parser';
import { JavaLexer } from '../language/java/lexer';
import { JavaParser } from '../language/java/parser';
import { CSPLexer } from '../language/csp/lexer';
import { CSPParser } from '../language/csp/parser';
import { PraxisLexer } from '../language/praxis/lexer';
import { PraxisParser } from '../language/praxis/parser';
import { Interpreter } from '../language/interpreter';
import { Debugger } from '../language/debugger';
import { Translator } from '../language/translator';
import type { Program } from '../language/ast';
import type { SupportedLang } from '../components/LanguageSelector';
import { HighlightableCodeMirror } from '../components/HighlightableCodeMirror';
import { JSONTree } from '../components/JSONTree';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { getCodeMirrorExtensions } from '../utils/editorUtils';
import { getRangeLines, findNodesAtLocation } from '../utils/debuggerUtils';

// CodeMirror decoration helper
const highlightLineDecoration = Decoration.line({
    attributes: {
        style: 'background-color: rgba(99, 102, 241, 0.25); border-left: 3px solid rgb(99, 102, 241);'
    }
});

const highlightLinesEffect = StateEffect.define<number[]>();

const highlightedLinesField = StateField.define({
    create() {
        return Decoration.none;
    },
    update(decorations: any, tr: any) {
        for (const effect of tr.effects) {
            if (effect.is(highlightLinesEffect)) {
                const ranges = effect.value;
                const builder = new RangeSetBuilder<Decoration>();
                
                for (const lineNum of ranges) {
                    const line = tr.state.doc.line(lineNum + 1);
                    if (line) {
                        builder.add(line.from, line.from, highlightLineDecoration);
                    }
                }
                return builder.finish();
            }
        }
        return decorations.map(tr.changes);
    },
    provide: (f: any) => EditorView.decorations.from(f)
});

export default function EmbedPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [embedData, setEmbedData] = useState<EmbedData | null>(null);
    const [output, setOutput] = useState<string[]>([]);
    const [ast, setAst] = useState<Program | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // Layout state
    const [sourceWidth, setSourceWidth] = useState(window.innerWidth / 3);
    const [translationWidth, setTranslationWidth] = useState(window.innerWidth / 3);
    const [resizingIdx, setResizingIdx] = useState<'source' | 'translation' | null>(null);
    
    // Translation state
    const [currentTargetLang, setCurrentTargetLang] = useState<SupportedLang>('python');
    const [showTranslationMenu, setShowTranslationMenu] = useState(false);
    const [showAst, setShowAst] = useState(false);
    
    // Debugging state
    const [isDebugging, setIsDebugging] = useState(false);
    const [isDebugComplete, setIsDebugComplete] = useState(false);
    const [debuggerInstance, setDebuggerInstance] = useState<Debugger | null>(null);
    const [highlightedSourceLines, setHighlightedSourceLines] = useState<number[]>([]);
    const [highlightedTranslationLines, setHighlightedTranslationLines] = useState<number[]>([]);
    const [currentVariables, setCurrentVariables] = useState<Record<string, any>>({});
    
    const editorViewRef = useRef<any>(null);

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

    // Handle line highlighting using CodeMirror decorations
    useEffect(() => {
        if (!editorViewRef.current) return;

        editorViewRef.current.dispatch({
            effects: highlightLinesEffect.of(highlightedSourceLines)
        });
    }, [highlightedSourceLines]);

    const handleCreateEditor = useCallback((view: any) => {
        editorViewRef.current = view;
    }, []);

    const getTranslation = (target: SupportedLang): { code: string; sourceMap: any } => {
        if (!ast) return { code: "// Valid source code required...", sourceMap: new Map() };
        if (target === 'ast') return { code: JSON.stringify(ast, null, 2), sourceMap: new Map() };

        const translator = new Translator();
        try {
            return translator.translateWithMap(ast, target as any);
        } catch (e) {
            return { code: `// Translation to ${target} not available.`, sourceMap: new Map() };
        }
    };

    const getExtensions = (lang: SupportedLang) => {
        const baseExtensions = getCodeMirrorExtensions(lang);
        baseExtensions.push(highlightedLinesField);
        return baseExtensions;
    };

    const handleRun = () => {
        setError(null);
        setOutput([]);
        try {
            const program = ast;
            if (!program) return;

            const interpreter = new Interpreter();
            const results = interpreter.interpret(program);
            setOutput(results);
        } catch (e: any) {
            console.error(e);
            setError(e.message);
            setOutput((prev) => [...prev, `Error: ${e.message}`]);
        }
    };

    const handleDebugStart = () => {
        setError(null);
        setOutput([]);
        try {
            const program = ast;
            if (!program) return;

            const debugInstance = new Debugger();
            debugInstance.init(program, (embedData?.lang || 'python') as SupportedLang);
            setDebuggerInstance(debugInstance);
            setIsDebugging(true);
            setIsDebugComplete(false);
            setCurrentVariables({});
            setOutput(['Debugger initialized. Click Step to begin.']);
            setHighlightedSourceLines([]);
            setHighlightedTranslationLines([]);
        } catch (e: any) {
            console.error(e);
            setError(e.message);
        }
    };

    const handleDebugStep = () => {
        if (!debuggerInstance || !ast || !embedData?.code) return;

        try {
            const step = debuggerInstance.step();
            if (!step) return;

            setCurrentVariables(step.variables);

            if (step.sourceLocation) {
                const nodesAtLocation = findNodesAtLocation(ast, step.sourceLocation.start);
                
                // Highlight source lines
                const sourceHighlightedLines = new Set<number>();
                for (const node of nodesAtLocation) {
                    if (node.loc) {
                        const nodeLines = getRangeLines(embedData.code, node.loc.start);
                        nodeLines.forEach(line => sourceHighlightedLines.add(line));
                    }
                }
                setHighlightedSourceLines(Array.from(sourceHighlightedLines));

                // Highlight translation lines
                const translation = getTranslation(currentTargetLang);
                const translationSourceMap = translation.sourceMap;
                const nodeIds = nodesAtLocation.map(n => n.id);
                const translationHighlightedLines: number[] = [];
                for (const nodeId of nodeIds) {
                    const mapEntry = translationSourceMap.get ? translationSourceMap.get(nodeId) : translationSourceMap[nodeId];
                    if (mapEntry !== undefined) {
                        if (typeof mapEntry === 'object' && 'lineStart' in mapEntry) {
                            translationHighlightedLines.push(mapEntry.lineStart - 1);
                        } else if (typeof mapEntry === 'number') {
                            translationHighlightedLines.push(mapEntry);
                        }
                    }
                }
                setHighlightedTranslationLines(translationHighlightedLines);
            } else {
                setHighlightedSourceLines([]);
                setHighlightedTranslationLines([]);
            }

            const outputLines: string[] = [];
            outputLines.push(`--- Step ${step.stepNumber} ---`);
            outputLines.push(`Node: ${step.nodeType}`);
            if (step.sourceLocation) {
                outputLines.push(`Location: ${step.sourceLocation.start} - ${step.sourceLocation.end}`);
            }
            outputLines.push('');

            setOutput(outputLines);

            if (step.isComplete) {
                setIsDebugComplete(true);
                setOutput((prev) => [...prev, 'Execution complete.']);
            }
        } catch (e: any) {
            console.error(e);
            setError(e.message);
            setOutput((prev) => [...prev, `Error: ${e.message}`]);
            setIsDebugComplete(true);
        }
    };

    const handleDebugStop = () => {
        setIsDebugging(false);
        setDebuggerInstance(null);
        setHighlightedSourceLines([]);
        setHighlightedTranslationLines([]);
        setIsDebugComplete(false);
        setCurrentVariables({});
        setOutput((prev) => [...prev, 'Debugger stopped.']);
    };

    const handleOpenInEditor = () => {
        if (!embedData) return;
        const encoded = encodeEmbed({
            code: embedData.code,
            lang: embedData.lang as any,
        });
        navigate(`/v2/editor?code=${encoded}`);
    };

    // Resize handler
    const onMouseDown = (e: React.MouseEvent, idx: 'source' | 'translation') => {
        setResizingIdx(idx);
        e.preventDefault();
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (resizingIdx === null) return;

            if (resizingIdx === 'source') {
                setSourceWidth((prev) => Math.max(150, prev + e.movementX));
            } else if (resizingIdx === 'translation') {
                setTranslationWidth((prev) => Math.max(150, prev + e.movementX));
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
            <div className="flex items-center justify-center h-screen bg-slate-950 text-slate-100">
                <div className="text-center space-y-4">
                    <AlertCircle size={48} className="mx-auto text-red-500 opacity-50" />
                    <div>
                        <h2 className="text-xl font-bold text-red-400 mb-2">{error || 'No Code Found'}</h2>
                        <p className="text-slate-400">The embed data could not be loaded.</p>
                    </div>
                </div>
            </div>
        );
    }

    const translation = getTranslation(currentTargetLang);

    return (
        <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
            {/* Source Code Pane */}
            <div
                className="flex shrink-0 relative group/source z-[10] border-r border-slate-800"
                style={{ width: sourceWidth }}
            >
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="h-10 bg-slate-900 flex items-center px-4 border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-500 shrink-0">
                        Source ({embedData.lang})
                    </div>
                    <div className="flex-1 relative bg-slate-950 overflow-hidden">
                        <CodeMirror
                            value={embedData.code}
                            height="100%"
                            theme={vscodeDark}
                            extensions={getExtensions(embedData.lang as SupportedLang)}
                            editable={false}
                            onCreateEditor={handleCreateEditor}
                            className="text-sm h-full font-mono"
                        />
                    </div>
                </div>
                {/* Source Resize Handle */}
                <div
                    className={`absolute top-0 right-0 w-1 h-full cursor-col-resize z-[20] transition-colors ${resizingIdx === 'source' ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/30'}`}
                    onMouseDown={(e) => onMouseDown(e, 'source')}
                />
            </div>

            {/* Translation Pane */}
            <div
                className="flex shrink-0 relative group/translation z-[10] border-r border-slate-800"
                style={{ width: translationWidth }}
            >
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="bg-slate-900 border-b border-slate-800 shrink-0">
                        {/* Header with tabs */}
                        <div className="h-10 flex items-center justify-between px-4">
                            <div className="relative">
                                <button 
                                    onClick={() => setShowTranslationMenu(!showTranslationMenu)}
                                    className="flex items-center gap-2 py-2 text-indigo-400 hover:text-indigo-300 transition-colors text-xs font-bold uppercase"
                                >
                                    {showAst ? 'AST' : currentTargetLang}
                                    <ChevronDown size={12} />
                                </button>
                                {showTranslationMenu && (
                                    <div className="absolute top-full left-0 w-40 bg-slate-800 border border-slate-700 rounded-md shadow-xl overflow-hidden mt-1 z-[110]">
                                        {(['python', 'java', 'csp', 'praxis'] as SupportedLang[]).map(lang => (
                                            <button 
                                                key={lang}
                                                onClick={() => {
                                                    setCurrentTargetLang(lang);
                                                    setShowAst(false);
                                                    setShowTranslationMenu(false);
                                                }}
                                                className={`block w-full text-left px-4 py-2 text-xs hover:bg-slate-700 transition-colors ${currentTargetLang === lang && !showAst ? 'bg-indigo-600 text-white' : ''}`}
                                            >
                                                {lang}
                                            </button>
                                        ))}
                                        <div className="border-t border-slate-700" />
                                        <button 
                                            onClick={() => {
                                                setShowAst(true);
                                                setShowTranslationMenu(false);
                                            }}
                                            className={`block w-full text-left px-4 py-2 text-xs hover:bg-slate-700 transition-colors ${showAst ? 'bg-indigo-600 text-white' : ''}`}
                                        >
                                            Show AST
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="h-10 flex items-center gap-2 px-4 border-t border-slate-800 bg-slate-900/50">
                            {!isDebugging ? (
                                <>
                                    <button
                                        onClick={handleRun}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded transition-all"
                                    >
                                        <Play size={12} fill="currentColor" /> Run
                                    </button>
                                    <button
                                        onClick={handleDebugStart}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-200 bg-slate-700 hover:bg-slate-600 rounded transition-all"
                                    >
                                        Debug
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={handleDebugStep}
                                        disabled={isDebugComplete}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-all disabled:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <FastForward size={12} fill="currentColor" /> Step
                                    </button>
                                    <button
                                        onClick={handleDebugStop}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded transition-all"
                                    >
                                        <Square size={12} fill="currentColor" /> Stop
                                    </button>
                                </>
                            )}
                            <button
                                onClick={handleOpenInEditor}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-200 bg-slate-700 hover:bg-slate-600 rounded transition-all ml-auto"
                            >
                                Open in Editor
                            </button>
                        </div>
                    </div>

                    {/* Translation Content */}
                    <div className="flex-1 overflow-hidden bg-slate-950 relative">
                        {showAst ? (
                            <div className="text-xs font-mono h-full overflow-auto p-4 custom-scrollbar">
                                {ast ? <JSONTree data={ast} /> : <div className="text-slate-700 text-center mt-10 italic">Valid code required...</div>}
                            </div>
                        ) : (
                            <HighlightableCodeMirror
                                value={translation.code}
                                language={currentTargetLang}
                                highlightedLines={highlightedTranslationLines}
                                readOnly={true}
                            />
                        )}
                    </div>
                </div>
                {/* Translation Resize Handle */}
                <div
                    className={`absolute top-0 right-0 w-1 h-full cursor-col-resize z-[20] transition-colors ${resizingIdx === 'translation' ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/30'}`}
                    onMouseDown={(e) => onMouseDown(e, 'translation')}
                />
            </div>

            {/* Output Pane */}
            <div className="flex-1 flex flex-col min-w-0 border-l border-slate-800">
                <div className="h-10 bg-slate-900 flex items-center px-4 border-b border-slate-800 shrink-0">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Output</span>
                </div>
                <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-slate-950 leading-6">
                    {error && (
                        <div className="text-red-400 mb-3 p-3 bg-red-950/30 rounded border border-red-900/50">
                            <span className="font-bold">Error:</span> {error}
                        </div>
                    )}
                    {isDebugging && Object.keys(currentVariables).length > 0 && (
                        <div className="mb-3 p-3 bg-slate-800/50 rounded border border-slate-700">
                            <div className="font-bold text-indigo-400 mb-2">Variables:</div>
                            {Object.entries(currentVariables).map(([key, value]) => (
                                <div key={key} className="text-slate-300 ml-2">
                                    <span className="text-indigo-300">{key}</span>: {JSON.stringify(value)}
                                </div>
                            ))}
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
        </div>
    );
}
