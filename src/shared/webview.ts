import type { TopicDetail } from '../v2ex/types'

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
