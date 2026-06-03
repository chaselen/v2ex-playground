import type { WebviewEventDefinition, WebviewRpcDefinition } from './webviewRpc'

/**
 * Webview 节点项
 */
export interface WebviewNode {
  id: string
  label: string
  nodeName?: string
}

/** 首页预置节点 */
export const EXPLORE_NODES: WebviewNode[] = [
  { id: 'tech', label: '技术', nodeName: 'tech' },
  { id: 'creative', label: '创意', nodeName: 'creative' },
  { id: 'play', label: '好玩', nodeName: 'play' },
  { id: 'apple', label: 'Apple', nodeName: 'apple' },
  { id: 'jobs', label: '酷工作', nodeName: 'jobs' },
  { id: 'deals', label: '交易', nodeName: 'deals' },
  { id: 'city', label: '城市', nodeName: 'city' },
  { id: 'qna', label: '问与答', nodeName: 'qna' },
  { id: 'hot', label: '最热', nodeName: 'hot' },
  { id: 'all', label: '全部', nodeName: 'all' },
  { id: 'r2', label: 'R2', nodeName: 'r2' },
  { id: 'nodes', label: '节点', nodeName: 'nodes' }
]

/**
 * Webview 话题项
 */
export interface WebviewTopic {
  id: number
  title: string
  /** 节点名称 */
  nodeName?: string
  /** 节点标题 */
  nodeTitle?: string
  replies: number
}

/**
 * Webview 账户概览
 */
export interface WebviewAccountOverview {
  /** 头像地址 */
  avatar: string
  /** 用户名 */
  username: string
  /** 节点收藏数量 */
  nodeCollectionCount: number
  /** 主题收藏数量 */
  topicCollectionCount: number
  /** 特别关注数量 */
  specialFollowingCount: number
  /** 活跃度百分比 */
  activityPercent: number
  /** 未读提醒数量 */
  unreadNoticeCount: number
  /** 金币数量 */
  gold: number
  /** 银币数量 */
  silver: number
  /** 铜币数量 */
  bronze: number
}

/**
 * Webview 提醒消息项
 */
export interface WebviewNotification {
  /** 提醒 id */
  id: number
  /** 用户头像 */
  avatar: string
  /** 用户名 */
  username: string
  /** 用户主页路径 */
  memberPath: string
  /** 提醒摘要 HTML */
  summaryHtml: string
  /** 话题 id */
  topicId?: number
  /** 话题标题 */
  topicTitle?: string
  /** 话题路径 */
  topicPath?: string
  /** 展示时间 */
  time: string
  /** 消息正文 HTML */
  payloadHtml: string
}

/** 主面板标签 key */
export type MainTabKey = 'explore' | 'custom' | 'collection'

/** 主面板全部标签 key */
export type MainPanelTabKey = MainTabKey | 'my'

/**
 * Webview 接收的初始化数据
 */
export interface InitData {
  tabs: {
    explore: WebviewNode[]
    custom: WebviewNode[]
    collection: WebviewNode[]
  }
  loggedIn: boolean
  accountOverview?: WebviewAccountOverview
  selectedTab?: MainPanelTabKey
}

/**
 * 节点子项数据
 */
export interface NodeChildrenData {
  /** 标签 key */
  tab: MainTabKey
  /** 节点 id */
  nodeId: string
  /** 当前页码 */
  page: number
  /** 总页数 */
  totalPage: number
  /** 话题列表 */
  children: WebviewTopic[]
  /** 错误文案 */
  error?: string
}

/** 我的内容标签 key */
export type MyContentTabKey = 'topicCollection' | 'specialFollowing' | 'messages'

/**
 * 我的主题列表数据
 */
export interface MyTopicListData {
  /** 标签 key */
  tab: Extract<MyContentTabKey, 'topicCollection' | 'specialFollowing'>
  /** 当前页码 */
  page: number
  /** 总页数 */
  totalPage: number
  /** 话题列表 */
  topics: WebviewTopic[]
}

/**
 * 我的消息列表数据
 */
export interface MyNotificationListData {
  /** 当前页码 */
  page: number
  /** 总页数 */
  totalPage: number
  /** 消息总数 */
  totalCount: number
  /** 消息列表 */
  notifications: WebviewNotification[]
}

/**
 * 自定义节点更新数据
 */
export interface CustomNodesUpdatedData {
  /** 节点列表 */
  nodes: WebviewNode[]
}

/**
 * 账户概览变化数据
 */
export interface AccountOverviewChangedData {
  /** 最新账户概览 */
  overview: WebviewAccountOverview
  /** 旧账户概览 */
  oldOverview?: WebviewAccountOverview
}

/**
 * 主面板标签切换数据
 */
export interface SelectMainTabData {
  /** 目标标签 key */
  tab: MainPanelTabKey
}

/**
 * 主面板 Webview RPC 命令
 */
export interface MainViewRpcCommands {
  ready: WebviewRpcDefinition<object, InitData>
  refreshAll: WebviewRpcDefinition<object, InitData>
  expandNode: WebviewRpcDefinition<
    { tab: MainTabKey; nodeId: string; page?: number },
    NodeChildrenData
  >
  refreshNode: WebviewRpcDefinition<
    { tab: MainTabKey; nodeId: string; page?: number },
    NodeChildrenData
  >
  getMyTopics: WebviewRpcDefinition<
    { tab: Extract<MyContentTabKey, 'topicCollection' | 'specialFollowing'>; page?: number },
    MyTopicListData
  >
  getMyNotifications: WebviewRpcDefinition<{ page?: number }, MyNotificationListData>
  addNode: WebviewRpcDefinition<object, CustomNodesUpdatedData>
  removeNode: WebviewRpcDefinition<{ nodeId: string }, CustomNodesUpdatedData>
  openTopic: WebviewRpcDefinition<{ topicId: string | number; title: string }, void>
  openExternal: WebviewRpcDefinition<{ path: string }, void>
  search: WebviewRpcDefinition<object, void>
  login: WebviewRpcDefinition<object, void>
  ctxCopyLink: WebviewRpcDefinition<{ topicId: number; label: string }, void>
  ctxCopyTitleLink: WebviewRpcDefinition<{ topicId: number; label: string }, void>
  ctxViewInBrowser: WebviewRpcDefinition<{ topicId: number; label: string }, void>
}

/**
 * 主面板发往 Webview 的事件
 */
export interface MainViewWebviewEvents {
  initData: WebviewEventDefinition<InitData>
  refreshLoadedNodes: WebviewEventDefinition<object>
  accountOverviewChanged: WebviewEventDefinition<AccountOverviewChangedData>
  selectMainTab: WebviewEventDefinition<SelectMainTabData>
}
