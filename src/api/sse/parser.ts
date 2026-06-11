/**
 * Pure SSE wire-format parser (ADR-17): feed text chunks, get dispatched
 * frames back. State between feeds is just the unterminated remainder string.
 * `retry:` fields are parsed and ignored — reconnect timing belongs to the
 * transport's own backoff. Frames with no data are dropped per the SSE spec.
 */

export interface SseFrame {
  id: string | undefined
  event: string | undefined
  data: string
}

export interface SseChunkResult {
  buffer: string
  frames: SseFrame[]
}

export const initialSseBuffer = ''

function fieldValue(line: string): { field: string; value: string } {
  const colon = line.indexOf(':')
  if (colon === -1) {
    return { field: line, value: '' }
  }
  const rawValue = line.slice(colon + 1)
  return {
    field: line.slice(0, colon),
    value: rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue,
  }
}

function parseFrame(block: string): SseFrame | null {
  let id: string | undefined
  let event: string | undefined
  const dataLines: string[] = []

  for (const line of block.split('\n')) {
    if (line === '' || line.startsWith(':')) continue
    const { field, value } = fieldValue(line)
    if (field === 'data') dataLines.push(value)
    else if (field === 'event') event = value
    else if (field === 'id') id = value
    // 'retry' and unknown fields: parsed, ignored
  }

  if (dataLines.length === 0) return null
  return { id, event, data: dataLines.join('\n') }
}

export function feedSseChunk(buffer: string, chunk: string): SseChunkResult {
  let text = buffer + chunk
  // a trailing CR may be the first half of a CRLF split across chunks
  let carry = ''
  if (text.endsWith('\r')) {
    carry = '\r'
    text = text.slice(0, -1)
  }
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const blocks = normalized.split('\n\n')
  // the final segment has no terminating blank line yet — it stays buffered
  const remainder = blocks.pop() ?? ''

  const frames: SseFrame[] = []
  for (const block of blocks) {
    const frame = parseFrame(block)
    if (frame !== null) frames.push(frame)
  }
  return { buffer: remainder + carry, frames }
}
