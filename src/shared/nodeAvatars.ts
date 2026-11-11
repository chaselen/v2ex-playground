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
