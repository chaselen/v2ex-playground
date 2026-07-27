import type { WebviewApi } from 'vscode-webview'
import { WEBVIEW_RESPONSE_COMMAND } from '@extension/shared/webview'
import type {
  WebviewEventHandler,
  WebviewEventKey,
  WebviewResponseMessage,
  WebviewRpcClient
} from '@extension/shared/webview'

/** Webview 持久化状态 */
export type VsCodeState = Record<string, unknown>

/** 待响应请求 */
interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
  timer: ReturnType<typeof setTimeout>
}

let api: WebviewApi<VsCodeState> | null = null
let requestSeq = 0
let messageListenerReady = false
const pendingRequests = new Map<string, PendingRequest>()
const eventHandlers = new Map<string, Set<(payload: object) => void>>()

/** 默认 RPC 超时时间 */
const defaultRequestTimeout = 30000

/** 图片上传 RPC 超时时间 */
const uploadImageRequestTimeout = 60000

/**
 * 获取 VS Code Webview API 单例
 */
export function getVsCodeApi(): WebviewApi<VsCodeState> {
  if (!api) {
    api = acquireVsCodeApi<VsCodeState>()
  }
  return api
}

/**
 * 将链接解析为基于当前页面的绝对地址
 * @param path 链接地址
 */
export function resolveWebviewUrl(path: string): string {
  return new URL(path, document.baseURI).toString()
}

/** 带扩展侧事件订阅能力的 Webview RPC 客户端 */
export type VsCodeClient<Commands, Events> = WebviewRpcClient<Commands> & {
  on<Event extends WebviewEventKey<Events>>(
    event: Event,
    handler: WebviewEventHandler<Events, Event>
  ): () => void
}

/**
 * 创建指定页面契约的 VS Code 通信客户端
 */
export function createVsCodeClient<Commands, Events = Record<string, never>>(): VsCodeClient<
  Commands,
  Events
> {
  ensureMessageListener()

  return new Proxy(
    {},
    {
      get: (_, command: string | symbol) => {
        if (command === 'on') {
          return subscribe
        }
        if (command === 'then' || typeof command === 'symbol') {
          return undefined
        }
        return (...args: unknown[]) => request(command, trimTrailingUndefined(args))
      }
    }
  ) as VsCodeClient<Commands, Events>
}

/**
 * 移除末尾未传的可选参数
 * @param args 请求参数
 */
function trimTrailingUndefined(args: unknown[]) {
  let length = args.length
  while (length > 0 && args[length - 1] === undefined) {
    length -= 1
  }
  return length === args.length ? args : args.slice(0, length)
}

/**
 * 订阅 Webview 状态并主动读取初始化状态
 * @param subscribeState 订阅状态事件
 * @param getState 读取当前状态
 * @param onState 应用状态
 * @param onError 初始化失败处理器
 */
export function subscribeWebviewState<State>(
  subscribeState: (handler: (state: State) => void) => () => void,
  getState: () => Promise<State>,
  onState: (state: State) => void,
  onError: (error: unknown) => void = error => console.error(error)
): () => void {
  let disposed = false
  let receivedStateEvent = false
  const dispose = subscribeState(state => {
    if (disposed) {
      return
    }
    receivedStateEvent = true
    onState(state)
  })

  // 先订阅再读取，且不允许初始化响应覆盖更新的状态事件
  getState()
    .then(state => {
      if (!disposed && !receivedStateEvent) {
        onState(state)
      }
    })
    .catch(error => {
      if (!disposed) {
        onError(error)
      }
    })

  return () => {
    disposed = true
    dispose()
  }
}

/**
 * 向扩展侧发送请求并等待响应
 * @param command 命令名
 * @param args 请求参数
 */
function request(command: string, args: unknown[]): Promise<unknown> {
  const requestId = `webview:${Date.now()}:${++requestSeq}`

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(new Error(`请求 ${command} 超时`))
    }, getRequestTimeout(command))

    pendingRequests.set(requestId, { resolve, reject, timer })
    getVsCodeApi().postMessage({ command, requestId, args })
  })
}

/**
 * 获取 RPC 超时时间
 * @param command 命令名
 */
function getRequestTimeout(command: string) {
  return command === 'uploadImage' ? uploadImageRequestTimeout : defaultRequestTimeout
}

/**
 * 订阅扩展侧事件
 * @param event 事件名
 * @param handler 事件处理器
 */
function subscribe(event: string, handler: (payload: object) => void): () => void {
  const handlers = eventHandlers.get(event) || new Set()
  handlers.add(handler)
  eventHandlers.set(event, handlers)

  return () => {
    handlers.delete(handler)
    if (!handlers.size) {
      eventHandlers.delete(event)
    }
  }
}

/**
 * 确保消息监听已注册
 */
function ensureMessageListener() {
  if (messageListenerReady) {
    return
  }
  window.addEventListener('message', event => handleMessage(event.data))
  messageListenerReady = true
}

/**
 * 处理扩展侧消息
 * @param message 消息数据
 */
function handleMessage(message: unknown) {
  if (isResponseMessage(message)) {
    const pending = pendingRequests.get(message.requestId)
    if (!pending) {
      return
    }

    pendingRequests.delete(message.requestId)
    clearTimeout(pending.timer)
    if (message.ok) {
      pending.resolve(message.data)
    } else {
      pending.reject(new Error(message.error || '请求失败'))
    }
    return
  }

  if (isEventMessage(message)) {
    eventHandlers.get(message.command)?.forEach(handler => handler(message))
  }
}

/**
 * 判断是否为扩展侧事件
 * @param data 消息数据
 */
function isEventMessage(data: unknown): data is { command: string } & object {
  return (
    typeof data === 'object' &&
    data !== null &&
    'command' in data &&
    typeof data.command === 'string' &&
    data.command !== WEBVIEW_RESPONSE_COMMAND
  )
}

/**
 * 判断是否为请求响应消息
 * @param data 消息数据
 */
function isResponseMessage(data: unknown): data is WebviewResponseMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'command' in data &&
    data.command === WEBVIEW_RESPONSE_COMMAND &&
    'requestId' in data &&
    typeof data.requestId === 'string'
  )
}
