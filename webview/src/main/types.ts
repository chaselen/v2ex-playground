import type { MainTabKey, WebviewNode, WebviewTopic } from '../../../src/shared/webview'

export type { MainTabKey }

/**
 * 带前端状态的节点项
 */
export interface NodeItem extends WebviewNode {
  loading: boolean
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
export type TreeItemType = 'node' | 'topic' | 'loading' | 'error' | 'empty'

/**
 * 右键菜单动作
 */
export type ContextMenuAction = 'copyLink' | 'copyTitleLink' | 'viewInBrowser'

/**
 * Semi 树项
 */
export interface TreeItem {
  key: string
  label: string
  type: TreeItemType
  tab?: MainTabKey
  nodeId?: string
  topicId?: number
  title?: string
  replies?: number
  loading?: boolean
  isLeaf?: boolean
  children?: TreeItem[]
}
