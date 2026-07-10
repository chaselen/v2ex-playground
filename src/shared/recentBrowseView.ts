import type { WebviewNavigationRpcCommands } from './commonView'

/**
 * 最近浏览话题
 */
export interface RecentBrowseTopic {
  /** 话题 id */
  topicId: number
  /** 话题标题 */
  title: string
  /** 作者名称 */
  authorName: string
  /** 作者头像 */
  authorAvatar: string
  /** 节点 name */
  nodeName: string
  /** 节点展示标题 */
  nodeTitle: string
  /** 完整发布时间 */
  publishedAt: string
  /** 最近浏览时间戳 */
  readAt: number
}

/**
 * 最近浏览列表数据
 */
export interface RecentBrowseListData {
  /** 当前页码 */
  page: number
  /** 总页数 */
  totalPage: number
  /** 话题总数 */
  totalCount: number
  /** 话题列表 */
  topics: RecentBrowseTopic[]
}

/**
 * 最近浏览面板 Webview RPC 命令
 */
export interface RecentBrowsePanelRpcCommands extends WebviewNavigationRpcCommands {
  getRecentBrowseTopics(payload: { page?: number; pageSize?: number }): RecentBrowseListData
  deleteRecentBrowseTopic(payload: {
    topicId: number
    page?: number
    pageSize?: number
  }): RecentBrowseListData
  clearRecentBrowseTopics(): RecentBrowseListData
}

/**
 * 最近浏览面板发往 Webview 的事件
 */
export interface RecentBrowsePanelWebviewEvents {}
