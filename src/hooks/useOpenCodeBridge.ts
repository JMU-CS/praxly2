/**
 * "Add to editor" on an AI chat code block. The chat panel publishes the
 * handler through `useEditorBridge`; only a mounted editor can service it, so
 * the registration is torn down with the page.
 */

import { useEffect, useRef } from 'react';

import type { SupportedLang } from '../components/LanguageSelector';
import { useEditorBridge } from '../store/appStore';

/** Fence tags the AI writes, mapped to the languages Praxly supports. */
const FENCE_LANGS: Record<string, SupportedLang> = {
  praxis: 'praxis',
  python: 'python',
  py: 'python',
  java: 'java',
  csp: 'csp',
  javascript: 'javascript',
  js: 'javascript',
};

export function useOpenCodeBridge(
  onOpenCode: (code: string, lang: SupportedLang | undefined) => void
) {
  // The handler closes over fresh page state each render; the bridge
  // registration below should happen only once.
  const handlerRef = useRef(onOpenCode);
  handlerRef.current = onOpenCode;

  useEffect(() => {
    useEditorBridge.getState().setOpenCode((code, fenceLang) => {
      handlerRef.current(code, FENCE_LANGS[fenceLang.trim().toLowerCase()]);
    });
    return () => useEditorBridge.getState().setOpenCode(null);
  }, []);
}
