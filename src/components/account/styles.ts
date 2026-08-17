/**
 * Tailwind class strings shared across the account sections, so the cards,
 * inputs, and buttons stay visually identical from one pane to the next.
 */

export const cardCls = 'rounded-2xl border border-slate-800 bg-slate-900';

export const inputCls =
  'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-muted focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition';

export const primaryBtnCls =
  'rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

export const textBtnCls =
  'rounded-full px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-slate-800 transition-colors';
