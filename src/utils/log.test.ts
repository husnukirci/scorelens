import { logEvent } from './log'

describe('logEvent', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('emits a structured payload with the event name', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    logEvent('stream.connected', { path: 'envelope' })
    expect(info).toHaveBeenCalledWith(
      '[scorelens]',
      expect.objectContaining({ event: 'stream.connected', path: 'envelope' }),
    )
  })

  it('routes warn and error levels to their console channels', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    logEvent('stream.recovering', { attempt: 2 }, 'warn')
    logEvent('app.error', { message: 'boom' }, 'error')
    expect(warn).toHaveBeenCalledWith('[scorelens]', expect.objectContaining({ attempt: 2 }))
    expect(error).toHaveBeenCalledWith('[scorelens]', expect.objectContaining({ message: 'boom' }))
  })

  it('suppresses info events outside dev builds, but never warnings or errors', () => {
    vi.stubEnv('DEV', false)
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    logEvent('transactions.fill', { pages: 4 })
    logEvent('stream.recovering', {}, 'warn')
    expect(info).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })
})
