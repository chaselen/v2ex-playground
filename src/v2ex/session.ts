import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { parseCookie } from 'cookie'
import picomatch from 'picomatch'
import { CookieJar, MemoryCookieStore, type Cookie } from 'tough-cookie'
import { installHttpFailureLogging, type HttpFailureHandler } from '@/core/httpFailureLogging'
import { loginCookieName, normalizeLoginCookie, twoFactorCookieName } from './cookie'
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
  type LoginExpiredHandler
} from './types'

/** V2EX 服务地址 */
export const V2EX_BASE_URL = 'https://www.v2ex.com'

/** V2EX 登录 Cookie 的服务端作用域 */
const V2EX_LOGIN_COOKIE_SCOPE = 'Domain=.v2ex.com; Path=/'

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

/** 随 Axios 配置合并保留的两步验证重试标记 */
type TwoFactorRequestConfig = AxiosResponse['config'] & { v2exTwoFactorRetried?: boolean }

/** V2EX 会话配置 */
export interface V2exSessionOptions {
  onLoginExpired?: LoginExpiredHandler
  onTwoFactorRequired?: () => boolean | Promise<boolean>
  /** 两步验证完成且原请求重试成功 */
  onTwoFactorVerified?: () => void | Promise<void>
  onHttpFailure?: HttpFailureHandler
}

/** V2EX 响应监听器 */
export type V2exResponseHandler = (response: AxiosResponse) => void

/** 负责 V2EX HTTP、Cookie、重定向与两步验证的会话 */
export class V2exSession {
  readonly baseUrl = V2EX_BASE_URL
  /** Axios 请求客户端，仅由 Session 内部使用 */
  private readonly http: AxiosInstance

