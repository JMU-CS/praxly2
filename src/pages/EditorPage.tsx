import { useState, useCallback, useEffect, useRef } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { Program } from '../language/ast';
import type { SupportedLang } from '../components/LanguageSelector';
import { OutputPanel } from '../components/OutputPanel';
import { highlightedLinesField, dispatchLineHighlighting } from '../utils/codemirrorConfig';
import { computeMultiplePanelHighlighting } from '../utils/debugHandlers';
import { decodeEmbed, encodeEmbed, copyToClipboard } from '../utils/embedCodec';
import { getCodeMirrorExtensions } from '../utils/editorUtils';
import { DEFAULT_EXAMPLE_ID, EXAMPLE_PROGRAMS, getExampleById } from '../utils/sampleCodes';
import { useCodeParsing } from '../hooks/useCodeParsing';
import { useCodeDebugger } from '../hooks/useCodeDebugger';
import { Debugger } from '../language/debugger';

import { EditorHeader } from '../components/editor/EditorHeader';
import { SourcePane } from '../components/editor/SourcePane';
import { TranslationPaneItem } from '../components/editor/TranslationPaneItem';
import { AddPanelStrip } from '../components/editor/AddPanelStrip';
import { AiSidePanel } from '../components/editor/AiSidePanel';
import type { Panel } from '../components/editor/types';

const MIN_SOURCE_WIDTH = 280;
const MIN_PANEL_WIDTH = 240;
const MIN_OUTPUT_HEIGHT = 120;
const MIN_MEM_DIA_HEIGHT = 100;
const MAX_MEM_DIA_HEIGHT = 360;
const MIN_AI_PANEL_WIDTH = 260;
const MAX_AI_PANEL_WIDTH = 560;
const ADD_STRIP_WIDTH = 64;
const MOBILE_BREAKPOINT = 1024;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const createPanelId = (): string =>
  window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(7);

const DEFAULT_EXAMPLE = getExampleById(DEFAULT_EXAMPLE_ID) ??
  EXAMPLE_PROGRAMS[0] ?? {
    id: 'fallback-python',
    title: 'Fallback Example',
    description: 'Fallback editor program',
    category: 'fundamentals' as const,
    lang: 'python' as const,
    code: 'print("Praxly")',
  };

