import type { BrowseSettingsWebviewEvents, WebviewCommonRpcCommands } from './commonView'
import type { RecentBrowseListData } from './recentBrowse'

/** 最近浏览列表查询 */
export interface RecentBrowseQuery {
  /** 页码 */
  page?: number
  /** 每页数量 */
  pageSize?: number
  /** 标题、作者或节点搜索词 */
  query?: string
}

/** 删除最近浏览话题请求 */
export interface DeleteRecentBrowseTopicRequest extends RecentBrowseQuery {
  /** 话题 id */
  topicId: number
}

/**
 * 最近浏览面板 Webview RPC 命令
 */
export interface RecentBrowsePanelRpcCommands extends WebviewCommonRpcCommands {
  getRecentBrowseTopics(payload: RecentBrowseQuery): RecentBrowseListData
  deleteRecentBrowseTopic(payload: DeleteRecentBrowseTopicRequest): RecentBrowseListData
  clearRecentBrowseTopics(): RecentBrowseListData
}

/**
 * 最近浏览面板发往 Webview 的事件
 */
export interface RecentBrowsePanelWebviewEvents extends BrowseSettingsWebviewEvents {}
