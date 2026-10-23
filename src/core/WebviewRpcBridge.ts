import vscode from 'vscode'
import { logger } from '@/core/logger'
import { getSyntaxTheme, watchSyntaxTheme } from 'vscode-tint/vscode'
import {
  WEBVIEW_RESPONSE_COMMAND,
  WEBVIEW_RPC_METHOD_PREFIX,
  WebviewEventKey,
  WebviewEventPayload,
  WebviewRpcController,
  WebviewRequestMessage
} from '@/shared/webview'

/** Webview RPC 兜底处理器 */
type AnyWebviewRpcHandler = (...args: unknown[]) => Promise<unknown> | unknown

/**
 * 扩展侧 Webview RPC 桥接器
 */
export class WebviewRpcBridge<Commands = Record<string, never>, Events = Record<string, never>> {
  private readonly listener: vscode.Disposable
  private syntaxThemeListener?: vscode.Disposable
  private syntaxThemeRevision = 0
  private disposed = false

  /**
   * @param webview VS Code Webview
   * @param controller RPC 控制器
   */
  constructor(
    private readonly webview: vscode.Webview,
    private readonly controller: WebviewRpcController<Commands>
  ) {
    this.listener = webview.onDidReceiveMessage((message: WebviewRequestMessage) => {
      this.handleMessage(message)
    })
  }

  /**
   * 释放消息监听
   */
  dispose() {
    this.disposed = true
    this.syntaxThemeListener?.dispose()
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
    void this.webview.postMessage({ command, ...data })
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
      logger.error('Webview RPC 调用失败', err, {
        command: message.command
      })
      this.postResponse(message.requestId, false, undefined, (err as Error).message)
    }
  }

  /**
   * 分发请求消息
   * @param message Webview 消息
   */
  private dispatchRequest(message: WebviewRequestMessage) {
    const methodName = `${WEBVIEW_RPC_METHOD_PREFIX}${message.command}`
    const handler = (this.controller as unknown as Record<string, AnyWebviewRpcHandler>)[methodName]
    if (typeof handler !== 'function') {
      throw new Error(`未注册 Webview RPC 处理器: ${message.command}`)
    }
    if (message.command === 'getSyntaxTheme' && !this.syntaxThemeListener && !this.disposed) {
      this.syntaxThemeListener = watchSyntaxTheme(() => {
        const revision = ++this.syntaxThemeRevision
        void getSyntaxTheme()
          .then(theme => {
            if (!this.disposed && revision === this.syntaxThemeRevision) {
              this.rawPost('syntaxThemeChanged', { theme })
            }
          })
          .catch(error => logger.warn('更新代码高亮主题失败', error))
      })
    }
    return handler.apply(this.controller, message.args)
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
