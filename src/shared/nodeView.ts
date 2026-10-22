import type {
  BrowseSettingsWebviewEvents,
  WebviewCommonRpcCommands,
  WebviewStateRpcCommands
} from './commonView'
import type { NodeTopicList } from '../v2ex/types'

/** 节点主题面板数据 */
export interface NodePanelTopicList extends NodeTopicList {
  /** 当前页码 */
  page: number
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
  /** 打开创作新主题面板并预选当前节点 */
  createTopic(): void
  /** 将当前节点的订阅地址写入宿主剪贴板 */
  copySubscription(format: 'xml' | 'json'): void
  /** 刷新当前页主题列表 */
  refresh(): void
  /** 加载指定页主题列表 */
  loadPage(page: number): void
  /** 收藏当前节点并刷新页面状态 */
  collectNode(): void
  /** 忽略当前节点并刷新页面状态 */
  ignoreNode(): NodePanelViewState
  /** 取消忽略当前节点并刷新页面状态 */
  cancelIgnoreNode(): NodePanelViewState
  /** 取消收藏当前节点并刷新页面状态 */
  cancelCollectNode(): void
}

/** 节点主题面板发往 Webview 的事件 */
export interface NodePanelWebviewEvents extends BrowseSettingsWebviewEvents {
  nodeStateChanged: {
    /** 最新页面状态 */
    state: NodePanelViewState
  }
}
