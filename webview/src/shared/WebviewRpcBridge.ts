import type { WebviewApi } from 'vscode-webview'
import { WEBVIEW_RESPONSE_COMMAND } from '../../../src/shared/webview'
import type {
  WebviewRequestMessage,
  WebviewResponseMessage,
  WebviewRpcCommandKey,
  WebviewRpcHandler,
  WebviewRpcPayload,
  WebviewRpcResponse
} from '../../../src/shared/webview'

/** Webview 持久化状态 */
export type VsCodeState = Record<string, unknown>

/** Webview RPC 兜底处理器 */
type AnyWebviewRpcHandler = (message: WebviewRequestMessage) => Promise<unknown> | unknown

/** 待响应请求 */
interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Webview 侧 RPC 桥接器
 */
export class WebviewRpcBridge<Commands = Record<string, never>> {
  private requestSeq = 0
  private messageListenerReady = false
  private readonly messageListener = (event: MessageEvent) => {
    this.handleMessage(event.data)
  }
  private readonly commandHandlers = new Map<string, AnyWebviewRpcHandler>()
  private readonly pendingRequests = new Map<string, PendingRequest>()

  /**
   * @param api VS Code Webview API
   */
  constructor(private readonly api: WebviewApi<VsCodeState>) {
    this.ensureMessageListener()
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
   * 释放监听与待响应请求
   */
  dispose() {
    if (this.messageListenerReady) {
      window.removeEventListener('message', this.messageListener)
      this.messageListenerReady = false
    }

    this.commandHandlers.clear()
    this.pendingRequests.forEach(pending => {
      clearTimeout(pending.timer)
      pending.reject(new Error('Webview RPC 已释放'))
    })
    this.pendingRequests.clear()
  }

  /**
   * 向扩展侧发送消息
   * @param command 命令名
   * @param payload 附加参数
   */
  post(command: string, payload: object = {}) {
    this.api.postMessage({
      command,
      ...payload
    })
  }

  /**
   * 向扩展侧发送请求并等待响应
   * @param command 命令名
   * @param payload 附加参数
   * @param timeoutMs 超时时间
   */
  request<Command extends WebviewRpcCommandKey<Commands>>(
    command: Command,
    payload: WebviewRpcPayload<Commands, Command> = {} as WebviewRpcPayload<Commands, Command>,
    timeoutMs = 30000
  ): Promise<WebviewRpcResponse<Commands, Command>> {
    this.ensureMessageListener()

    const requestId = `webview:${Date.now()}:${++this.requestSeq}`

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

      this.api.postMessage({
        command,
        requestId,
        ...payload
      })
    })
  }

  /**
   * 确保消息监听已注册
   */
  private ensureMessageListener() {
    if (this.messageListenerReady) {
      return
    }

    window.addEventListener('message', this.messageListener)

    this.messageListenerReady = true
  }

  /**
   * 处理扩展侧消息
   * @param message 消息数据
   */
  private async handleMessage(message: unknown) {
    if (this.isResponseMessage(message)) {
      this.handleResponse(message)
      return
    }

    if (!this.isRequestMessage(message) || typeof message.requestId !== 'string') {
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
    const handler = this.commandHandlers.get(message.command)
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
    this.post(WEBVIEW_RESPONSE_COMMAND, {
      requestId,
      ok,
      data,
      error
    })
  }

  /**
   * 判断是否为请求消息
   * @param data 消息数据
   */
  private isRequestMessage(data: unknown): data is WebviewRequestMessage {
    return (
      typeof data === 'object' &&
      data !== null &&
      'command' in data &&
      typeof data.command === 'string'
    )
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
