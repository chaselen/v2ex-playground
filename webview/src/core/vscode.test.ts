import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  postMessage: vi.fn()
}))

vi.stubGlobal('window', {
  addEventListener: mocks.addEventListener
})
vi.stubGlobal('acquireVsCodeApi', () => ({
  getState: vi.fn(),
  postMessage: mocks.postMessage,
  setState: vi.fn()
}))

import { createVsCodeClient } from './vscode'

interface TestRpcCommands {
  loadImages(imageSources: string[], options?: { format?: string }): void
}

describe('createVsCodeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  test('removes trailing undefined arguments before posting a request', () => {
    const vscode = createVsCodeClient<TestRpcCommands>()

    void vscode.loadImages(['https://example.com/image.png'], undefined)

    expect(mocks.postMessage).toHaveBeenCalledWith({
      command: 'loadImages',
      requestId: expect.any(String),
      args: [['https://example.com/image.png']]
    })
  })
})
