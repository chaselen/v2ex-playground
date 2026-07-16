import { describe, expect, test, vi } from 'vitest'
import type vscode from 'vscode'
import { WebviewRpcBridge } from './WebviewRpcBridge'
import type { WebviewRpcController, WebviewRequestMessage } from '@/shared/webview'

vi.mock('@/core/logger', () => ({
  logger: {
    error: vi.fn()
  }
}))

interface TestRpcCommands {
  increment(payload: { amount: number }): number
}

class TestRpcController implements WebviewRpcController<TestRpcCommands> {
  private value = 1

  rpc_increment(payload: { amount: number }) {
    this.value += payload.amount
    return this.value
  }

  dispose() {
    throw new Error('不应暴露非 RPC 方法')
  }
}

/** 创建可主动发送消息的 Webview 测试替身 */
function createWebview() {
  let receiveMessage: (message: WebviewRequestMessage) => void = () => undefined
  const disposable = { dispose: vi.fn() }
  const postMessage = vi.fn().mockResolvedValue(true)
  const webview = {
    onDidReceiveMessage: vi.fn(listener => {
      receiveMessage = listener
      return disposable
    }),
    postMessage
  } as unknown as vscode.Webview

  return {
    webview,
    postMessage,
    disposable,
    receive(message: WebviewRequestMessage) {
      receiveMessage(message)
    }
  }
}

describe('WebviewRpcBridge', () => {
  test('dispatches to prefixed controller methods with the controller context', async () => {
    const target = createWebview()
    new WebviewRpcBridge<TestRpcCommands>(target.webview, new TestRpcController())

    target.receive({ command: 'increment', requestId: 'request:1', args: [{ amount: 2 }] })

    await vi.waitFor(() =>
      expect(target.postMessage).toHaveBeenCalledWith({
        command: '__response',
        requestId: 'request:1',
        ok: true,
        data: 3,
        error: undefined
      })
    )
  })

  test('does not expose controller methods without the RPC prefix', async () => {
    const target = createWebview()
    new WebviewRpcBridge<TestRpcCommands>(target.webview, new TestRpcController())

    target.receive({ command: 'dispose', requestId: 'request:2', args: [] })

    await vi.waitFor(() =>
      expect(target.postMessage).toHaveBeenCalledWith({
        command: '__response',
        requestId: 'request:2',
        ok: false,
        data: undefined,
        error: '未注册 Webview RPC 处理器: dispose'
      })
    )
  })

  test('disposes the Webview message listener', () => {
    const target = createWebview()
    const bridge = new WebviewRpcBridge<TestRpcCommands>(target.webview, new TestRpcController())

    bridge.dispose()

    expect(target.disposable.dispose).toHaveBeenCalledOnce()
  })
})
