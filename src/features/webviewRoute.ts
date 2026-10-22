import { getHelpSlug, isV2exUrl } from '@/v2ex'

/** URL 解析得到的导航意图，不持有面板或执行回调 */
export type WebviewNavigationTarget =
  | { type: 'topic'; topicId: string; title?: string }
  | { type: 'member'; username: string }
  | { type: 'node'; name: string; title: string }
  | { type: 'tag'; tag: string }
  | { type: 'help'; slug: string; anchor?: string }
  | { type: 'createTopic' }
  | { type: 'balance' }

/** 判断链接是否支持插件内导航，不执行打开操作 */
export function canOpenWebviewUrl(path: string): boolean {
  return resolveWebviewRoute(path) !== undefined
}

/** 解析站内页面路由；无效链接、未支持页面或解码失败时返回 undefined */
export function resolveWebviewRoute(
  path: string,
  title?: string
): WebviewNavigationTarget | undefined {
  let url: URL
  try {
    url = new URL(path)
  } catch {
    return
  }

  if (isV2exUrl(url)) {
    const topicId = url.pathname.match(/^\/t\/(\d+)\/?$/)?.[1]
    if (topicId) {
      const numericId = Number(topicId)
      if (!Number.isSafeInteger(numericId) || numericId <= 0) return
      return { type: 'topic', topicId, title }
    }
    const match = url.pathname.match(/^\/(member|go|tag)\/([^/]+)\/?$/)
    if (match) {
      let value: string
      try {
        value = decodeURIComponent(match[2])
      } catch {
        return
      }
      if (match[1] === 'go' && !value.trim()) return
      if (match[1] === 'tag') {
        const tag = value.trim()
        if (!tag) return
        return { type: 'tag', tag }
      }
      return match[1] === 'member'
        ? { type: 'member', username: value }
        : { type: 'node', name: value, title: title || value }
    }
    const slug = getHelpSlug(url.pathname)
    if (slug) {
      let anchor: string | undefined
      try {
        anchor = url.hash ? decodeURIComponent(url.hash.slice(1)) : undefined
      } catch {
        return
      }
      return { type: 'help', slug, anchor }
    }
    if (/^\/write\/?$/.test(url.pathname)) {
      return { type: 'createTopic' }
    }
    if (/^\/balance\/?$/.test(url.pathname)) {
      return { type: 'balance' }
    }
  }
}
