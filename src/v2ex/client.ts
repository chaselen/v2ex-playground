import * as cheerio from 'cheerio/slim'
import axios, { AxiosResponse } from 'axios'
import { parse as parseCookieHeader } from 'cookie'
import dayjs from 'dayjs'
import picomatch from 'picomatch'
import { CookieJar } from 'tough-cookie'
import { normalizeLoginCookie } from './cookie'
import { isSameAccountOverview, parseAccountOverview, parseOnlineCount } from './parsers/account'
import { parseBalance } from './parsers/balance'
import { parsePagerTotalPage } from './parsers/common'
import { parseMemberContent, parseMemberInfo } from './parsers/member'
import {
  parseReplies,
  parseTopicIdByLink,
  parseTopicListCells,
  parseTopicMeta
} from './parsers/topic'
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
  Topic,
  Node,
  DailySignInResult,
  LoginExpiredHandler,
  LoginRequiredError,
  TwoFactorRequiredHandler,
  TwoFactorRequiredError,
  AccountOverviewChangedHandler,
  ThankResponse,
  TopicDetail,
  SoV2exSearchParams,
  SoV2exSearchResult,
  AccountOverview,
  BalanceDetail,
  V2exNotification,
  MemberContent,
  MemberContentOptions,
  MemberContentTabKey,
  MemberInfo,
  NodeTopicList,
  OnlineCountChangedHandler
} from './types'

/** V2EX 请求超时时间 */
const v2exRequestTimeout = 15000

/** V2EX 公共请求头 */
const v2exRequestHeaders = {
  // 需要用一个合法的UA，否则访问某些页面会出错
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-CN,zh;q=0.9'
}

/** 用户页内容标签 */
const memberContentTabs = new Set<MemberContentTabKey>([
  'topics',
  'replies',
  'qna',
  'tech',
  'play',
  'jobs',
  'deals',
  'city'
])

/** 会返回账户概览的 V2EX 页面路径 */
const accountOverviewPathPatterns = [
  '/',
  '/go/*',
  '/my/following',
  '/my/nodes',
  '/my/topics',
  '/balance',
  '/notifications',
  '/t/*',
  '/planes',
  '/mission/daily',
  '/mission/daily/*'
]

/** 账户概览页面路径匹配器 */
const isAccountOverviewPath = picomatch(accountOverviewPathPatterns)

/** 需要检查自动重定向的 V2EX 页面路径 */
const redirectCheckPathPatterns = ['/balance', '/go/*', '/t/*']

/** 自动重定向检查页面路径匹配器 */
const isRedirectCheckPath = picomatch(redirectCheckPathPatterns)

export class V2exClient {
  /** 域名 */
  readonly baseUrl = 'https://www.v2ex.com'

  /** V2EX Cookie 存储 */
  private readonly cookieJar = new CookieJar()

  /** 缓存的账户概览 */
  private accountOverview?: AccountOverview

  /** 缓存的在线人数 */
  private onlineCount?: number

  /** 账户概览变化监听器 */
  private readonly accountOverviewChangedHandlers = new Set<AccountOverviewChangedHandler>()

  /** 在线人数变化监听器 */
  private readonly onlineCountChangedHandlers = new Set<OnlineCountChangedHandler>()

  /** 已重试过两步验证的请求 */
  private readonly twoFactorRetriedConfigs = new WeakSet<object>()

  /** v2ex 请求客户端 */
  private readonly http = axios.create({
    baseURL: this.baseUrl,
    headers: v2exRequestHeaders,
    timeout: v2exRequestTimeout,
    beforeRedirect: (options, responseDetails, requestDetails) =>
      this.handleBeforeRedirect(
        options.href,
        options.headers,
        responseDetails.headers,
        requestDetails.url
      )
  })

  /**
   * @param initialCookie 初始 V2EX Cookie
   * @param onLoginExpired 登录失效回调
   * @param onTwoFactorRequired 两步验证回调
   */
  constructor(
    initialCookie?: string,
    private readonly onLoginExpired?: LoginExpiredHandler,
    private readonly onTwoFactorRequired?: TwoFactorRequiredHandler
  ) {
    this.setCookie(initialCookie || '')
    this.setupInterceptors()
  }

  /**
   * 注册请求与响应拦截器
   */
  private setupInterceptors(): void {
    this.http.interceptors.request.use(config => this.attachCookieToRequest(config))
    this.http.interceptors.response.use(response => this.handleResponse(response))
  }

