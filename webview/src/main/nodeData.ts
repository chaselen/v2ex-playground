import type { WebviewNode, WebviewTopic } from '@extension/shared/webview'
import type { NodeItem } from './types'

/**
 * 创建带前端状态的节点项
 * @param node 原始节点
 */
export function createNodeItem(node: WebviewNode): NodeItem {
  return {
    ...node,
    loading: false,
    page: 1,
    totalPage: 1,
    totalCount: 0,
    children: null,
    error: null
  }
}

/**
 * 合并节点数据并保留已加载状态
 * @param nodes 最新节点
 * @param existing 已有节点
 */
export function mergeNodeItems(nodes: WebviewNode[], existing: NodeItem[]): NodeItem[] {
  const existingByName = new Map(existing.map(node => [node.name, node]))

  return nodes.map(node => {
    const old = existingByName.get(node.name)
    return old ? { ...old, ...node } : createNodeItem(node)
  })
}

/**
 * 补齐话题列表默认字段
 * @param topics 话题列表
 */
export function normalizeTopics(topics: WebviewTopic[]): WebviewTopic[] {
  return topics.map(topic => ({
    ...topic,
    replies: topic.replies || 0
  }))
}
