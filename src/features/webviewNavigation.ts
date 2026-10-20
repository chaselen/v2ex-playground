import { getHelpSlug, isV2exUrl } from '@/v2ex'
import {
  openBalance,
  openCreateTopic,
  openMember,
  openNode,
  openTopic,
  openHelp
} from './panelNavigation'
import { openExternal } from './openExternal'

/** 将 Webview URL 导航到插件支持的页面，其余链接交给浏览器 */
export function openWebviewUrl(path: string, title?: string) {
  let url: URL
  try {
    url = new URL(path)
  } catch {
    openExternal(path)
    return
  }

  if (isV2exUrl(url)) {
    const topicId = url.pathname.match(/^\/t\/(\d+)\/?$/)?.[1]
    if (topicId) {
      openTopic(topicId, title)
      return
    }
    const match = url.pathname.match(/^\/(member|go)\/([^/]+)\/?$/)
    if (match) {
      let value: string
      try {
        value = decodeURIComponent(match[2])
      } catch {
        openExternal(path)
        return
      }
      if (match[1] === 'member') openMember(value)
      else openNode(value, title || value)
      return
    }
    const slug = getHelpSlug(url.pathname)
    if (slug) {
      let anchor: string | undefined
      try {
        anchor = url.hash ? decodeURIComponent(url.hash.slice(1)) : undefined
      } catch {
        openExternal(path)
        return
      }
      openHelp(slug, anchor)
      return
    }
    if (/^\/write\/?$/.test(url.pathname)) {
      openCreateTopic()
      return
    }
    if (/^\/balance\/?$/.test(url.pathname)) {
      openBalance()
      return
    }
  }
  openExternal(path)
}