  private readonly cookieStore = new MemoryCookieStore()
  private readonly cookieJar = new CookieJar(this.cookieStore)
  /** 当前登录会话是否已经通知失效 */
  private loginExpiredNotified = true
  /** 登录失效后的清理是否已完成；失败时允许重新清理 */
  private loginExpirationCompleted = true
  /** 当前登录失效清理任务 */
  private loginExpirationTask?: Promise<void>
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
          requestDetails.url
        )
    })
    this.setCookie(initialCookie)
    this.setupInterceptors()
  }

  /** 获取当前会话的最新 once；提交前调用，不缓存令牌 */
  async getOnce(): Promise<string> {
    const { data } = await this.get<string>('/poll_once', { responseType: 'text' })
    return data.trim()
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
    this.loginExpiredNotified = !cookie
    this.loginExpirationCompleted = !cookie
    this.loginExpirationTask = undefined
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

  /** 监听 V2EX 响应 */
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
    responseUrl: string
  ): void {
    this.updateCookieFromHeaders(headers, responseUrl)
    const redirectUrl = new URL(redirectHref)
    removeCookieHeader(redirectHeaders)
    if (isV2exUrl(redirectUrl)) {
      redirectHeaders.Cookie = this.getCookie(redirectUrl.toString())
    }
  }

  /** 为 V2EX 请求附加 Cookie */
  private attachCookieToRequest(config: AxiosResponse['config']): AxiosResponse['config'] {
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
    if (!isV2exUrl(getConfigUrl(response.config, this.baseUrl))) return response
    this.updateCookieFromResponse(response)
    const twoFactorResponse = await this.handleTwoFactorResponse(response)
    if (twoFactorResponse !== response) return twoFactorResponse
    await this.checkRedirectFromResponse(response)
    this.responseHandlers.forEach(handler => handler(response))
    return response
  }

  /** 写入 Cookie 或 Set-Cookie 字符串 */
  private writeCookie(cookie: string, url: string): void {
    Object.entries(parseCookie(cookie, { decode: value => value })).forEach(([name, value]) => {
      if (value === undefined) return
      this.cookieJar.setCookieSync(`${name}=${value}; ${V2EX_LOGIN_COOKIE_SCOPE}`, url)
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
      if (typeof cookie !== 'string') return
      const written = this.cookieJar.setCookieSync(cookie, responseUrl)
      if (written && (written.key === loginCookieName || written.key === twoFactorCookieName)) {
        this.removeConflictingLoginCookies(written)
      }
    })
  }

  /** 保留服务端本次写入的认证 Cookie，删除其他域或路径中的同名旧值 */
  private removeConflictingLoginCookies(written: Cookie): void {
    // MemoryCookieStore 的回调同步执行，合并完成后请求头只包含一个认证值
    this.cookieStore.getAllCookies((error, cookies) => {
      if (error) throw error
      for (const cookie of cookies || []) {
        if (
          cookie.key !== written.key ||
          (cookie.domain === written.domain && cookie.path === written.path)
        )
          continue
        this.cookieStore.removeCookie(cookie.domain!, cookie.path!, cookie.key, error => {
          if (error) throw error
        })
      }
    })
  }

  /** 处理两步验证响应并重试原请求 */
  private async handleTwoFactorResponse(response: AxiosResponse): Promise<AxiosResponse> {
    if (!this.isTwoFactorResponse(response)) return response
    const config: TwoFactorRequestConfig = response.config
    if (config.v2exTwoFactorRetried) {
      throw new TwoFactorRequiredError('需要输入 V2EX 两步验证码')
    }
    config.v2exTwoFactorRetried = true
    if (!(await this.options.onTwoFactorRequired?.())) {
      throw new TwoFactorRequiredError('需要输入 V2EX 两步验证码')
    }
    this.refreshConfigCookie(config)
    const retriedResponse = await this.http.request(config)
    await this.options.onTwoFactorVerified?.()
    return retriedResponse
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
    if (!isV2exUrl(requestUrl) || requestUrl.pathname === '/2fa') return false
    const location = getHeader(response.headers, 'location')
    if (location && response.status >= 300 && response.status < 400) {
      return isV2exPath(new URL(location, requestUrl), '/2fa')
    }
    if (!hasFollowedRedirect(response)) return false
    return isV2exPath(new URL(getResponseUrl(response, this.baseUrl)), '/2fa')
  }

  /** 检查受保护页面的异常重定向 */
  private async checkRedirectFromResponse(response: AxiosResponse): Promise<void> {
    const requestUrl = getConfigUrl(response.config, this.baseUrl)
    if (!isV2exUrl(requestUrl)) return
    const location = getHeader(response.headers, 'location')
    const explicitRedirect = location && response.status >= 300 && response.status < 400
    if (!explicitRedirect && !hasFollowedRedirect(response)) return
    const responseUrl = explicitRedirect
      ? new URL(location, requestUrl)
      : new URL(getResponseUrl(response, this.baseUrl))
    if (isV2exPath(responseUrl, '/2fa') && requestUrl.pathname !== '/2fa') {
      throw new TwoFactorRequiredError('需要输入 V2EX 两步验证码')
    }
    if (isV2exPath(responseUrl, '/signin') && requestUrl.pathname !== '/signin') {
      // 清理失败仍按登录失效结束请求，凭据清理由客户端继续重试
      await this.expireLogin().catch(() => undefined)
      throw new LoginRequiredError(
        requestUrl.pathname === '/write' ? '创作新主题需要先登录' : '你要查看的页面需要先登录'
      )
    }
    if (isV2exPath(responseUrl, '/restricted') && requestUrl.pathname !== '/restricted') {
      throw new AccountRestrictedError(
        '访问受限，详情请查看 <a href="https://www.v2ex.com/restricted">https://www.v2ex.com/restricted</a>'
      )
    }
    if (explicitRedirect || !isRedirectCheckPath(requestUrl.pathname)) return
    if (isV2exUrl(responseUrl) && responseUrl.pathname === requestUrl.pathname) return
    if (isV2exPath(responseUrl, '/')) {
      if (this.getLoginCookie()) throw new Error('您无权访问此页面')
      throw new LoginRequiredError('你要查看的页面需要先登录')
    }
    throw new Error('未知错误')
  }

  /** 清空失效会话；并发清理共用任务，失败后允许重试 */
  async expireLogin(): Promise<void> {
    if (this.loginExpirationTask) {
      await this.loginExpirationTask
      return
    }
    if (this.loginExpirationCompleted) return
    if (!this.loginExpiredNotified) {
      this.setCookie('')
      this.loginExpirationCompleted = false
    }
    let task: Promise<void>
    try {
      task = Promise.resolve(this.options.onLoginExpired?.())
    } catch (error) {
      task = Promise.reject(error)
    }
    this.loginExpirationTask = task
    try {
      await task
      if (this.loginExpirationTask === task) this.loginExpirationCompleted = true
    } finally {
      if (this.loginExpirationTask === task) {
        this.loginExpirationTask = undefined
      }
    }
  }
}
