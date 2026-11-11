import { getV2exNodeAvatarUrl } from '../shared/nodeAvatars'
import type { WebviewNode } from '../shared/webview'
import type { Node } from '../v2ex/types'

/**
 * 将节点列表转为带头像的 Webview 节点
 * 头像按 name 拼代理 URL，不依赖 getAllNodes / 本地已存 avatar
 * @param nodes 待展示的节点列表
 */
export function toWebviewNodesWithAvatars(
  nodes: Array<Pick<Node, 'name' | 'title' | 'avatar'>>
): WebviewNode[] {
  return nodes.map(node => ({
    name: node.name,
    title: node.title,
    avatar: getV2exNodeAvatarUrl(node.name, 'normal')
  }))
}
