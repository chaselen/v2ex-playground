import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  postMessage: vi.fn(),
  messageListener: undefined as ((event: { data: unknown }) => void) | undefined
}))

vi.stubGlobal('window', {
  addEventListener: (name: string, listener: (event: { data: unknown }) => void) => {
    mocks.addEventListener(name, listener)
    mocks.messageListener = listener
  }
})
vi.stubGlobal('acquireVsCodeApi', () => ({
  getState: vi.fn(),
  postMessage: mocks.postMessage,
  setState: vi.fn()
}))

import { createVsCodeClient } from './vscode'

interface TestRpcCommands {
  postTopicReply(): { replyId: string }
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

  test('a confirmed publication plus slow refresh can complete after the ordinary RPC deadline', async () => {
    mocks.postMessage.mockImplementationOnce((message: { requestId: string }) => {
      setTimeout(
        () =>
          mocks.messageListener?.({
            data: {
              command: '__response',
              requestId: message.requestId,
              ok: true,
              data: { replyId: '123' }
            }
          }),
        45000
      )
    })
    const vscode = createVsCodeClient<TestRpcCommands>()
    let settled = false
    const request = vscode.postTopicReply().then(result => {
      settled = true
      return result
    })
    await vi.advanceTimersByTimeAsync(30001)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(14999)
    await expect(request).resolves.toEqual({ replyId: '123' })
  })

  test('a lost reply request still has a bounded deadline', async () => {
    const vscode = createVsCodeClient<TestRpcCommands>()
    const outcome = vscode.postTopicReply().then(
      () => '',
      (error: Error) => error.message
    )
    await vi.advanceTimersByTimeAsync(60000)
    expect(await outcome).toBe('请求 postTopicReply 超时')
  })

  test('ordinary read requests retain their existing 30 second deadline', async () => {
    const vscode = createVsCodeClient<TestRpcCommands>()
    const outcome = vscode.loadImages([]).then(
      () => '',
      (error: Error) => error.message
    )
    await vi.advanceTimersByTimeAsync(30000)
    expect(await outcome).toBe('请求 loadImages 超时')
  })
})
