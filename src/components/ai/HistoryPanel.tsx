import { Search, Trash2 } from 'lucide-react';
import type { Chat } from './ChatThread';

interface HistoryPanelProps {
  chats: Chat[];
  activeId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function HistoryPanel({
  chats,
  activeId,
  search,
  onSearchChange,
  onOpen,
  onDelete,
}: HistoryPanelProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-2 border-b border-slate-800">
        <div className="flex items-center gap-2 rounded-md bg-slate-800 border border-slate-700 px-2">
          <Search size={13} className="text-muted shrink-0" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search chats…"
            className="flex-1 bg-transparent py-1.5 text-xs text-slate-200 placeholder-muted focus:outline-none"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {chats.length === 0 && (
          <p className="text-xs text-muted text-center mt-6">No chats found.</p>
        )}
        {chats.map((c) => (
          <div
            key={c.id}
            className={`group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
              c.id === activeId ? 'bg-slate-800' : 'hover:bg-slate-800/60'
            }`}
            onClick={() => onOpen(c.id)}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-slate-200">{c.title}</p>
              <p className="text-xs text-muted">
                {c.messages.length === 0
                  ? 'Empty'
                  : `${c.messages.length} message${c.messages.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c.id);
              }}
              className="shrink-0 p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-red-400 transition"
              title="Delete chat"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
