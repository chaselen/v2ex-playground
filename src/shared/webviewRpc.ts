/** Webview 请求响应命令 */
export const WEBVIEW_RESPONSE_COMMAND = '__response'

/**
 * Webview 发给扩展侧的请求消息
 */
export interface WebviewRequestMessage {
  /** 命令名 */
  command: string
  /** 请求 id */
  requestId: string
  /** 请求参数 */
  args: unknown[]
}

/**
 * 扩展侧发给 Webview 的请求响应
 */
export interface WebviewResponseMessage<T = unknown> {
  /** 响应命令名 */
  command: typeof WEBVIEW_RESPONSE_COMMAND
  /** 请求 id */
  requestId: string
  /** 是否成功 */
  ok: boolean
  /** 响应数据 */
  data?: T
  /** 错误文案 */
  error?: string
}

/** Webview RPC 命令名 */
export type WebviewRpcCommandKey<Commands> = {
  [Command in keyof Commands]: Commands[Command] extends (...args: never[]) => unknown
    ? Command
    : never
}[keyof Commands] &
  string

/** Webview 事件名 */
export type WebviewEventKey<Events> = Extract<keyof Events, string>

/** Webview RPC 请求参数列表 */
export type WebviewRpcArgs<
  Commands,
  Command extends WebviewRpcCommandKey<Commands>
> = Commands[Command] extends (...args: infer Args) => unknown ? Args : never

/** Webview RPC 响应数据 */
export type WebviewRpcResponse<
  Commands,
  Command extends WebviewRpcCommandKey<Commands>
> = Commands[Command] extends (...args: never[]) => infer Response ? Awaited<Response> : never

/** Webview 事件参数 */
export type WebviewEventPayload<
  Events,
  Event extends WebviewEventKey<Events>
> = Events[Event] extends object ? Events[Event] : never

/** Webview RPC 消息处理器 */
export type WebviewRpcHandler<Commands, Command extends WebviewRpcCommandKey<Commands>> = (
  ...args: WebviewRpcArgs<Commands, Command>
) => Promise<WebviewRpcResponse<Commands, Command>> | WebviewRpcResponse<Commands, Command>

/** Webview RPC 消息处理器映射 */
export type WebviewRpcHandlers<Commands> = {
  [Command in WebviewRpcCommandKey<Commands>]: WebviewRpcHandler<Commands, Command>
}

/** Webview RPC 客户端 */
export type WebviewRpcClient<Commands> = {
  [Command in WebviewRpcCommandKey<Commands>]: (
    ...args: WebviewRpcArgs<Commands, Command>
  ) => Promise<WebviewRpcResponse<Commands, Command>>
}

/** Webview 事件处理器 */
export type WebviewEventHandler<Events, Event extends WebviewEventKey<Events>> = (
  payload: WebviewEventPayload<Events, Event>
) => void
