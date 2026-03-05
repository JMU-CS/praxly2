import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Play, Trash2, Home, Bug, FastForward, Square, Plus, Share2, Check, ChevronDown, FileJson, ArrowRightLeft, Code, X } from 'lucide-react';

import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { Decoration, EditorView } from '@codemirror/view';
import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';

import { Lexer as PythonLexer } from '../language/python/lexer';
import { Parser as PythonParser } from '../language/python/parser';
import { JavaLexer } from '../language/java/lexer';
import { JavaParser } from '../language/java/parser';
import { CSPLexer } from '../language/csp/lexer';
import { CSPParser } from '../language/csp/parser';
import { PraxisLexer } from '../language/praxis/lexer';
import { PraxisParser } from '../language/praxis/parser';

import { Interpreter } from '../language/interpreter';
import { Translator } from '../language/translator';
import { Debugger } from '../language/debugger';
import type { Program } from '../language/ast';
import { JSONTree } from '../components/JSONTree';
import { OutputPanel } from '../components/OutputPanel';
import { HighlightableCodeMirror } from '../components/HighlightableCodeMirror';
import { getCodeMirrorExtensions } from '../components/editorUtils';
import type { SupportedLang } from '../components/LanguageSelector';
import { encodeEmbed, generateEmbedHTML, copyToClipboard } from '../utils/embedCodec';
import { getRangeLines, findNodesAtLocation } from '../utils/debuggerUtils';
import type { SourceMap } from '../language/visitor';

const SAMPLE_CODE_PYTHON = `x = 10
y = 5.5
name = "Praxly"

def check(val):
  if val > 8:
    return True
  else:
    return False

result = check(x)
print(result)
`;

const SAMPLE_CODE_JAVA = `public class Main {
  public static void main(String[] args) {
    int x = 10;
    System.out.println(x);
  }
}
`;

const SAMPLE_CODE_CSP = `x <- 10
DISPLAY(x)
IF (x > 5) {
  DISPLAY("Big")
}
`;

const SAMPLE_CODE_PRAXIS = `int newScore ( int diceOne, int diceTwo, int oldScore )
  if ( diceOne == diceTwo )
    return 0
  else
    if ( ( diceOne == 6 ) or ( diceTwo == 6 ) )
      return oldScore
    else
      return oldScore + diceOne + diceTwo
    end if
  end if
end newScore`

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
    update(decorations, tr) {
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
    provide: f => EditorView.decorations.from(f)
});

interface Panel {
    id: string;
    lang: SupportedLang;
    width: number;
    sourceMap: SourceMap;
}

