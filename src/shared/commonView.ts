/**
 * Webview 公共导航 RPC 命令
 */
export interface WebviewNavigationRpcCommands {
  openExternal(path: string): void
  openTopic(payload: { topicId: string | number; title?: string }): void
  openMember(username: string): void
  openNode(payload: { name: string; title?: string }): void
}

/**
 * 有状态 Webview 的初始化 RPC 命令
 */
export interface WebviewStateRpcCommands<State> {
  /** 获取当前视图状态 */
  ready(): State
}
