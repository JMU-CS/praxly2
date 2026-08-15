/**
 * Saves and restores the editor session (source text, language, which panels
 * were open, and whether the console was expanded) so a reload picks up where
 * the user left off.
 */

import { useEffect } from 'react';

import type { SupportedLang } from '../components/LanguageSelector';
import type { Panel } from '../components/editor/types';
import { defaultPanelWidth } from '../components/editor/layoutConstants';
import { randomId } from '../utils/id';

const EDITOR_STATE_KEY = 'praxly-editor-state';

export type PersistedEditorState = {
  code: string;
  sourceLang: SupportedLang;
  openLangs: SupportedLang[];
  showAiChat: boolean;
  showMemDia: boolean;
  /** Whether the console was expanded. Absent in sessions saved before this was tracked. */
  showOutput?: boolean;
};

/** An embed link (`?code=...`) is an explicit share — it should win over,
 *  and not be clobbered into, any saved session in localStorage. */
export const hasEmbedParam = () => Boolean(new URLSearchParams(window.location.search).get('code'));

export const loadEditorState = (): PersistedEditorState | null => {
  if (hasEmbedParam()) return null;
  try {
    const raw = localStorage.getItem(EDITOR_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Rebuilds the translation panels a saved session had open. */
export const restorePanels = (): Panel[] => {
  const saved = loadEditorState();
  if (!saved || saved.openLangs.length === 0) return [];

  const width = defaultPanelWidth();

  return saved.openLangs
    .filter((lang) => lang !== saved.sourceLang)
    .map((lang) => ({ id: randomId(), lang, width, sourceMap: new Map() }));
};

/**
 * Writes the session back to localStorage, debounced so typing doesn't thrash
 * it. Skipped for embed links — those are a one-off share, not a session.
 */
export function usePersistEditorState(state: PersistedEditorState, enabled: boolean): void {
  const { code, sourceLang, showAiChat, showMemDia, showOutput } = state;
  // The panel list is rebuilt on every keystroke (source maps refresh with the
  // AST), so key the effect on the languages themselves, not array identity.
  const openLangsKey = state.openLangs.join(',');

  useEffect(() => {
    if (!enabled) return;

    const id = window.setTimeout(() => {
      const next: PersistedEditorState = {
        code,
        sourceLang,
        openLangs: openLangsKey ? (openLangsKey.split(',') as SupportedLang[]) : [],
        showAiChat,
        showMemDia,
        showOutput,
      };
      localStorage.setItem(EDITOR_STATE_KEY, JSON.stringify(next));
    }, 250);

    return () => clearTimeout(id);
  }, [code, sourceLang, openLangsKey, showAiChat, showMemDia, showOutput, enabled]);
}
