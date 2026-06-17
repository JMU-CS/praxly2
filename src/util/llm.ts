import OpenAI from 'openai';

/**
 * Talks to an LLM through Dr. Mayfield's LiteLLM proxy using the OpenAI SDK.
 * LiteLLM is OpenAI-compatible, so switching models is just changing `MODEL`
 * (e.g. 'anthropic/claude-3-5-sonnet', 'gemini/gemini-2.5-flash', ...).
 *
 * Config comes from Vite env vars (set these in a root `.env` file):
 *   VITE_LITELLM_BASE_URL  - the LiteLLM proxy URL (required)
 *   VITE_LITELLM_API_KEY   - the LiteLLM key (required)
 *   VITE_LLM_MODEL         - model name (defaults to qwen2.5:0.5b)
 */

// Cast avoids needing the Vite client type reference here.
const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ??
  {}) as Record<string, string | undefined>;

const MODEL = env.VITE_LLM_MODEL ?? 'qwen2.5:0.5b';

const client = new OpenAI({
  baseURL: env.VITE_LITELLM_BASE_URL,
  apiKey: env.VITE_LITELLM_API_KEY,
  // We call the proxy directly from the browser during development.
  dangerouslyAllowBrowser: true,
});

const SYSTEM_PROMPT =
  'You are a helpful coding tutor built into the Praxly IDE. ' +
  'Praxly supports Praxis pseudocode, Python, Java, and CSP (a pseudocode used in AP CS Principles). ' +
  'The student has one or more code panels open in the editor, shown below — often the same program ' +
  'translated across languages. Use all of them as context. ' +
  'Give clear, concise answers aimed at K-12 students learning to code. ' +
  'Guide the student to understand rather than dumping the full answer.';

export interface SimpleMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** One open editor panel: a language and its current code. */
export interface LlmPanel {
  language: string;
  code: string;
}

export interface StreamOptions {
  messages: SimpleMessage[];
  panels: LlmPanel[];
  /** Code the student highlighted in the editor to focus the conversation on. */
  selection?: string;
  signal?: AbortSignal;
}

function buildContextBlock(panels: LlmPanel[], selection?: string): string {
  const withCode = panels.filter((p) => p.code.trim().length > 0);

  let block =
    withCode.length === 0
      ? 'The student has not written any code yet.'
      : 'The student currently has these code panels open:\n\n' +
        withCode.map((p) => `${p.language}:\n\`\`\`\n${p.code}\n\`\`\``).join('\n\n');

  if (selection && selection.trim().length > 0) {
    block +=
      `\n\nThe student has highlighted this specific snippet and wants to focus on it:\n` +
      `\`\`\`\n${selection}\n\`\`\``;
  }

  return block;
}

/**
 * Streams the assistant's reply. Yields the full accumulated text each time
 * a new chunk arrives, which is what assistant-ui's local runtime expects.
 */
export async function* streamAssistant(opts: StreamOptions): AsyncGenerator<string> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\n${buildContextBlock(opts.panels, opts.selection)}`,
    },
    ...opts.messages.map((m) => ({ role: m.role, content: m.text })),
  ];

  const stream = await client.chat.completions.create(
    { model: MODEL, stream: true, messages },
    { signal: opts.signal }
  );

  let acc = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (delta) {
      acc += delta;
      yield acc;
    }
  }
}
