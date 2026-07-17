/**
 * Per-language feature demo programs, sourced directly from `examples/demo.*`
 * (the same files the round-trip/examples/blocks test suites use) so the
 * content lives in exactly one place.
 */

import pythonDemo from '../../examples/demo.py?raw';
import javaDemo from '../../examples/demo.java?raw';
import javascriptDemo from '../../examples/demo.js?raw';
import cspDemo from '../../examples/demo.csp?raw';
import praxisDemo from '../../examples/demo.praxis?raw';
import blocksDemo from '../../examples/demo.blocks.json?raw';

import type { SupportedLang } from '../components/LanguageSelector';

export const DEMO_PROGRAMS: Partial<Record<SupportedLang, string>> = {
  python: pythonDemo,
  java: javaDemo,
  javascript: javascriptDemo,
  csp: cspDemo,
  praxis: praxisDemo,
  blocks: blocksDemo,
};

export const getDemoForLang = (lang: SupportedLang): string | undefined => DEMO_PROGRAMS[lang];
