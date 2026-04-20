import { useState, useCallback, useEffect, useRef } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { Program } from '../language/ast';
import type { SupportedLang } from '../components/LanguageSelector';
import { OutputPanel } from '../components/OutputPanel';
import { highlightedLinesField, dispatchLineHighlighting } from '../utils/codemirrorConfig';
import { computeMultiplePanelHighlighting } from '../utils/debugHandlers';
import { decodeEmbed, encodeEmbed, generateEmbedHTML, copyToClipboard } from '../utils/embedCodec';
import { getCodeMirrorExtensions } from '../utils/editorUtils';
import {
  SAMPLE_CODE_CSP,
  SAMPLE_CODE_JAVA,
  SAMPLE_CODE_PRAXIS,
  SAMPLE_CODE_PYTHON,
} from '../utils/sampleCodes';
import { useCodeParsing } from '../hooks/useCodeParsing';
import { useCodeDebugger } from '../hooks/useCodeDebugger';
import { Debugger } from '../language/debugger';

import { EditorHeader } from '../components/editor/EditorHeader';
import { SourcePane } from '../components/editor/SourcePane';
import { TranslationPaneItem } from '../components/editor/TranslationPaneItem';
import { AddPanelStrip } from '../components/editor/AddPanelStrip';
import { AiSidePanel } from '../components/editor/AiSidePanel';
import type { Panel } from '../components/editor/types';

