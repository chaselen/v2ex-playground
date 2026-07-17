import type { TagTopicList } from '../v2ex/types'
import type { WebviewCommonRpcCommands, WebviewStateRpcCommands } from './commonView'

/** 标签主题面板状态 */
export interface TagPanelViewState {
  /** 页面状态 */
  status: 'loading' | 'result' | 'error'
  /** 标签主题列表 */
  data?: TagTopicList
  /** 错误文案 */
  message?: string
}

/** 标签主题面板 Webview RPC 命令 */
export interface TagPanelRpcCommands
  extends WebviewCommonRpcCommands, WebviewStateRpcCommands<TagPanelViewState> {
  /** 刷新标签主题列表 */
  refresh(): void
}

/** 标签主题面板发往 Webview 的事件 */
export interface TagPanelWebviewEvents {
  tagStateChanged: {
    /** 最新页面状态 */
    state: TagPanelViewState
  }
}