  /**
   * 处理 HTTP 自动重定向
   * @param redirectHref 下一跳链接
   * @param redirectHeaders 下一跳请求头
   * @param headers 中间响应头
   * @param responseUrl 中间响应链接
   */
  private handleBeforeRedirect(
    redirectHref: string,
    redirectHeaders: Record<string, unknown>,
    headers: Record<string, unknown>,
    responseUrl: string
  ): void {
    // 自动重定向的中间响应不会进入 Axios 响应拦截器，需要在下一跳前同步 Cookie
    this.updateCookieFromHeaders(headers, responseUrl)

    const redirectUrl = new URL(redirectHref)
    removeCookieHeader(redirectHeaders)
    if (isV2exUrl(redirectUrl)) {
      redirectHeaders.Cookie = this.getCookie(redirectUrl.toString())
    }
  }

  /**
   * 为 V2EX 请求附加 Cookie
   * @param config 请求配置
   */
  private attachCookieToRequest(config: AxiosResponse['config']): AxiosResponse['config'] {
    const reqUrl = getConfigUrl(config, this.baseUrl)
    if (!isV2exUrl(reqUrl)) {
      return config
    }

    config.headers = config.headers || {}
    if (findCookieHeaderName(config.headers)) {
      return config
    }

    config.headers.Cookie = this.getCookie(reqUrl.toString())
    return config
  }

  /**
   * 处理 V2EX 响应
   * @param response HTTP 响应
   */
  private async handleResponse(response: AxiosResponse): Promise<AxiosResponse> {
    this.updateCookieFromResponse(response)
    const twoFactorResponse = await this.handleTwoFactorResponse(response)
    if (twoFactorResponse !== response) {
      return twoFactorResponse
    }

    this.checkRedirectFromResponse(response)
    this.updateAccountOverviewFromResponse(response)
    this.updateOnlineCountFromResponse(response)
    return response
  }

  /**
   * 获取当前 V2EX Cookie
   * @param url 目标链接
   */
  getCookie(url = this.baseUrl): string {
    return this.cookieJar.getCookieStringSync(url)
  }

  /**
   * 获取可持久化的登录 Cookie
   *
   * 运行时 CookieJar 还包含服务端下发的内部 Cookie，持久化时只保留 A2/A2O
   * @param url 目标链接
   */
  getLoginCookie(url = this.baseUrl): string {
    return normalizeLoginCookie(this.getCookie(url))
  }

  /**
   * 设置当前 V2EX Cookie
   * @param cookie Cookie 字符串
   */
  setCookie(cookie: string): void {
    this.cookieJar.removeAllCookiesSync()
    this.accountOverview = undefined
    this.onlineCount = undefined
    if (!cookie) {
      return
    }
    this.writeCookie(cookie, this.baseUrl)
  }

  /**
   * 监听账户概览变化
   * @param handler 账户概览变化回调
   */
  onAccountOverviewChanged(handler: AccountOverviewChangedHandler): { dispose: () => void } {
    this.accountOverviewChangedHandlers.add(handler)
    return {
      dispose: () => this.accountOverviewChangedHandlers.delete(handler)
    }
  }

  /**
   * 监听在线人数变化
   * @param handler 在线人数变化回调
   */
  onOnlineCountChanged(handler: OnlineCountChangedHandler): { dispose: () => void } {
    this.onlineCountChangedHandlers.add(handler)
    return {
      dispose: () => this.onlineCountChangedHandlers.delete(handler)
    }
  }

  /**
   * 写入 Cookie 字符串
   * @param cookie Cookie 或 Set-Cookie 字符串
   * @param url Cookie 所属链接
   */
  private writeCookie(cookie: string, url: string): void {
    if (!cookie.includes(';')) {
      this.cookieJar.setCookieSync(cookie, url)
      return
    }

    const parsedCookie = parseCookieHeader(cookie)
    Object.entries(parsedCookie).forEach(([name, value]) => {
      this.cookieJar.setCookieSync(`${name}=${value}`, url)
    })
  }

  /**
   * 从响应头更新 Cookie
   * @param response HTTP 响应
   */
  private updateCookieFromResponse(response: AxiosResponse): void {
    const responseUrl = getResponseUrl(response, this.baseUrl)
    this.updateCookieFromHeaders(response.headers, responseUrl)
  }

