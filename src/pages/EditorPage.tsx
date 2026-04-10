import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Play, Trash2, Home, Bug, FastForward, Square, Plus, Share2, Check, ChevronDown, FileJson, ArrowRightLeft, Code, X } from 'lucide-react';

import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';

import type { Program } from '../language/ast';
import { computeMultiplePanelHighlighting } from '../utils/debugHandlers';
import { JSONTree } from '../components/JSONTree';
import { OutputPanel } from '../components/OutputPanel';
import { HighlightableCodeMirror } from '../components/HighlightableCodeMirror';
import { getCodeMirrorExtensions } from '../utils/editorUtils';
import type { SupportedLang } from '../components/LanguageSelector';
import { encodeEmbed, generateEmbedHTML, copyToClipboard, decodeEmbed } from '../utils/embedCodec';
import { SAMPLE_CODE_PYTHON, SAMPLE_CODE_JAVA, SAMPLE_CODE_CSP, SAMPLE_CODE_PRAXIS } from '../utils/sampleCodes';
import type { SourceMap } from '../language/visitor';
import { highlightedLinesField, dispatchLineHighlighting } from '../utils/codemirrorConfig';
import { useCodeParsing } from '../hooks/useCodeParsing';
import { useCodeDebugger } from '../hooks/useCodeDebugger';
import { Debugger } from '../language/debugger';

interface Panel {
    id: string;
    lang: SupportedLang;
    width: number;
    sourceMap: SourceMap;
}

