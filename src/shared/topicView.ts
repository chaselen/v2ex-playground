import type {
  BrowseSettingsWebviewEvents,
  WebviewCommonRpcCommands,
  WebviewStateRpcCommands
} from './commonView'
import type { ImageUploadInput } from './image'
import type {
  TopicInfo,
  MemberInfo,
  Node,
  TopicDetail,
  TopicContentAction,
  TopicContentState,
  TopicContentInput,
  TopicManagementAction,
  TopicManagementState,
  TopicSyntax,
  TopicReplyPostResult
} from '../v2ex/types'
export type { MemberInfo } from '../v2ex/types'

/** 话题操作目标 */
export interface TopicActionTarget {
  /** 话题 id */
  topicId: string | number
  /** 当前回复页 */
  replyPage?: number
}

/** 提交话题回复请求 */
export interface PostTopicReplyInput extends TopicActionTarget {
  /** 预览中的发表结果不改变主面板正在浏览的位置 */
  fromPreview?: boolean
  /** 回复正文 */
  content: string
  /** 点击回复按钮选定的官方父回复编号 */
  parentReplyId?: string
}

/** 发表已成功；随后刷新失败时仍返回结果，避免保留草稿造成重复提交 */
export interface PostTopicReplyResponse {
  posted: TopicReplyPostResult
  topic?: TopicDetail
  refreshError?: string
}

/** 感谢话题回复请求 */
export interface ThankTopicReplyInput extends TopicActionTarget {
  /** 回复 id */
  replyId: string
}

/** 话题内用户快速信息 */
export interface MemberQuickInfo extends MemberInfo {
  /** 当前登录用户是否为该用户 */
  isSelf: boolean
}

/** 话题内用户关系操作目标 */
export interface TopicMemberRelationTarget {
  /** 用户编号 */
  memberId: number
  /** 用户名 */
  username: string
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
  /** 是否可执行登录态操作 */
  canOperate?: boolean
  /** 当前话题已有本地总结 */
  hasCachedSummary?: boolean
}

/** 用户确认摘要请求前看到的模型来源和发送目标 */
export interface TopicSummaryTarget {
  protocol: 'openai' | 'anthropic'
  endpoint: string
  model: string
}

/** 生成摘要时实际纳入的回复范围，页数包括已检查的最后一页 */
export interface TopicSummaryCoverage {
  pages: number
  totalPages: number
  replies: number
  totalReplies: number
  truncated: boolean
}

/** 成功生成的总结及其来源信息 */
export interface TopicSummaryResult {
  text: string
  model: string
  coverage: TopicSummaryCoverage
  /** 生成完成的时间戳（毫秒），旧缓存可能没有此字段 */
  generatedAt?: number
}

export type TopicSummaryUpdate =
  | { status: 'waiting'; model: string; coverage: TopicSummaryCoverage }
  | { status: 'thinking' }
  | { status: 'chunk'; text: string }
  | { status: 'done'; result: TopicSummaryResult; saved: boolean }
  | { status: 'canceled' }
  | { status: 'error'; message: string }

/**
 * 话题面板 Webview RPC 命令
 */
export interface TopicPanelRpcCommands
  extends WebviewCommonRpcCommands, WebviewStateRpcCommands<TopicPanelViewState> {
  /** 加载源站话题信息 */
  getTopicInfo(topicId: number): TopicInfo
  /** 获取可移动到的节点列表 */
  getNodes(): Node[]
  /** 读取编辑、移动或附言的初始化数据 */
  prepareTopicContent(action: TopicContentAction): TopicContentState
  /** 提交内容操作并返回最新详情 */
  updateTopicContent(payload: TopicContentInput): TopicDetail
  /** 读取首页推广或下沉的确认说明 */
  prepareTopicManagement(action: TopicManagementAction): TopicManagementState
  /** 提交首页推广或下沉操作并返回最新详情 */
  manageTopic(action: TopicManagementAction, confirmation: string): TopicDetail
  /** 预览主题正文或附言 */
  previewTopicContent(content: string, syntax: TopicSyntax): string
  /** 打开标签主题面板 */
  openTag(tag: string): void
  login(): void
  refresh(): void
  getTopicSummaryTarget(): TopicSummaryTarget
  getCachedTopicSummary(): TopicSummaryResult | undefined
  openTopicSummarySettings(): void
  setTopicSummaryApiKey(): void
  startTopicSummary(requestId: string, target: TopicSummaryTarget): void
  cancelTopicSummary(requestId: string): void
  /** 保存话题分享图 */
  saveTopicShareImage(topicId: string | number, base64: string): void
  /** 加载分享图使用的本地资源 URI 或 data URL */
  loadTopicShareImages(
    loadId: string,
    imageSources: string[],
    format?: 'resourceUri' | 'dataUrl'
  ): Record<string, string>
  /** 取消指定分享图片批次，并等待后台请求结束 */
  cancelTopicShareImages(loadId: string): void
  /** 收藏话题并返回最新详情 */
  collectTopic(topicId: string | number, replyPage?: number): TopicDetail
  /** 取消收藏话题并返回最新详情 */
  cancelCollectTopic(topicId: string | number, replyPage?: number): TopicDetail
  /** 忽略话题并返回最新详情 */
  ignoreTopic(topicId: string | number, replyPage?: number): TopicDetail
  /** 取消忽略话题并返回最新详情 */
  cancelIgnoreTopic(topicId: string | number, replyPage?: number): TopicDetail
  /** 感谢话题创建者并返回最新详情 */
  thankTopic(topicId: string | number, replyPage?: number): TopicDetail
  /** 提交回复并返回最新详情 */
  postTopicReply(payload: PostTopicReplyInput): PostTopicReplyResponse
  /** 上传回复图片 */
  uploadImage(payload: ImageUploadInput): string
  /** 检测 Imgur 连通性 */
  checkImgurConnectivity(target: 'image' | 'upload', refresh?: boolean): boolean
  /** 预览回复内容 */
  previewReply(content: string): string
  /** 加载站内话题预览 */
  getTopicPreview(topicId: string | number, replyPage?: number): TopicDetail
  /** 感谢回复者并返回最新详情 */
  thankTopicReply(payload: ThankTopicReplyInput): TopicDetail
  /** 加载当前话题回复页并返回最新详情 */
  loadReplyPage(replyPage: number): TopicDetail | undefined
  /** 加载用户快速信息 */
  loadMemberQuickInfo(username: string): MemberQuickInfo
  /**
   * 屏蔽用户
   * @param memberId 用户编号
   * @param username 用户名
   */
  blockMember(memberId: number, username: string): void
  /**
   * 取消屏蔽用户
   * @param memberId 用户编号
   * @param username 用户名
   */
  unblockMember(memberId: number, username: string): void
}

/**
 * 话题面板发往 Webview 的事件
 */
export interface TopicPanelWebviewEvents extends BrowseSettingsWebviewEvents {
  topicSummaryUpdated: { requestId: string; update: TopicSummaryUpdate }
  topicSummarySettingsChanged: Record<string, never>
  topicStateChanged: {
    /** 页面状态 */
    state: TopicPanelViewState
  }
}
