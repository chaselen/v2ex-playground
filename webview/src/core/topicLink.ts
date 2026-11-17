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

/** 解析当前话题内的明确回复锚点，供局部列表定位与跨页加载 */
export function getTopicReplyTarget(
  href: string,
  topicId: number
): { replyId: string; page: number } | undefined {
  const base = `https://www.v2ex.com/t/${topicId}`
  if (getV2exTopicId(href, base) !== String(topicId)) return undefined
  const url = new URL(href, base)
  const replyId = url.hash.match(/^#r_([1-9]\d*)$/)?.[1]
  const page = Number(url.searchParams.get('p') || 1)
  return replyId && Number.isSafeInteger(page) && page > 0 ? { replyId, page } : undefined
}
