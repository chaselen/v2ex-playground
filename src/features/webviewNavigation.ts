import { getHelpSlug, isV2exUrl } from '@/v2ex'
import {
  openBalance,
  openCreateTopic,
  openMember,
  openNode,
  openTag,
  openTopic,
  openHelp
} from './panelNavigation'
import { openExternal } from './openExternal'

/** 将 Webview URL 导航到插件支持的页面，其余链接交给浏览器 */
export function openWebviewUrl(path: string, title?: string) {
  const navigate = resolvePageNavigation(path, title)
  if (navigate) navigate()
  else openExternal(path)
}

/** 判断链接能否由插件内置页面打开，与实际导航共用路由规则 */
export function canOpenWebviewUrl(path: string): boolean {
  return resolvePageNavigation(path) !== undefined
}

/**
 * 解析插件内置页面路由，仅返回导航回调，不执行导航，供输入校验与实际打开共用
 * @param path 待解析的完整页面链接
 * @param title 话题或节点面板使用的标题
 * @returns 导航回调；链接无效、页面不受支持或必要字段解码失败时返回 undefined
 */
function resolvePageNavigation(path: string, title?: string): (() => void) | undefined {
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
      return () => openTopic(topicId, title)
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
        return () => openTag(tag)
      }
      return match[1] === 'member' ? () => openMember(value) : () => openNode(value, title || value)
    }
    const slug = getHelpSlug(url.pathname)
    if (slug) {
      let anchor: string | undefined
      try {
        anchor = url.hash ? decodeURIComponent(url.hash.slice(1)) : undefined
      } catch {
        return
      }
      return () => openHelp(slug, anchor)
    }
    if (/^\/write\/?$/.test(url.pathname)) {
      return () => openCreateTopic()
    }
    if (/^\/balance\/?$/.test(url.pathname)) {
      return () => openBalance()
    }
  }
}
