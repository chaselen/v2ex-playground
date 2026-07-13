import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { parse as parseCookieHeader } from 'cookie'
import picomatch from 'picomatch'
import { CookieJar } from 'tough-cookie'
import { installHttpFailureLogging, type HttpFailureHandler } from '@/core/httpFailureLogging'
import { normalizeLoginCookie } from './cookie'
import {
  findCookieHeaderName,
  getConfigUrl,
  getHeader,
  getResponseUrl,
  hasFollowedRedirect,
  isV2exPath,
  isV2exUrl,
  removeCookieHeader
} from './clientUtils'
import {
  AccountRestrictedError,
  LoginRequiredError,
  TwoFactorRequiredError,
  type LoginExpiredHandler,
  type TwoFactorRequiredHandler
} from './types'

/** V2EX 服务地址 */
export const V2EX_BASE_URL = 'https://www.v2ex.com'

/** V2EX 请求超时时间 */
export const V2EX_REQUEST_TIMEOUT = 15000

/** V2EX 公共请求头 */
export const V2EX_REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-CN,zh;q=0.9'
}

/** 需要检查自动重定向的页面路径 */
const isRedirectCheckPath = picomatch([
  '/balance',
  '/go/*',
  '/mission/daily',
  '/my/*',
  '/notifications',
  '/t/*'
])

/** V2EX 会话配置 */
export interface V2exSessionOptions {
  onLoginExpired?: LoginExpiredHandler
  onTwoFactorRequired?: TwoFactorRequiredHandler
  onHttpFailure?: HttpFailureHandler
}

/** V2EX 响应监听器 */
export type V2exResponseHandler = (response: AxiosResponse) => void

/** 负责 V2EX HTTP、Cookie、重定向与两步验证的会话 */
export class V2exSession {
  readonly baseUrl = V2EX_BASE_URL
  /** Axios 请求客户端，仅由 Session 内部使用 */
  private readonly http: AxiosInstance

  private readonly cookieJar = new CookieJar()
  /** Cookie 被整体替换的次数 */
  private cookieGeneration = 0
  /** 当前登录会话是否已经通知失效 */
  private loginExpiredNotified = true
  /** 请求发起时对应的 Cookie 代次 */
  private readonly requestCookieGenerations = new WeakMap<object, number>()
  private readonly twoFactorRetriedConfigs = new WeakSet<object>()
  private readonly responseHandlers = new Set<V2exResponseHandler>()

  constructor(
    initialCookie = '',
    private readonly options: V2exSessionOptions = {}
  ) {
    this.http = axios.create({
      baseURL: this.baseUrl,
      headers: V2EX_REQUEST_HEADERS,
      timeout: V2EX_REQUEST_TIMEOUT,
      beforeRedirect: (redirectOptions, responseDetails, requestDetails) =>
        this.handleBeforeRedirect(
          redirectOptions.href,
          redirectOptions.headers,
          responseDetails.headers,
          requestDetails.url,
          requestDetails.headers
        )
    })
    this.setCookie(initialCookie)
    this.setupInterceptors()
  }

  /** 获取当前会话 Cookie */
  getCookie(url = this.baseUrl): string {
    return this.cookieJar.getCookieStringSync(url)
  }

  /** 获取可持久化的登录 Cookie */
  getLoginCookie(url = this.baseUrl): string {
    return normalizeLoginCookie(this.getCookie(url))
  }

  /** 替换当前会话 Cookie */
  setCookie(cookie: string): void {
    this.cookieGeneration += 1
    this.loginExpiredNotified = !cookie
    this.cookieJar.removeAllCookiesSync()
    if (cookie) this.writeCookie(cookie, this.baseUrl)
  }

