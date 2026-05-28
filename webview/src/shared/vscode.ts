import type { WebviewApi } from 'vscode-webview'
import { WebviewRpcBridge, type VsCodeState } from './WebviewRpcBridge'
import type {
  WebviewRequestRpcCommands,
  WebviewRpcCommandKey,
  WebviewRpcHandler,
  WebviewRpcPayload,
  WebviewRpcResponse
} from '../../../src/shared/webview'

let api: WebviewApi<VsCodeState> | null = null
let bridge: WebviewRpcBridge<WebviewRequestRpcCommands> | null = null

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
 * 获取 Webview RPC 桥接器单例
 */
export function getWebviewRpcBridge(): WebviewRpcBridge<WebviewRequestRpcCommands> {
  if (!bridge) {
    bridge = new WebviewRpcBridge(getVsCodeApi())
  }
  return bridge
}

/**
 * 向扩展侧发送消息
 * @param command 命令名
 * @param payload 附加参数
 */
export function postVsCodeMessage(command: string, payload: object = {}) {
  getWebviewRpcBridge().post(command, payload)
}

/**
 * 向扩展侧发送请求并等待响应
 * @param command 命令名
 * @param payload 附加参数
 * @param timeoutMs 超时时间
 */
export function requestVsCodeMessage<
  Command extends WebviewRpcCommandKey<WebviewRequestRpcCommands>
>(
  command: Command,
  payload: WebviewRpcPayload<WebviewRequestRpcCommands, Command> = {} as WebviewRpcPayload<
    WebviewRequestRpcCommands,
    Command
  >,
  timeoutMs = 30000
): Promise<WebviewRpcResponse<WebviewRequestRpcCommands, Command>> {
  return getWebviewRpcBridge().request(command, payload, timeoutMs)
}

/**
 * 处理扩展侧请求
 * @param command 命令名
 * @param handler 请求处理器
 */
export function handleVsCodeMessage<
  Command extends WebviewRpcCommandKey<WebviewRequestRpcCommands>
>(command: Command, handler: WebviewRpcHandler<WebviewRequestRpcCommands, Command>) {
  getWebviewRpcBridge().handle(command, handler)
}
