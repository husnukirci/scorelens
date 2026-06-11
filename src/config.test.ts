import { parseConfig } from '@/config'

const validEnv = {
  VITE_API_BASE_URL: 'https://api.example.test',
  VITE_SSE_BASE_URL: 'https://sse.example.test',
}

describe('parseConfig', () => {
  it('returns both base urls from a valid env', () => {
    const config = parseConfig(validEnv)
    expect(config.apiBaseUrl).toBe('https://api.example.test')
    expect(config.sseBaseUrl).toBe('https://sse.example.test')
  })

  it('strips trailing slashes so call sites can join paths predictably', () => {
    const config = parseConfig({
      VITE_API_BASE_URL: 'https://api.example.test/',
      VITE_SSE_BASE_URL: 'https://sse.example.test///',
    })
    expect(config.apiBaseUrl).toBe('https://api.example.test')
    expect(config.sseBaseUrl).toBe('https://sse.example.test')
  })

  it('returns a frozen object', () => {
    expect(Object.isFrozen(parseConfig(validEnv))).toBe(true)
  })

  it('names the missing variable when one is absent', () => {
    expect(() => parseConfig({ VITE_API_BASE_URL: 'https://api.example.test' })).toThrow(
      /VITE_SSE_BASE_URL/,
    )
  })

  it('names the missing variable when one is empty', () => {
    expect(() =>
      parseConfig({ VITE_API_BASE_URL: '', VITE_SSE_BASE_URL: 'https://sse.example.test' }),
    ).toThrow(/VITE_API_BASE_URL/)
  })

  it('rejects values that do not parse as urls', () => {
    expect(() =>
      parseConfig({
        VITE_API_BASE_URL: 'not a url',
        VITE_SSE_BASE_URL: 'https://sse.example.test',
      }),
    ).toThrow(/VITE_API_BASE_URL/)
  })

  it('rejects non-http(s) protocols', () => {
    expect(() =>
      parseConfig({
        VITE_API_BASE_URL: 'ftp://api.example.test',
        VITE_SSE_BASE_URL: 'https://sse.example.test',
      }),
    ).toThrow(/VITE_API_BASE_URL/)
  })

  it('rejects non-string values', () => {
    expect(() =>
      parseConfig({ VITE_API_BASE_URL: 42, VITE_SSE_BASE_URL: 'https://sse.example.test' }),
    ).toThrow(/VITE_API_BASE_URL/)
  })
})
