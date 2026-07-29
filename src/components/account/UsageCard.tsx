import { useMemo } from 'react';

import type { AccountUsage } from '../../api/account';
import { cardCls } from './styles';

/** Message-count totals plus a 30-day activity sparkline. */
export function UsageCard({ usage }: { usage: AccountUsage | null }) {
  // Fill the last 30 days so quiet days render as empty bars, not gaps.
  const bars = useMemo(() => {
    const byDay = new Map((usage?.daily ?? []).map((d) => [d.day, d.count]));
    const days: Array<{ day: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ day: key, count: byDay.get(key) ?? 0 });
    }
    return days;
  }, [usage]);
  const maxCount = Math.max(1, ...bars.map((b) => b.count));

  return (
    <div className={`${cardCls} p-6`}>
      <h2 className="text-lg text-slate-100">AI usage</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Chats', value: usage?.sessions ?? 0 },
          { label: 'Messages', value: usage?.messages ?? 0 },
          { label: 'Sent', value: usage?.sent ?? 0 },
          { label: 'Received', value: usage?.received ?? 0 },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-slate-800/50 p-4 text-center">
            <div className="text-2xl font-medium text-slate-100">{stat.value}</div>
            <div className="mt-1 text-xs text-slate-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <h3 className="mt-6 text-xs font-medium uppercase tracking-wide text-slate-500">
        Last 30 days
      </h3>
      <div
        className="mt-2 flex h-24 items-end gap-[3px]"
        role="img"
        aria-label="Messages per day, last 30 days"
      >
        {bars.map((b) => (
          <div
            key={b.day}
            title={`${b.day}: ${b.count} message${b.count === 1 ? '' : 's'}`}
            className={`flex-1 rounded-t ${b.count > 0 ? 'bg-indigo-500/100' : 'bg-slate-800'}`}
            style={{ height: `${Math.max(4, (b.count / maxCount) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
