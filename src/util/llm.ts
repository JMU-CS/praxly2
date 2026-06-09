import OpenAI from 'openai';

/**
 * Talks to an LLM through Dr. Mayfield's LiteLLM proxy using the OpenAI SDK.
 * LiteLLM is OpenAI-compatible, so switching models is just changing `MODEL`
 * (e.g. 'anthropic/claude-3-5-sonnet', 'gemini/gemini-2.5-flash', ...).
 *
 * Config comes from Vite env vars (set these in a root `.env` file):
 *   VITE_LITELLM_BASE_URL  - the LiteLLM proxy URL (required)
 *   VITE_LITELLM_API_KEY   - the LiteLLM key (defaults to 'Mayfield')
 *   VITE_LLM_MODEL         - model name (defaults to claude-3-5-sonnet)
 */

// Cast avoids needing the Vite client type reference here.
const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ??
  {}) as Record<string, string | undefined>;

const MODEL = env.VITE_LLM_MODEL ?? 'anthropic/claude-3-5-sonnet';

const client = new OpenAI({
  baseURL: env.VITE_LITELLM_BASE_URL,
  apiKey: env.VITE_LITELLM_API_KEY ?? 'Mayfield',
  // We call the proxy directly from the browser during development.
  dangerouslyAllowBrowser: true,
});

const SYSTEM_PROMPT =
  'You are a helpful coding tutor built into the Praxly IDE. ' +
  'Praxly supports Praxis pseudocode, Python, Java, and CSP (a pseudocode used in AP CS Principles). ' +
  'The student is working on code in the editor, included below. ' +
  'Give clear, concise answers aimed at K-12 students learning to code. ' +
  'Guide the student to understand rather than dumping the full answer.';

export interface SimpleMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface StreamOptions {
  messages: SimpleMessage[];
  code: string;
  language: string;
  signal?: AbortSignal;
}

/**
 * Streams the assistant's reply. Yields the full accumulated text each time
 * a new chunk arrives, which is what assistant-ui's local runtime expects.
 */
export async function* streamAssistant(opts: StreamOptions): AsyncGenerator<string> {
  const contextBlock = opts.code.trim()
    ? `The student is working in ${opts.language}. Their current code:\n\`\`\`\n${opts.code}\n\`\`\``
    : `The student is working in ${opts.language}.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n${contextBlock}` },
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
