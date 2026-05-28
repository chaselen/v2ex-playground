import vscode from 'vscode'
import {
  WEBVIEW_RESPONSE_COMMAND,
  WebviewEventKey,
  WebviewEventPayload,
  WebviewRpcCommandKey,
  WebviewRpcHandler,
  WebviewRpcPayload,
  WebviewRpcResponse,
  WebviewRequestMessage,
  WebviewResponseMessage
} from '@/shared/webview'

/** Webview RPC 兜底处理器 */
type AnyWebviewRpcHandler = (message: WebviewRequestMessage) => Promise<unknown> | unknown

/** 待响应请求 */
interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * 扩展侧 Webview RPC 桥接器
 */
export class WebviewRpcBridge<Commands = Record<string, never>, Events = Record<string, never>> {
  private requestSeq = 0
  private listener?: vscode.Disposable
  private readonly commandHandlers = new Map<string, AnyWebviewRpcHandler>()
  private readonly pendingRequests = new Map<string, PendingRequest>()

  /**
   * @param webview VS Code Webview
   * @param handler 兜底业务消息处理器
   */
  constructor(
    private readonly webview: vscode.Webview,
    private readonly handler?: AnyWebviewRpcHandler
  ) {}

  /**
   * 监听 Webview 消息
   */
  listen(): vscode.Disposable {
    this.listener?.dispose()
    this.listener = this.webview.onDidReceiveMessage((message: WebviewRequestMessage) => {
      this.handleMessage(message)
    })
    return this.listener
  }

  /**
   * 释放监听与待响应请求
   */
  dispose() {
    this.listener?.dispose()
    this.listener = undefined
    this.commandHandlers.clear()
    this.pendingRequests.forEach(pending => {
      clearTimeout(pending.timer)
      pending.reject(new Error('Webview RPC 已释放'))
    })
    this.pendingRequests.clear()
  }

  /**
   * 注册请求处理器
   * @param command 命令名
   * @param handler 业务消息处理器
   */
  handle<Command extends WebviewRpcCommandKey<Commands>>(
    command: Command,
    handler: WebviewRpcHandler<Commands, Command>
  ) {
    this.commandHandlers.set(command, handler as AnyWebviewRpcHandler)
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
   * 向 Webview 发送请求并等待响应
   * @param command 命令名
   * @param data 附加数据
   * @param timeoutMs 超时时间
   */
  request<Command extends WebviewRpcCommandKey<Commands>>(
    command: Command,
    data: WebviewRpcPayload<Commands, Command> = {} as WebviewRpcPayload<Commands, Command>,
    timeoutMs = 30000
  ): Promise<WebviewRpcResponse<Commands, Command>> {
    const requestId = `extension:${Date.now()}:${++this.requestSeq}`

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`请求 ${command} 超时`))
      }, timeoutMs)

      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer
      })

      this.rawPost(command, {
        requestId,
        ...data
      })
    })
  }

  /**
   * 处理 Webview 消息
   * @param message Webview 消息
   */
  private async handleMessage(message: WebviewRequestMessage) {
    if (this.isResponseMessage(message)) {
      this.handleResponse(message)
      return
    }

    const requestId = typeof message.requestId === 'string' ? message.requestId : undefined

    try {
      const data = await this.dispatchRequest(message)
      if (requestId) {
        this.postResponse(requestId, true, data)
      }
    } catch (err) {
      console.error(err)
      if (requestId) {
        this.postResponse(requestId, false, undefined, (err as Error).message)
      }
    }
  }

  /**
   * 分发请求消息
   * @param message Webview 消息
   */
  private dispatchRequest(message: WebviewRequestMessage) {
    const handler = this.commandHandlers.get(message.command) || this.handler
    if (!handler) {
      throw new Error(`未注册 Webview RPC 处理器: ${message.command}`)
    }
    return handler(message)
  }

  /**
   * 处理请求响应
   * @param message 响应消息
   */
  private handleResponse(message: WebviewResponseMessage) {
    const pending = this.pendingRequests.get(message.requestId)
    if (!pending) {
      return
    }

    this.pendingRequests.delete(message.requestId)
    clearTimeout(pending.timer)

    if (message.ok) {
      pending.resolve(message.data)
      return
    }

    pending.reject(new Error(message.error || '请求失败'))
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

  /**
   * 判断是否为请求响应消息
   * @param data 消息数据
   */
  private isResponseMessage(data: unknown): data is WebviewResponseMessage {
    return (
      typeof data === 'object' &&
      data !== null &&
      'command' in data &&
      data.command === WEBVIEW_RESPONSE_COMMAND &&
      'requestId' in data &&
      typeof data.requestId === 'string'
    )
  }
}
