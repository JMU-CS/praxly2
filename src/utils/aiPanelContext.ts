/**
 * Builds the code context the AI panel sends with a message: the source plus
 * every open translation, so the model sees the whole workspace rather than
 * just the pane the user happens to be in.
 */

import type { Program } from '../language/ast';
import type { LlmPanel } from '../api/llm';
import type { SupportedLang } from '../components/LanguageSelector';
import type { Panel } from '../components/editor/types';
import type { SourceMap } from '../hooks/useCodeParsing';

type GetTranslation = (
  ast: Program | null,
  lang: SupportedLang
) => { code: string; sourceMap: SourceMap };

export function buildAiPanelContext(
  code: string,
  sourceLang: SupportedLang,
  ast: Program | null,
  panels: Panel[],
  getTranslation: GetTranslation
): LlmPanel[] {
  const result: LlmPanel[] = [];

  if (code.trim()) {
    if (sourceLang === 'blocks') {
      // Blocks source is Blockly workspace JSON — meaningless to the LLM.
      // Send the equivalent Praxis pseudocode string instead.
      const readable = ast ? getTranslation(ast, 'praxis').code : '';
      if (readable.trim()) result.push({ language: 'praxis', code: readable });
    } else {
      result.push({ language: sourceLang, code });
    }
  }

  if (ast) {
    for (const panel of panels) {
      // A blocks panel shows the same program the source already covers,
      // and its JSON would only waste the model's context.
      if (panel.lang === 'blocks') continue;
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
}