export default function EditorPage() {
    const [code, setCode] = useState(SAMPLE_CODE_PRAXIS);
    const [output, setOutput] = useState<string[]>([]);
    const [ast, setAst] = useState<Program | null>(null);
    const [sourceLang, setSourceLang] = useState<SupportedLang>('praxis');
    const [error, setError] = useState<string | null>(null);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [embedCopied, setEmbedCopied] = useState(false);

    // Width for the left-most source editor
    const [editorWidth, setEditorWidth] = useState(window.innerWidth / 2);

    // Manage dynamic panels
    const [panels, setPanels] = useState<Panel[]>([]);

    // Debugger State
    const [isDebugging, setIsDebugging] = useState(false);
    const [isDebugComplete, setIsDebugComplete] = useState(false);
    const [debuggerInstance, setDebuggerInstance] = useState<Debugger | null>(null);
    const [highlightedLines, setHighlightedLines] = useState<number[]>([]);
    const [currentVariables, setCurrentVariables] = useState<Record<string, any>>({});
    const [panelHighlightedLines, setPanelHighlightedLines] = useState<Map<string, number[]>>(new Map());

    // Resizing State
    const [resizingIdx, setResizingIdx] = useState<number | 'editor' | 'output' | null>(null);
    const [outputHeight, setOutputHeight] = useState(176); // Initial height (h-44 = 176px)
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const editorViewRef = useRef<any>(null);

    // Adaptive layout: Split space equally among editor + all open panels
    useEffect(() => {
        const totalItems = panels.length + 1;
        // Strip is w-16 (64px). We subtract it to get the net workspace width.
        const addStripWidth = 64;
        const totalAvailableWidth = window.innerWidth - addStripWidth;
        const equalWidth = totalAvailableWidth / totalItems;

        setEditorWidth(equalWidth);
        setPanels(prev => prev.map(p => ({ ...p, width: equalWidth })));
    }, [panels.length]);

    // Capture EditorView using onCreateEditor callback
    const handleCreateEditor = useCallback((view: any) => {
        editorViewRef.current = view;
        console.log('✓ EditorView captured via onCreateEditor');
    }, []);

    // Handle line highlighting using CodeMirror decorations
    useEffect(() => {
        if (!editorViewRef.current) return;

        // Dispatch the state effect to update highlighted lines
        editorViewRef.current.dispatch({
            effects: highlightLinesEffect.of(highlightedLines)
        });
    }, [highlightedLines]);

    // --- Logic ---
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
                    parser = new PraxisParser(tokens);
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

    useEffect(() => {
        if (sourceLang !== 'ast') {
            try {
                const program = parseCode(sourceLang, code);
                setAst(program);
                setError(null);
            } catch (e: any) {
                setAst(null);
                setError(e.message);
            }
        }
    }, [code, sourceLang, parseCode]);

    // Update panel source maps when AST changes
    useEffect(() => {
        if (!ast || panels.length === 0) return;

        setPanels(prev =>
            prev.map(panel => {
                const translation = getTranslation(panel.lang);
                return { ...panel, sourceMap: translation.sourceMap };
            })
        );
    }, [ast]);

    const handleRun = () => {
        setError(null);
        setOutput([]);
        try {
            const runLang = sourceLang === 'ast' ? 'python' : sourceLang;
            const program = parseCode(runLang as SupportedLang, code);
            if (!program) return;
            setAst(program);

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
            const runLang = sourceLang === 'ast' ? 'python' : sourceLang;
            const program = parseCode(runLang as SupportedLang, code);
            if (!program) return;
            setAst(program);

            // Initialize debugger
            const debugInstance = new Debugger();
            debugInstance.init(program, runLang as SupportedLang);
            setDebuggerInstance(debugInstance);
            setIsDebugging(true);
            setIsDebugComplete(false);
            setCurrentVariables({});
            setOutput(['Debugger initialized. Click Step to begin.']);
            setHighlightedLines([]);
        } catch (e: any) {
            console.error(e);
            setError(e.message);
        }
    };

    const handleDebugStep = () => {
        if (!debuggerInstance) return;

        try {
            const step = debuggerInstance.step();
            if (!step) return;

            // Update current variables pane
            setCurrentVariables(step.variables);

            // Calculate which lines to highlight in source code
            if (step.sourceLocation) {
                // Find all AST nodes at this location, including parent nodes
                const nodesAtLocation = findNodesAtLocation(ast!, step.sourceLocation.start);
                
                // For the source code pane, highlight lines for all nodes at this location
                const sourceHighlightedLines = new Set<number>();
                for (const node of nodesAtLocation) {
                    if (node.loc) {
                        const nodeLines = getRangeLines(code, node.loc.start);
                        nodeLines.forEach(line => sourceHighlightedLines.add(line));
                    }
                }
                setHighlightedLines(Array.from(sourceHighlightedLines));

                // For translation panels, highlight corresponding lines using their source maps
                const nodeIds = nodesAtLocation.map(n => n.id);
                const newPanelHighlights = new Map<string, number[]>();
                panels.forEach(panel => {
                    const highlightedLines = new Set<number>();
                    for (const nodeId of nodeIds) {
                        const lineIndex = panel.sourceMap.get(nodeId);
                        if (lineIndex !== undefined) {
                            highlightedLines.add(lineIndex);
                        }
                    }
                    if (highlightedLines.size > 0) {
                        newPanelHighlights.set(panel.id, Array.from(highlightedLines));
                    }
                });
                setPanelHighlightedLines(newPanelHighlights);
            } else {
                setHighlightedLines([]);
                setPanelHighlightedLines(new Map());
            }

            // Update output with step info
            const outputLines: string[] = [];
            outputLines.push(`--- Step ${step.stepNumber} ---`);
            outputLines.push(`Node: ${step.nodeType}`);
            if (step.sourceLocation) {
                outputLines.push(`Location: ${step.sourceLocation.start} - ${step.sourceLocation.end}`);
            }
            outputLines.push('');

            setOutput(outputLines);

            // Check if execution is complete
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
        setHighlightedLines([]);
        setPanelHighlightedLines(new Map());
        setIsDebugComplete(false);
        setCurrentVariables({});
        setOutput((prev) => [...prev, 'Debugger stopped.']);
    };

    const handleClear = () => {
        setCode('');
        setAst(null);
        setOutput([]);
        setError(null);
    };

    const handleShare = async () => {
        const encoded = encodeEmbed({
            code,
            lang: sourceLang === 'ast' ? 'python' : (sourceLang as any),
        });
        const embedHtml = generateEmbedHTML(encoded);
        const success = await copyToClipboard(embedHtml);
        if (success) {
            setEmbedCopied(true);
            setTimeout(() => setEmbedCopied(false), 2000);
        }
    };

    const getTranslation = (target: SupportedLang): { code: string; sourceMap: SourceMap } => {
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
        
        // Add highlighting field extension for debugging
        baseExtensions.push(highlightedLinesField);
        
        return baseExtensions;
    };

    // Panel Management
    const addPanel = (lang: SupportedLang) => {
        const id = window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(7);
        const translation = getTranslation(lang);
        setPanels([...panels, { id, lang, width: 350, sourceMap: translation.sourceMap }]);
        setShowAddMenu(false);
    };

    const removePanel = (id: string) => {
        setPanels(panels.filter(p => p.id !== id));
    };

    // Resize Handler
    const onMouseDown = (e: React.MouseEvent, index: number | 'editor' | 'output') => {
        setResizingIdx(index);
        e.preventDefault();
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (resizingIdx === null) return;

            if (resizingIdx === 'output') {
                // Resizing output panel (vertical)
                const newHeight = window.innerHeight - e.clientY;
                setOutputHeight(Math.max(50, Math.min(newHeight, window.innerHeight - 100)));
            } else if (resizingIdx === 'editor') {
                // Resizing editor (horizontal)
                setEditorWidth(prev => Math.max(150, prev + e.movementX));
            } else {
                // Resizing dynamic panels (horizontal)
                setPanels(prev => {
                    const newPanels = [...prev];
                    const panel = newPanels[resizingIdx as number];
                    const newWidth = Math.max(100, panel.width + e.movementX);
                    newPanels[resizingIdx as number] = { ...panel, width: newWidth };
                    return newPanels;
                });
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

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
            {/* Header */}
            <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 shadow-sm z-[200]">
                <div className="flex items-center gap-3">
                    <Link to="/v2/" className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <Home size={20} />
                    </Link>
                    <div className="h-6 w-px bg-slate-800 mx-1" />
                    <div className="flex items-center gap-2">
                        <img src='/v2/fallen-leaf_1f342.ico' style={{ width: "32px", height: "32px" }} alt="Logo" />
                        <h1 className="font-bold text-lg text-slate-100 tracking-tight">Praxly <span className="text-indigo-400">2.0</span></h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={handleClear} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors">
                        <Trash2 size={14} /> Clear
                    </button>
                    <button
                        onClick={handleShare}
                        className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                            embedCopied
                                ? 'bg-green-600/20 text-green-400'
                                : 'text-slate-200 bg-slate-700 hover:bg-slate-600'
                        }`}
                    >
                        {embedCopied ? <Check size={14} /> : <Share2 size={14} />}
                        {embedCopied ? 'Copied!' : 'Share'}
                    </button>
                    {!isDebugging ? (
                        <>
                            <button onClick={handleDebugStart} className="flex items-center gap-2 px-4 py-1.5 text-sm font-bold text-slate-200 bg-slate-700 hover:bg-slate-600 rounded-md transition-all">
                                <Bug size={16} /> Debug
                            </button>
                            <button onClick={handleRun} className="flex items-center gap-2 px-4 py-1.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-md shadow-lg shadow-green-900/20 transition-all hover:translate-y-[-1px] active:translate-y-[1px]">
                                <Play size={16} fill="currentColor" /> Run Code
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={handleDebugStep} disabled={isDebugComplete} className="flex items-center gap-2 px-4 py-1.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-all disabled:bg-slate-600 disabled:cursor-not-allowed disabled:hover:bg-slate-600 disabled:opacity-50">
                                <FastForward size={16} fill="currentColor" /> Step
                            </button>
                            <button onClick={handleDebugStop} className="flex items-center gap-2 px-4 py-1.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-md transition-all">
                                <Square size={16} fill="currentColor" /> Stop
                            </button>
                        </>
                    )}
                </div>
            </header>

            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 flex min-h-0 relative overflow-visible">
                    {/* Source Editor Panel */}
                    <div
                        className="flex shrink-0 relative group/editor z-[10]"
                        style={{ width: editorWidth }}
                    >
                        <div className="flex-1 flex flex-col border-r border-slate-800 overflow-hidden">
                            <div className="h-10 bg-slate-900 flex items-center justify-between px-4 border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-500 shrink-0">
                                <div className="flex items-center relative group h-full">
                                    <button className="flex items-center gap-2 py-2 text-indigo-400 hover:text-indigo-300 transition-colors uppercase">
                                        {sourceLang === 'ast' ? 'AST VIEW' : sourceLang}
                                        <ChevronDown size={12} />
                                    </button>
                                    <div className="absolute top-full left-0 w-40 bg-slate-800 border border-slate-700 hidden group-hover:block rounded-md shadow-xl overflow-hidden mt-1 z-[110]">
                                        <button onClick={() => { setSourceLang('csp'); setCode(SAMPLE_CODE_CSP); }} className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-700 transition-colors">CSP</button>
                                        <button onClick={() => { setSourceLang('java'); setCode(SAMPLE_CODE_JAVA); }} className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-700 transition-colors">Java</button>
                                        <button onClick={() => { setSourceLang('praxis'); setCode(SAMPLE_CODE_PRAXIS); }} className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-700 transition-colors">Praxis</button>
                                        <button onClick={() => { setSourceLang('python'); setCode(SAMPLE_CODE_PYTHON); }} className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-700 transition-colors">Python</button>
                                    </div>
                                </div>
                                <span>SOURCE</span>
                            </div>
                            <div className="flex-1 relative bg-slate-950 overflow-hidden" ref={editorRef}>
                                <CodeMirror
                                    value={code}
                                    height="100%"
                                    theme={vscodeDark}
                                    extensions={getExtensions(sourceLang === 'ast' ? 'python' : sourceLang)}
                                    onChange={(val) => {
                                        setCode(val);
                                        if (isDebugging) {
                                            setHighlightedLines([]);
                                            setPanelHighlightedLines(new Map());
                                        }
                                    }}
                                    onCreateEditor={handleCreateEditor}
                                    className="text-sm h-full font-mono"
                                />
                            </div>
                        </div>
                        {/* Editor Resize Handle */}
                        <div
                            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize z-[20] transition-colors ${resizingIdx === 'editor' ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/30'}`}
                            onMouseDown={(e) => onMouseDown(e, 'editor')}
                        />
                    </div>

                    {/* Scrollable container for panels */}
                    <div className="flex-1 flex overflow-x-auto scrollbar-hide relative z-[10] bg-slate-900" ref={containerRef}>
                        {panels.map((panel, idx) => (
                            <div
                                key={panel.id}
                                className="flex shrink-0 border-r border-slate-800 last:border-0 relative"
                                style={{ width: panel.width }}
                            >
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    <div className="h-10 bg-slate-900/50 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
                                        <div className="flex items-center gap-2">
                                            {panel.lang === 'ast' ? <FileJson size={14} className="text-indigo-400" /> : <ArrowRightLeft size={14} className="text-indigo-400" />}
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{panel.lang} View</span>
                                        </div>
                                        <button
                                            onClick={() => removePanel(panel.id)}
                                            className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-hidden bg-slate-950 relative">
                                        {panel.lang === 'ast' ? (
                                            <div className="text-xs font-mono h-full overflow-auto p-4 custom-scrollbar">
                                                {ast ? <JSONTree data={ast} /> : <div className="text-slate-700 text-center mt-10 italic">Valid code required...</div>}
                                            </div>
                                        ) : (
                                            <HighlightableCodeMirror
                                                value={getTranslation(panel.lang).code}
                                                language={panel.lang}
                                                highlightedLines={panelHighlightedLines.get(panel.id) || []}
                                                readOnly={true}
                                            />
                                        )}
                                    </div>
                                </div>
                                {/* Resize Handle for Panel */}
                                <div
                                    className={`absolute top-0 right-0 w-1 h-full cursor-col-resize z-[20] transition-colors ${resizingIdx === idx ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/30'}`}
                                    onMouseDown={(e) => onMouseDown(e, idx)}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Persistent Add Panel Strip - Outside scroll container to prevent clipping */}
                    <div className="w-16 flex flex-col items-center pt-4 bg-slate-900 border-l border-slate-800 shrink-0 relative z-[150] shadow-[-10px_0_20px_rgba(0,0,0,0.5)]">
                        <div className="relative">
                            <button
                                onClick={() => setShowAddMenu(!showAddMenu)}
                                className="p-3 bg-slate-800 hover:bg-indigo-600 rounded-xl text-indigo-400 hover:text-white transition-all shadow-lg active:scale-90 border border-slate-700"
                                title="Add Translation View"
                            >
                                <Plus size={24} />
                            </button>

                            {showAddMenu && (
                                <div className="absolute top-0 right-full mr-3 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.7)] overflow-hidden z-[999] animate-in fade-in slide-in-from-right-2 duration-200">
                                    <div className="p-3 text-[11px] font-bold text-slate-400 border-b border-slate-700 bg-slate-900/50 uppercase tracking-widest">
                                        Open View
                                    </div>
                                    <div className="p-1">
                                        {(['python', 'java', 'csp', 'ast', 'praxis'] as SupportedLang[]).map(l => (
                                            <button
                                                key={l}
                                                onClick={() => addPanel(l)}
                                                className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-indigo-600 hover:text-white rounded-md transition-colors capitalize group"
                                            >
                                                {l === 'ast' ? <FileJson size={14} className="opacity-50 group-hover:opacity-100" /> : <Code size={14} className="opacity-50 group-hover:opacity-100" />}
                                                {
                                                    {
                                                        'ast': 'AST',
                                                        'csp': 'CSP',
                                                        'java': 'Java',
                                                        'praxis': 'Paxis',
                                                        'python': 'Python',
                                                    }[l] || l
                                                }
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Console Panel */}
                <OutputPanel
                    output={output}
                    error={error}
                    variables={currentVariables}
                    showVariables={isDebugging}
                    height={outputHeight}
                    resizeActive={resizingIdx === 'output'}
                    onResize={(e) => onMouseDown(e, 'output')}
                />
            </main>
        </div>
    );
}
