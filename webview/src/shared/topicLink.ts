/**
 * 从 V2EX 站内话题链接中提取话题 id
 * @param href 链接地址
 * @param baseUrl 相对链接基准地址
 */
export function getV2exTopicId(href: string, baseUrl: string): string | undefined {
  try {
    const url = new URL(href, baseUrl)
    if (!isV2exHostname(url.hostname)) {
      return undefined
    }

    // 仅匹配 pathname，允许链接携带评论锚点或分页参数
    return url.pathname.match(/^\/t\/(\d+)\/?$/)?.[1]
  } catch {
    return undefined
  }
}

/**
 * 判断域名是否属于 V2EX
 * @param hostname 域名
 */
export function isV2exHostname(hostname: string): boolean {
  return hostname === 'v2ex.com' || hostname.endsWith('.v2ex.com')
}
