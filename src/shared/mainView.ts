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
  replies: number
}

/** 主面板标签 key */
export type MainTabKey = 'explore' | 'custom' | 'collection'

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

/**
 * 自定义节点更新数据
 */
export interface CustomNodesUpdatedData {
  /** 节点列表 */
  nodes: WebviewNode[]
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
  addNode: WebviewRpcDefinition<object, CustomNodesUpdatedData>
  removeNode: WebviewRpcDefinition<{ nodeId: string }, CustomNodesUpdatedData>
  openTopic: WebviewRpcDefinition<{ topicId: string | number; title: string }, void>
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
}
