import type { WebviewNavigationRpcCommands } from './commonView'

/**
 * Webview 节点项
 */
export interface WebviewNode {
  /** 节点 name；首页预置项中为 tab name */
  name: string
  /** 节点或首页分类的展示标题 */
  title: string
  /** 节点图标地址 */
  avatar?: string
  /** 节点简介 */
  description?: string
}

/** 首页预置节点 */
export const EXPLORE_NODES: WebviewNode[] = [
  { name: 'tech', title: '技术' },
  { name: 'creative', title: '创意' },
  { name: 'play', title: '好玩' },
  { name: 'apple', title: 'Apple' },
  { name: 'jobs', title: '酷工作' },
  { name: 'deals', title: '交易' },
  { name: 'city', title: '城市' },
  { name: 'qna', title: '问与答' },
  { name: 'hot', title: '最热' },
  { name: 'all', title: '全部' },
  { name: 'r2', title: 'R2' },
  { name: 'nodes', title: '节点' }
]

/**
 * Webview 话题项
 */
export interface WebviewTopic {
  id: number
  title: string
  /** 节点 name，如 programmer */
  nodeName?: string
  /** 节点展示标题，如“程序员” */
  nodeTitle?: string
  replies: number
  /** 展示时间 */
  displayTime?: string
  /** 最后回复用户 */
  lastReplyUser?: string
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
  selectedNode?: WebviewNode
}

/**
 * 节点子项数据
 */
export interface NodeChildrenData {
  /** 标签 key */
  tab: MainTabKey
  /** 列表项 key */
  itemKey: string
  /** 当前页码 */
  page: number
  /** 总页数 */
  totalPage: number
  /** 主题总数 */
  totalCount: number
  /** 话题列表 */
  children: WebviewTopic[]
  /** 错误文案 */
  error?: string
}

/**
 * 节点主题列表数据
 */
export interface NodeTopicListData {
  /** 节点 */
  node: WebviewNode
  /** 当前页码 */
  page: number
  /** 总页数 */
  totalPage: number
  /** 主题总数 */
  totalCount: number
  /** 主题列表 */
  topics: WebviewTopic[]
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

/** 每日签到结果 */
export type WebviewDailySignInResult = 'success' | 'repetitive' | 'failed'

/**
 * 每日签到数据
 */
export interface WebviewDailySignInData {
  /** 今日是否已签到 */
  signedIn: boolean
  /** 是否正在签到 */
  loading?: boolean
  /** 签到结果 */
  result?: WebviewDailySignInResult
  /** 当日签到奖励铜币数 */
  reward?: number
}

/**
 * 节点列表数据
 */
export interface NodeListData {
  /** 节点列表 */
  nodes: WebviewNode[]
}

/**
 * 我的账户概览刷新数据
 */
export interface MyOverviewRefreshData {
  /** 是否已登录 */
  loggedIn: boolean
  /** 账户概览 */
  accountOverview?: WebviewAccountOverview
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
export interface MainViewRpcCommands extends WebviewNavigationRpcCommands {
  ready(): InitData
  refreshCollectionNodes(): NodeListData
  refreshMyOverview(): MyOverviewRefreshData
  expandNode(payload: { tab: MainTabKey; itemKey: string; page?: number }): NodeChildrenData
  refreshNode(payload: { tab: MainTabKey; itemKey: string; page?: number }): NodeChildrenData
  getNodeTopics(payload: { nodeName: string; page?: number }): NodeTopicListData
  getMyTopics(payload: {
    tab: Extract<MyContentTabKey, 'topicCollection' | 'specialFollowing'>
    page?: number
  }): MyTopicListData
  getMyNotifications(payload: { page?: number }): MyNotificationListData
  getDailySignInStatus(): WebviewDailySignInData
  dailySignIn(): WebviewDailySignInData
  addNode(): NodeListData
  removeNode(payload: { nodeName: string }): NodeListData
  cancelCollectNode(payload: { nodeName: string }): void
  openBalance(): void
  search(): void
  login(): void
  ctxCopyLink(payload: { topicId: number; label: string }): void
  ctxCopyTitleLink(payload: { topicId: number; label: string }): void
  ctxViewInBrowser(payload: { topicId: number; label: string }): void
}

/**
 * 主面板发往 Webview 的事件
 */
export interface MainViewWebviewEvents {
  initData: InitData
  accountOverviewChanged: AccountOverviewChangedData
  dailySignInStatusChanged: WebviewDailySignInData
  selectMainTab: SelectMainTabData
  openNode: WebviewNode
}
