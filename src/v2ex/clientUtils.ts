import type { AxiosResponse } from 'axios'

/** V2EX 基础链接 */
const v2exBaseUrl = 'https://www.v2ex.com'

/**
 * 判断链接是否属于 V2EX
 * @param url 待判断链接
 * @example
 * isV2exUrl(new URL('https://www.v2ex.com/t/1')) // true
 * isV2exUrl(new URL('http://www.v2ex.com/t/1')) // false
 */
export function isV2exUrl(url: URL): boolean {
  return url.protocol === 'https:' && (url.host === 'v2ex.com' || url.host.endsWith('.v2ex.com'))
}

/**
 * 判断链接是否为指定 V2EX 路径
 * @param url 待判断链接
 * @param path 目标路径
 * @example
 * isV2exPath(new URL('https://www.v2ex.com/2fa'), '/2fa') // true
 */
export function isV2exPath(url: URL, path: string): boolean {
  return isV2exUrl(url) && url.pathname === path
}

/**
 * 获取请求配置对应的链接
 * @param config 请求配置
 * @param baseUrl 基础链接
 * @example
 * getConfigUrl({ url: '/balance' }, 'https://www.v2ex.com').toString()
 * // 'https://www.v2ex.com/balance'
 */
export function getConfigUrl(config: AxiosResponse['config'], baseUrl = v2exBaseUrl): URL {
  return new URL(config.url || '', config.baseURL || baseUrl)
}

/**
 * 获取响应对应的最终链接
 * @param response HTTP 响应
 * @param baseUrl 基础链接
 *
 * 优先读取 Node 请求对象中的最终响应链接，缺失时回退到请求配置
 */
export function getResponseUrl(response: AxiosResponse, baseUrl = v2exBaseUrl): string {
  return (
    response.request?.res?.responseUrl ||
    response.request?._redirectable?._currentUrl ||
    getConfigUrl(response.config, baseUrl).toString()
  )
}

/**
 * 获取响应头文本
 * @param headers 响应头
 * @param name 响应头名称
 * @example
 * getHeader({ location: '/2fa' }, 'location') // '/2fa'
 * getHeader({ location: ['/2fa'] }, 'location') // '/2fa'
 */
export function getHeader(headers: Record<string, unknown>, name: string): string | undefined {
  const value = headers[name]
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0]
  }
  return undefined
}

/**
 * 获取 Cookie 请求头名称
 * @param headers 请求头
 * @example
 * findCookieHeaderName({ cookie: 'A2=xxx' }) // 'cookie'
 * findCookieHeaderName({ Cookie: 'A2=xxx' }) // 'Cookie'
 */
export function findCookieHeaderName(headers: Record<string, unknown>): string | undefined {
  return Object.keys(headers).find(name => name.toLowerCase() === 'cookie')
}

/**
 * 移除 Cookie 请求头
 * @param headers 请求头
 * @example
 * const headers = { cookie: 'A2=xxx', Accept: 'text/html' }
 * removeCookieHeader(headers)
 * // headers === { Accept: 'text/html' }
 */
export function removeCookieHeader(headers: Record<string, unknown>): void {
  const cookieHeaderName = findCookieHeaderName(headers)
  if (cookieHeaderName) {
    delete headers[cookieHeaderName]
  }
}

/**
 * 判断响应是否发生过自动重定向
 * @param response HTTP 响应
 *
 * Axios 在 Node 环境下会把重定向次数放在 request._redirectable._redirectCount
 */
export function hasFollowedRedirect(response: AxiosResponse): boolean {
  return (response.request?._redirectable?._redirectCount || 0) > 0
}
