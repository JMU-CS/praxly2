import type { SupportedLang } from '../LanguageSelector';
import { renderMemoryDiagramFromVariables } from '../../language/memdia';

interface MemDiaProps {
  paneTitle: string;
  paneLang: SupportedLang;
  currentVariables: Record<string, any>;
}

// This panel used to list each variable as plain text (`name: JSON.stringify(value)`).
// It now renders the real box-and-value memory diagram: renderMemoryDiagramFromVariables()
// (in memdia.ts) converts the same currentVariables dict into an SVG string, and this
// component just displays it.
export function MemDia({ paneTitle, paneLang, currentVariables }: MemDiaProps) {
  // currentVariables is already the right value to show at all times: Run and
  // Debug each clear it (via useProgramRunner/useCodeDebugger reset paths) when
  // the other mode starts or stops, so no extra "remember the last value" state
  // is needed here — this panel just mirrors whatever it's given.
  const svg = renderMemoryDiagramFromVariables(currentVariables);

  return (
    <div className="h-full bg-slate-900/80 p-3 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
          MemDia
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {paneTitle} ({paneLang})
        </span>
      </div>

      {/* dangerouslySetInnerHTML is safe here: `svg` is markup in memdia.ts
          (every variable name/value is passed through escapeXml there), never
          raw user- or HTML-supplied content. */}
      <div
        className="h-[calc(100%-24px)] overflow-auto rounded-md border border-slate-800 bg-slate-900/80 p-2"
        style={{ minHeight: 0, whiteSpace: 'nowrap' }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
