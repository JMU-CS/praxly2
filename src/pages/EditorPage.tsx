/**
 * The full Praxly editor: a source pane plus any number of live translation
 * panes, a console, memory diagrams, and the AI assistant.
 *
 * This file is composition only. The behavior lives in focused hooks —
 * `useEditorExecution` (parse/run/debug), `useTranslationPanels` (which panes
 * are open), `useEditorLayout` (how big everything is), `useMemDiaPanes`,
 * `useEditorSession` (persistence) — and the panes themselves live in
 * `components/editor/`.
 */

import { useMemo, useRef, useState } from 'react';

import { type SupportedLang } from '../components/LanguageSelector';
import { OutputPanel } from '../components/OutputPanel';
import { highlightedLinesField } from '../utils/codemirrorConfig';
import { encodeEmbed, copyToClipboard } from '../utils/embedCodec';
import { getCodeMirrorExtensions } from '../utils/editorUtils';
import { EXAMPLE_PROGRAMS, getExampleById } from '../utils/sampleCodes';
import { getDemoForLang } from '../utils/demoPrograms';
import { buildAiPanelContext } from '../utils/aiPanelContext';
import { planLanguageSwitch } from '../utils/languageSwitch';
import { resetApp } from '../utils/resetApp';

import { useCodeParsing } from '../hooks/useCodeParsing';
import { useAiSelection } from '../hooks/useAiSelection';
import { useEditorExecution } from '../hooks/useEditorExecution';
import { useEditorLayout } from '../hooks/useEditorLayout';
import { useEditorMenus } from '../hooks/useEditorMenus';
import { useEditorShortcuts } from '../hooks/useEditorShortcuts';
import { useEmbedLinkImport } from '../hooks/useEmbedLinkImport';
import { useHighlightedEditor } from '../hooks/useHighlightedEditor';
import { useMemDiaPanes } from '../hooks/useMemDiaPanes';
import { useOpenCodeBridge } from '../hooks/useOpenCodeBridge';
import { usePanelSourceMaps } from '../hooks/usePanelSourceMaps';
import { useTextSize } from '../hooks/useTextSize';
import { useTranslationPanels } from '../hooks/useTranslationPanels';
import { hasEmbedParam, loadEditorState, usePersistEditorState } from '../hooks/useEditorSession';

import { AddPanelStrip } from '../components/editor/AddPanelStrip';
import { AiSidePanel } from '../components/editor/AiSidePanel';
import { AskAiButton } from '../components/editor/AskAiButton';
import { EditorDialogs } from '../components/editor/EditorDialogs';
import { EditorHeader } from '../components/editor/EditorHeader';
import { SourcePane } from '../components/editor/SourcePane';
import { TranslationPanelGrid } from '../components/editor/TranslationPanelGrid';