export default function EditorPage() {
    const [searchParams] = useSearchParams();
    const [code, setCode] = useState(SAMPLE_CODE_PRAXIS);
    const [output, setOutput] = useState<string[]>([]);
    const [ast, setAst] = useState<Program | null>(null);
    const [sourceLang, setSourceLang] = useState<SupportedLang>('praxis');
    const [error, setError] = useState<string | null>(null);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showSourceLangDropdown, setShowSourceLangDropdown] = useState(false);
    const [embedCopied, setEmbedCopied] = useState(false);
    const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
    const [dragOverPanelId, setDragOverPanelId] = useState<string | null>(null);

    // Width for the left-most source editor
    const [editorWidth, setEditorWidth] = useState(window.innerWidth / 2);

    // Manage dynamic panels
    const [panels, setPanels] = useState<Panel[]>([]);

    // Normal mode input handling
    const [waitingForNormalInput, setWaitingForNormalInput] = useState(false);
    const [normalModeInputPrompt, setNormalModeInputPrompt] = useState<string>('');
    const [currentInterpreter, setCurrentInterpreter] = useState<any>(null);

    // Get hooks for parsing and debugging
    const { parseCode, getTranslation } = useCodeParsing();
    const {
        isDebugging,
        setIsDebugging,
        isDebugComplete,
        setIsDebugComplete,
        highlightedSourceLines,
        setHighlightedSourceLines,
        currentVariables,
        waitingForInput,
        inputPrompt,
        initDebugger,
        stepDebugger,
        stopDebugger,
        provideInput
    } = useCodeDebugger(getTranslation);

    // Resizing State
    const [resizingIdx, setResizingIdx] = useState<number | 'editor' | 'output' | null>(null);
    const [outputHeight, setOutputHeight] = useState(176); // Initial height (h-44 = 176px)
    const [panelHighlightedLines, setPanelHighlightedLines] = useState<Map<string, number[]>>(new Map());
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const editorViewRef = useRef<any>(null);

    // Load from embed URL parameter on mount
    useEffect(() => {
        const codeParam = searchParams.get('code');
        const targetLangParam = searchParams.get('targetLang');
        if (codeParam) {
            try {
                const decoded = decodeEmbed(codeParam);
                if (decoded) {
                    setCode(decoded.code);
                    setSourceLang(decoded.lang as SupportedLang);
                    
                    // Auto-open translation panel if targetLang is specified
                    if (targetLangParam && targetLangParam !== 'ast') {
                        // Defer panel creation to next render to ensure AST is parsed first
                        setTimeout(() => {
                            setPanels(prev => {
                                // Only add if not already present
                                if (!prev.some(p => p.lang === targetLangParam)) {
                                    const id = window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(7);
                                    return [...prev, { id, lang: targetLangParam as SupportedLang, width: 350, sourceMap: new Map() }];
                                }
                                return prev;
                            });
                        }, 0);
                    }
                }
            } catch (e) {
                console.error('Failed to decode embed:', e);
            }
        }
    }, [searchParams]);

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
        dispatchLineHighlighting(editorViewRef, highlightedSourceLines);
    }, [highlightedSourceLines]);

    // Parse code when it changes
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
                const { sourceMap } = getTranslation(ast, panel.lang);
                return { ...panel, sourceMap };
            })
        );
    }, [ast, code, getTranslation]);

    const handleRun = () => {
        setError(null);
        setOutput([]);
        setWaitingForNormalInput(false);
        try {
            const runLang = sourceLang === 'ast' ? 'python' : sourceLang;
            const program = parseCode(runLang as SupportedLang, code);
            if (!program) return;
            setAst(program);

            // Use debugger-based approach from the start so we don't re-execute on input
            const debugger_ = new Debugger();
            debugger_.init(program, runLang as SupportedLang, code);
            
            // Run all steps until completion or input needed
            let result = debugger_.step();
            
            while (result && !result.isComplete) {
                // result.output is already cumulative, so just set it directly
                setOutput(result.output);
                
                // Check if waiting for input
                if (result.waitingForInput) {
                    setCurrentInterpreter(debugger_);
                    setWaitingForNormalInput(true);
                    setNormalModeInputPrompt(result.inputPrompt || '');
                    return;
                }
                
                result = debugger_.step();
            }
            
            // Final step output
            if (result) {
                setOutput(result.output);
            }
            
            setCurrentInterpreter(null);
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

            initDebugger(program, runLang as SupportedLang, code);
            setOutput(['Debugger initialized. Click Step to begin.']);
            setHighlightedSourceLines([]);
            setPanelHighlightedLines(new Map());
        } catch (e: any) {
            console.error(e);
            setError(e.message);
        }
    };

    const handleDebugStep = () => {
        if (!ast) return;

        try {
            // Use the hook's stepDebugger function which properly updates currentVariables state
            const result = stepDebugger(ast, code, sourceLang === 'ast' ? 'python' : sourceLang);
            if (!result) return;

            setHighlightedSourceLines(result.sourceHighlightedLines);

            // Compute highlighted lines for each open panel using the step's location info
            const panelHighlights = computeMultiplePanelHighlighting(
                ast,
                panels,
                getTranslation,
                result.step?.sourceLocation || null
            );
            setPanelHighlightedLines(panelHighlights);

            setOutput(result.outputLines);

            // Check if execution is complete
            if (result.isComplete) {
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
        stopDebugger();
        setIsDebugging(false);
        setHighlightedSourceLines([]);
        setPanelHighlightedLines(new Map());
        setOutput((prev) => [...prev, 'Debugger stopped.']);
    };

    const handleSubmitInput = (input: string) => {
        provideInput(input);
        // Input echo is now handled by the interpreter
        
        // Automatically continue execution after input is provided
        if (ast) {
            setTimeout(() => {
                const result = stepDebugger(ast, code, sourceLang === 'ast' ? 'python' : sourceLang);
                if (!result) return;

                setHighlightedSourceLines(result.sourceHighlightedLines);

                const panelHighlights = computeMultiplePanelHighlighting(
                    ast,
                    panels,
                    getTranslation,
                    result.step?.sourceLocation || null
                );
                setPanelHighlightedLines(panelHighlights);

                // For debug mode, outputLines is just the new output lines for this step
                // But since interpreter output is cumulative, stepDebugger might return cumulative or diff?
                // Let's check useCodeDebugger
                setOutput((prev) => [...prev, ...result.outputLines]);

                if (result.isComplete) {
                    setIsDebugComplete(true);
                    setOutput((prev) => [...prev, 'Execution complete.']);
                }
            }, 0);
        }
    };

    const handleNormalModeInputSubmit = (input: string) => {
        if (!currentInterpreter) return;

        try {
            // Provide input to the debugger FIRST, before stepping
            if (currentInterpreter.provideInput) {
                currentInterpreter.provideInput(input);
            }

            // Continue stepping until all remaining statements are executed
            let steps = (currentInterpreter as any).step?.();
            let cumulativeOutput: string[] = steps?.output || [];
            
            while (steps && !steps.isComplete) {
                // Check if waiting for input
                if (steps.waitingForInput) {
                    setWaitingForNormalInput(true);
                    setNormalModeInputPrompt(steps.inputPrompt || '');
                    setOutput(cumulativeOutput);
                    return;
                }
                
                // Update cumulative output from this step
                cumulativeOutput = [...(steps?.output || [])];
                setOutput(cumulativeOutput);
                
                // Step to next
                steps = (currentInterpreter as any).step?.();
            }
            
            // Final output when complete
            if (steps) {
                // Input echo is now handled by the interpreter to ensure correct ordering
                cumulativeOutput = [...(steps?.output || [])];
                setOutput(cumulativeOutput);
            }
            
            setWaitingForNormalInput(false);
            setNormalModeInputPrompt('');
            setCurrentInterpreter(null);
        } catch (e: any) {
            console.error('Error in input submit:', e);
            setError(e.message);
            setOutput((prev) => [...prev, `Error: ${e.message}`]);
            setWaitingForNormalInput(false);
            setCurrentInterpreter(null);
        }
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

    const getExtensions = (lang: SupportedLang) => {
        const baseExtensions = getCodeMirrorExtensions(lang);
        baseExtensions.push(highlightedLinesField);
        return baseExtensions;
    };

    // Panel Management
    const addPanel = (lang: SupportedLang) => {
        const id = window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(7);
        const translation = getTranslation(ast, lang);
        setPanels([...panels, { id, lang, width: 350, sourceMap: translation.sourceMap }]);
        setShowAddMenu(false);
    };

    const removePanel = (id: string) => {
        setPanels(panels.filter(p => p.id !== id));
    };

    const reorderPanels = (sourceId: string, targetId: string) => {
        if (sourceId === targetId) return;

        setPanels(prev => {
            const sourceIndex = prev.findIndex(panel => panel.id === sourceId);
            const targetIndex = prev.findIndex(panel => panel.id === targetId);
            if (sourceIndex === -1 || targetIndex === -1) return prev;

            const reordered = [...prev];
            const [moved] = reordered.splice(sourceIndex, 1);
            reordered.splice(targetIndex, 0, moved);
            return reordered;
        });
    };

    const handlePanelDragStart = (e: React.DragEvent<HTMLDivElement>, panelId: string) => {
        setDraggedPanelId(panelId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', panelId);
    };

    const handlePanelDragOver = (e: React.DragEvent<HTMLDivElement>, panelId: string) => {
        if (!draggedPanelId || draggedPanelId === panelId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverPanelId !== panelId) {
            setDragOverPanelId(panelId);
        }
    };

    const handlePanelDrop = (e: React.DragEvent<HTMLDivElement>, panelId: string) => {
        e.preventDefault();
        const sourceId = draggedPanelId || e.dataTransfer.getData('text/plain');
        if (!sourceId || sourceId === panelId) {
            setDragOverPanelId(null);
            setDraggedPanelId(null);
            return;
        }

        reorderPanels(sourceId, panelId);
        setDragOverPanelId(null);
        setDraggedPanelId(null);
    };

    const handlePanelDragEnd = () => {
        setDraggedPanelId(null);
        setDragOverPanelId(null);
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

    // Close source language dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.source-lang-dropdown')) {
                setShowSourceLangDropdown(false);
            }
        };

        if (showSourceLangDropdown) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showSourceLangDropdown]);

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
                                <div className="flex items-center relative h-full source-lang-dropdown">
                                    <button 
                                        onClick={() => setShowSourceLangDropdown(!showSourceLangDropdown)}
                                        className="flex items-center gap-2 py-2 text-indigo-400 hover:text-indigo-300 transition-colors uppercase"
                                    >
                                        {sourceLang === 'ast' ? 'AST VIEW' : sourceLang}
                                        <ChevronDown size={12} />
                                    </button>
                                    {showSourceLangDropdown && (
                                        <div className="absolute top-full left-0 w-40 bg-slate-800 border border-slate-700 rounded-md shadow-xl overflow-hidden mt-1 z-[110]">
                                            <button onClick={() => { setSourceLang('csp'); setCode(SAMPLE_CODE_CSP); setShowSourceLangDropdown(false); }} className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-700 transition-colors">CSP</button>
                                            <button onClick={() => { setSourceLang('java'); setCode(SAMPLE_CODE_JAVA); setShowSourceLangDropdown(false); }} className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-700 transition-colors">Java</button>
                                            <button onClick={() => { setSourceLang('praxis'); setCode(SAMPLE_CODE_PRAXIS); setShowSourceLangDropdown(false); }} className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-700 transition-colors">Praxis</button>
                                            <button onClick={() => { setSourceLang('python'); setCode(SAMPLE_CODE_PYTHON); setShowSourceLangDropdown(false); }} className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-700 transition-colors">Python</button>
                                        </div>
                                    )}
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
                                            setHighlightedSourceLines([]);
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
                                className={`flex shrink-0 border-r border-slate-800 last:border-0 relative transition-opacity ${
                                    draggedPanelId === panel.id ? 'opacity-60' : 'opacity-100'
                                } ${dragOverPanelId === panel.id ? 'outline outline-2 outline-indigo-500 outline-offset-[-2px]' : ''}`}
                                style={{ width: panel.width }}
                                onDragOver={(e) => handlePanelDragOver(e, panel.id)}
                                onDrop={(e) => handlePanelDrop(e, panel.id)}
                            >
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    <div
                                        className="h-10 bg-slate-900/50 flex items-center justify-between px-4 border-b border-slate-800 shrink-0 cursor-grab active:cursor-grabbing"
                                        draggable
                                        onDragStart={(e) => handlePanelDragStart(e, panel.id)}
                                        onDragEnd={handlePanelDragEnd}
                                    >
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
                                                value={getTranslation(ast, panel.lang).code}
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
                                        {(['python', 'java', 'csp', 'ast', 'praxis'] as SupportedLang[]).map(l => {
                                            const isSelected = panels.some(p => p.lang === l);
                                            return (
                                                <button
                                                    key={l}
                                                    onClick={() => !isSelected && addPanel(l)}
                                                    disabled={isSelected}
                                                    className={`flex items-center gap-3 w-full text-left px-3 py-2.5 text-xs rounded-md transition-colors capitalize group ${
                                                        isSelected
                                                            ? 'text-slate-600 cursor-not-allowed opacity-50'
                                                            : 'text-slate-300 hover:bg-indigo-600 hover:text-white'
                                                    }`}
                                                >
                                                    {l === 'ast' ? <FileJson size={14} className="opacity-50 group-hover:opacity-100" /> : <Code size={14} className="opacity-50 group-hover:opacity-100" />}
                                                    {
                                                        {
                                                            'ast': 'AST',
                                                            'csp': 'CSP',
                                                            'java': 'Java',
                                                            'praxis': 'Praxis',
                                                            'python': 'Python',
                                                        }[l] || l
                                                    }
                                                </button>
                                            );
                                        })}
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
                    waitingForInput={waitingForInput || waitingForNormalInput}
                    inputPrompt={inputPrompt || normalModeInputPrompt}
                    onSubmitInput={(input) => {
                        if (waitingForNormalInput) {
                            handleNormalModeInputSubmit(input);
                        } else {
                            handleSubmitInput(input);
                        }
                    }}
                />
            </main>
        </div>
    );
}
