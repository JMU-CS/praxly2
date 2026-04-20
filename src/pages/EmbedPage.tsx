/**
 * EmbedPage component that provides an embeddable code editor interface.
 * Similar to EditorPage but optimized for sharing and embedding in external websites.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Play, AlertCircle, FastForward, Square, ChevronDown } from 'lucide-react';

import { decodeEmbed, encodeEmbed, type EmbedData } from '../utils/embedCodec';
import type { Program } from '../language/ast';
import type { SupportedLang } from '../components/LanguageSelector';
import { HighlightableCodeMirror } from '../components/HighlightableCodeMirror';
import { JSONTree } from '../components/JSONTree';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { getCodeMirrorExtensions } from '../utils/editorUtils';
import { highlightedLinesField, dispatchLineHighlighting } from '../utils/codemirrorConfig';
import { useCodeParsing } from '../hooks/useCodeParsing';
import { useCodeDebugger } from '../hooks/useCodeDebugger';
import { Debugger } from '../language/debugger';

export default function EmbedPage() {
  const [searchParams] = useSearchParams();
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

  // Get hooks for parsing and debugging
  const { parseCode, getTranslation } = useCodeParsing();
  const {
    isDebugging,
    setIsDebugging,
    isDebugComplete,
    setIsDebugComplete,
    highlightedSourceLines,
    setHighlightedSourceLines,
    highlightedTranslationLines,
    setHighlightedTranslationLines,
    currentVariables,
    waitingForInput,
    inputPrompt,
    initDebugger,
    stepDebugger,
    stopDebugger,
    provideInput,
  } = useCodeDebugger(getTranslation);

  // Normal mode input handling
  const [waitingForNormalInput, setWaitingForNormalInput] = useState(false);
  const [normalModeInputPrompt, setNormalModeInputPrompt] = useState<string>('');
  const [currentInterpreter, setCurrentInterpreter] = useState<any>(null);

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
      const program = parseCode(embedData.lang as SupportedLang, embedData.code);
      setAst(program);
      setError(null);
    } catch (e: any) {
      setError(e.message);
      setAst(null);
    }
  }, [embedData, parseCode]);

  // Handle line highlighting using CodeMirror decorations
  useEffect(() => {
    dispatchLineHighlighting(editorViewRef, highlightedSourceLines);
  }, [highlightedSourceLines]);

  const handleCreateEditor = useCallback((view: any) => {
    editorViewRef.current = view;
  }, []);

  const getExtensions = (lang: SupportedLang) => {
    const baseExtensions = getCodeMirrorExtensions(lang);
    baseExtensions.push(highlightedLinesField);
    return baseExtensions;
  };

  const handleRun = () => {
    setError(null);
    setOutput([]);
    setWaitingForNormalInput(false);
    try {
      const program = ast;
      if (!program) return;

      // Use debugger-based approach from the start so we don't re-execute on input
      const debugger_ = new Debugger();
      debugger_.init(
        program,
        (embedData?.lang || 'python') as SupportedLang,
        embedData?.code || ''
      );

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
      const program = ast;
      if (!program) return;

      initDebugger(program, (embedData?.lang || 'python') as SupportedLang, embedData?.code || '');
      setOutput(['Debugger initialized. Click Step to begin.']);
    } catch (e: any) {
      console.error(e);
      setError(e.message);
    }
  };

  const handleDebugStep = () => {
    if (!ast || !embedData?.code) return;

    try {
      const result = stepDebugger(ast, embedData.code, currentTargetLang);
      if (!result) return;

      setHighlightedSourceLines(result.sourceHighlightedLines);
      setHighlightedTranslationLines(result.translationHighlightedLines);
      setOutput(result.outputLines);

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
    setOutput((prev) => [...prev, 'Debugger stopped.']);
  };

  const handleSubmitInput = (input: string) => {
    provideInput(input);
    // Echo removed, handled by interpreter

    // Automatically continue execution after input is provided
    if (ast && embedData?.code) {
      setTimeout(() => {
        const result = stepDebugger(ast, embedData.code, currentTargetLang);
        if (!result) return;

        setHighlightedSourceLines(result.sourceHighlightedLines);
        setHighlightedTranslationLines(result.translationHighlightedLines);
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
          // Update output with what we have so far
          cumulativeOutput = [...(steps?.output || [])];
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
        cumulativeOutput = [...(steps?.output || [])];
        // Input echo is now handled by the interpreter
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

  const handleOpenInEditor = () => {
    if (!embedData) return;
    const encoded = encodeEmbed({
      code: embedData.code,
      lang: embedData.lang as any,
    });
    const targetLang = showAst ? 'ast' : currentTargetLang;
    window.open(`/v2/editor?code=${encoded}&targetLang=${targetLang}`, '_blank');
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

  const translation = getTranslation(ast, currentTargetLang);

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
              editable={true}
              onChange={(val) => {
                setEmbedData((prev) => (prev ? { ...prev, code: val } : null));
              }}
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
                    {(['python', 'java', 'csp', 'praxis'] as SupportedLang[]).map((lang) => (
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
                {ast ? (
                  <JSONTree data={ast} />
                ) : (
                  <div className="text-slate-700 text-center mt-10 italic">
                    Valid code required...
                  </div>
                )}
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
        <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-slate-950 leading-6 flex flex-col">
          <div className="flex-1 overflow-auto">
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
                <div
                  key={idx}
                  className="flex gap-4 border-b border-slate-900/40 last:border-0 py-0.5"
                >
                  <span className="text-slate-700 select-none w-6 text-right flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-slate-300 break-all">{line}</span>
                </div>
              ))
            )}
          </div>
          {(waitingForInput || waitingForNormalInput) && (
            <div className="border-t border-slate-800 bg-slate-950 mt-4 pt-4 flex flex-col gap-2 shrink-0">
              {(inputPrompt || normalModeInputPrompt) && (
                <div className="text-slate-400 text-xs font-mono">
                  {inputPrompt || normalModeInputPrompt}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter input..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const input = (e.target as HTMLInputElement).value;
                      if (waitingForNormalInput) {
                        handleNormalModeInputSubmit(input);
                      } else {
                        handleSubmitInput(input);
                      }
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                  data-testid="stdin-input"
                  autoFocus={waitingForInput || waitingForNormalInput}
                />
                <button
                  onClick={(e) => {
                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement)
                      .value;
                    if (waitingForNormalInput) {
                      handleNormalModeInputSubmit(input);
                    } else {
                      handleSubmitInput(input);
                    }
                    (e.currentTarget.previousElementSibling as HTMLInputElement).value = '';
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded transition-colors shrink-0"
                >
                  Submit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
