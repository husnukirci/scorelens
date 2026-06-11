import '@testing-library/jest-dom/vitest'

import { server } from './server'

/**
 * happy-dom's ResizeObserver never fires, so size-observing libraries
 * (recharts, tanstack virtual) render nothing. This stub reports the
 * element's (test-stubbed) offset dimensions synchronously on observe.
 */
class ImmediateResizeObserver implements ResizeObserver {
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element): void {
    const width = target instanceof HTMLElement ? target.offsetWidth : 0
    const height = target instanceof HTMLElement ? target.offsetHeight : 0
    const size = [{ inlineSize: width, blockSize: height }]
    this.callback(
      [
        {
          target,
          contentRect: {
            width,
            height,
            top: 0,
            left: 0,
            bottom: height,
            right: width,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          },
          borderBoxSize: size,
          contentBoxSize: size,
          devicePixelContentBoxSize: size,
        },
      ],
      this,
    )
  }

  unobserve(): void {}
  disconnect(): void {}
}

vi.stubGlobal('ResizeObserver', ImmediateResizeObserver)

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
