/** 打开话题面板参数 */
export interface OpenTopicPayload {
  /** 话题 id */
  topicId: string | number
  /** 话题标题 */
  title?: string
}

/** 打开节点主题面板参数 */
export interface OpenNodePayload {
  /** 节点 name */
  name: string
  /** 节点展示标题 */
  title?: string
}

/**
 * Webview 公共 RPC 命令
 */
export interface WebviewCommonRpcCommands {
  openExternal(path: string): void
  openTopic(payload: OpenTopicPayload): void
  openMember(username: string): void
  openNode(payload: OpenNodePayload): void
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