export default function EditorPage() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(DEFAULT_EXAMPLE.code);
  const [output, setOutput] = useState<string[]>([]);
  const [ast, setAst] = useState<Program | null>(null);
  const [sourceLang, setSourceLang] = useState<SupportedLang>(DEFAULT_EXAMPLE.lang);
  const [error, setError] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSourceLangDropdown, setShowSourceLangDropdown] = useState(false);
  const [showExamplesMenu, setShowExamplesMenu] = useState(false);
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
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);

  const [editorWidth, setEditorWidth] = useState(
    Math.max(MIN_SOURCE_WIDTH, Math.floor(window.innerWidth * 0.45))
  );
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
  const [outputHeight, setOutputHeight] = useState(
    Math.max(176, Math.floor(window.innerHeight * 0.24))
  );
  const [panelHighlightedLines, setPanelHighlightedLines] = useState<Map<string, number[]>>(
    new Map()
  );

  type ResizeDragSnapshot = {
    index: number | 'editor' | 'output';
    startX: number;
    startY: number;
    startEditorWidth: number;
    startPanelWidth: number;
    startOutputHeight: number;
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<any>(null);
  const resizeDragRef = useRef<ResizeDragSnapshot | null>(null);
  const memDiaResizeRef = useRef<{ paneId: string; startY: number; startHeight: number } | null>(
    null
  );
  const aiResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const isMobile = viewportWidth < MOBILE_BREAKPOINT;

  const getMemDiaHeight = (paneId: string) => memDiaHeights[paneId] ?? 160;

  const getDefaultPanelWidth = useCallback(() => {
    if (isMobile) {
      return Math.max(MIN_PANEL_WIDTH, Math.floor(viewportWidth * 0.8));
    }
    return 350;
  }, [isMobile, viewportWidth]);

  const getMaxSourceWidth = useCallback(() => {
    const reservedWidth =
      ADD_STRIP_WIDTH +
      (showAiSidePanel ? aiPanelWidth : 0) +
      (panels.length > 0 ? MIN_PANEL_WIDTH : 0);

    return Math.max(MIN_SOURCE_WIDTH, viewportWidth - reservedWidth);
  }, [aiPanelWidth, panels.length, showAiSidePanel, viewportWidth]);

  const getContentAvailableWidth = useCallback(() => {
    return Math.max(
      MIN_SOURCE_WIDTH,
      viewportWidth - ADD_STRIP_WIDTH - (showAiSidePanel ? aiPanelWidth : 0)
    );
  }, [aiPanelWidth, showAiSidePanel, viewportWidth]);

  const onMemDiaResizeMouseDown = (e: MouseEvent, paneId: string) => {
    e.preventDefault();
    memDiaResizeRef.current = {
      paneId,
      startY: e.clientY,
      startHeight: getMemDiaHeight(paneId),
    };
    setResizingMemDiaPaneId(paneId);
  };

  const handleSourceLanguageChange = (lang: SupportedLang) => {
    if (lang === sourceLang) {
      setShowSourceLangDropdown(false);
      return;
    }

    if (!code.trim()) {
      setSourceLang(lang);
      setPanels((prev) => prev.filter((panel) => panel.lang !== lang));
      setIsDebugging(false);
      setIsDebugComplete(false);
      setHighlightedSourceLines([]);
      setPanelHighlightedLines(new Map());
      setShowSourceLangDropdown(false);
      return;
    }

    try {
      const sourceForTranslation = sourceLang === 'ast' ? 'python' : sourceLang;
      const parsed = parseCode(sourceForTranslation, code);
      const translated = getTranslation(parsed, lang).code;
      let translatedCodeIssue: string | null = null;

      if (!translated || translated.trim().length === 0) {
        setError(`Translation to ${lang} produced empty code. Keeping current source.`);
        setShowSourceLangDropdown(false);
        return;
      }

      if (
        translated.startsWith('// Translation to') ||
        translated.startsWith('// Valid source code required')
      ) {
        translatedCodeIssue = `Unable to verify translated ${lang} source.`;
      } else {
        try {
          parseCode(lang, translated);
        } catch (validationError: any) {
          translatedCodeIssue = validationError?.message || 'The translated code may not work.';
        }
      }

      if (translatedCodeIssue) {
        const shouldContinue = window.confirm(
          `The translated code may not work. Continue?\n\n${translatedCodeIssue}`
        );

        if (!shouldContinue) {
          setShowSourceLangDropdown(false);
          return;
        }
      }

      setSourceLang(lang);
      setCode(translated);
      setPanels((prev) => prev.filter((panel) => panel.lang !== lang));
      setIsDebugging(false);
      setIsDebugComplete(false);
      setHighlightedSourceLines([]);
      setPanelHighlightedLines(new Map());
      setError(null);
    } catch (e: any) {
      setError(e.message ?? `Unable to translate current ${sourceLang} source into ${lang}.`);
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

      setPanels((prev) => {
        const next = prev.filter((panel) => panel.lang !== decoded.lang);
        const isValidTarget = ['python', 'java', 'csp', 'praxis', 'ast'].includes(
          targetLangParam ?? ''
        );

        if (!isValidTarget || !targetLangParam || targetLangParam === decoded.lang) {
          return next;
        }

        if (next.some((panel) => panel.lang === targetLangParam)) {
          return next;
        }

        const defaultPanelWidth =
          window.innerWidth < MOBILE_BREAKPOINT
            ? Math.max(MIN_PANEL_WIDTH, Math.floor(window.innerWidth * 0.8))
            : 350;

        return [
          ...next,
          {
            id: createPanelId(),
            lang: targetLangParam as SupportedLang,
            width: defaultPanelWidth,
            sourceMap: new Map(),
          },
        ];
      });
    } catch (e) {
      console.error('Failed to decode embed:', e);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const maxSourceWidth = getMaxSourceWidth();
    const maxOutputHeight = Math.max(MIN_OUTPUT_HEIGHT, window.innerHeight - 120);
    const maxAiWidth = Math.min(
      MAX_AI_PANEL_WIDTH,
      Math.max(MIN_AI_PANEL_WIDTH, viewportWidth - MIN_SOURCE_WIDTH - ADD_STRIP_WIDTH - 40)
    );

    setEditorWidth((prev) => clamp(prev, MIN_SOURCE_WIDTH, maxSourceWidth));
    setOutputHeight((prev) => clamp(prev, MIN_OUTPUT_HEIGHT, maxOutputHeight));
    setAiPanelWidth((prev) => clamp(prev, MIN_AI_PANEL_WIDTH, maxAiWidth));
    setPanels((prev) => {
      let changed = false;
      const next = prev.map((panel) => {
        const clampedWidth = Math.max(MIN_PANEL_WIDTH, panel.width);
        if (clampedWidth !== panel.width) {
          changed = true;
          return { ...panel, width: clampedWidth };
        }
        return panel;
      });

      return changed ? next : prev;
    });
  }, [getMaxSourceWidth, viewportWidth]);

  useEffect(() => {
    const availableWidth = getContentAvailableWidth();

    if (panels.length === 0) {
      setEditorWidth((prev) => (prev === availableWidth ? prev : availableWidth));
      return;
    }

    const totalPaneCount = panels.length + 1;
    const targetSourceWidth = Math.max(
      MIN_SOURCE_WIDTH,
      Math.floor(availableWidth / totalPaneCount)
    );
    const targetPanelWidth = Math.max(MIN_PANEL_WIDTH, Math.floor(availableWidth / totalPaneCount));

    setEditorWidth((prev) => (prev === targetSourceWidth ? prev : targetSourceWidth));

    setPanels((prev) => {
      let changed = false;
      const next = prev.map((panel) => {
        if (panel.width !== targetPanelWidth) {
          changed = true;
          return { ...panel, width: targetPanelWidth };
        }
        return panel;
      });

      return changed ? next : prev;
    });
  }, [getContentAvailableWidth, panels.length]);

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

  const handleLoadExample = (exampleId: string) => {
    const example = getExampleById(exampleId);
    if (!example) {
      setShowExamplesMenu(false);
      return;
    }

    setSourceLang(example.lang);
    setCode(example.code);
    setPanels((prev) => prev.filter((panel) => panel.lang !== example.lang));
    setOutput([]);
    setError(null);
    setIsDebugging(false);
    setIsDebugComplete(false);
    setHighlightedSourceLines([]);
    setPanelHighlightedLines(new Map());
    setWaitingForNormalInput(false);
    setCurrentInterpreter(null);
    setShowSettingsMenu(false);
    setShowExamplesMenu(false);
  };

  const handleToggleAiPanel = () => {
    setShowAiSidePanel((prev) => !prev);
  };

  const handleShare = async () => {
    const encoded = encodeEmbed({
      code,
      lang: sourceLang === 'ast' ? 'python' : (sourceLang as any),
    });

    const embedUrl = `${window.location.origin}/v2/embed?code=${encoded}`;
    const success = await copyToClipboard(embedUrl);
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
    setPanels((prev) => {
      if (lang === sourceLang || prev.some((panel) => panel.lang === lang)) {
        return prev;
      }

      const translation = getTranslation(ast, lang);

      return [
        ...prev,
        {
          id: createPanelId(),
          lang,
          width: getDefaultPanelWidth(),
          sourceMap: translation.sourceMap,
        },
      ];
    });

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
    e.preventDefault();

    if (index === 'editor' && panels.length === 0) {
      return;
    }

    if (typeof index === 'number' && !panels[index]) {
      return;
    }

    resizeDragRef.current = {
      index,
      startX: e.clientX,
      startY: e.clientY,
      startEditorWidth: editorWidth,
      startPanelWidth: typeof index === 'number' ? panels[index].width : 0,
      startOutputHeight: outputHeight,
    };

    setResizingIdx(index);
  };

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const drag = resizeDragRef.current;
      if (!drag || resizingIdx === null) return;

      if (resizingIdx === 'output') {
        const deltaY = e.clientY - drag.startY;
        const maxOutputHeight = Math.max(MIN_OUTPUT_HEIGHT, window.innerHeight - 120);
        const nextHeight = clamp(
          drag.startOutputHeight - deltaY,
          MIN_OUTPUT_HEIGHT,
          maxOutputHeight
        );
        setOutputHeight(nextHeight);
      } else if (resizingIdx === 'editor') {
        const deltaX = e.clientX - drag.startX;
        const nextWidth = clamp(
          drag.startEditorWidth + deltaX,
          MIN_SOURCE_WIDTH,
          getMaxSourceWidth()
        );
        setEditorWidth(nextWidth);
      } else {
        const panelIndex = resizingIdx;
        setPanels((prev) => {
          if (!prev[panelIndex]) {
            return prev;
          }

          const deltaX = e.clientX - drag.startX;
          const newWidth = Math.max(MIN_PANEL_WIDTH, drag.startPanelWidth + deltaX);
          if (prev[panelIndex].width === newWidth) {
            return prev;
          }

          const next = [...prev];
          next[panelIndex] = { ...prev[panelIndex], width: newWidth };
          return next;
        });
      }
    };

    const handleMouseUp = () => {
      setResizingIdx(null);
      resizeDragRef.current = null;
    };

    if (resizingIdx !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [getMaxSourceWidth, resizingIdx]);

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const drag = memDiaResizeRef.current;
      if (!drag) return;

      const deltaY = e.clientY - drag.startY;
      const nextHeight = clamp(drag.startHeight - deltaY, MIN_MEM_DIA_HEIGHT, MAX_MEM_DIA_HEIGHT);

      setMemDiaHeights((prev) => {
        if (prev[drag.paneId] === nextHeight) {
          return prev;
        }

        return { ...prev, [drag.paneId]: nextHeight };
      });
    };

    const handleMouseUp = () => {
      memDiaResizeRef.current = null;
      setResizingMemDiaPaneId(null);
    };

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
      const drag = aiResizeRef.current;
      if (!isResizingAiPanel || !drag) return;

      const deltaX = e.clientX - drag.startX;
      const maxAiWidth = Math.min(
        MAX_AI_PANEL_WIDTH,
        Math.max(MIN_AI_PANEL_WIDTH, viewportWidth - MIN_SOURCE_WIDTH - ADD_STRIP_WIDTH - 40)
      );
      const nextWidth = clamp(drag.startWidth - deltaX, MIN_AI_PANEL_WIDTH, maxAiWidth);

      setAiPanelWidth(nextWidth);
    };

    const handleMouseUp = () => {
      aiResizeRef.current = null;
      setIsResizingAiPanel(false);
    };

    if (isResizingAiPanel) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingAiPanel, viewportWidth]);

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

  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.examples-dropdown')) {
        setShowExamplesMenu(false);
      }
    };

    if (showExamplesMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showExamplesMenu]);

  const sourcePaneWidth = panels.length === 0 ? getContentAvailableWidth() : editorWidth;

  return (
    <div className="flex flex-col h-dvh bg-slate-950 text-slate-100 font-sans overflow-hidden">
      <EditorHeader
        embedCopied={embedCopied}
        showExamplesMenu={showExamplesMenu}
        showSettingsMenu={showSettingsMenu}
        showAiSidePanel={showAiSidePanel}
        showMemDia={showMemDia}
        isDebugging={isDebugging}
        isDebugComplete={isDebugComplete}
        examples={EXAMPLE_PROGRAMS}
        onClear={handleClear}
        onShare={handleShare}
        onLoadExample={handleLoadExample}
        onToggleExamplesMenu={() => {
          setShowExamplesMenu((prev) => !prev);
          setShowSettingsMenu(false);
        }}
        onToggleSettingsMenu={() => {
          setShowSettingsMenu((prev) => !prev);
          setShowExamplesMenu(false);
        }}
        onToggleAiPanel={() => {
          handleToggleAiPanel();
          setShowSettingsMenu(false);
        }}
        onToggleMemDia={() => setShowMemDia((prev) => !prev)}
        onDebugStart={handleDebugStart}
        onRun={handleRun}
        onDebugStep={handleDebugStep}
        onDebugStop={handleDebugStop}
      />

      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 min-h-0 relative overflow-x-auto lg:overflow-visible">
          <div className={`flex min-h-0 h-full ${isMobile ? 'min-w-max' : 'w-full'}`}>
            <SourcePane
              width={sourcePaneWidth}
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
              onResizeEditor={(e) => {
                if (panels.length === 0) {
                  return;
                }
                onMouseDown(e, 'editor');
              }}
              editorResizeActive={panels.length > 0 && resizingIdx === 'editor'}
            />

            <div
              className={`${isMobile ? 'flex shrink-0' : 'flex-1'} flex overflow-x-auto scrollbar-hide relative z-[10] bg-slate-900 min-w-0`}
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
                  aiResizeRef.current = {
                    startX: e.clientX,
                    startWidth: aiPanelWidth,
                  };
                  setIsResizingAiPanel(true);
                }}
                onClose={() => setShowAiSidePanel(false)}
              />
            )}
          </div>
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
