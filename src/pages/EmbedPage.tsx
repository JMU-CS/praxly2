/**
 * Embeddable code player: a ready-to-run version of the editor for dropping
 * into an external page. `?code=` carries the program; adding `?to=<lang>`
 * switches from the simple source+output layout to source+translation over
 * output.
 *
 * This file is layout only — the panes live in `components/embed/`, and running
 * / debugging / parsing lives in `useEmbedExecution`.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router';

import type { SupportedLang } from '../components/LanguageSelector';
import { EmbedActions } from '../components/embed/EmbedActions';
import { EmbedErrorScreen } from '../components/embed/EmbedErrorScreen';
import { EmbedOutput } from '../components/embed/EmbedOutput';
import { EmbedSourcePane } from '../components/embed/EmbedSourcePane';
import { EmbedTranslationPane } from '../components/embed/EmbedTranslationPane';
import { encodeEmbed } from '../utils/embedCodec';
import { useEmbedData } from '../hooks/useEmbedData';
import { useDragWidth } from '../hooks/useDragWidth';
import { useEmbedExecution } from '../hooks/useEmbedExecution';

const VALID_TO_LANGS = ['python', 'java', 'csp', 'praxis', 'javascript', 'ast'];

const MIN_SOURCE_WIDTH = 150;

export default function EmbedPage() {
  const [searchParams] = useSearchParams();

  // Layout mode comes from ?to= — absent or unrecognised means source+output.
  const toParam = searchParams.get('to');
  const isTranslationMode = toParam !== null && VALID_TO_LANGS.includes(toParam);

  const { embedData, decodeError, setCode } = useEmbedData();

  // Translation-pane selection, seeded from ?to=.
  const [targetLang, setTargetLang] = useState<SupportedLang>(
    isTranslationMode && toParam !== 'ast' ? (toParam as SupportedLang) : 'python'
  );
  const [showTranslationMenu, setShowTranslationMenu] = useState(false);
  const [showAst, setShowAst] = useState(toParam === 'ast');

  const {
    width: sourceWidth,
    isResizing,
    startResize,
  } = useDragWidth(window.innerWidth / 2, MIN_SOURCE_WIDTH);

  const exec = useEmbedExecution(embedData, targetLang);

  const handleOpenInEditor = () => {
    if (!embedData) return;
    const encoded = encodeEmbed({ code: embedData.code, lang: embedData.lang as any });
    const target = isTranslationMode
      ? `/v2/editor?code=${encoded}&targetLang=${showAst ? 'ast' : targetLang}`
      : `/v2/editor?code=${encoded}`;
    window.open(target, '_blank');
  };

  if (!embedData) {
    return <EmbedErrorScreen message={decodeError} />;
  }

  const actions = (
    <EmbedActions
      isDebugging={exec.isDebugging}
      isDebugComplete={exec.isDebugComplete}
      onRun={exec.run}
      onDebugStart={exec.debugStart}
      onDebugStep={exec.debugStep}
      onDebugStop={exec.debugStop}
      onOpenInEditor={handleOpenInEditor}
    />
  );

  const sourcePane = (
    <EmbedSourcePane
      lang={exec.lang}
      code={embedData.code}
      width={sourceWidth}
      extensions={exec.sourceExtensions}
      resizeActive={isResizing}
      onCodeChange={setCode}
      onCreateEditor={exec.onCreateEditor}
      onStartResize={startResize}
    />
  );

  const outputBody = (
    <EmbedOutput
      output={exec.output}
      error={exec.error}
      isDebugging={exec.isDebugging}
      callStack={exec.callStack}
      waitingForInput={exec.waitingForInput}
      inputPrompt={exec.inputPrompt}
      onSubmitInput={exec.submitInput}
    />
  );

  return (
    /* <main> + an sr-only <h1>: the embed has no chrome of its own, so
       without them every pane sits outside a landmark on a heading-less
       document. Both are invisible in the iframe. */
    <main className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      <h1 className="sr-only">Praxly embedded code sample</h1>
      {isTranslationMode ? (
        /* Translation layout: source + translation on top, output at bottom */
        <>
          <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
            {sourcePane}
            <EmbedTranslationPane
              ast={exec.ast}
              translationCode={exec.getTranslation(exec.ast, targetLang).code}
              targetLang={targetLang}
              showAst={showAst}
              menuOpen={showTranslationMenu}
              highlightedLines={exec.highlightedTranslationLines}
              actions={actions}
              onToggleMenu={() => setShowTranslationMenu(!showTranslationMenu)}
              onSelectTarget={(lang) => {
                setTargetLang(lang);
                setShowAst(false);
                setShowTranslationMenu(false);
              }}
              onSelectAst={() => {
                setShowAst(true);
                setShowTranslationMenu(false);
              }}
            />
          </div>

          <section
            aria-label="Console output"
            className="flex flex-col border-t border-slate-800 h-[40%] shrink-0"
          >
            <div className="h-10 bg-slate-900 flex items-center px-4 border-b border-slate-800 shrink-0">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Output
              </span>
            </div>
            {outputBody}
          </section>
        </>
      ) : (
        /* Simple layout: source on the left, output on the right */
        <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
          {sourcePane}

          <section
            aria-label="Console output"
            className="flex flex-1 flex-col border-l border-slate-800 min-w-0 overflow-hidden"
          >
            <div className="h-10 bg-slate-900 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Output
              </span>
              {actions}
            </div>
            {outputBody}
          </section>
        </div>
      )}
    </main>
  );
}
