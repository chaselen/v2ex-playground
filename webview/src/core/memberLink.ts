import { isV2exHostname } from './topicLink'

/**
 * 从 V2EX 站内用户链接中提取用户名
 * @param href 链接地址
 * @param baseUrl 相对链接基准地址
 */
export function getMemberUsernameFromHref(href: string, baseUrl: string): string {
  try {
    const url = new URL(href, baseUrl)
    if (!isV2exHostname(url.hostname)) {
      return ''
    }

    const value = url.pathname.match(/^\/member\/([^/]+)\/?$/)?.[1]
    if (!value) {
      return ''
    }

    try {
      return decodeURIComponent(value)
    } catch {
      return ''
    }
  } catch {
    return ''
  }
}
