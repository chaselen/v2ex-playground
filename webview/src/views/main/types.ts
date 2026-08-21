import type { MainTabKey, WebviewNode, WebviewTopic } from '@extension/shared/webview'

export type { MainTabKey }

/**
 * 带前端状态的节点项
 */
export interface NodeItem extends WebviewNode {
  loading: boolean
  page: number
  totalPage: number
  totalCount: number
  children: WebviewTopic[] | null
  error: string | null
}

/**
 * 主面板标签数据
 */
export type MainTabs = Record<MainTabKey, NodeItem[]>

/**
 * 树节点类型
 */
export type TreeItemType = 'node' | 'topic' | 'pagination' | 'loading' | 'error' | 'empty'

/**
 * 右键菜单动作
 */
export type ContextMenuAction = 'copyLink' | 'copyTitleLink' | 'viewInBrowser'

/**
 * 节点树渲染项
 */
export interface TreeItem {
  key: string
  label: string
  type: TreeItemType
  tab?: MainTabKey
  itemKey?: string
  topicId?: number
  title?: string
  /** 节点图标地址；自定义 / 收藏节点列表使用 */
  avatar?: string
  replies?: number
  isRead?: boolean
  page?: number
  totalPage?: number
  totalCount?: number
  loading?: boolean
  isLeaf?: boolean
  children?: TreeItem[]
}
