/**
 * Webview 公共 RPC 命令
 */
export interface WebviewCommonRpcCommands {
  openExternal(path: string): void
  openTopic(topicId: string | number, title?: string): void
  openMember(username: string): void
  openNode(name: string, title?: string): void
  /** 下载远程图片 */
  downloadImage(imageSrc: string): void
}

/**
 * 有状态 Webview 的初始化 RPC 命令
 */
export interface WebviewStateRpcCommands<State> {
  /** 获取当前视图状态 */
  ready(): State
}
