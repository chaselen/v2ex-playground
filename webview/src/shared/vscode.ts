/**
 * VS Code Webview API
 */
export interface VsCodeApi {
  postMessage(message: unknown): void
}

declare const acquireVsCodeApi: () => VsCodeApi

let api: VsCodeApi | null = null

/**
 * 获取 VS Code Webview API 单例
 */
export function getVsCodeApi(): VsCodeApi {
  if (!api) {
    api = acquireVsCodeApi()
  }
  return api
}

/**
 * 向扩展侧发送消息
 * @param command 命令名
 * @param payload 附加参数
 */
export function postVsCodeMessage(command: string, payload: Record<string, unknown> = {}) {
  getVsCodeApi().postMessage({
    command,
    ...payload
  })
}
