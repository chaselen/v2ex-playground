import type { BrowseSettingsWebviewEvents, WebviewCommonRpcCommands } from './commonView'
import type { AccountOverview, V2exNotification } from '../v2ex/types'
import type { DailySignInState } from './dailySignIn'

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
  { name: 'nodes', title: '节点' },
  { name: 'members', title: '关注' }
]

/** 仅登录用户可用的首页分类名称 */
const AUTHENTICATED_EXPLORE_NODE_NAMES = new Set(['nodes', 'members'])

/**
 * 获取当前登录态可展示的首页分类
 * @param loggedIn 是否已登录
 */
export function getExploreNodes(loggedIn: boolean): WebviewNode[] {
  if (loggedIn) {
    return EXPLORE_NODES
  }

  return EXPLORE_NODES.filter(node => !AUTHENTICATED_EXPLORE_NODE_NAMES.has(node.name))
}

/**
 * Webview 话题项
 */
export interface WebviewTopic {
  /** 话题 id */
  id: number
  /** 话题标题 */
  title: string
  /** 节点 name，如 programmer */
  nodeName?: string
  /** 节点展示标题，如“程序员” */
  nodeTitle?: string
  /** 回复数 */
  replies: number
  /** 列表展示时间，可能为中文相对时间或本地化日期 */
  displayTime?: string
  /** 最后回复用户 */
  lastReplyUser?: string
  /** 是否已读 */
  isRead?: boolean
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
  accountOverview?: AccountOverview
  selectedTab?: MainPanelTabKey
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

/** 主面板节点子列表请求 */
export interface NodeChildrenRequest {
  /** 标签 key */
  tab: MainTabKey
  /** 列表项 key */
  itemKey: string
  /** 页码 */
  page?: number
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
  notifications: V2exNotification[]
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
  accountOverview?: AccountOverview
}

/**
 * 账户概览变化数据
 */
export interface AccountOverviewChangedData {
  /** 最新账户概览 */
  overview: AccountOverview
  /** 旧账户概览 */
  oldOverview?: AccountOverview
}

/**
 * 主面板标签切换数据
 */
export interface SelectMainTabData {
  /** 目标标签 key */
  tab: MainPanelTabKey
}

/**
 * 话题已读数据
 */
export interface TopicReadData {
  /** 已读话题 id；同窗口打开时为 1 个，焦点或可见时同步为当前全部已读 */
  topicIds: number[]
}

/**
 * 主面板 Webview RPC 命令
 */
export interface MainViewRpcCommands extends WebviewCommonRpcCommands {
  ready(): InitData
  refreshCollectionNodes(): NodeListData
  refreshMyOverview(): MyOverviewRefreshData
  expandNode(payload: NodeChildrenRequest): NodeChildrenData
  refreshNode(payload: NodeChildrenRequest): NodeChildrenData
  getMyTopics(tab: MyTopicListData['tab'], page?: number): MyTopicListData
  getMyNotifications(page?: number): MyNotificationListData
  /** 删除提醒消息，成功后由调用方重新读取列表 */
  deleteNotification(notificationId: number): void
  getDailySignInStatus(): DailySignInState
  dailySignIn(): DailySignInState
  addNode(): NodeListData
  collectNode(): NodeListData
  removeNode(nodeName: string): NodeListData
  cancelCollectNode(nodeName: string): void
  openBalance(): void
  createTopic(): void
  search(): void
  login(): void
  ctxCopyLink(topicId: number): void
  ctxCopyTitleLink(topicId: number, title: string): void
  ctxViewInBrowser(topicId: number): void
}

/**
 * 主面板发往 Webview 的事件
 */
export interface MainViewWebviewEvents extends BrowseSettingsWebviewEvents {
  initData: InitData
  accountOverviewChanged: AccountOverviewChangedData
  dailySignInStatusChanged: DailySignInState
  selectMainTab: SelectMainTabData
  topicRead: TopicReadData
  /** 收藏节点列表已变化，需同步收藏节点标签 */
  collectionNodesChanged: NodeListData
}
