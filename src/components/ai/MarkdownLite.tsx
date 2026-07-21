import { Fragment, useMemo } from 'react';
import { SquareArrowOutUpRight } from 'lucide-react';
import { useEditorBridge } from '../../store/appStore';

/**
 * Minimal markdown renderer for chat messages — handles exactly what the
 * tutor actually emits (fenced code blocks and inline code) without pulling
 * in a full markdown library.
 *
 * While a reply is still streaming, an unterminated ``` fence is treated as
 * an open code block so code renders styled from the first token.
 */

interface Segment {
  kind: 'text' | 'code';
  content: string;
  language?: string;
}

function splitFences(text: string): Segment[] {
  const segments: Segment[] = [];
  const parts = text.split('```');

  parts.forEach((part, i) => {
    const isCode = i % 2 === 1;
    if (!isCode) {
      const trimmed = part.replace(/^\n+/, '').replace(/\n+$/, '');
      if (trimmed.length > 0) segments.push({ kind: 'text', content: trimmed });
      return;
    }
    // The fence's first line is an optional language tag (```python).
    const newline = part.indexOf('\n');
    const firstLine = newline === -1 ? part : part.slice(0, newline);
    const isLangTag = /^[A-Za-z0-9+#_-]*$/.test(firstLine.trim());
    const language = isLangTag ? firstLine.trim() : '';
    const body = isLangTag && newline !== -1 ? part.slice(newline + 1) : isLangTag ? '' : part;
    segments.push({ kind: 'code', content: body.replace(/\n$/, ''), language });
  });

  return segments;
}

/** Renders plain text, styling `inline code` spans. */
function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`\n]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
          <code
            key={i}
            className="rounded bg-slate-950/60 px-1 py-0.5 font-mono text-[0.9em] text-indigo-200"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

export function MarkdownLite({ text }: { text: string }) {
  const segments = useMemo(() => splitFences(text), [text]);
  const openCode = useEditorBridge((s) => s.openCode);

  return (
    <div className="space-y-2">
      {segments.map((segment, i) =>
        segment.kind === 'code' ? (
          <div key={i} className="overflow-hidden rounded-md border border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-700 bg-slate-950/80 px-2.5 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {segment.language || 'code'}
              </span>
              {openCode && segment.content.trim().length > 0 && (
                <button
                  onClick={() => openCode(segment.content, segment.language ?? '')}
                  title="Open this code in the editor (replaces what's there)"
                  className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-indigo-300 transition-colors"
                >
                  <SquareArrowOutUpRight size={11} />
                  Open in editor
                </button>
              )}
            </div>
            <pre className="overflow-x-auto bg-slate-950/60 px-2.5 py-2">
              <code className="font-mono text-[0.9em] leading-relaxed text-slate-200">
                {segment.content}
              </code>
            </pre>
          </div>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            <InlineText text={segment.content} />
          </p>
        )
      )}
    </div>
  );
}
