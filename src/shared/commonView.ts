/**
 * Webview 公共导航 RPC 命令
 */
export interface WebviewNavigationRpcCommands {
  openExternal(payload: { path: string }): void
  openTopic(payload: { topicId: string | number; title?: string }): void
  openMember(payload: { username: string }): void
  openNode(payload: { name: string; title?: string }): void
}

/**
 * Webview 内容增强 RPC 命令
 */
export interface WebviewContentRpcCommands extends WebviewNavigationRpcCommands {
  browseImage(payload: { src: string }): void
}
