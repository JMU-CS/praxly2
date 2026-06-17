import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

import type { Program } from '../language/ast';
import type { SupportedLang } from '../components/LanguageSelector';
import { OutputPanel } from '../components/OutputPanel';
import { highlightedLinesField, dispatchLineHighlighting } from '../utils/codemirrorConfig';
import { computeMultiplePanelHighlighting } from '../utils/debugHandlers';
import { decodeEmbed, encodeEmbed, copyToClipboard } from '../utils/embedCodec';
import { getCodeMirrorExtensions } from '../utils/editorUtils';
import { EXAMPLE_PROGRAMS, getExampleById } from '../utils/sampleCodes';
import { useCodeParsing } from '../hooks/useCodeParsing';
import { useCodeDebugger } from '../hooks/useCodeDebugger';
import { Debugger } from '../language/debugger';

import { EditorHeader } from '../components/editor/EditorHeader';
import type { TextSize } from '../components/editor/EditorHeader';
import { SourcePane } from '../components/editor/SourcePane';
import { TranslationPaneItem } from '../components/editor/TranslationPaneItem';
import { AddPanelStrip } from '../components/editor/AddPanelStrip';
import { AiSidePanel } from '../components/editor/AiSidePanel';
import type { LlmPanel } from '../util/llm';
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

/**
 * Runs clamp.
 */
const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Runs create panel id.
 */
const createPanelId = (): string =>
  window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(7);

/**
 * Runs editor page.
 */
