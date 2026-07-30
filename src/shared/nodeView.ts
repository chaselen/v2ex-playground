import type { Node, Topic } from '../v2ex/types'
import type { WebviewCommonRpcCommands, WebviewStateRpcCommands } from './commonView'

/** 节点主题面板数据 */
export interface NodePanelTopicList {
  /** 节点信息 */
  node: Node
  /** 当前页码 */
  page: number
  /** 总页数 */
  totalPage: number
  /** 主题总数 */
  totalCount: number
  /** 主题列表 */
  list: Topic[]
}

/** 节点主题面板状态 */
export interface NodePanelViewState {
  /** 页面状态 */
  status: 'loading' | 'result' | 'error'
  /** 是否已登录；用于控制收藏等写操作入口 */
  loggedIn: boolean
  /** 节点主题列表 */
  data?: NodePanelTopicList
  /** 错误文案 */
  message?: string
}

/** 节点主题面板 Webview RPC 命令 */
export interface NodePanelRpcCommands
  extends WebviewCommonRpcCommands, WebviewStateRpcCommands<NodePanelViewState> {
  /** 刷新当前页主题列表 */
  refresh(): void
  /** 加载指定页主题列表 */
  loadPage(page: number): void
  /** 收藏当前节点并刷新页面状态 */
  collectNode(): void
  /** 取消收藏当前节点并刷新页面状态 */
  cancelCollectNode(): void
}

/** 节点主题面板发往 Webview 的事件 */
export interface NodePanelWebviewEvents {
  nodeStateChanged: {
    /** 最新页面状态 */
    state: NodePanelViewState
  }
}
