import { useState } from 'react';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';

import { deleteChatApi, renameChatApi, type SessionMeta } from '../../api/chat';
import { useChatStore } from '../../store/appStore';
import { cardCls, inputCls } from './styles';
import type { Notify } from './types';

/** Saved AI conversations, with inline rename and delete. */
export function ChatHistoryCard({
  chats,
  setChats,
  notify,
}: {
  chats: SessionMeta[];
  setChats: (c: SessionMeta[]) => void;
  notify: Notify;
}) {
  const removeSession = useChatStore((s) => s.removeSession);
  const updateSession = useChatStore((s) => s.updateSession);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this chat? This cannot be undone.')) return;
    try {
      await deleteChatApi(id);
      removeSession(id);
      setChats(chats.filter((c) => c.id !== id));
      notify('success', 'Chat deleted.');
    } catch {
      notify('error', 'Failed to delete chat.');
    }
  };

  const handleRename = async (id: string) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    try {
      await renameChatApi(id, title);
      updateSession(id, { title });
      setChats(chats.map((c) => (c.id === id ? { ...c, title } : c)));
    } catch {
      notify('error', 'Failed to rename chat.');
    }
  };

  return (
    <div className={`${cardCls} divide-y divide-slate-800`}>
      <div className="p-6">
        <h2 className="text-lg text-slate-100">Chat history</h2>
        <p className="mt-1 text-sm text-slate-400">
          Rename or delete your saved conversations with the Praxly tutor.
        </p>
      </div>
      {chats.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">No chats yet.</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {chats.map((chat) => (
            <li key={chat.id} className="flex items-center gap-3 px-6 py-3">
              <MessageSquare size={16} className="shrink-0 text-slate-500" />
              {renamingId === chat.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRename(chat.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(chat.id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className={`${inputCls} max-w-xs py-1`}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                  {chat.title ?? 'Untitled chat'}
                </span>
              )}
              <span className="hidden text-xs text-slate-500 sm:block">
                {new Date(chat.updatedAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => {
                  setRenamingId(chat.id);
                  setRenameValue(chat.title ?? '');
                }}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                title="Rename chat"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => handleDelete(chat.id)}
                className="rounded-full p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                title="Delete chat"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
