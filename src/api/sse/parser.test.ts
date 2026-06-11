import { feedSseChunk, initialSseBuffer } from '@/api/sse/parser'
import type { SseFrame } from '@/api/sse/parser'

/** Feed chunks in sequence and collect every dispatched frame. */
function parseAll(chunks: string[]): SseFrame[] {
  let buffer = initialSseBuffer
  const frames: SseFrame[] = []
  for (const chunk of chunks) {
    const result = feedSseChunk(buffer, chunk)
    buffer = result.buffer
    frames.push(...result.frames)
  }
  return frames
}

describe('feedSseChunk', () => {
  it('dispatches a complete frame on its terminating blank line', () => {
    const frames = parseAll(['id: 1\nevent: TRANSACTION_ADDED\ndata: {"type":"x"}\n\n'])
    expect(frames).toEqual([{ id: '1', event: 'TRANSACTION_ADDED', data: '{"type":"x"}' }])
  })

  it('holds an incomplete frame in the buffer until the blank line arrives', () => {
    let result = feedSseChunk(initialSseBuffer, 'id: 1\nevent: TRANSACTION_ADDED\ndata: {"a')
    expect(result.frames).toEqual([])
    result = feedSseChunk(result.buffer, '":1}\n\n')
    expect(result.frames).toEqual([{ id: '1', event: 'TRANSACTION_ADDED', data: '{"a":1}' }])
  })

  it('reassembles a frame split across many chunks at arbitrary boundaries', () => {
    const wire = 'id: 7\nevent: TRANSACTION_DELETED\ndata: {"transaction_id":"txn_1"}\n\n'
    const frames = parseAll([...wire].map((char) => char))
    expect(frames).toEqual([
      { id: '7', event: 'TRANSACTION_DELETED', data: '{"transaction_id":"txn_1"}' },
    ])
  })

  it('dispatches multiple frames arriving in one chunk', () => {
    const frames = parseAll(['event: A\ndata: 1\n\nevent: B\ndata: 2\n\n'])
    expect(frames).toEqual([
      { id: undefined, event: 'A', data: '1' },
      { id: undefined, event: 'B', data: '2' },
    ])
  })

  it('joins multi-data-line events with newlines per the SSE spec', () => {
    const frames = parseAll(['event: A\ndata: line one\ndata: line two\ndata: line three\n\n'])
    expect(frames[0]?.data).toBe('line one\nline two\nline three')
  })

  it('handles CRLF line endings', () => {
    const frames = parseAll(['id: 1\r\nevent: A\r\ndata: x\r\n\r\n'])
    expect(frames).toEqual([{ id: '1', event: 'A', data: 'x' }])
  })

  it('ignores comment lines (keepalives) without dispatching', () => {
    const frames = parseAll([
      ': connected\n\nevent: A\ndata: 1\n\n: keepalive\n\n: stream ended\n\n',
    ])
    expect(frames).toEqual([{ id: undefined, event: 'A', data: '1' }])
  })

  it('parses and ignores retry: fields — reconnect timing is ours (ADR-17)', () => {
    const frames = parseAll(['retry: 3000\nevent: A\ndata: 1\n\n'])
    expect(frames).toEqual([{ id: undefined, event: 'A', data: '1' }])
  })

  it('drops a frame that has no data', () => {
    const frames = parseAll(['id: 9\nevent: GHOST\n\nevent: A\ndata: 1\n\n'])
    expect(frames).toEqual([{ id: undefined, event: 'A', data: '1' }])
  })

  it('strips exactly one leading space after the field colon', () => {
    const frames = parseAll(['data:no-space\n\ndata:  two-spaces\n\n'])
    expect(frames).toEqual([
      { id: undefined, event: undefined, data: 'no-space' },
      { id: undefined, event: undefined, data: ' two-spaces' },
    ])
  })

  it('treats a field with no colon as a field name with empty value', () => {
    // per spec: "data" alone contributes an empty data line
    const frames = parseAll(['data\ndata: x\n\n'])
    expect(frames[0]?.data).toBe('\nx')
  })

  it('never dispatches from a trailing unterminated frame', () => {
    const result = feedSseChunk(initialSseBuffer, 'event: A\ndata: 1\n')
    expect(result.frames).toEqual([])
  })

  it('reassembles a CRLF split across a chunk boundary', () => {
    const frames = parseAll(['data: x\r', '\n\r\n'])
    expect(frames).toEqual([{ id: undefined, event: undefined, data: 'x' }])
  })
})
