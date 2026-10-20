/**
 * Webview 公共 RPC 命令
 */
export interface WebviewCommonRpcCommands {
  /** 按 URL 打开插件页面或浏览器，title 用于面板标题 */
  openExternal(path: string, title?: string): void
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
