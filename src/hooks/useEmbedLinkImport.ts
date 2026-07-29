/**
 * Loads a shared program into the editor when it is opened via an embed link
 * (`/v2/editor?code=…&targetLang=…`), opening the requested translation panel
 * alongside it.
 */

import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useSearchParams } from 'react-router';

import type { SupportedLang } from '../components/LanguageSelector';
import type { Panel } from '../components/editor/types';
import { defaultPanelWidth } from '../components/editor/layoutConstants';
import { decodeEmbed } from '../utils/embedCodec';
import { randomId } from '../utils/id';

const VALID_TARGET_LANGS = ['python', 'java', 'csp', 'praxis', 'javascript', 'blocks', 'ast'];

interface UseEmbedLinkImportArgs {
  setCode: (code: string) => void;
  setSourceLang: (lang: SupportedLang) => void;
  setPanels: Dispatch<SetStateAction<Panel[]>>;
}

export function useEmbedLinkImport({ setCode, setSourceLang, setPanels }: UseEmbedLinkImportArgs) {
  const [searchParams] = useSearchParams();

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
        // The source pane already shows this language — never duplicate it.
        const next = prev.filter((panel) => panel.lang !== decoded.lang);

        const wantsPanel =
          targetLangParam !== null &&
          VALID_TARGET_LANGS.includes(targetLangParam) &&
          targetLangParam !== decoded.lang &&
          !next.some((panel) => panel.lang === targetLangParam);

        if (!wantsPanel) return next;

        return [
          ...next,
          {
            id: randomId(),
            lang: targetLangParam as SupportedLang,
            width: defaultPanelWidth(),
            sourceMap: new Map(),
          },
        ];
      });
    } catch (e) {
      console.error('Failed to decode embed:', e);
    }
  }, [searchParams, setCode, setSourceLang, setPanels]);
}
