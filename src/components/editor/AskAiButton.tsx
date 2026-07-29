import { Sparkles } from 'lucide-react';

import type { SelectionCoords } from '../../hooks/useAiSelection';

/** Floating "Ask AI" button that follows a selection in the source editor. */
export function AskAiButton({ coords, onClick }: { coords: SelectionCoords; onClick: () => void }) {
  return (
    <button
      // Keep the editor's selection alive — losing it would unmount this button
      // before the click lands.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 300 }}
      className="flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-600 text-white text-xs font-medium shadow-lg hover:bg-indigo-500 transition-colors"
      title="Ask the AI about the selected code"
    >
      <Sparkles size={12} />
      Ask AI
    </button>
  );
}
