import { composeWebviewRpcControllers } from './composeWebviewRpcControllers'
import { describe, expect, test, vi } from 'vitest'
import type vscode from 'vscode'
import { WebviewRpcBridge } from './WebviewRpcBridge'
import { getSyntaxTheme, watchSyntaxTheme } from 'vscode-tint/vscode'
import type { SyntaxTheme } from 'vscode-tint'
import type { WebviewRpcController, WebviewRequestMessage } from '@/shared/webview'

vi.mock('vscode-tint/vscode', () => ({
  getSyntaxTheme: vi.fn(),
  watchSyntaxTheme: vi.fn(() => ({ dispose: vi.fn() }))
}))

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

  test('语法主题按需订阅，丢弃乱序更新，销毁后不推送', async () => {
    let changed = () => {}
    const stopWatching = vi.fn()
    vi.mocked(watchSyntaxTheme).mockImplementation(listener => {
      changed = listener
      return { dispose: stopWatching }
    })
    const pending: ((theme: SyntaxTheme) => void)[] = []
    vi.mocked(getSyntaxTheme).mockImplementation(
      () => new Promise(resolve => pending.push(resolve))
    )
    const target = createWebview()
    const bridge = new WebviewRpcBridge(target.webview, {
      rpc_getSyntaxTheme: () => ({})
    })
    expect(watchSyntaxTheme).not.toHaveBeenCalled()
    target.receive({ command: 'getSyntaxTheme', requestId: 'theme:1', args: [] })
    target.receive({ command: 'getSyntaxTheme', requestId: 'theme:2', args: [] })
    expect(watchSyntaxTheme).toHaveBeenCalledOnce()
    changed()
    changed()
    pending[1]({ settings: [{ scope: 'string', settings: { foreground: '#222222' } }] })
    await vi.waitFor(() =>
      expect(target.postMessage).toHaveBeenCalledWith({
        command: 'syntaxThemeChanged',
        theme: { settings: [{ scope: 'string', settings: { foreground: '#222222' } }] }
      })
    )
    pending[0]({ settings: [{ scope: 'string', settings: { foreground: '#111111' } }] })
    await Promise.resolve()
    expect(target.postMessage).not.toHaveBeenCalledWith({
      command: 'syntaxThemeChanged',
      theme: { settings: [{ scope: 'string', settings: { foreground: '#111111' } }] }
    })
    changed()
    bridge.dispose()
    pending[2]({ settings: [{ scope: 'string', settings: { foreground: '#333333' } }] })
    await Promise.resolve()
    expect(stopWatching).toHaveBeenCalledOnce()
    expect(target.postMessage).not.toHaveBeenCalledWith({
      command: 'syntaxThemeChanged',
      theme: { settings: [{ scope: 'string', settings: { foreground: '#333333' } }] }
    })
  })
})

describe('composed Webview RPC controllers', () => {
  test('routes page and common commands with each handler’s original this', async () => {
    const target = createWebview()
    class CommonRpc {
      private value = 'common'
      rpc_getLabel = () => this.value
      dispose() {
        throw new Error('不应注册生命周期方法')
      }
    }
    const handlers = composeWebviewRpcControllers(new TestRpcController(), new CommonRpc())
    new WebviewRpcBridge<TestRpcCommands & { getLabel(): string }>(target.webview, handlers)
    expect(handlers).not.toHaveProperty('dispose')
    target.receive({ command: 'increment', requestId: 'page', args: [{ amount: 3 }] })
    target.receive({ command: 'getLabel', requestId: 'common', args: [] })
    await vi.waitFor(() => {
      expect(target.postMessage).toHaveBeenCalledWith({
        command: '__response',
        requestId: 'page',
        ok: true,
        data: 4,
        error: undefined
      })
      expect(target.postMessage).toHaveBeenCalledWith({
        command: '__response',
        requestId: 'common',
        ok: true,
        data: 'common',
        error: undefined
      })
    })
  })

  test('rejects duplicate commands instead of silently overriding one handler', () => {
    expect(() =>
      composeWebviewRpcControllers(new TestRpcController(), new TestRpcController())
    ).toThrow('重复的 Webview RPC 处理器: increment')
  })

  test('keeps an override within one handler and does not evaluate RPC getters', () => {
    class Parent {
      rpc_value() {
        return 1
      }
    }
    class Child extends Parent {
      rpc_value() {
        return 2
      }
      get rpc_invalid(): number {
        throw new Error('组合时不应执行 getter')
      }
    }
    const handlers = composeWebviewRpcControllers(new Child())
    expect(handlers.rpc_value()).toBe(2)
    expect(handlers).not.toHaveProperty('rpc_invalid')
  })
})