export default function EditorPage() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [ast, setAst] = useState<Program | null>(null);
  const [sourceLang, setSourceLang] = useState<SupportedLang>('praxis');
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
  const [outputState, setOutputState] = useState<'open' | 'closed'>('open');
  const [textSize, setTextSize] = useState<TextSize>(
    () => Number(localStorage.getItem('praxly-text-size')) || 3
  );
  const [memDiaStates, setMemDiaStates] = useState<Map<string, 'open' | 'closed'>>(new Map());
  const [aiPanelWidth, setAiPanelWidth] = useState(320);
  const [isResizingAiPanel, setIsResizingAiPanel] = useState(false);
  // Highlight-to-chat: text selected in the source editor + where to float the button.
  const [aiSelection, setAiSelection] = useState('');
  const [aiSelectionCoords, setAiSelectionCoords] = useState<{ top: number; left: number } | null>(
    null
  );
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

  /**
   * Runs get mem dia height.
   */
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

  /**
   * Handles mem dia resize mouse down.
   */
  const onMemDiaResizeMouseDown = (e: MouseEvent, paneId: string) => {
    e.preventDefault();
    memDiaResizeRef.current = {
      paneId,
      startY: e.clientY,
      startHeight: getMemDiaHeight(paneId),
    };
    setResizingMemDiaPaneId(paneId);
  };

  /**
   * Handles source language change.
   */
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
    /**
     * Handles resize.
     */
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

    const rootPanelCount = panels.filter((p) => !p.stackedUnder).length;

    if (rootPanelCount === 0) {
      setEditorWidth((prev) => (prev === availableWidth ? prev : availableWidth));
      return;
    }

    const totalPaneCount = rootPanelCount + 1;
    const targetSourceWidth = Math.max(
      MIN_SOURCE_WIDTH,
      Math.floor(availableWidth / totalPaneCount)
    );
    const targetPanelWidth = Math.max(MIN_PANEL_WIDTH, Math.floor(availableWidth / totalPaneCount));

    setEditorWidth((prev) => (prev === targetSourceWidth ? prev : targetSourceWidth));

    setPanels((prev) => {
      let changed = false;
      const next = prev.map((panel) => {
        if (panel.stackedUnder) return panel;
        if (panel.width !== targetPanelWidth) {
          changed = true;
          return { ...panel, width: targetPanelWidth };
        }
        return panel;
      });

      return changed ? next : prev;
    });
  }, [getContentAvailableWidth, panels]);

  const handleCreateEditor = useCallback((view: any) => {
    editorViewRef.current = view;
  }, []);

  // Track the current source-editor selection so the user can chat about it.
  const handleEditorUpdate = useCallback((update: any) => {
    if (!update.selectionSet && !update.docChanged && !update.geometryChanged) return;
    const sel = update.state.selection.main;
    if (sel.empty) {
      setAiSelection('');
      setAiSelectionCoords(null);
      return;
    }
    setAiSelection(update.state.sliceDoc(sel.from, sel.to));
    const coords = update.view.coordsAtPos(sel.to);
    setAiSelectionCoords(coords ? { top: coords.bottom + 4, left: coords.left } : null);
  }, []);

  const clearAiSelection = useCallback(() => {
    setAiSelection('');
    setAiSelectionCoords(null);
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

  // Gather every open code panel (source + translations) so the AI panel can
  // send all of them as context, not just the source.
  const aiPanelContext = useMemo<LlmPanel[]>(() => {
    const result: LlmPanel[] = [];
    if (code.trim()) {
      result.push({ language: sourceLang, code });
    }
    if (ast) {
      for (const panel of panels) {
        try {
          const translated = getTranslation(ast, panel.lang).code;
          if (translated?.trim()) {
            result.push({ language: panel.lang, code: translated });
          }
        } catch {
          // Skip panels that can't currently be translated.
        }
      }
    }
    return result;
  }, [code, sourceLang, ast, panels, getTranslation]);

  /**
   * Handles run.
   */
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

  /**
   * Handles debug start.
   */
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

  /**
   * Handles debug step.
   */
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

  /**
   * Handles debug stop.
   */
  const handleDebugStop = () => {
    stopDebugger();
    setIsDebugging(false);
    setHighlightedSourceLines([]);
    setPanelHighlightedLines(new Map());
    setOutput((prev) => [...prev, 'Debugger stopped.']);
  };

  /**
   * Handles submit input.
   */
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

  /**
   * Handles normal mode input submit.
   */
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

  /**
   * Handles clear.
   */
  const handleClear = () => {
    setCode('');
    setAst(null);
    setOutput([]);
    setError(null);
  };

  /**
   * Handles load example.
   */
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

  /**
   * Handles toggle ai panel.
   */
  const handleToggleAiPanel = () => {
    setShowAiSidePanel((prev) => !prev);
  };

  const handleTextSizeChange = (size: TextSize) => {
    setTextSize(size);
    localStorage.setItem('praxly-text-size', String(size));
  };

  const getMemDiaState = (paneId: string): 'open' | 'closed' => memDiaStates.get(paneId) ?? 'open';

  const cycleMemDiaState = (paneId: string) => {
    setMemDiaStates((prev) => {
      const next = new Map(prev);
      next.set(paneId, (next.get(paneId) ?? 'open') === 'open' ? 'closed' : 'open');
      return next;
    });
  };

  const cycleOutputState = () => {
    setOutputState((prev) => (prev === 'open' ? 'closed' : 'open'));
  };

  /**
   * Handles share.
   */
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

  /**
   * Runs get extensions.
   */
  const getExtensions = (lang: SupportedLang) => {
    const baseExtensions = getCodeMirrorExtensions(lang);
    baseExtensions.push(highlightedLinesField);
    return baseExtensions;
  };

  /**
   * Runs add panel.
   */
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
  };

  /**
   * Runs remove panel.
   */
  const removePanel = (id: string) => {
    setPanels((prev) => {
      const filtered = prev.filter((panel) => panel.id !== id);
      // Unstack any panel that was stacked under the removed panel
      return filtered.map((p) => (p.stackedUnder === id ? { ...p, stackedUnder: undefined } : p));
    });
  };

  /**
   * Toggles a translation panel on or off without closing the add menu.
   */
  const togglePanel = (lang: SupportedLang) => {
    const existing = panels.find((panel) => panel.lang === lang);
    if (existing) {
      removePanel(existing.id);
    } else {
      addPanel(lang);
    }
  };

  const togglePanelStack = (id: string) => {
    setPanels((prev) => {
      const panel = prev.find((p) => p.id === id);
      if (!panel) return prev;

      if (panel.stackedUnder) {
        // Unstack: move back to standalone
        return prev.map((p) => (p.id === id ? { ...p, stackedUnder: undefined } : p));
      }

      // Stack under the nearest root panel to the left
      const rootPanels = prev.filter((p) => !p.stackedUnder && p.id !== id);
      if (rootPanels.length === 0) return prev;

      // Find the root panel immediately to the left of this panel in order
      const panelIndex = prev.indexOf(panel);
      let targetRoot: Panel | undefined;
      for (let i = panelIndex - 1; i >= 0; i--) {
        if (!prev[i].stackedUnder) {
          targetRoot = prev[i];
          break;
        }
      }
      // Fallback to last root panel
      if (!targetRoot) targetRoot = rootPanels[rootPanels.length - 1];

      // If targetRoot already has a stacked panel, can't stack again (only 2 per column)
      const alreadyStacked = prev.some((p) => p.stackedUnder === targetRoot!.id);
      if (alreadyStacked) return prev;

      return prev.map((p) => (p.id === id ? { ...p, stackedUnder: targetRoot!.id } : p));
    });
  };

  /**
   * Swaps which panel is root and which is stacked within the same column.
   */
  const swapStackedPanels = (sourceId: string, targetId: string) => {
    setPanels((prev) => {
      const source = prev.find((p) => p.id === sourceId);
      const target = prev.find((p) => p.id === targetId);
      if (!source || !target) return prev;

      // source is stacked under target → source becomes root, target stacks under source
      if (source.stackedUnder === targetId) {
        return prev.map((p) => {
          if (p.id === sourceId) return { ...p, stackedUnder: undefined };
          if (p.id === targetId) return { ...p, stackedUnder: sourceId };
          return p;
        });
      }
      // target is stacked under source → target becomes root, source stacks under target
      if (target.stackedUnder === sourceId) {
        return prev.map((p) => {
          if (p.id === targetId) return { ...p, stackedUnder: undefined };
          if (p.id === sourceId) return { ...p, stackedUnder: targetId };
          return p;
        });
      }
      return prev;
    });
  };

  /**
   * Runs reorder panels.
   */
  const reorderPanels = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    setPanels((prev) => {
      const sourceIndex = prev.findIndex((panel) => panel.id === sourceId);
      const targetIndex = prev.findIndex((panel) => panel.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;

      const reordered = [...prev];
      const [moved] = reordered.splice(sourceIndex, 1);
      // Dragging always unstacks — the panel becomes a new standalone column at its drop position
      reordered.splice(targetIndex, 0, { ...moved, stackedUnder: undefined });
      return reordered;
    });
  };

  /**
   * Handles panel drag start.
   */
  const handlePanelDragStart = (e: DragEvent<HTMLDivElement>, panelId: string) => {
    setDraggedPanelId(panelId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', panelId);
  };

  /**
   * Handles panel drag over.
   */
  const handlePanelDragOver = (e: DragEvent<HTMLDivElement>, panelId: string) => {
    if (!draggedPanelId || draggedPanelId === panelId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverPanelId !== panelId) {
      setDragOverPanelId(panelId);
    }
  };

  /**
   * Handles panel drop.
   */
  const handlePanelDrop = (e: DragEvent<HTMLDivElement>, panelId: string) => {
    e.preventDefault();
    const sourceId = draggedPanelId || e.dataTransfer.getData('text/plain');

    if (!sourceId || sourceId === panelId) {
      setDragOverPanelId(null);
      setDraggedPanelId(null);
      return;
    }

    const source = panels.find((p) => p.id === sourceId);
    const target = panels.find((p) => p.id === panelId);
    const inSameColumn =
      source && target && (source.stackedUnder === panelId || target.stackedUnder === sourceId);

    if (inSameColumn) {
      swapStackedPanels(sourceId, panelId);
    } else {
      reorderPanels(sourceId, panelId);
    }

    setDragOverPanelId(null);
    setDraggedPanelId(null);
  };

  /**
   * Handles panel drag end.
   */
  const handlePanelDragEnd = () => {
    setDraggedPanelId(null);
    setDragOverPanelId(null);
  };

  /**
   * Handles mouse down.
   */
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
    /**
     * Handles mouse move.
     */
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const drag = resizeDragRef.current;
      if (!drag || resizingIdx === null) return;

      if (resizingIdx === 'output') {
        const deltaY = e.clientY - drag.startY;
        const maxOutputHeight = Math.max(MIN_OUTPUT_HEIGHT, window.innerHeight - 120);
        const rawHeight = drag.startOutputHeight - deltaY;
        if (rawHeight < MIN_OUTPUT_HEIGHT - 40) {
          setOutputState('closed');
        } else {
          const nextHeight = clamp(rawHeight, MIN_OUTPUT_HEIGHT, maxOutputHeight);
          setOutputHeight(nextHeight);
          setOutputState('open');
        }
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

    /**
     * Handles mouse up.
     */
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
    /**
     * Handles mouse move.
     */
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const drag = memDiaResizeRef.current;
      if (!drag) return;

      const deltaY = e.clientY - drag.startY;
      const rawHeight = drag.startHeight - deltaY;

      if (rawHeight < MIN_MEM_DIA_HEIGHT - 40) {
        setMemDiaStates((prev) => {
          const next = new Map(prev);
          next.set(drag.paneId, 'closed');
          return next;
        });
      } else {
        const nextHeight = clamp(rawHeight, MIN_MEM_DIA_HEIGHT, MAX_MEM_DIA_HEIGHT);
        setMemDiaHeights((prev) =>
          prev[drag.paneId] === nextHeight ? prev : { ...prev, [drag.paneId]: nextHeight }
        );
        setMemDiaStates((prev) => {
          if ((prev.get(drag.paneId) ?? 'open') === 'open') return prev;
          const next = new Map(prev);
          next.set(drag.paneId, 'open');
          return next;
        });
      }
    };

    /**
     * Handles mouse up.
     */
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
    /**
     * Handles mouse move.
     */
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

    /**
     * Handles mouse up.
     */
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
    /**
     * Handles click outside.
     */
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
    /**
     * Handles click outside.
     */
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
    /**
     * Handles click outside.
     */
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

  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.add-panel-dropdown')) {
        setShowAddMenu(false);
      }
    };

    if (showAddMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showAddMenu]);

  useEffect(() => {
    const actionsRef = {
      handleRun,
      handleDebugStart,
      handleDebugStep,
      handleDebugStop,
      isDebugging,
      isDebugComplete,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        if (e.shiftKey) {
          if (actionsRef.isDebugging) actionsRef.handleDebugStop();
          else actionsRef.handleDebugStart();
        } else {
          if (!actionsRef.isDebugging) actionsRef.handleRun();
        }
      } else if (e.key === 'F10' && actionsRef.isDebugging && !actionsRef.isDebugComplete) {
        e.preventDefault();
        actionsRef.handleDebugStep();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDebugging, isDebugComplete, handleRun, handleDebugStart, handleDebugStep, handleDebugStop]);

  const sourcePaneWidth = panels.length === 0 ? getContentAvailableWidth() : editorWidth;

  const fontSize = `${10 + textSize * 2}px`;

  return (
    <div
      className="flex flex-col h-dvh bg-slate-950 text-slate-100 font-sans overflow-hidden"
      style={{ '--praxly-font-size': fontSize } as React.CSSProperties}
    >
      {/* Skip link for keyboard / screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:bg-indigo-600 focus:text-white focus:px-4 focus:py-2 focus:rounded focus:outline-none"
      >
        Skip to main content
      </a>

      <EditorHeader
        embedCopied={embedCopied}
        showExamplesMenu={showExamplesMenu}
        showSettingsMenu={showSettingsMenu}
        showAiSidePanel={showAiSidePanel}
        showMemDia={showMemDia}
        isDebugging={isDebugging}
        isDebugComplete={isDebugComplete}
        examples={EXAMPLE_PROGRAMS}
        textSize={textSize}
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
        onToggleAiPanel={handleToggleAiPanel}
        onToggleMemDia={() => {
          setShowMemDia((prev) => {
            if (!prev) setMemDiaStates(new Map()); // Reset all closed panes when enabling
            return !prev;
          });
        }}
        onDebugStart={handleDebugStart}
        onRun={handleRun}
        onDebugStep={handleDebugStep}
        onDebugStop={handleDebugStop}
        onTextSizeChange={handleTextSizeChange}
      />

      <main id="main-content" className="flex-1 flex flex-row overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0">
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
                memDiaState={getMemDiaState('source')}
                onToggleMemDiaCollapse={() => cycleMemDiaState('source')}
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
                onEditorUpdate={handleEditorUpdate}
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
                {/* Render root panels as columns; each column may have a stacked child below */}
                {panels
                  .filter((p) => !p.stackedUnder)
                  .map((rootPanel) => {
                    const rootIdx = panels.indexOf(rootPanel);
                    const stackedPanel = panels.find((p) => p.stackedUnder === rootPanel.id);
                    // "Stack below" button is shown on a root panel when:
                    // - it has no stacked child yet (column isn't full)
                    // - there is at least one other root panel that also has no stacked child
                    //   (so this panel could move below that one)
                    const otherFreeRoots = panels.filter(
                      (p) =>
                        !p.stackedUnder &&
                        p.id !== rootPanel.id &&
                        !panels.some((sp) => sp.stackedUnder === p.id)
                    );
                    const canStack = !stackedPanel && otherFreeRoots.length > 0;

                    return (
                      <div
                        key={rootPanel.id}
                        className="flex flex-col shrink-0 border-r border-slate-800 last:border-0"
                        style={{ width: rootPanel.width }}
                      >
                        {/* Top panel (root) */}
                        <div
                          className={
                            stackedPanel
                              ? 'flex-1 min-h-0 overflow-hidden border-b border-slate-700'
                              : 'flex-1 min-h-0 overflow-hidden'
                          }
                        >
                          <TranslationPaneItem
                            panel={rootPanel}
                            ast={ast}
                            draggedPanelId={draggedPanelId}
                            dragOverPanelId={dragOverPanelId}
                            translationCode={getTranslation(ast, rootPanel.lang).code}
                            highlightedLines={panelHighlightedLines.get(rootPanel.id) || []}
                            showMemDia={showMemDia}
                            resizingMemDiaPaneId={resizingMemDiaPaneId}
                            memDiaHeight={getMemDiaHeight(rootPanel.id)}
                            currentVariables={currentVariables}
                            resizeActive={resizingIdx === rootIdx}
                            memDiaState={getMemDiaState(rootPanel.id)}
                            onToggleStack={
                              canStack ? () => togglePanelStack(rootPanel.id) : undefined
                            }
                            isStacked={false}
                            onRemovePanel={removePanel}
                            onResize={(e) => onMouseDown(e, rootIdx)}
                            onMemDiaResizeMouseDown={onMemDiaResizeMouseDown}
                            onToggleMemDiaCollapse={() => cycleMemDiaState(rootPanel.id)}
                            onPanelDragStart={handlePanelDragStart}
                            onPanelDragOver={handlePanelDragOver}
                            onPanelDrop={handlePanelDrop}
                            onPanelDragEnd={handlePanelDragEnd}
                          />
                        </div>

                        {/* Bottom panel (stacked child) — same flex-1 height, shares column width */}
                        {stackedPanel && (
                          <div className="flex-1 min-h-0 overflow-hidden">
                            <TranslationPaneItem
                              panel={stackedPanel}
                              ast={ast}
                              draggedPanelId={draggedPanelId}
                              dragOverPanelId={dragOverPanelId}
                              translationCode={getTranslation(ast, stackedPanel.lang).code}
                              highlightedLines={panelHighlightedLines.get(stackedPanel.id) || []}
                              showMemDia={showMemDia}
                              resizingMemDiaPaneId={resizingMemDiaPaneId}
                              memDiaHeight={getMemDiaHeight(stackedPanel.id)}
                              currentVariables={currentVariables}
                              resizeActive={resizingIdx === rootIdx}
                              memDiaState={getMemDiaState(stackedPanel.id)}
                              onToggleStack={() => togglePanelStack(stackedPanel.id)}
                              isStacked={true}
                              onRemovePanel={removePanel}
                              onResize={(e) => onMouseDown(e, rootIdx)}
                              onMemDiaResizeMouseDown={onMemDiaResizeMouseDown}
                              onToggleMemDiaCollapse={() => cycleMemDiaState(stackedPanel.id)}
                              onPanelDragStart={handlePanelDragStart}
                              onPanelDragOver={handlePanelDragOver}
                              onPanelDrop={handlePanelDrop}
                              onPanelDragEnd={handlePanelDragEnd}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <OutputPanel
            output={output}
            error={error}
            variables={currentVariables}
            showVariables={isDebugging}
            height={outputState === 'open' ? outputHeight : undefined}
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
            panelState={outputState}
            onToggle={cycleOutputState}
            onOpen={() => setOutputState('open')}
          />
        </div>

        <AddPanelStrip
          showAddMenu={showAddMenu}
          sourceLang={sourceLang}
          panels={panels}
          onToggleMenu={() => setShowAddMenu((prev) => !prev)}
          onTogglePanel={togglePanel}
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
            panels={aiPanelContext}
            selection={aiSelection}
            onClearSelection={clearAiSelection}
          />
        )}

        {/* Highlight-to-chat: floating button near the editor selection. */}
        {aiSelection && aiSelectionCoords && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowAiSidePanel(true)}
            style={{
              position: 'fixed',
              top: aiSelectionCoords.top,
              left: aiSelectionCoords.left,
              zIndex: 300,
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-600 text-white text-xs font-medium shadow-lg hover:bg-indigo-500 transition-colors"
            title="Ask the AI about the selected code"
          >
            <Sparkles size={12} />
            Ask AI
          </button>
        )}
      </main>
    </div>
  );
}
