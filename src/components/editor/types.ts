import type { SourceMap } from '../../language/visitor';
import type { SupportedLang } from '../LanguageSelector';

export interface Panel {
  id: string;
  lang: SupportedLang;
  width: number;
  sourceMap: SourceMap;
}
