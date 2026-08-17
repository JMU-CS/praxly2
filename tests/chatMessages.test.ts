import { describe, it, expect } from 'vitest';
import {
  GENERIC_ERROR,
  threadMessageError,
  threadMessageModel,
  toSimpleMessages,
} from '../src/components/ai/threadMessages';
import { toSimpleMessages as backendToSimpleMessages } from '../src/api/chat';

/** Shape assistant-ui hands back for one message in a thread. */
const msg = (
  role: string,
  text: string,
  extra: Partial<{ metadata: unknown; status: unknown }> = {}
) => ({ role, content: text ? [{ type: 'text', text }] : [], ...extra }) as never;

const errored = (error: unknown) => ({ type: 'incomplete', reason: 'error', error });

describe('thread → cached messages', () => {
  it('keeps a failed turn so the error survives a reopen', () => {
    const cached = toSimpleMessages([
      msg('user', 'why does this loop hang?'),
      msg('assistant', '', { status: errored('The provider is rate-limiting this key.') }),
    ]);

    expect(cached).toHaveLength(2);
    expect(cached[1]).toEqual({
      role: 'assistant',
      text: '',
      error: 'The provider is rate-limiting this key.',
    });
  });

  it('keeps whatever streamed before a failure, alongside the error', () => {
    const cached = toSimpleMessages([
      msg('assistant', 'Here is the start of an ans', { status: errored('Connection lost.') }),
    ]);

    expect(cached[0]?.text).toBe('Here is the start of an ans');
    expect(cached[0]?.error).toBe('Connection lost.');
  });

  it('drops empty messages that did not fail', () => {
    expect(toSimpleMessages([msg('assistant', '')])).toEqual([]);
  });

  it('records the model that answered', () => {
    const cached = toSimpleMessages([
      msg('assistant', 'sure', { metadata: { custom: { model: 'gemini-2.5-flash' } } }),
    ]);
    expect(cached[0]?.model).toBe('gemini-2.5-flash');
  });

  it('falls back to a generic sentence when the error is not text', () => {
    expect(threadMessageError(msg('assistant', '', { status: errored({ code: 500 }) }))).toBe(
      GENERIC_ERROR
    );
    expect(threadMessageError(msg('assistant', 'fine'))).toBeNull();
  });

  it('ignores a blank or non-string model', () => {
    expect(
      threadMessageModel(msg('assistant', 'x', { metadata: { custom: { model: '  ' } } }))
    ).toBeUndefined();
    expect(
      threadMessageModel(msg('assistant', 'x', { metadata: { custom: { model: 7 } } }))
    ).toBeUndefined();
  });
});

describe('backend history → cached messages', () => {
  it('carries the stored model and error through', () => {
    const cached = backendToSimpleMessages([
      { id: '1', role: 'user', content: 'hi', model: null, error: null },
      { id: '2', role: 'assistant', content: 'hello', model: 'gpt-4.1-mini', error: null },
      {
        id: '3',
        role: 'assistant',
        content: '',
        model: null,
        error: 'That model isn’t available.',
      },
    ]);

    expect(cached[1]).toEqual({ role: 'assistant', text: 'hello', model: 'gpt-4.1-mini' });
    expect(cached[2]).toEqual({
      role: 'assistant',
      text: '',
      error: 'That model isn’t available.',
    });
  });

  it('handles rows from before the columns existed', () => {
    const cached = backendToSimpleMessages([{ id: '1', role: 'assistant', content: 'old reply' }]);
    expect(cached[0]).toEqual({ role: 'assistant', text: 'old reply' });
  });
});
