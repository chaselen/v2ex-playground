/** V2EX 服务地址 */
export const V2EX_BASE_URL = 'https://www.v2ex.com'

/**
 * 判断 HTTP 或 HTTPS 链接是否属于 V2EX
 * @param url 待判断链接
 * @example
 * isV2exUrl(new URL('https://www.v2ex.com/t/1')) // true
 * isV2exUrl(new URL('http://www.v2ex.com/t/1')) // true
 * isV2exUrl(new URL('ftp://www.v2ex.com/t/1')) // false
 */
export function isV2exUrl(url: URL): boolean {
  return (
    (url.protocol === 'https:' || url.protocol === 'http:') &&
    (url.host === 'v2ex.com' || url.host.endsWith('.v2ex.com'))
  )
}

/**
 * 判断 HTTP 或 HTTPS 链接是否为指定 V2EX 路径
 * @param url 待判断链接
 * @param path 目标路径
 * @example
 * isV2exPath(new URL('https://www.v2ex.com/2fa'), '/2fa') // true
 * isV2exPath(new URL('http://www.v2ex.com/2fa'), '/2fa') // true
 * isV2exPath(new URL('https://example.com/2fa'), '/2fa') // false
 */
export function isV2exPath(url: URL, path: string): boolean {
  return isV2exUrl(url) && url.pathname === path
}

/** 站点默认图标。关闭「节点图标作为 favicon」后，主题页 icon 会退回这些地址 */
const GENERIC_V2EX_ICON =
  /^\/static\/(?:favicon\.ico|icon-\d+\.png|apple-touch-icon(?:-\d+)?(?:\.png)?)$/

/**
 * 判断地址是否为 V2EX 站点默认图标，而不是节点图标
 * @param iconUrl 图标地址，可以是绝对地址或站内路径
 * @example isGenericV2exIcon('/static/favicon.ico') // true
 * @example isGenericV2exIcon('https://cdn.v2ex.com/navatar/94f6/d7e0/300_large.png') // false
 */
export function isGenericV2exIcon(iconUrl: string): boolean {
  try {
    const url = new URL(iconUrl, V2EX_BASE_URL)
    return isV2exUrl(url) && GENERIC_V2EX_ICON.test(url.pathname)
  } catch {
    return false
  }
}

/**
 * 从链接中提取主题id，仅提取编号，不校验所属站点
 * @param topicLink 主题链接
 * @example "/t/1136705#reply50" -> 1136705
 * @example "https://www.v2ex.com/t/703733#reply12" -> 703733
 * @returns 主题id
 */
export function parseTopicIdByLink(topicLink: string): number | undefined {
  const match = topicLink.match(/t\/(\d+)/)
  return match ? Number(match[1]) : undefined
}

/**
 * 从原站帮助路径提取主题，仅接受单一路径段
 * @example
 * getHelpSlug('/help/currency') // 'currency'
 * getHelpSlug('/help/a/b') // undefined
 */
export function getHelpSlug(path: string): string | undefined {
  return path.match(/^\/help\/([a-z0-9-]+)\/?$/)?.[1]
}

/**
 * 根据话题编号生成链接，可指定站点基础地址
 * @example
 * getTopicLink(703733) // 'https://www.v2ex.com/t/703733'
 * getTopicLink(703733, 'https://edge.v2ex.com') // 'https://edge.v2ex.com/t/703733'
 */
export function getTopicLink(topicId: string | number, baseUrl = V2EX_BASE_URL): string {
  return `${baseUrl}/t/${topicId}`
}

/**
 * 根据用户名生成主页链接，可指定站点基础地址
 * @example
 * getMemberLink('Livid') // 'https://www.v2ex.com/member/Livid'
 * getMemberLink('Livid', 'https://edge.v2ex.com') // 'https://edge.v2ex.com/member/Livid'
 */
export function getMemberLink(username: string, baseUrl = V2EX_BASE_URL): string {
  return `${baseUrl}/member/${username}`
}

/**
 * 节点 name 来自路径段，本身无需 URL 编码
 * @example
 * getNodeLink('vibe-coding') // 'https://www.v2ex.com/go/vibe-coding'
 * getNodeLink('0x10c') // 'https://www.v2ex.com/go/0x10c'
 */
export function getNodeLink(nodeName: string, baseUrl = V2EX_BASE_URL): string {
  return `${baseUrl}/go/${nodeName}`
}

/**
 * 去除标签首尾空白并编码为链接，空标签不可生成链接
 * @example
 * getTagLink(' VS Code ') // 'https://www.v2ex.com/tag/VS%20Code'
 * getTagLink('  ') // 抛出 Error('标签名称不能为空')
 */
export function getTagLink(tag: string, baseUrl = V2EX_BASE_URL): string {
  const normalizedTag = tag.trim()
  if (!normalizedTag) throw new Error('标签名称不能为空')
  return `${baseUrl}/tag/${encodeURIComponent(normalizedTag)}`
}
