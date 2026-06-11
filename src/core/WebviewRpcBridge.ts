import vscode from 'vscode'
import {
  WEBVIEW_RESPONSE_COMMAND,
  WebviewEventKey,
  WebviewEventPayload,
  WebviewRpcHandlers,
  WebviewRequestMessage
} from '@/shared/webview'

/** Webview RPC 兜底处理器 */
type AnyWebviewRpcHandler = (...args: unknown[]) => Promise<unknown> | unknown

/**
 * 扩展侧 Webview RPC 桥接器
 */
export class WebviewRpcBridge<Commands = Record<string, never>, Events = Record<string, never>> {
  private readonly listener: vscode.Disposable

  /**
   * @param webview VS Code Webview
   * @param handlers RPC 处理器映射
   */
  constructor(
    private readonly webview: vscode.Webview,
    private readonly handlers: WebviewRpcHandlers<Commands>
  ) {
    this.listener = webview.onDidReceiveMessage((message: WebviewRequestMessage) => {
      this.handleMessage(message)
    })
  }

  /**
   * 释放消息监听
   */
  dispose() {
    this.listener.dispose()
  }

  /**
   * 向 Webview 发送消息
   * @param command 命令名
   * @param data 附加数据
   */
  post<Event extends WebviewEventKey<Events>>(
    command: Event,
    data: WebviewEventPayload<Events, Event> = {} as WebviewEventPayload<Events, Event>
  ) {
    this.rawPost(command, data)
  }

  /**
   * 向 Webview 发送原始消息
   * @param command 命令名
   * @param data 附加数据
   */
  private rawPost(command: string, data?: object) {
    try {
      this.webview.postMessage({ command, ...data })
    } catch (err) {
      console.log(err)
    }
  }

  /**
   * 处理 Webview 消息
   * @param message Webview 消息
   */
  private async handleMessage(message: WebviewRequestMessage) {
    if (
      typeof message?.command !== 'string' ||
      typeof message.requestId !== 'string' ||
      !Array.isArray(message.args)
    ) {
      return
    }

    try {
      const data = await this.dispatchRequest(message)
      this.postResponse(message.requestId, true, data)
    } catch (err) {
      console.error(err)
      this.postResponse(message.requestId, false, undefined, (err as Error).message)
    }
  }

  /**
   * 分发请求消息
   * @param message Webview 消息
   */
  private dispatchRequest(message: WebviewRequestMessage) {
    const handler = (this.handlers as unknown as Record<string, AnyWebviewRpcHandler>)[
      message.command
    ]
    if (!handler) {
      throw new Error(`未注册 Webview RPC 处理器: ${message.command}`)
    }
    return handler(...message.args)
  }

  /**
   * 发送请求响应
   * @param requestId 请求 id
   * @param ok 是否成功
   * @param data 响应数据
   * @param error 错误文案
   */
  private postResponse(requestId: string, ok: boolean, data?: unknown, error?: string) {
    this.rawPost(WEBVIEW_RESPONSE_COMMAND, {
      requestId,
      ok,
      data,
      error
    })
  }
}
