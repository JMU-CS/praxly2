import type { SourceMap } from '../../language/visitor';
import type { SupportedLang } from '../LanguageSelector';

export interface Panel {
  id: string;
  lang: SupportedLang;
  width: number;
  sourceMap: SourceMap;
  stackedUnder?: string; // ID of the panel this is rendered below (shares that panel's column)
}
