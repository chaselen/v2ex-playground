import type { TopicDetail } from '../v2ex/types'
import type { MainViewRpcCommands } from './mainView'
import type { MemberPanelRpcCommands } from './memberView'
import type { WebviewEventDefinition, WebviewRpcDefinition } from './webviewRpc'

/**
 * Webview 发给扩展侧的话题命令消息
 */
export interface TopicPanelMessage {
  /** 命令名 */
  command: string
  /** 图片地址 */
  src?: string
  /** 话题 id */
  topicId?: string | number
  /** 回复内容 */
  content?: string
  /** 回复 id */
  replyId?: string
  /** 回复页码 */
  replyPage?: number
}

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
export interface TopicPanelRpcCommands {
  browseImage: WebviewRpcDefinition<{ src: string }, void>
  openExternal: WebviewRpcDefinition<{ src: string }, void>
  openTopic: WebviewRpcDefinition<{ topicId: string | number }, void>
  openMember: WebviewRpcDefinition<{ username: string }, void>
  login: WebviewRpcDefinition<object, void>
  refresh: WebviewRpcDefinition<object, void>
  collect: WebviewRpcDefinition<object, void>
  cancelCollect: WebviewRpcDefinition<object, void>
  thank: WebviewRpcDefinition<object, void>
  postReply: WebviewRpcDefinition<{ content: string }, void>
  thankReply: WebviewRpcDefinition<{ replyId: string }, void>
  loadReplyPage: WebviewRpcDefinition<{ replyPage: number }, void>
}

/**
 * 话题面板发往 Webview 的事件
 */
export interface TopicPanelWebviewEvents {
  renderState: WebviewEventDefinition<{
    /** 页面状态 */
    state: TopicPanelViewState
  }>
}

/**
 * Webview 侧会等待响应的 RPC 命令
 */
export type WebviewRequestRpcCommands = Pick<
  MainViewRpcCommands,
  | 'ready'
  | 'expandNode'
  | 'refreshNode'
  | 'getMyTopics'
  | 'getMyNotifications'
  | 'getDailySignInStatus'
  | 'dailySignIn'
  | 'addNode'
  | 'removeNode'
> &
  Pick<
    TopicPanelRpcCommands,
    'collect' | 'cancelCollect' | 'thank' | 'postReply' | 'thankReply' | 'loadReplyPage'
  > &
  Pick<MemberPanelRpcCommands, 'loadMemberTab' | 'loadMemberPage'>