  /** 发送自定义 V2EX 请求 */
  request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.http.request<T>(config)
  }

  /** 发送 GET 请求 */
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.http.get<T>(url, config)
  }

  /** 发送 POST 请求 */
  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.http.post<T>(url, data, config)
  }

  /** 监听已通过会话检查的响应 */
  onResponse(handler: V2exResponseHandler): { dispose: () => void } {
    this.responseHandlers.add(handler)
    return { dispose: () => this.responseHandlers.delete(handler) }
  }

  /** 注册统一请求、响应和失败处理 */
  private setupInterceptors(): void {
    this.http.interceptors.request.use(config => this.attachCookieToRequest(config))
    this.http.interceptors.response.use(response => this.handleResponse(response))
    if (this.options.onHttpFailure) {
      installHttpFailureLogging(this.http, this.options.onHttpFailure)
    }
  }

  /** 处理自动重定向中的 Cookie */
  private handleBeforeRedirect(
    redirectHref: string,
    redirectHeaders: Record<string, unknown>,
    headers: Record<string, unknown>,
    responseUrl: string,
    requestHeaders: Record<string, unknown>
  ): void {
    const requestCookie = getHeader(requestHeaders, 'cookie') || ''
    if (normalizeLoginCookie(requestCookie) !== this.getLoginCookie(responseUrl)) {
      removeCookieHeader(redirectHeaders)
      return
    }

    this.updateCookieFromHeaders(headers, responseUrl)
    const redirectUrl = new URL(redirectHref)
    removeCookieHeader(redirectHeaders)
    if (isV2exUrl(redirectUrl)) {
      redirectHeaders.Cookie = this.getCookie(redirectUrl.toString())
    }
  }

  /** 为 V2EX 请求附加 Cookie */
  private attachCookieToRequest(config: AxiosResponse['config']): AxiosResponse['config'] {
    this.requestCookieGenerations.set(config, this.cookieGeneration)
    const requestUrl = getConfigUrl(config, this.baseUrl)
    if (!isV2exUrl(requestUrl)) return config
    config.headers = config.headers || {}
    if (!findCookieHeaderName(config.headers)) {
      config.headers.Cookie = this.getCookie(requestUrl.toString())
    }
    return config
  }

  /** 统一处理 V2EX 响应 */
  private async handleResponse(response: AxiosResponse): Promise<AxiosResponse> {
    if (!this.isCurrentRequest(response.config)) return response
    this.updateCookieFromResponse(response)
    const twoFactorResponse = await this.handleTwoFactorResponse(response)
    if (twoFactorResponse !== response) return twoFactorResponse
    if (!this.isCurrentRequest(response.config)) return response
    this.checkRedirectFromResponse(response)
    this.responseHandlers.forEach(handler => handler(response))
    return response
  }

  /** 判断响应是否属于当前 Cookie 会话 */
  private isCurrentRequest(config: AxiosResponse['config']): boolean {
    return this.requestCookieGenerations.get(config) === this.cookieGeneration
  }

  /** 写入 Cookie 或 Set-Cookie 字符串 */
  private writeCookie(cookie: string, url: string): void {
    if (!cookie.includes(';')) {
      this.cookieJar.setCookieSync(cookie, url)
      return
    }
    Object.entries(parseCookieHeader(cookie)).forEach(([name, value]) => {
      this.cookieJar.setCookieSync(`${name}=${value}`, url)
    })
  }

  /** 从响应更新 Cookie */
  private updateCookieFromResponse(response: AxiosResponse): void {
    this.updateCookieFromHeaders(response.headers, getResponseUrl(response, this.baseUrl))
  }

  /** 从响应头更新 Cookie */
  private updateCookieFromHeaders(headers: Record<string, unknown>, responseUrl: string): void {
    if (!isV2exUrl(new URL(responseUrl))) return
    const setCookie = headers['set-cookie']
    if (!setCookie) return
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie]
    cookies.forEach(cookie => {
      if (typeof cookie === 'string') this.cookieJar.setCookieSync(cookie, responseUrl)
    })
  }

  /** 处理两步验证响应并重试原请求 */
  private async handleTwoFactorResponse(response: AxiosResponse): Promise<AxiosResponse> {
    if (!this.isTwoFactorResponse(response)) return response
    const config = response.config
    if (this.twoFactorRetriedConfigs.has(config)) {
      throw new TwoFactorRequiredError('需要输入 V2EX 两步验证码')
    }
    this.twoFactorRetriedConfigs.add(config)
    if (!(await this.options.onTwoFactorRequired?.())) {
      throw new TwoFactorRequiredError('需要输入 V2EX 两步验证码')
    }
    this.refreshConfigCookie(config)
    return this.http.request(config)
  }

  /** 刷新重试请求配置中的 Cookie */
  private refreshConfigCookie(config: AxiosResponse['config']): void {
    const requestUrl = getConfigUrl(config, this.baseUrl)
    if (!isV2exUrl(requestUrl)) return
    config.headers = config.headers || {}
    const cookieHeaderName = findCookieHeaderName(config.headers) || 'Cookie'
    config.headers[cookieHeaderName] = this.getCookie(requestUrl.toString())
  }

  /** 判断响应是否要求两步验证 */
  private isTwoFactorResponse(response: AxiosResponse): boolean {
    const requestUrl = getConfigUrl(response.config, this.baseUrl)
    if (!isV2exUrl(requestUrl)) return false
    const location = getHeader(response.headers, 'location')
    if (location && response.status >= 300 && response.status < 400) {
      return isV2exPath(new URL(location, requestUrl), '/2fa')
    }
    if (!hasFollowedRedirect(response)) return false
    return isV2exPath(new URL(getResponseUrl(response, this.baseUrl)), '/2fa')
  }

  /** 检查受保护页面的异常重定向 */
  private checkRedirectFromResponse(response: AxiosResponse): void {
    const requestUrl = getConfigUrl(response.config, this.baseUrl)
    if (!isV2exUrl(requestUrl) || !hasFollowedRedirect(response)) return
    const responseUrl = new URL(getResponseUrl(response, this.baseUrl))
    if (isV2exPath(responseUrl, '/2fa')) {
      throw new TwoFactorRequiredError('需要输入 V2EX 两步验证码')
    }
    if (!isRedirectCheckPath(requestUrl.pathname)) return
    if (isV2exUrl(responseUrl) && responseUrl.pathname === requestUrl.pathname) return

    if (response.request.path.indexOf('/signin') >= 0) {
      this.notifyLoginExpired()
      throw new LoginRequiredError('你要查看的页面需要先登录')
    }
    if (response.request.path === '/') {
      if (this.getCookie()) throw new Error('您无权访问此页面')
      throw new LoginRequiredError('你要查看的页面需要先登录')
    }
    if (response.request.path.indexOf('/restricted') === 0) {
      throw new AccountRestrictedError(
        '访问受限，详情请查看 <a href="https://www.v2ex.com/restricted">https://www.v2ex.com/restricted</a>'
      )
    }
    throw new Error('未知错误')
  }

  /** 清空会话并通知登录失效 */
  private notifyLoginExpired(): void {
    if (this.loginExpiredNotified) return
    this.loginExpiredNotified = true
    this.setCookie('')
    void this.options.onLoginExpired?.()
  }
}
