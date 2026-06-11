import type { TopicDetail } from '../v2ex/types'
import type { WebviewContentRpcCommands } from './commonView'
/**
 * 发往 webview 的话题页面状态
 */
export interface TopicPanelViewState {
  /** 页面状态 */
  status: 'loading' | 'topic' | 'error'
  /** 话题详情 */
  topic?: TopicDetail
  /** 错误文案 */
  message?: string
  /** 是否显示登录按钮 */
  showLogin?: boolean
  /** 是否显示刷新按钮 */
  showRefresh?: boolean
  /** 查看帖子时是否显示图片 */
  showImages?: boolean
  /** 是否可执行登录态操作 */
  canOperate?: boolean
}

/**
 * 话题面板 Webview RPC 命令
 */
export interface TopicPanelRpcCommands extends WebviewContentRpcCommands {
  login(): void
  refresh(): void
  collect(): void
  cancelCollect(): void
  thank(): void
  postReply(payload: { content: string }): void
  thankReply(payload: { replyId: string }): void
  loadReplyPage(payload: { replyPage: number }): void
}

/**
 * 话题面板发往 Webview 的事件
 */
export interface TopicPanelWebviewEvents {
  topicStateChanged: {
    /** 页面状态 */
    state: TopicPanelViewState
  }
}
