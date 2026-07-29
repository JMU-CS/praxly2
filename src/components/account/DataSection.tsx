import type { AccountUsage } from '../../api/account';
import type { SessionMeta } from '../../api/chat';
import { ChatHistoryCard } from './ChatHistoryCard';
import { UsageCard } from './UsageCard';
import type { Notify } from './types';

/** Data & activity pane: AI usage stats above the saved chat list. */
export function DataSection({
  usage,
  chats,
  setChats,
  notify,
}: {
  usage: AccountUsage | null;
  chats: SessionMeta[];
  setChats: (c: SessionMeta[]) => void;
  notify: Notify;
}) {
  return (
    <div className="space-y-6">
      <UsageCard usage={usage} />
      <ChatHistoryCard chats={chats} setChats={setChats} notify={notify} />
    </div>
  );
}
