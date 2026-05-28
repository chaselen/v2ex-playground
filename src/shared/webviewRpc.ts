/** Webview 请求响应命令 */
export const WEBVIEW_RESPONSE_COMMAND = '__response'

/**
 * Webview 发给扩展侧的请求消息
 */
export interface WebviewRequestMessage {
  /** 命令名 */
  command: string
  /** 请求 id */
  requestId?: string
  /** 附加参数 */
  [key: string]: unknown
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

/**
 * Webview RPC 命令定义
 */
export interface WebviewRpcDefinition<Payload extends object = object, Response = unknown> {
  /** 请求参数 */
  payload: Payload
  /** 响应数据 */
  response: Response
}

/**
 * 发往 Webview 的事件定义
 */
export interface WebviewEventDefinition<Payload extends object = object> {
  /** 事件参数 */
  payload: Payload
}

/** Webview RPC 命令名 */
export type WebviewRpcCommandKey<Commands> = Extract<keyof Commands, string>

/** Webview 事件名 */
export type WebviewEventKey<Events> = Extract<keyof Events, string>

/** Webview RPC 请求参数 */
export type WebviewRpcPayload<Commands, Command extends WebviewRpcCommandKey<Commands>> =
  Commands[Command] extends WebviewRpcDefinition<infer Payload, unknown> ? Payload : object

/** Webview RPC 响应数据 */
export type WebviewRpcResponse<Commands, Command extends WebviewRpcCommandKey<Commands>> =
  Commands[Command] extends WebviewRpcDefinition<object, infer Response> ? Response : unknown

/** Webview 事件参数 */
export type WebviewEventPayload<Events, Event extends WebviewEventKey<Events>> =
  Events[Event] extends WebviewEventDefinition<infer Payload> ? Payload : object

/** Webview RPC 请求消息 */
export type WebviewRpcRequestMessage<
  Commands,
  Command extends WebviewRpcCommandKey<Commands>
> = WebviewRequestMessage &
  WebviewRpcPayload<Commands, Command> & {
    /** 命令名 */
    command: Command
  }

/** Webview RPC 消息处理器 */
export type WebviewRpcHandler<Commands, Command extends WebviewRpcCommandKey<Commands>> = (
  message: WebviewRpcRequestMessage<Commands, Command>
) => Promise<unknown> | unknown
