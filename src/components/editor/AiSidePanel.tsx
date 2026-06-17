import { useMemo, useRef } from 'react';
import { Send, X } from 'lucide-react';
import type { MouseEvent } from 'react';
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  type ChatModelAdapter,
} from '@assistant-ui/react';
import { streamAssistant, type SimpleMessage, type LlmPanel } from '../../util/llm';

// Max characters a user may send in one message. Keeps requests bounded so we
// don't overload the model's context window. Easy to tune.
const MAX_INPUT_CHARS = 2000;

interface AiSidePanelProps {
  width: number;
  isResizing: boolean;
  onStartResize: (e: MouseEvent) => void;
  onClose: () => void;
  panels: LlmPanel[];
  selection: string;
  onClearSelection: () => void;
}

const UserMessage = () => (
  <MessagePrimitive.Root className="flex justify-end">
    <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap bg-indigo-600 text-white">
      <MessagePrimitive.Parts />
    </div>
  </MessagePrimitive.Root>
);

const AssistantMessage = () => (
  <MessagePrimitive.Root className="flex justify-start">
    <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap bg-slate-800 text-slate-200 border border-slate-700">
      <MessagePrimitive.Parts />
    </div>
  </MessagePrimitive.Root>
);

export function AiSidePanel({
  width,
  isResizing,
  onStartResize,
  onClose,
  panels,
  selection,
  onClearSelection,
}: AiSidePanelProps) {
  // Keep the latest open panels + highlighted selection available to the adapter closure.
  const panelsRef = useRef(panels);
  panelsRef.current = panels;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const adapter = useMemo<ChatModelAdapter>(
    () => ({
      async *run({ messages, abortSignal }) {
        const simple: SimpleMessage[] = messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            text: m.content.map((p) => ('text' in p ? p.text : '')).join(''),
          }))
          .filter((m) => m.text.length > 0);

        let last = '';
        for await (const text of streamAssistant({
          messages: simple,
          panels: panelsRef.current,
          selection: selectionRef.current,
          signal: abortSignal,
        })) {
          last = text;
          yield { content: [{ type: 'text', text }] };
        }

        // The tiny dev model occasionally returns nothing — avoid a blank bubble.
        if (last.trim().length === 0) {
          yield {
            content: [{ type: 'text', text: '(No response — please try asking again.)' }],
          };
        }
      },
    }),
    []
  );

  const runtime = useLocalRuntime(adapter);

  return (
    <div
      className="shrink-0 flex flex-col bg-slate-900 border-l border-slate-800 relative z-[140]"
      style={{ width }}
    >
      {/* Resize handle */}
      <div
        className={`absolute top-0 left-0 w-1 h-full cursor-col-resize z-[200] transition-colors ${
          isResizing ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/40'
        }`}
        onMouseDown={onStartResize}
      />

      {/* Header */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/80 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
          AI Assistant
        </span>
        <button
          onClick={onClose}
          className="p-1 text-slate-500 hover:text-slate-200 transition-colors"
          title="Close AI panel"
        >
          <X size={14} />
        </button>
      </div>

      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadPrimitive.Root className="flex-1 flex flex-col min-h-0">
          <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            <ThreadPrimitive.Empty>
              <p className="text-xs text-slate-500 text-center mt-6">
                Ask anything about your code.
              </p>
            </ThreadPrimitive.Empty>
            <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
          </ThreadPrimitive.Viewport>

          {/* Input area */}
          <div className="border-t border-slate-800 p-3 shrink-0">
            {selection.trim().length > 0 && (
              <div className="mb-2 flex items-start gap-2 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                    Asking about selected code
                  </p>
                  <p className="truncate font-mono text-[11px] text-slate-300">
                    {selection.trim()}
                  </p>
                </div>
                <button
                  onClick={onClearSelection}
                  className="shrink-0 p-0.5 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Clear selected code"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <ComposerPrimitive.Root className="flex gap-2 items-end">
              <ComposerPrimitive.Input
                placeholder="Ask about your code… (Enter to send)"
                rows={2}
                maxLength={MAX_INPUT_CHARS}
                className="flex-1 resize-none rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 px-3 py-2 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <ComposerPrimitive.Send
                className="p-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                title="Send"
              >
                <Send size={14} />
              </ComposerPrimitive.Send>
            </ComposerPrimitive.Root>
          </div>
        </ThreadPrimitive.Root>
      </AssistantRuntimeProvider>
    </div>
  );
}
