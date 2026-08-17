import { describe, it, expect } from 'vitest';
import { ExportedMessageRepository, MessageRepository } from '@assistant-ui/core/internal';

import {
  GENERIC_ERROR,
  threadMessageError,
  threadMessageModel,
  threadMessageText,
  toSimpleMessages,
  toThreadMessages,
} from '../src/components/ai/threadMessages';
import type { SimpleMessage } from '../src/api/llm';

/**
 * A failed turn is cached as empty text plus an `error` string. Getting that
 * back on screen depends on a chain: toThreadMessages must turn `error` into an
 * error *status*, assistant-ui's repository must preserve that status through
 * the seed, and threadMessageError must read it back out. Break any link and
 * the reply renders as a blank bubble with the failure silently gone — which is
 * exactly the bug these tests exist to keep fixed.
 */

/** Seeds a thread the way ChatThread does, and reads the messages back. */
function throughRuntime(messages: SimpleMessage[]) {
  const repo = new MessageRepository();
  repo.import(ExportedMessageRepository.fromArray(toThreadMessages(messages) as never));
  return repo.getMessages();
}

const ERRORED_TURN: SimpleMessage[] = [
  { role: 'user', text: 'Explain this code' },
  {
    role: 'assistant',
    text: '',
    error: "That model isn't available for your key. Pick another in Account → AI model & API key.",
  },
];

describe('restoring a cached errored turn', () => {
  it('shows the error, not an empty bubble, for a reply with no text', () => {
    const [, assistant] = throughRuntime(ERRORED_TURN);

    expect(threadMessageText(assistant!)).toBe('');
    // The whole point: empty text must still resolve to the error string.
    expect(threadMessageError(assistant!)).toBe(ERRORED_TURN[1]!.error);
  });

  it('marks the assistant message incomplete/error so the red bubble renders', () => {
    const [, assistant] = throughRuntime(ERRORED_TURN);
    expect(assistant!.status).toMatchObject({ type: 'incomplete', reason: 'error' });
  });

  it('leaves user messages without a status', () => {
    // assistant-ui throws outright on a user message carrying one.
    const [user] = throughRuntime(ERRORED_TURN);
    expect(threadMessageError(user!)).toBeNull();
  });

  it('keeps partial text alongside the error when a reply failed mid-stream', () => {
    const [, assistant] = throughRuntime([
      { role: 'user', text: 'Explain this code' },
      { role: 'assistant', text: 'Here is the first half', error: 'Connection lost.' },
    ]);
    expect(threadMessageText(assistant!)).toBe('Here is the first half');
    expect(threadMessageError(assistant!)).toBe('Connection lost.');
  });

  it('falls back to generic text when the error is recorded blank', () => {
    const [, assistant] = throughRuntime([
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: '', error: '   ' },
    ]);
    // A blank error still has to read as a failure, never as an empty reply.
    expect(assistant!.status).toMatchObject({ reason: 'error' });
    expect(threadMessageError(assistant!)).toBe(GENERIC_ERROR);
  });

  it('survives a cache round trip, so reopening twice keeps the error', () => {
    const once = toSimpleMessages(throughRuntime(ERRORED_TURN));
    expect(once).toEqual(ERRORED_TURN);
    expect(toSimpleMessages(throughRuntime(once))).toEqual(ERRORED_TURN);
  });

  it('carries the model label through with the error', () => {
    const [, assistant] = throughRuntime([
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: '', model: 'gemini/gemini-flash-lite-latest', error: 'Boom.' },
    ]);
    expect(threadMessageModel(assistant!)).toBe('gemini/gemini-flash-lite-latest');
    expect(threadMessageError(assistant!)).toBe('Boom.');
  });
});