const SAMPLE_BY_LANGUAGE: Record<'csp' | 'java' | 'praxis' | 'python', string> = {
  csp: SAMPLE_CODE_CSP,
  java: SAMPLE_CODE_JAVA,
  praxis: SAMPLE_CODE_PRAXIS,
  python: SAMPLE_CODE_PYTHON,
};

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
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showAiSidePanel, setShowAiSidePanel] = useState(false);
  const [showMemDia, setShowMemDia] = useState(false);
  const [aiPanelWidth, setAiPanelWidth] = useState(320);
  const [isResizingAiPanel, setIsResizingAiPanel] = useState(false);
  const [resizingMemDiaPaneId, setResizingMemDiaPaneId] = useState<string | null>(null);
  const [memDiaHeights, setMemDiaHeights] = useState<Record<string, number>>({});

  const [editorWidth, setEditorWidth] = useState(window.innerWidth / 2);
  const [panels, setPanels] = useState<Panel[]>([]);

  const [waitingForNormalInput, setWaitingForNormalInput] = useState(false);
  const [normalModeInputPrompt, setNormalModeInputPrompt] = useState<string>('');
  const [currentInterpreter, setCurrentInterpreter] = useState<any>(null);

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
    provideInput,
  } = useCodeDebugger(getTranslation);

  const [resizingIdx, setResizingIdx] = useState<number | 'editor' | 'output' | null>(null);
  const [outputHeight, setOutputHeight] = useState(176);
  const [panelHighlightedLines, setPanelHighlightedLines] = useState<Map<string, number[]>>(
    new Map()
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<any>(null);

  const getMemDiaHeight = (paneId: string) => memDiaHeights[paneId] ?? 160;

  const onMemDiaResizeMouseDown = (e: MouseEvent, paneId: string) => {
    e.preventDefault();
    setResizingMemDiaPaneId(paneId);
  };

  const handleSourceLanguageChange = (lang: SupportedLang) => {
    setSourceLang(lang);
    if (lang !== 'ast') {
      setCode(SAMPLE_BY_LANGUAGE[lang as 'csp' | 'java' | 'praxis' | 'python']);
    }
    setShowSourceLangDropdown(false);
  };

  useEffect(() => {
    const codeParam = searchParams.get('code');
    const targetLangParam = searchParams.get('targetLang');

    if (!codeParam) return;

    try {
      const decoded = decodeEmbed(codeParam);
      if (!decoded) return;

      setCode(decoded.code);
      setSourceLang(decoded.lang as SupportedLang);

      if (
        targetLangParam &&
        targetLangParam !== 'ast' &&
        targetLangParam !== decoded.lang &&
        !panels.some((p) => p.lang === targetLangParam)
      ) {
        setTimeout(() => {
          setPanels((prev) => {
            if (prev.some((p) => p.lang === targetLangParam)) {
              return prev;
            }

            const id = window.crypto?.randomUUID
              ? window.crypto.randomUUID()
              : Math.random().toString(36).substring(7);

            return [
              ...prev,
              {
                id,
                lang: targetLangParam as SupportedLang,
                width: 350,
                sourceMap: new Map(),
              },
            ];
          });
        }, 0);
      }
    } catch (e) {
      console.error('Failed to decode embed:', e);
    }
  }, [searchParams]);

  useEffect(() => {
    const totalItems = panels.length + 1;
    const addStripWidth = 64;
    const totalAvailableWidth = window.innerWidth - addStripWidth;
    const equalWidth = totalAvailableWidth / totalItems;

    setEditorWidth(equalWidth);
    setPanels((prev) => prev.map((p) => ({ ...p, width: equalWidth })));
  }, [panels.length]);

  const handleCreateEditor = useCallback((view: any) => {
    editorViewRef.current = view;
  }, []);

  useEffect(() => {
    dispatchLineHighlighting(editorViewRef, highlightedSourceLines);
  }, [highlightedSourceLines]);

  useEffect(() => {
    if (sourceLang === 'ast') return;

    try {
      const program = parseCode(sourceLang, code);
      setAst(program);
      setError(null);
    } catch (e: any) {
      setAst(null);
      setError(e.message);
    }
  }, [code, sourceLang, parseCode]);

  useEffect(() => {
    if (!ast || panels.length === 0) return;

    setPanels((prev) =>
      prev.map((panel) => {
        const { sourceMap } = getTranslation(ast, panel.lang);
        return { ...panel, sourceMap };
      })
    );
  }, [ast, getTranslation]);

  const handleRun = () => {
    setError(null);
    setOutput([]);
    setWaitingForNormalInput(false);

    try {
      const runLang = sourceLang === 'ast' ? 'python' : sourceLang;
      const program = parseCode(runLang as SupportedLang, code);
      if (!program) return;

      setAst(program);

      const debuggerInstance = new Debugger();
      debuggerInstance.init(program, runLang as SupportedLang, code);

      let result = debuggerInstance.step();
      while (result && !result.isComplete) {
        setOutput(result.output);

        if (result.waitingForInput) {
          setCurrentInterpreter(debuggerInstance);
          setWaitingForNormalInput(true);
          setNormalModeInputPrompt(result.inputPrompt || '');
          return;
        }

        result = debuggerInstance.step();
      }

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
    setHighlightedSourceLines([]);
    setPanelHighlightedLines(new Map());
    setOutput((prev) => [...prev, 'Debugger stopped.']);
  };

  const handleSubmitInput = (input: string) => {
    provideInput(input);

    if (!ast) return;

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
      setOutput((prev) => [...prev, ...result.outputLines]);

      if (result.isComplete) {
        setIsDebugComplete(true);
        setOutput((prev) => [...prev, 'Execution complete.']);
      }
    }, 0);
  };

  const handleNormalModeInputSubmit = (input: string) => {
    if (!currentInterpreter) return;

    try {
      if (currentInterpreter.provideInput) {
        currentInterpreter.provideInput(input);
      }

      let steps = (currentInterpreter as any).step?.();
      let cumulativeOutput: string[] = steps?.output || [];

      while (steps && !steps.isComplete) {
        if (steps.waitingForInput) {
          setWaitingForNormalInput(true);
          setNormalModeInputPrompt(steps.inputPrompt || '');
          setOutput(cumulativeOutput);
          return;
        }

        cumulativeOutput = [...(steps?.output || [])];
        setOutput(cumulativeOutput);
        steps = (currentInterpreter as any).step?.();
      }

      if (steps) {
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

  const addPanel = (lang: SupportedLang) => {
    if (lang === sourceLang || panels.some((p) => p.lang === lang)) {
      setShowAddMenu(false);
      return;
    }

    const id = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : Math.random().toString(36).substring(7);

    const translation = getTranslation(ast, lang);
    setPanels((prev) => [...prev, { id, lang, width: 350, sourceMap: translation.sourceMap }]);
    setShowAddMenu(false);
  };

  const removePanel = (id: string) => {
    setPanels((prev) => prev.filter((panel) => panel.id !== id));
  };

  const reorderPanels = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    setPanels((prev) => {
      const sourceIndex = prev.findIndex((panel) => panel.id === sourceId);
      const targetIndex = prev.findIndex((panel) => panel.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;

      const reordered = [...prev];
      const [moved] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      return reordered;
    });
  };

  const handlePanelDragStart = (e: DragEvent<HTMLDivElement>, panelId: string) => {
    setDraggedPanelId(panelId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', panelId);
  };

  const handlePanelDragOver = (e: DragEvent<HTMLDivElement>, panelId: string) => {
    if (!draggedPanelId || draggedPanelId === panelId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverPanelId !== panelId) {
      setDragOverPanelId(panelId);
    }
  };

  const handlePanelDrop = (e: DragEvent<HTMLDivElement>, panelId: string) => {
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

  const onMouseDown = (e: MouseEvent, index: number | 'editor' | 'output') => {
    setResizingIdx(index);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (resizingIdx === null) return;

      if (resizingIdx === 'output') {
        const newHeight = window.innerHeight - e.clientY;
        setOutputHeight(Math.max(50, Math.min(newHeight, window.innerHeight - 100)));
      } else if (resizingIdx === 'editor') {
        setEditorWidth((prev) => Math.max(150, prev + e.movementX));
      } else {
        setPanels((prev) => {
          const next = [...prev];
          const panel = next[resizingIdx as number];
          const newWidth = Math.max(100, panel.width + e.movementX);
          next[resizingIdx as number] = { ...panel, width: newWidth };
          return next;
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

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!resizingMemDiaPaneId) return;

      setMemDiaHeights((prev) => {
        const current = prev[resizingMemDiaPaneId] ?? 160;
        const next = Math.max(100, Math.min(360, current - e.movementY));
        return { ...prev, [resizingMemDiaPaneId]: next };
      });
    };

    const handleMouseUp = () => setResizingMemDiaPaneId(null);

    if (resizingMemDiaPaneId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingMemDiaPaneId]);

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isResizingAiPanel) return;
      setAiPanelWidth((prev) => Math.max(260, Math.min(560, prev - e.movementX)));
    };

    const handleMouseUp = () => setIsResizingAiPanel(false);

    if (isResizingAiPanel) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingAiPanel]);

  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
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

  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.settings-dropdown')) {
        setShowSettingsMenu(false);
      }
    };

    if (showSettingsMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showSettingsMenu]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      <EditorHeader
        embedCopied={embedCopied}
        showSettingsMenu={showSettingsMenu}
        showAiSidePanel={showAiSidePanel}
        showMemDia={showMemDia}
        isDebugging={isDebugging}
        isDebugComplete={isDebugComplete}
        onClear={handleClear}
        onShare={handleShare}
        onToggleSettingsMenu={() => setShowSettingsMenu((prev) => !prev)}
        onToggleAiPanel={() => setShowAiSidePanel((prev) => !prev)}
        onToggleMemDia={() => setShowMemDia((prev) => !prev)}
        onDebugStart={handleDebugStart}
        onRun={handleRun}
        onDebugStep={handleDebugStep}
        onDebugStop={handleDebugStop}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex min-h-0 relative overflow-visible">
          <SourcePane
            width={editorWidth}
            sourceLang={sourceLang}
            showSourceLangDropdown={showSourceLangDropdown}
            code={code}
            showMemDia={showMemDia}
            resizingMemDiaPaneId={resizingMemDiaPaneId}
            memDiaHeight={getMemDiaHeight('source')}
            currentVariables={currentVariables}
            editorRef={editorRef}
            extensions={getExtensions(sourceLang === 'ast' ? 'python' : sourceLang)}
            onToggleSourceLangDropdown={() => setShowSourceLangDropdown((prev) => !prev)}
            onSelectSourceLang={handleSourceLanguageChange}
            onCodeChange={(value) => {
              setCode(value);
              if (isDebugging) {
                setHighlightedSourceLines([]);
                setPanelHighlightedLines(new Map());
              }
            }}
            onCreateEditor={handleCreateEditor}
            onMemDiaResizeMouseDown={onMemDiaResizeMouseDown}
            onResizeEditor={(e) => onMouseDown(e, 'editor')}
            editorResizeActive={resizingIdx === 'editor'}
          />

          <div
            className="flex-1 flex overflow-x-auto scrollbar-hide relative z-[10] bg-slate-900"
            ref={containerRef}
          >
            {panels.map((panel, idx) => (
              <TranslationPaneItem
                key={panel.id}
                panel={panel}
                ast={ast}
                draggedPanelId={draggedPanelId}
                dragOverPanelId={dragOverPanelId}
                translationCode={getTranslation(ast, panel.lang).code}
                highlightedLines={panelHighlightedLines.get(panel.id) || []}
                showMemDia={showMemDia}
                resizingMemDiaPaneId={resizingMemDiaPaneId}
                memDiaHeight={getMemDiaHeight(panel.id)}
                currentVariables={currentVariables}
                resizeActive={resizingIdx === idx}
                onRemovePanel={removePanel}
                onResize={(e) => onMouseDown(e, idx)}
                onMemDiaResizeMouseDown={onMemDiaResizeMouseDown}
                onPanelDragStart={handlePanelDragStart}
                onPanelDragOver={handlePanelDragOver}
                onPanelDrop={handlePanelDrop}
                onPanelDragEnd={handlePanelDragEnd}
              />
            ))}
          </div>

          <AddPanelStrip
            showAddMenu={showAddMenu}
            sourceLang={sourceLang}
            panels={panels}
            onToggleMenu={() => setShowAddMenu((prev) => !prev)}
            onAddPanel={addPanel}
          />

          {showAiSidePanel && (
            <AiSidePanel
              width={aiPanelWidth}
              isResizing={isResizingAiPanel}
              onStartResize={(e) => {
                e.preventDefault();
                setIsResizingAiPanel(true);
              }}
              onClose={() => setShowAiSidePanel(false)}
            />
          )}
        </div>

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
