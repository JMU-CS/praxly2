import type { SupportedLang } from '../LanguageSelector';

interface MemDiaProps {
  paneTitle: string;
  paneLang: SupportedLang;
  currentVariables: Record<string, any>;
}

export function MemDia({ paneTitle, paneLang, currentVariables }: MemDiaProps) {
  const variableEntries = Object.entries(currentVariables);

  return (
    <div className="h-full bg-slate-900/80 p-3 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
          MemDia
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {paneTitle} ({paneLang})
        </span>
      </div>
      {variableEntries.length === 0 ? (
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-500">
          No runtime memory yet. Run or debug to populate variables for this pane.
        </div>
      ) : (
        <div className="space-y-2">
          {variableEntries.slice(0, 8).map(([name, value]) => (
            <div
              key={name}
              className="flex items-start justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2"
            >
              <span className="text-xs font-semibold text-slate-300">{name}</span>
              <span className="max-w-[70%] break-words text-right text-xs text-indigo-300">
                {typeof value === 'string' ? `\"${value}\"` : JSON.stringify(value)}
              </span>
            </div>
          ))}
          {variableEntries.length > 8 && (
            <div className="text-[11px] text-slate-500">+ {variableEntries.length - 8} more</div>
          )}
        </div>
      )}
    </div>
  );
}
