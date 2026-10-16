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
  TopicSyntax
} from '../v2ex/types'
import type { WebviewCommonRpcCommands, WebviewStateRpcCommands } from './commonView'
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
  /** 回复正文 */
  content: string
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
  /** 查看帖子时是否显示图片 */
  showImages?: boolean
  /** 查看帖子时是否显示头像 */
  showAvatar?: boolean
  /** 是否可执行登录态操作 */
  canOperate?: boolean
}

/**
 * 话题面板 Webview RPC 命令
 */
export interface TopicPanelRpcCommands
  extends WebviewCommonRpcCommands, WebviewStateRpcCommands<TopicPanelViewState> {
  /** 加载源站话题信息 */
  getTopicInfo(topicId: number): TopicInfo
  /** 选择目标节点，返回展示信息 */
  pickTopicContentNode(currentNodeName?: string): Node | undefined
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
  /** 复制话题链接 */
  copyTopicLink(topicId: string | number): void
  /** 复制话题标题和链接 */
  copyTopicTitleLink(topicId: string | number, title: string): void
  /** 在浏览器中打开话题 */
  viewTopicInBrowser(topicId: string | number): void
  /** 保存话题分享图 */
  saveTopicShareImage(topicId: string | number, base64: string): void
  /** 加载分享图使用的本地资源 URI 或 data URL */
  loadTopicShareImages(
    imageSources: string[],
    format?: 'resourceUri' | 'dataUrl'
  ): Record<string, string>
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
  postTopicReply(payload: PostTopicReplyInput): TopicDetail
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
  loadReplyPage(replyPage: number): TopicDetail
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
export interface TopicPanelWebviewEvents {
  topicStateChanged: {
    /** 页面状态 */
    state: TopicPanelViewState
  }
}
