import type { MemberInfo, TopicDetail } from '../v2ex/types'
import type { WebviewCommonRpcCommands, WebviewStateRpcCommands } from './commonView'
export type { MemberInfo } from '../v2ex/types'

/** 话题操作目标 */
export interface TopicActionTarget {
  /** 话题 id */
  topicId: string | number
  /** 当前回复页 */
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
  /** 打开标签主题面板 */
  openTag(tag: string): void
  login(): void
  refresh(): void
  /** 复制话题链接 */
  copyTopicLink(topicId: string | number): void
  /** 复制话题标题和链接 */
  copyTopicTitleLink(payload: { topicId: string | number; title: string }): void
  /** 在浏览器中打开话题 */
  viewTopicInBrowser(topicId: string | number): void
  /** 保存话题分享图 */
  saveTopicShareImage(payload: { topicId: string | number; base64: string }): void
  /** 加载分享图使用的本地资源 URI 或 data URL */
  loadTopicShareImages(
    imageSources: string[],
    options?: { format?: 'resourceUri' | 'dataUrl' }
  ): Record<string, string>
  /** 收藏话题并返回最新详情 */
  collectTopic(payload: TopicActionTarget): TopicDetail
  /** 取消收藏话题并返回最新详情 */
  cancelCollectTopic(payload: TopicActionTarget): TopicDetail
  /** 感谢话题创建者并返回最新详情 */
  thankTopic(payload: TopicActionTarget): TopicDetail
  /** 提交回复并返回最新详情 */
  postTopicReply(payload: TopicActionTarget & { content: string }): TopicDetail
  /** 上传回复图片 */
  uploadImage(payload: { filename: string; mimeType: string; base64: string }): string
  /** 检测 Imgur 连通性 */
  checkImgurConnectivity(payload: { target: 'image' | 'upload'; refresh?: boolean }): boolean
  /** 预览回复内容 */
  previewReply(content: string): string
  /** 加载站内话题预览 */
  getTopicPreview(payload: { topicId: string | number; replyPage?: number }): TopicDetail
  /** 感谢回复者并返回最新详情 */
  thankTopicReply(payload: TopicActionTarget & { replyId: string }): TopicDetail
  /** 加载当前话题回复页并返回最新详情 */
  loadReplyPage(replyPage: number): TopicDetail
  /** 加载用户快速信息 */
  loadMemberQuickInfo(username: string): MemberInfo
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
