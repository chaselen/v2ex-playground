import type { WebviewNode } from '@/shared/webview'
import type { Node } from '@/v2ex'

/** V2EX 节点头像代理根地址 */
const V2EX_NODE_AVATAR_PROXY_BASE = 'https://img.fuyou.tech/v2ex/node'

/** 节点头像尺寸 */
export type V2exNodeAvatarSize = 'mini' | 'normal' | 'large'

/**
 * 生成 V2EX 节点头像代理地址
 * 经 img.fuyou.tech 代理，避免 Webview 直连 cdn.v2ex.com 被拦截（如 403）
 * @param nodeName 节点 name
 * @param size 头像尺寸，默认 normal（约 48px，适配列表 16px 在 Retina 下的清晰度）
 */
export function getV2exNodeAvatarUrl(
  nodeName: string,
  size: V2exNodeAvatarSize = 'normal'
): string {
  return `${V2EX_NODE_AVATAR_PROXY_BASE}/${nodeName}?size=${size}`
}

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