export default function EditorPage() {
  const [loadedViaEmbedLink] = useState(hasEmbedParam);
  const [code, setCode] = useState(() => loadEditorState()?.code ?? '');
  const [sourceLang, setSourceLang] = useState<SupportedLang>(
    () => loadEditorState()?.sourceLang ?? 'praxis'
  );
  const [showAiSidePanel, setShowAiSidePanel] = useState(
    () => loadEditorState()?.showAiChat ?? false
  );
  const [showMemDia, setShowMemDia] = useState(() => loadEditorState()?.showMemDia ?? false);

  // Pending "this will discard your code" confirmations (see EditorDialogs).
  const [pendingLangSwitch, setPendingLangSwitch] = useState<SupportedLang | null>(null);
  const [pendingExampleId, setPendingExampleId] = useState<string | null>(null);
  const [pendingDemoLoad, setPendingDemoLoad] = useState(false);
  const [pendingClear, setPendingClear] = useState(false);
  const [pendingReset, setPendingReset] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);

  const { parseCode, getTranslation } = useCodeParsing();
  const panels = useTranslationPanels(getTranslation);
  const exec = useEditorExecution({
    code,
    sourceLang,
    panels: panels.panels,
    parseCode,
    getTranslation,
  });
  const layout = useEditorLayout({
    panels: panels.panels,
    setPanels: panels.setPanels,
    rootPanels: panels.rootPanels,
    showAiSidePanel,
  });
  const memDia = useMemDiaPanes();
  const menus = useEditorMenus();
  const aiSelection = useAiSelection();
  const { textSize, setTextSize, fontSizePx } = useTextSize();
  const onCreateEditor = useHighlightedEditor(exec.highlightedSourceLines);

  usePanelSourceMaps(exec.ast, panels.setPanels, getTranslation);
  useEmbedLinkImport({ setCode, setSourceLang, setPanels: panels.setPanels });
  usePersistEditorState(
    {
      code,
      sourceLang,
      openLangs: panels.panels.map((panel) => panel.lang),
      showAiChat: showAiSidePanel,
      showMemDia,
      showOutput: layout.outputState === 'open',
    },
    !loadedViaEmbedLink
  );
  useEditorShortcuts({
    isDebugging: exec.isDebugging,
    isDebugComplete: exec.isDebugComplete,
    onRun: exec.run,
    onDebugStart: exec.debugStart,
    onDebugStep: exec.debugStep,
    onDebugStop: exec.debugStop,
  });

  /** Switches the source pane to `lang` with the given code and a clean slate. */
  const applySourceLanguage = (lang: SupportedLang, newCode: string) => {
    setSourceLang(lang);
    setCode(newCode);
    exec.stopSession();
    exec.setError(null);
  };

  const handleSourceLanguageChange = (lang: SupportedLang) => {
    menus.closeSourceLangDropdown();
    if (lang === sourceLang) return;

    const plan = planLanguageSwitch(code, sourceLang, lang, parseCode, getTranslation);
    if (plan.kind === 'untranslatable') {
      // Can't produce a working translation — ask before discarding the
      // program (EditorDialogs handles the answer).
      setPendingLangSwitch(lang);
      return;
    }

    applySourceLanguage(lang, plan.kind === 'translated' ? plan.code : '');
  };

  /** Replaces the editor's contents, resetting the console and any session. */
  const replaceProgram = (newCode: string, lang?: SupportedLang, keepHasRun = false) => {
    if (lang) {
      setSourceLang(lang);
      // Drop any translation panel that duplicates the new source language.
      panels.dropPanelsForLang(lang);
    }
    setCode(newCode);
    exec.clearConsole({ resetHasRun: !keepHasRun });
    exec.stopSession();
  };

  // "Open in editor" on an AI chat code block. The fence's language tag
  // switches the source language when it names one Praxly supports.
  useOpenCodeBridge((newCode, lang) => replaceProgram(newCode, lang, true));

  const loadExample = (exampleId: string) => {
    const example = getExampleById(exampleId);
    if (!example) return;
    replaceProgram(example.code, example.lang);
  };

  const handleLoadExample = (exampleId: string) => {
    menus.closeHeaderMenus();
    // A non-blank editor is about to be discarded — confirm first.
    if (code.trim()) {
      setPendingExampleId(exampleId);
      return;
    }
    loadExample(exampleId);
  };

  const loadDemo = () => {
    const demo = getDemoForLang(sourceLang);
    if (!demo) return;
    replaceProgram(demo);
  };

  const handleLoadDemo = () => {
    menus.closeHeaderMenus();
    // A non-blank editor is about to be discarded — confirm first.
    if (code.trim()) {
      setPendingDemoLoad(true);
      return;
    }
    loadDemo();
  };

  const clearProgram = () => {
    setCode('');
    exec.setAst(null);
    exec.clearConsole({ resetHasRun: true });
  };

  const handleClear = () => {
    // A non-blank editor is about to be discarded — confirm first.
    if (code.trim()) {
      setPendingClear(true);
      return;
    }
    clearProgram();
  };

  const handleToggleMemDia = () => {
    // Reopen every collapsed pane when the diagrams come back on.
    if (!showMemDia) memDia.resetStates();
    setShowMemDia((prev) => !prev);
  };

  const handleShare = async () => {
    const encoded = encodeEmbed({
      code,
      lang: sourceLang === 'ast' ? 'python' : (sourceLang as any),
    });

    const embedUrl = `${window.location.origin}/v2/embed?code=${encoded}`;
    if (await copyToClipboard(embedUrl)) {
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2000);
    }
  };

  const sourceExtensions = useMemo(() => {
    const extensions = getCodeMirrorExtensions(sourceLang === 'ast' ? 'python' : sourceLang);
    extensions.push(highlightedLinesField);
    return extensions;
  }, [sourceLang]);

  // Every open code pane, so the AI panel sends the whole workspace as context.
  const aiPanelContext = useMemo(
    () => buildAiPanelContext(code, sourceLang, exec.ast, panels.panels, getTranslation),
    [code, sourceLang, exec.ast, panels.panels, getTranslation]
  );

  const fontSize = `${fontSizePx}px`;

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
        showExamplesMenu={menus.showExamplesMenu}
        showSettingsMenu={menus.showSettingsMenu}
        isDebugging={exec.isDebugging}
        isDebugComplete={exec.isDebugComplete}
        examples={EXAMPLE_PROGRAMS}
        demoAvailable={getDemoForLang(sourceLang) !== undefined}
        textSize={textSize}
        onClear={handleClear}
        onShare={handleShare}
        onLoadExample={handleLoadExample}
        onLoadDemo={handleLoadDemo}
        onToggleExamplesMenu={menus.toggleExamplesMenu}
        onToggleSettingsMenu={menus.toggleSettingsMenu}
        onDebugStart={exec.debugStart}
        onRun={exec.run}
        onDebugStep={exec.debugStep}
        onDebugStop={exec.debugStop}
        onTextSizeChange={setTextSize}
        onReset={() => {
          menus.toggleSettingsMenu();
          setPendingReset(true);
        }}
      />

      <main id="main-content" className="flex-1 flex flex-row overflow-hidden min-h-0">
        {/* The visible "Praxly" wordmark is a home link in the banner, so the
            page has no heading of its own. This supplies the h1 — inside the
            landmark, which is both where the skip link lands and the only way
            it is itself contained by one. */}
        <h1 className="sr-only">Praxly code editor</h1>

        <AddPanelStrip
          panels={panels.panels}
          showAiSidePanel={showAiSidePanel}
          showMemDia={showMemDia}
          onTogglePanel={(lang) => panels.togglePanel(lang, exec.ast)}
          onToggleAiPanel={() => setShowAiSidePanel((prev) => !prev)}
          onToggleMemDia={handleToggleMemDia}
        />

        <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0">
          <div className="flex-1 min-h-0 relative overflow-x-auto lg:overflow-visible">
            <div className={`flex min-h-0 h-full ${layout.isMobile ? 'min-w-max' : 'w-full'}`}>
              <SourcePane
                width={layout.sourcePaneWidth}
                sourceLang={sourceLang}
                showSourceLangDropdown={menus.showSourceLangDropdown}
                code={code}
                showMemDia={showMemDia}
                resizingMemDiaPaneId={memDia.resizingPaneId}
                memDiaHeight={memDia.getHeight('source')}
                // currentVariables expects the full per-frame call stack, not a
                // flattened map, so methods render as separate frame boxes — see MemDia.tsx.
                currentVariables={exec.currentCallStack}
                editorRef={editorRef}
                extensions={sourceExtensions}
                fontSize={fontSizePx}
                memDiaState={memDia.getState('source')}
                onToggleMemDiaCollapse={() => memDia.toggle('source')}
                onToggleSourceLangDropdown={menus.toggleSourceLangDropdown}
                onSelectSourceLang={handleSourceLanguageChange}
                onCodeChange={(value) => {
                  setCode(value);
                  exec.noteCodeEdited();
                }}
                onCreateEditor={onCreateEditor}
                onEditorUpdate={aiSelection.onEditorUpdate}
                onMemDiaResizeMouseDown={memDia.startResize}
                onResizeEditor={(e) => {
                  if (panels.panels.length > 0) layout.startPaneResize(e, 'editor');
                }}
                editorResizeActive={panels.panels.length > 0 && layout.resizingIdx === 'editor'}
              />

              <div
                className={`${
                  layout.isMobile ? 'flex shrink-0' : 'flex-1'
                } flex overflow-x-auto scrollbar-hide relative z-[10] bg-slate-900 min-w-0`}
              >
                <TranslationPanelGrid
                  panels={panels.panels}
                  rootPanels={panels.rootPanels}
                  elasticPanelId={panels.elasticPanelId}
                  isMobile={layout.isMobile}
                  ast={exec.ast}
                  draggedPanelId={panels.draggedPanelId}
                  dragOverPanelId={panels.dragOverPanelId}
                  getTranslationCode={(lang) => getTranslation(exec.ast, lang).code}
                  fontSize={fontSizePx}
                  panelHighlightedLines={exec.panelHighlightedLines}
                  showMemDia={showMemDia}
                  memDiaResizingPaneId={memDia.resizingPaneId}
                  getMemDiaHeight={memDia.getHeight}
                  getMemDiaState={memDia.getState}
                  onToggleMemDia={memDia.toggle}
                  onMemDiaResizeMouseDown={memDia.startResize}
                  // currentVariables expects the full per-frame call stack, not a
                  // flattened map, so methods render as separate frame boxes — see MemDia.tsx.
                  currentVariables={exec.currentCallStack}
                  resizingIdx={layout.resizingIdx}
                  onResizeColumn={layout.startPaneResize}
                  onRemovePanel={panels.removePanel}
                  onToggleStack={panels.togglePanelStack}
                  dragHandlers={panels.dragHandlers}
                />
              </div>
            </div>
          </div>

          <OutputPanel
            output={exec.output}
            error={exec.error}
            hasRun={exec.hasRun}
            variables={exec.currentVariables}
            callStack={exec.currentCallStack}
            showVariables={exec.isDebugging}
            height={layout.outputState === 'open' ? layout.outputHeight : undefined}
            resizeActive={layout.resizingIdx === 'output'}
            onResize={(e) => layout.startPaneResize(e, 'output')}
            waitingForInput={exec.waitingForInput}
            inputPrompt={exec.inputPrompt}
            onSubmitInput={exec.submitInput}
            panelState={layout.outputState}
            onToggle={layout.toggleOutputState}
          />
        </div>

        {showAiSidePanel && (
          <AiSidePanel
            width={layout.aiPanelWidth}
            isResizing={layout.isResizingAiPanel}
            onStartResize={layout.startAiResize}
            onClose={() => setShowAiSidePanel(false)}
            panels={aiPanelContext}
            selection={aiSelection.selection}
            onClearSelection={aiSelection.clear}
          />
        )}

        <EditorDialogs
          pendingLangSwitch={pendingLangSwitch}
          pendingExampleId={pendingExampleId}
          pendingDemoLoad={pendingDemoLoad}
          pendingClear={pendingClear}
          pendingReset={pendingReset}
          onConfirmLangSwitch={(lang) => {
            applySourceLanguage(lang, '');
            setPendingLangSwitch(null);
          }}
          onCancelLangSwitch={() => setPendingLangSwitch(null)}
          onConfirmExample={(exampleId) => {
            loadExample(exampleId);
            setPendingExampleId(null);
          }}
          onCancelExample={() => setPendingExampleId(null)}
          onConfirmDemo={() => {
            loadDemo();
            setPendingDemoLoad(false);
          }}
          onCancelDemo={() => setPendingDemoLoad(false)}
          onConfirmClear={() => {
            clearProgram();
            setPendingClear(false);
          }}
          onCancelClear={() => setPendingClear(false)}
          // No setPendingReset(false) on confirm — resetApp reloads the page.
          onConfirmReset={() => resetApp()}
          onCancelReset={() => setPendingReset(false)}
        />

        {/* Highlight-to-chat: floating button near the editor selection. */}
        {aiSelection.selection && aiSelection.coords && (
          <AskAiButton coords={aiSelection.coords} onClick={() => setShowAiSidePanel(true)} />
        )}
      </main>
    </div>
  );
}
