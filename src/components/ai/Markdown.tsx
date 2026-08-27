import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SquareArrowOutUpRight } from 'lucide-react';
import { useEditorBridge } from '../../store/appStore';

/**
 * Renders an assistant chat message as markdown (bold, lists, headings,
 * tables, inline + fenced code). Fenced code blocks get a language header and
 * an "Add to editor" button that appends the code to the end of the source
 * editor.
 */

/**
 * The tutor sometimes prefixes each line of a code block with its line number
 * ("1 if (...)", "2   return"). That's fine to read, but pasting it into the
 * editor would double up with the editor's own line gutter — so strip a
 * leading number+space from every line, but only when ALL non-empty lines are
 * numbered in increasing order (i.e. it's really line numbering, not code that
 * happens to start with a digit).
 */
function stripLeadingLineNumbers(code: string): string {
  const lines = code.split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return code;
  if (!nonEmpty.every((l) => /^\s*\d+\s+/.test(l))) return code;

  const nums = nonEmpty.map((l) => parseInt(/^\s*(\d+)/.exec(l)![1], 10));
  const increasing = nums.every((n, i) => i === 0 || n > nums[i - 1]);
  if (!increasing) return code;

  return lines.map((l) => l.replace(/^(\s*)\d+\s+/, '$1')).join('\n');
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const openCode = useEditorBridge((s) => s.openCode);
  return (
    <div className="my-2 overflow-hidden rounded-md border border-slate-700">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-950/80 px-2.5 py-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          {language || 'code'}
        </span>
        {openCode && code.trim().length > 0 && (
          <button
            onClick={() => openCode(stripLeadingLineNumbers(code), language)}
            title="Add this code to the end of the editor"
            className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-slate-400 transition-colors hover:text-indigo-300"
          >
            <SquareArrowOutUpRight size={11} />
            Add to editor
          </button>
        )}
      </div>
      <pre className="overflow-x-auto bg-slate-950/60 px-2.5 py-2">
        <code className="font-mono text-[0.9em] leading-relaxed text-slate-200">{code}</code>
      </pre>
    </div>
  );
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Unwrap <pre> so our CodeBlock (which brings its own <pre>) isn't nested inside one.
          pre: ({ children }) => <>{children}</>,
          code({ className, children }) {
            const value = String(children).replace(/\n$/, '');
            const match = /language-(\w+)/.exec(className ?? '');
            const isBlock = Boolean(match) || value.includes('\n');
            if (!isBlock) {
              return (
                <code className="rounded bg-slate-950/60 px-1 py-0.5 font-mono text-[0.9em] text-indigo-200">
                  {value}
                </code>
              );
            }
            return <CodeBlock language={match?.[1] ?? ''} code={value} />;
          },
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-indigo-300 underline">
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="list-disc space-y-0.5 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-0.5 pl-5">{children}</ol>,
          h1: ({ children }) => (
            <h3 className="text-sm font-semibold text-slate-100">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="text-sm font-semibold text-slate-100">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="text-xs font-semibold text-slate-100">{children}</h4>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-slate-700 px-2 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border border-slate-700 px-2 py-1">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
