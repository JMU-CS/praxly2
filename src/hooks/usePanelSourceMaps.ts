/**
 * Refreshes every open panel's source map when the program changes, so debug
 * highlighting keeps pointing at the right line of each translation.
 */

import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { Program } from '../language/ast';
import type { SupportedLang } from '../components/LanguageSelector';
import type { Panel } from '../components/editor/types';
import type { SourceMap } from './useCodeParsing';

export function usePanelSourceMaps(
  ast: Program | null,
  setPanels: Dispatch<SetStateAction<Panel[]>>,
  getTranslation: (
    ast: Program | null,
    lang: SupportedLang
  ) => { code: string; sourceMap: SourceMap }
) {
  useEffect(() => {
    if (!ast) return;

    setPanels((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((panel) => ({
        ...panel,
        sourceMap: getTranslation(ast, panel.lang).sourceMap,
      }));
    });
  }, [ast, getTranslation, setPanels]);
}