  /**
   * 从响应头更新 Cookie
   * @param headers 响应头
   * @param responseUrl 响应链接
   */
  private updateCookieFromHeaders(headers: Record<string, unknown>, responseUrl: string): void {
    if (!isV2exUrl(new URL(responseUrl))) {
      return
    }

    const setCookie = headers['set-cookie']
    if (!setCookie) {
      return
    }

    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie]
    cookies.forEach(cookie => {
      if (typeof cookie === 'string') {
        this.cookieJar.setCookieSync(cookie, responseUrl)
      }
    })
  }

  /**
   * 处理两步验证响应
   * @param response HTTP 响应
   */
  private async handleTwoFactorResponse(response: AxiosResponse): Promise<AxiosResponse> {
    if (!this.isTwoFactorResponse(response)) {
      return response
    }

    const config = response.config
    if (this.twoFactorRetriedConfigs.has(config)) {
      throw new TwoFactorRequiredError('需要输入 V2EX 两步验证码')
    }

    this.twoFactorRetriedConfigs.add(config)
    const verified = await this.onTwoFactorRequired?.()
    if (!verified) {
      throw new TwoFactorRequiredError('需要输入 V2EX 两步验证码')
    }

    this.refreshConfigCookie(config)
    return this.http.request(config)
  }

  /**
   * 刷新请求配置中的 Cookie
   * @param config 请求配置
   */
  private refreshConfigCookie(config: AxiosResponse['config']): void {
    const reqUrl = getConfigUrl(config, this.baseUrl)
    if (!isV2exUrl(reqUrl)) {
      return
    }

    config.headers = config.headers || {}
    const cookieHeaderName = findCookieHeaderName(config.headers) || 'Cookie'
    config.headers[cookieHeaderName] = this.getCookie(reqUrl.toString())
  }

  /**
   * 判断响应是否要求两步验证
   * @param response HTTP 响应
   */
  private isTwoFactorResponse(response: AxiosResponse): boolean {
    const requestUrl = getConfigUrl(response.config, this.baseUrl)
    if (!isV2exUrl(requestUrl)) {
      return false
    }

    const location = getHeader(response.headers, 'location')
    if (location && response.status >= 300 && response.status < 400) {
      const redirectUrl = new URL(location, requestUrl)
      return isV2exPath(redirectUrl, '/2fa')
    }

    if (!hasFollowedRedirect(response)) {
      return false
    }

    const responseUrl = new URL(getResponseUrl(response, this.baseUrl))
    return isV2exPath(responseUrl, '/2fa')
  }

  /**
   * 检查指定页面响应是否被自动重定向
   *
   * 部分帖子需要登录查看
   * 第1种：会重定向到登录页（https://www.v2ex.com/signin?next=/t/xxxxxx），并提示：你要查看的页面需要先登录。如交易区：https://www.v2ex.com/t/704753
   * 第2种：会重定向到首页，无提示。如：https://www.v2ex.com/t/704716
   * 第3种：账号访问受限（如新用户），会重定向到 https://www.v2ex.com/restricted
   * @param response HTTP 响应
   */
  private checkRedirectFromResponse(response: AxiosResponse): void {
    const requestUrl = getConfigUrl(response.config, this.baseUrl)
    if (!isV2exUrl(requestUrl)) {
      return
    }
    if (!hasFollowedRedirect(response)) {
      return
    }

    const responseUrl = new URL(getResponseUrl(response, this.baseUrl))
    if (isV2exPath(responseUrl, '/2fa')) {
      throw new TwoFactorRequiredError('需要输入 V2EX 两步验证码')
    }

    if (!isRedirectCheckPath(requestUrl.pathname)) {
      return
    }

    // 服务端可能仅为原页面补充分页等查询参数，此类重定向仍视为正常响应。
    // 例：https://www.v2ex.com/go/in -> https://www.v2ex.com/go/in?p=1
    if (isV2exUrl(responseUrl) && responseUrl.pathname === requestUrl.pathname) {
      return
    }

    if (response.request.path.indexOf('/signin') >= 0) {
      this.notifyLoginExpired()
      throw new LoginRequiredError('你要查看的页面需要先登录')
    }
    if (response.request.path === '/') {
      if (this.getCookie()) {
        throw new Error('您无权访问此页面')
      }
      throw new LoginRequiredError('你要查看的页面需要先登录')
    }
    if (response.request.path.indexOf('/restricted') === 0) {
      throw new AccountRestrictedError(
        '访问受限，详情请查看 <a href="https://www.v2ex.com/restricted">https://www.v2ex.com/restricted</a>'
      )
    }
    throw new Error('未知错误')
  }

  /**
   * 从指定页面响应更新账户概览缓存
   * @param response HTTP 响应
   */
  private updateAccountOverviewFromResponse(response: AxiosResponse): void {
    if (typeof response.data !== 'string') {
      return
    }

    const requestUrl = getConfigUrl(response.config, this.baseUrl)
    if (!isV2exUrl(requestUrl)) {
      return
    }
    if (!isAccountOverviewPath(requestUrl.pathname)) {
      return
    }

    this.updateAccountOverviewFromHtml(cheerio.load(response.data))
  }

  /**
   * 从 HTML 响应更新在线人数缓存
   * @param response HTTP 响应
   */
  private updateOnlineCountFromResponse(response: AxiosResponse): void {
    if (typeof response.data !== 'string') {
      return
    }

    const requestUrl = getConfigUrl(response.config, this.baseUrl)
    if (!isV2exUrl(requestUrl)) {
      return
    }

    this.updateOnlineCountFromHtml(cheerio.load(response.data))
  }

  /**
   * 通知登录失效
   */
  private notifyLoginExpired(): void {
    this.setCookie('')
    void this.onLoginExpired?.()
  }

  /**
   * 获取我的主题列表
   * @param path 列表路径
   * @param page 页码
   */
  private async getMyTopicList(
    path: '/my/topics' | '/my/following',
    page: number
  ): Promise<{ totalPage: number; list: Topic[] }> {
    const res = await this.http.get<string>(`${path}?p=${page}`)

    const $ = cheerio.load(res.data)
    const cells = $('#Main > .box').last().children('.cell.item')

    return {
      totalPage: parsePagerTotalPage($),
      list: parseTopicListCells($, cells)
    }
  }

  /**
   * 归一化用户页标签
   * @param tab 标签
   */
  private normalizeMemberContentTab(tab?: MemberContentTabKey): MemberContentTabKey {
    if (tab && memberContentTabs.has(tab)) {
      return tab
    }

    return 'topics'
  }

  /**
   * 获取用户页请求路径
   * @param username 用户名
   * @param tab 标签
   * @param page 页码
   */
  private getMemberContentPath(username: string, tab: MemberContentTabKey, page: number): string {
    if (tab === 'topics') {
      return `/member/${username}/topics?p=${page}`
    }

    if (tab === 'replies') {
      return `/member/${username}/replies?p=${page}`
    }

    return `/member/${username}/${tab}?p=${page}`
  }

  /**
   * 根据话题 id 获取话题链接
   * @param topicId 话题 id
   * @example "703733" -> "https://www.v2ex.com/t/703733"
   */
  getTopicLinkById(topicId: string | number) {
    return `${this.baseUrl}/t/${topicId}`
  }

  /**
   * 获取 once 参数
   * @returns once 参数
   */
  async getOnce(): Promise<string> {
    const { data } = await this.http.get<string>('/poll_once', {
      responseType: 'text'
    })
    return data.trim()
  }

  /**
   * 从链接中提取主题id
   * @param topicLink 主题链接
   * @example "/t/1136705#reply50" -> 1136705
   * @example "https://www.v2ex.com/t/703733#reply12" -> 703733
   * @returns 主题id
   */
  getTopicIdByLink(topicLink: string): number | undefined {
    return parseTopicIdByLink(topicLink)
  }

  /**
   * 根据用户名获取用户主页链接
   * @param username 用户名
   */
  getMemberLink(username: string) {
    return `${this.baseUrl}/member/${username}`
  }

  /**
   * 获取用户基本信息
   * @param username 用户名
   */
  async getMemberInfo(username: string): Promise<MemberInfo> {
    const homeRes = await this.http.get<string>(`/member/${username}`)

    const home$ = cheerio.load(homeRes.data)

    return parseMemberInfo(home$, username)
  }

  /**
   * 获取用户活动内容
   * @param username 用户名
   * @param options 获取选项
   */
  async getMemberContent(
    username: string,
    options: MemberContentOptions = {}
  ): Promise<MemberContent> {
    const tab = this.normalizeMemberContentTab(options.tab)
    const page = this.normalizePage(options.page)
    const res = await this.http.get<string>(this.getMemberContentPath(username, tab, page))

    const $ = cheerio.load(res.data)

    return parseMemberContent($, username, tab, page)
  }

  /**
   * 根据标签获取话题列表
   * @param tab 标签
   */
  async getTopicListByTab(tab: string): Promise<Topic[]> {
    const { data: html } = await this.http.get(`/?tab=${tab}`)
    const $ = cheerio.load(html)
    const cells = $('#Main > .box').eq(0).children('.cell.item')

    return parseTopicListCells($, cells)
  }

  /**
   * 根据节点获取话题列表
   * @param nodeName 节点 name
   * @param page 页码
   * @example https://www.v2ex.com/go/python?p=2
   */
  async getTopicListByNode(nodeName: string, page = 1): Promise<NodeTopicList> {
    const { data: html } = await this.http.get(`/go/${nodeName}?p=${page}`)
    const $ = cheerio.load(html)
    const node = this.parseNodePageInfo($, nodeName)
    const cells = $('#TopicsNode .cell[class*="t_"]')

    return {
      node,
      totalPage: parsePagerTotalPage($),
      totalCount: this.parseNodeTopicTotalCount($),
      list: parseTopicListCells($, cells, node)
    }
  }

  /**
   * 解析节点页面信息
   * @param $ cheerio 实例
   * @param nodeName 节点 name
   */
  private parseNodePageInfo($: cheerio.CheerioAPI, nodeName: string): Node {
    const header = $('.node-header').first()
    const avatar = header.find('.page-content-header > img').first().attr('src')
    const description = header.find('.intro').first().text().trim()

    return {
      name: nodeName,
      title: header.find('.node-breadcrumb').first().text().split('›').pop()?.trim() || nodeName,
      avatar: avatar ? new URL(avatar, this.baseUrl).toString() : undefined,
      description: description || undefined
    }
  }

  /**
   * 解析节点主题总数
   * @param $ cheerio 实例
   */
  private parseNodeTopicTotalCount($: cheerio.CheerioAPI): number {
    const text = $('.node-header .topic-count strong').first().text().trim()
    return Number(text.replace(/,/g, '')) || 0
  }

  /**
   * 获取我收藏的主题
   * @param page 页码
   * @example https://www.v2ex.com/my/topics?p=2
   */
  async getCollectionTopics(page = 1): Promise<{ totalPage: number; list: Topic[] }> {
    return this.getMyTopicList('/my/topics', page)
  }

  /**
   * 获取特别关注的主题
   * @param page 页码
   * @example https://www.v2ex.com/my/following?p=2
   */
  async getSpecialFollowingTopics(page = 1): Promise<{ totalPage: number; list: Topic[] }> {
    return this.getMyTopicList('/my/following', page)
  }

  /**
   * 获取提醒消息列表
   * @param page 页码
   * @example https://www.v2ex.com/notifications?p=2
   */
  async getNotifications(
    page = 1
  ): Promise<{ totalPage: number; totalCount: number; list: V2exNotification[] }> {
    const res = await this.http.get<string>(`/notifications?p=${page}`)

    const $ = cheerio.load(res.data)
    const totalCount = Number($('.header .fr strong.gray').first().text().trim() || 0)
    const list: V2exNotification[] = []

    $('#notifications > .cell[id^="n_"]').each((_, element) => {
      const cell = $(element)
      const avatar = cell.find('img.avatar').first()
      const member = cell.find('a[href^="/member/"]').first()
      const summary = cell.find('span.fade').first()
      const topic = summary.find('a.topic-link').first()
      const topicPath = topic.attr('href') || ''
      const topicId = topicPath ? parseTopicIdByLink(topicPath) : undefined
      const id = Number((cell.attr('id') || '').replace(/^n_/, '')) || 0

      if (!id) {
        return
      }

      list.push({
        id,
        avatar: avatar.attr('src') || '',
        username: member.text().trim() || avatar.attr('alt') || '',
        memberPath: member.attr('href') || '',
        summaryHtml: summary.html()?.trim() || '',
        topicId,
        topicTitle: topic.text().trim() || undefined,
        topicPath: topicPath || undefined,
        time: cell.find('span.snow').first().text().trim(),
        payloadHtml: cell.find('.payload').first().html()?.trim() || ''
      })
    })

    return {
      totalPage: parsePagerTotalPage($),
      totalCount,
      list
    }
  }

  /**
   * 获取话题详情内容
   * @param topicId 话题id
   * @param page 回复页码
   */
  async getTopicDetail(topicId: number, page = 1): Promise<TopicDetail> {
    const replyPage = this.normalizePage(page)
    const res = await this.http.get<string>(`/t/${topicId}?p=${replyPage}`)

    const $ = cheerio.load(res.data)
    const topic = parseTopicMeta($, topicId, this.baseUrl)
    topic.replies = parseReplies($)
    topic.replyTotalPage = parsePagerTotalPage($)
    topic.replyCurrentPage = Math.min(replyPage, topic.replyTotalPage)

    return topic
  }

  /**
   * 获取账户概览
   *
   * 包含未读提醒数量和账户余额
   * @param options 获取选项
   */
  async getAccountOverview(options: { force?: boolean } = {}): Promise<AccountOverview> {
    if (!options.force && this.accountOverview) {
      return this.accountOverview
    }

    await this.http.get<string>('/')
    return this.accountOverview || this.createEmptyAccountOverview()
  }

  /**
   * 获取在线人数
   * @param options 获取选项
   */
  async getOnlineCount(options: { force?: boolean } = {}): Promise<number | undefined> {
    if (!options.force && this.onlineCount !== undefined) {
      return this.onlineCount
    }

    await this.http.get<string>('/')
    return this.onlineCount
  }

  /**
   * 获取账户余额详情
   * @param page 页码
   */
  async getBalance(page = 1): Promise<BalanceDetail> {
    const balancePage = this.normalizePage(page)
    const { data: html } = await this.http.get<string>(`/balance?p=${balancePage}`)

    return parseBalance(cheerio.load(html), balancePage)
  }

  /**
   * 创建空账户概览
   */
  private createEmptyAccountOverview(): AccountOverview {
    return {
      avatar: '',
      username: '',
      nodeCollectionCount: 0,
      topicCollectionCount: 0,
      specialFollowingCount: 0,
      activityPercent: 0,
      unreadNoticeCount: 0,
      gold: 0,
      silver: 0,
      bronze: 0
    }
  }

  /**
   * 从 HTML 中解析并更新账户概览缓存
   * @param $ cheerio 实例
   */
  private updateAccountOverviewFromHtml($: cheerio.CheerioAPI): AccountOverview | undefined {
    const overview = parseAccountOverview($)
    if (!overview) {
      return undefined
    }

    const oldOverview = this.accountOverview
    this.accountOverview = overview

    if (!oldOverview || !isSameAccountOverview(overview, oldOverview)) {
      this.notifyAccountOverviewChanged(overview, oldOverview)
    }

    return overview
  }

  /**
   * 从 HTML 中解析并更新在线人数缓存
   * @param $ cheerio 实例
   */
  private updateOnlineCountFromHtml($: cheerio.CheerioAPI): number | undefined {
    const onlineCount = parseOnlineCount($)
    if (onlineCount === undefined) {
      return undefined
    }

    const oldOnlineCount = this.onlineCount
    this.onlineCount = onlineCount

    if (oldOnlineCount !== onlineCount) {
      this.notifyOnlineCountChanged(onlineCount, oldOnlineCount)
    }

    return onlineCount
  }

  /**
   * 通知账户概览变化
   * @param overview 最新账户概览
   * @param oldOverview 旧账户概览
   */
  private notifyAccountOverviewChanged(overview: AccountOverview, oldOverview?: AccountOverview) {
    this.accountOverviewChangedHandlers.forEach(handler => {
      void handler(overview, oldOverview)
    })
  }

  /**
   * 通知在线人数变化
   * @param onlineCount 最新在线人数
   * @param oldOnlineCount 旧在线人数
   */
  private notifyOnlineCountChanged(onlineCount: number, oldOnlineCount?: number) {
    this.onlineCountChangedHandlers.forEach(handler => {
      void handler(onlineCount, oldOnlineCount)
    })
  }

  /**
   * 归一化页码
   * @param page 原始页码
   */
  private normalizePage(page?: number): number {
    if (!Number.isFinite(page)) {
      return 1
    }

    return Math.max(1, Math.floor(Number(page)))
  }

  /**
   * 提交回复
   * @param topicId 话题id
   * @param content 回复内容
   */
  async postReply(topicId: number, content: string) {
    const once = await this.getOnce()
    const params = new URLSearchParams({
      content,
      once
    })
    await this.http.post(`/t/${topicId}`, params)
  }

  /**
   * 预览回复内容
   * @param text 回复内容
   * @param syntax 预览语法
   */
  async previewReply(text: string, syntax: 'default' | 'markdown'): Promise<string> {
    const formData = new FormData()
    formData.append('text', text)

    const resp = await this.http.post<string>(`/preview/${syntax}`, formData, {
      responseType: 'text',
      transformResponse: data => data
    })
    return String(resp.data || '')
  }

  /**
   * 感谢回复者
   * @param replyId 回复id
   */
  async thankReply(replyId: string): Promise<void> {
    const once = await this.getOnce()
    const resp = await this.http.post<ThankResponse>(
      `https://www.v2ex.com/thank/reply/${replyId}?once=${once}`
    )
    if (resp.status !== 200) {
      throw new Error('感谢回复失败')
    }
    if (!resp.data.success) {
      throw new Error(resp.data.message || '感谢回复失败')
    }
  }

  /**
   * 向帖子发送感谢
   * @param topicId 帖子id
   */
  async thankTopic(topicId: number): Promise<void> {
    const once = await this.getOnce()
    const resp = await this.http.post<ThankResponse>(`/thank/topic/${topicId}?once=${once}`)
    if (resp.status !== 200) {
      throw new Error('感谢帖子失败')
    }
    if (!resp.data.success) {
      throw new Error(resp.data.message || '感谢帖子失败')
    }
  }

  /**
   * 检查cookie是否有效
   */
  async checkCookie(): Promise<boolean> {
    const cookie = this.getCookie()
    if (!cookie) {
      return false
    }

    // 使用内部请求客户端刷新服务端下发的会话 Cookie
    const { data: html } = await this.http.get<string>('/')
    const $ = cheerio.load(html)
    const isCookieValid = $('#member-activity').length > 0
    if (!isCookieValid) {
      this.notifyLoginExpired()
    }
    return isCookieValid
  }

  /**
   * 尝试使用 Cookie 登录
   * @param cookie 待检查的 Cookie 如：`A2=""; A2O=""`，最好只包含这两个cookie
   * @throws {TwoFactorRequiredError} 需要两步验证的错误
   */
  async tryLogin(cookie: string): Promise<boolean> {
    if (!cookie) {
      return false
    }
    const response = await axios.get<string>(this.baseUrl, {
      headers: {
        ...v2exRequestHeaders,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Cookie: cookie
      },
      timeout: v2exRequestTimeout
    })
    const responseUrl = response.request?.res?.responseUrl
    if (responseUrl) {
      const url = new URL(responseUrl)
      if (isV2exPath(url, '/2fa')) {
        throw new TwoFactorRequiredError('需要输入 V2EX 两步验证码')
      }
    }
    const html = response.data
    const $ = cheerio.load(html)
    // 如果显示了用户活跃度，表示cookie有效
    return $('#member-activity').length > 0
  }

  /**
   * 提交两步验证码
   * @param code 6 位验证码
   */
  async submitTwoFactorCode(code: string): Promise<void> {
    if (!/^\d{6}$/.test(code)) {
      throw new Error('请输入 6 位验证码')
    }

    const once = await this.getOnce()
    const params = new URLSearchParams({ code, once })
    const response = await this.http.post<string>('/2fa', params, {
      maxRedirects: 0,
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      validateStatus: status => status >= 200 && status < 400
    })

    if (response.status === 302) {
      return
    }

    const $ = cheerio.load(response.data)
    const problem = $('.problem').first().text().replace(/\s+/g, ' ').trim()
    throw new Error(problem || '两步验证码验证失败，请重新输入验证码')
  }

  /** 缓存的节点信息 */
  private _cachedNodes: Node[] = []
  /**
   * 获取所有节点
   */
  async getAllNodes(): Promise<Node[]> {
    if (this._cachedNodes.length) {
      return this._cachedNodes
    }
    const { data: html } = await this.http.get<string>('/planes')
    const $ = cheerio.load(html)
    const nodes: Node[] = []
    $('a.item_node').each((_, element) => {
      nodes.push({
        name: $(element).attr('href')?.split('go/')[1] || '',
        title: $(element).text().trim()
      })
    })
    this._cachedNodes = nodes
    return nodes
  }

  /**
   * 获取我收藏的节点
   */
  async getCollectionNodes(): Promise<Node[]> {
    const res = await this.http.get<string>('/my/nodes')

    const $ = cheerio.load(res.data)
    const nodes: Node[] = []
    $('#my-nodes > a.fav-node').each((_, element) => {
      nodes.push({
        name: $(element).attr('href')?.split('go/')[1] || '',
        title: $(element).children('.fav-node-name').text().trim().split(' ')[0]
      })
    })
    return nodes
  }

  /**
   * 查询每日签到状态
   */
  async getDailySignInStatus(): Promise<boolean> {
    const reward = await this.getDailySignInReward()
    return reward > 0
  }

  /**
   * 查询当日签到奖励铜币数
   */
  async getDailySignInReward(): Promise<number> {
    const { data: html } = await this.http.get<string>('/balance')
    const $ = cheerio.load(html)
    const today = dayjs().format('YYYY-MM-DD')
    let reward = 0

    $('table.data tr').each((_, element) => {
      if (reward) {
        return
      }

      const cells = $(element).children('td')
      const time = cells.eq(0).text().trim()
      const type = cells.eq(1).text().trim()
      if (!time.startsWith(today) || type !== '每日登录奖励') {
        return
      }

      reward = Number(cells.eq(2).text().trim()) || 0
    })

    return reward
  }

  /**
   * 每日签到
   * @returns 签到结果
   */
  async dailySignIn(): Promise<DailySignInResult> {
    // 签到可能由手动操作或刚登录后触发，也可能发生在扩展长时间运行后，需要先访问首页刷新服务端下发的会话 Cookie
    const isCookieValid = await this.checkCookie()
    if (!isCookieValid) {
      return {
        result: 'failed',
        reward: 0
      }
    }

    const currentReward = await this.getDailySignInReward()
    if (currentReward > 0) {
      return {
        result: 'repetitive',
        reward: currentReward
      }
    }

    const { data: html } = await this.http.get<string>('/mission/daily')
    const $ = cheerio.load(html)
    const onclick = $('input[value^="领取"]').first().attr('onclick') || ''
    const once = onclick.match(/\/mission\/daily\/redeem\?once=(\d+)/)?.[1]
    if (!once) {
      return {
        result: 'failed',
        reward: 0
      }
    }

    await this.http.get<string>(`/mission/daily/redeem?once=${once}`)
    const reward = await this.getDailySignInReward()
    return {
      result: reward > 0 ? 'success' : 'failed',
      reward
    }
  }

  /**
   * 收藏帖子
   * @param topicId 帖子id
   */
  async collectTopic(topicId: number) {
    const once = await this.getOnce()
    const resp = await this.http.get<string>(`/favorite/topic/${topicId}?once=${once}`, {
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400
    })
    if (resp.status !== 302) {
      throw new Error('收藏失败')
    }
  }

  /**
   * 取消收藏帖子
   * @param topicId 帖子id
   */
  async cancelCollectTopic(topicId: number) {
    const once = await this.getOnce()
    const resp = await this.http.get<string>(`/unfavorite/topic/${topicId}?once=${once}`, {
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400
    })
    if (resp.status !== 302) {
      throw new Error('取消收藏失败')
    }
  }

  /**
   * 取消收藏节点
   * @param nodeName 节点 name
   */
  async cancelCollectNode(nodeName: string): Promise<void> {
    const nodeRes = await this.http.get<string>(`/go/${nodeName}`)

    const $ = cheerio.load(nodeRes.data)
    const unfavoriteHref = $('a[href^="/unfavorite/node/"]').first().attr('href')
    const unfavoriteUrl = new URL(unfavoriteHref || '/', this.baseUrl)
    const nodeId = Number(unfavoriteUrl.pathname.match(/^\/unfavorite\/node\/(\d+)$/)?.[1])
    const once = unfavoriteUrl.searchParams.get('once')
    if (!nodeId || !once) {
      throw new Error('未找到节点取消收藏参数')
    }

    const resp = await this.http.get<string>(`/unfavorite/node/${nodeId}?once=${once}`, {
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400
    })
    if (resp.status !== 302) {
      throw new Error('取消收藏节点失败')
    }
  }

  /**
   * V2EX搜搜
   * @param params 搜索参数
   */
  async search(params: SoV2exSearchParams): Promise<SoV2exSearchResult> {
    const { data: res } = await this.http.get('https://www.sov2ex.com/api/search', {
      params
    })
    const hits: Array<{
      _source: SoV2exSearchResult['hits'][number]['source']
      highlight?: object
    }> = res.hits || []

    return {
      took: Number(res.took) || 0,
      timedOut: Boolean(res.timed_out),
      total: Number(res.total) || 0,
      hits: hits.map(hit => ({
        source: hit._source,
        highlight: hit.highlight
      }))
    }
  }
}
