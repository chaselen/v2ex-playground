import type { AxiosResponse } from 'axios'
import { V2EX_BASE_URL, isV2exUrl } from './links'

/** 会话 Cookie 与认证处理仅信任 HTTPS 原站地址，独立于通用链接识别规则 */
export function isV2exSessionUrl(url: URL): boolean {
  return url.protocol === 'https:' && isV2exUrl(url)
}

/** 在 HTTPS 会话边界内精确匹配认证重定向路径 */
export function isV2exSessionPath(url: URL, path: string): boolean {
  return isV2exSessionUrl(url) && url.pathname === path
}

/**
 * 获取请求配置对应的链接
 * @param config 请求配置
 * @param baseUrl 基础链接
 * @example
 * getConfigUrl({ url: '/balance' }, 'https://www.v2ex.com').toString()
 * // 'https://www.v2ex.com/balance'
 */
export function getConfigUrl(config: AxiosResponse['config'], baseUrl = V2EX_BASE_URL): URL {
  return new URL(config.url || '', config.baseURL || baseUrl)
}

/**
 * 获取响应对应的最终链接
 * @param response HTTP 响应
 * @param baseUrl 基础链接
 *
 * 优先读取 Node 请求对象中的最终响应链接，缺失时回退到请求配置
 */
export function getResponseUrl(response: AxiosResponse, baseUrl = V2EX_BASE_URL): string {
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
