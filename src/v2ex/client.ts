import * as cheerio from 'cheerio'
import axios, { AxiosResponse } from 'axios'
import { parse as parseCookieHeader } from 'cookie'
import dayjs from 'dayjs'
import picomatch from 'picomatch'
import { CookieJar } from 'tough-cookie'
import {
  AccountRestrictedError,
  Topic,
  Node,
  DailySignInResult,
  LoginExpiredHandler,
  LoginRequiredError,
  AccountOverviewChangedHandler,
  ThankResponse,
  TopicDetail,
  TopicReply,
  SoV2exSort,
  SoV2exSource,
  AccountOverview,
  V2exNotification,
  MemberContent,
  MemberContentOptions,
  MemberContentTabKey,
  MemberInfo,
  MemberReply
} from './types'

/** Cheerio 选择结果 */
type CheerioSelection = ReturnType<cheerio.CheerioAPI>

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
  '/notifications',
  '/t/*',
  '/planes',
  '/mission/daily',
  '/mission/daily/*'
]

/** 账户概览页面路径匹配器 */
const isAccountOverviewPath = picomatch(accountOverviewPathPatterns)

/** 需要检查自动重定向的 V2EX 页面路径 */
const redirectCheckPathPatterns = ['/go/*', '/t/*']

/** 自动重定向检查页面路径匹配器 */
const isRedirectCheckPath = picomatch(redirectCheckPathPatterns)

export class V2exClient {
  /** 域名 */
  readonly baseUrl = 'https://www.v2ex.com'

  /** V2EX Cookie 存储 */
  private readonly cookieJar = new CookieJar()

  /** 缓存的账户概览 */
  private accountOverview?: AccountOverview

  /** 账户概览变化监听器 */
  private readonly accountOverviewChangedHandlers = new Set<AccountOverviewChangedHandler>()

  /** v2ex 请求客户端 */
  private readonly http = axios.create({
    baseURL: this.baseUrl,
    headers: v2exRequestHeaders,
    timeout: v2exRequestTimeout,
    beforeRedirect: (options, responseDetails, requestDetails) => {
      // 自动重定向的中间响应不会进入 Axios 响应拦截器，需要在下一跳前同步 Cookie
      this.updateCookieFromHeaders(responseDetails.headers, requestDetails.url)

      const redirectUrl = new URL(options.href)
      const cookieHeaderName = Object.keys(options.headers).find(
        name => name.toLowerCase() === 'cookie'
      )
      if (cookieHeaderName) {
        delete options.headers[cookieHeaderName]
      }
      if (this.isV2exUrl(redirectUrl)) {
        options.headers.Cookie = this.getCookie(redirectUrl.toString())
      }
    }
  })

  /**
   * @param initialCookie 初始 V2EX Cookie
   * @param onLoginExpired 登录失效回调
   */
  constructor(
    initialCookie?: string,
    private readonly onLoginExpired?: LoginExpiredHandler
  ) {
    this.setCookie(initialCookie || '')

    this.http.interceptors.request.use(config => {
      const reqUrl = new URL(config.url || '', config.baseURL)
      // 添加 V2EX Cookie
      if (this.isV2exUrl(reqUrl)) {
        if (config.headers['Cookie'] === undefined) {
          config.headers['Cookie'] = this.getCookie(reqUrl.toString())
        }
      }
      return config
    })
    this.http.interceptors.response.use(response => {
      this.updateCookieFromResponse(response)
      this.checkRedirectFromResponse(response)
      this.updateAccountOverviewFromResponse(response)
      return response
    })
  }

  /**
   * 获取当前 V2EX Cookie
   * @param url 目标链接
   */
  getCookie(url = this.baseUrl): string {
    return this.cookieJar.getCookieStringSync(url)
  }

  /**
   * 设置当前 V2EX Cookie
   * @param cookie Cookie 字符串
   */
  setCookie(cookie: string): void {
    this.cookieJar.removeAllCookiesSync()
    this.accountOverview = undefined
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
    const responseUrl = this.getResponseUrl(response)
    this.updateCookieFromHeaders(response.headers, responseUrl)
  }

  /**
   * 从响应头更新 Cookie
   * @param headers 响应头
   * @param responseUrl 响应链接
   */
  private updateCookieFromHeaders(headers: Record<string, unknown>, responseUrl: string): void {
    if (!this.isV2exUrl(new URL(responseUrl))) {
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
   * 判断链接是否属于 V2EX
   * @param url 待判断链接
   */
  private isV2exUrl(url: URL): boolean {
    return url.protocol === 'https:' && (url.host === 'v2ex.com' || url.host.endsWith('.v2ex.com'))
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
    const requestUrl = new URL(response.config.url || '', response.config.baseURL || this.baseUrl)
    if (!this.isV2exUrl(requestUrl)) {
      return
    }
    if (!isRedirectCheckPath(requestUrl.pathname)) {
      return
    }
    if (response.request._redirectable._redirectCount <= 0) {
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

    const requestUrl = new URL(response.config.url || '', response.config.baseURL || this.baseUrl)
    if (!this.isV2exUrl(requestUrl)) {
      return
    }
    if (!isAccountOverviewPath(requestUrl.pathname)) {
      return
    }

    this.updateAccountOverviewFromHtml(cheerio.load(response.data))
  }

  /**
   * 获取响应对应的最终链接
   * @param response HTTP 响应
   */
  private getResponseUrl(response: AxiosResponse): string {
    return (
      response.request?.res?.responseUrl ||
      response.request?._redirectable?._currentUrl ||
      new URL(response.config.url || '', response.config.baseURL || this.baseUrl).toString()
    )
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
      totalPage: this.parsePagerTotalPage($),
      list: this.parseTopicListCells($, cells)
    }
  }

  /**
   * 解析通用分页组件总页数
   * @param $ cheerio 实例
   */
  private parsePagerTotalPage($: cheerio.CheerioAPI): number {
    const pageNumbers = $('.ps_container a.page_current, .ps_container a.page_normal')
      .map((_, element) => Number($(element).text().trim()) || 0)
      .get()
    const inputMax = Number($('.ps_container input.page_input').attr('max') || 0)

    return Math.max(1, inputMax, ...pageNumbers)
  }

  /**
   * 解析话题列表项
   * @param $ cheerio 实例
   * @param cells 话题列表元素
   * @param fallbackNode 固定节点信息
   */
  private parseTopicListCells(
    $: cheerio.CheerioAPI,
    cells: CheerioSelection,
    fallbackNode?: Node
  ): Topic[] {
    const list: Topic[] = []

    cells.each((_, cell) => {
      const topicElement = $(cell).find('a.topic-link')
      const topicHref = topicElement.attr('href')
      const topicId = topicHref ? this.getTopicIdByLink(topicHref) : undefined

      if (!topicId) {
        return
      }

      const nodeElement = $(cell).find('a.node')
      const nodeHref = nodeElement.attr('href') || ''
      // 在/my/topics页面中，自己的帖子回复数元素名为.count_orange
      const countElement = $(cell).find('.count_livid, .count_orange')
      const topicInfo = $(cell).find('.topic_info')
      const hasLastReply = /Lastly replied by|最后回复/.test(topicInfo.text())

      list.push({
        id: topicId,
        title: topicElement.text().trim(),
        node: {
          name: fallbackNode?.name || nodeHref.split('go/')[1] || '',
          title: fallbackNode?.title || nodeElement.text().trim()
        },
        replies: Number(countElement.text().trim()) || 0,
        displayTime: topicInfo.find('span[title]').last().text().trim(),
        lastReplyUser: hasLastReply
          ? topicInfo.find('strong a[href^="/member/"]').last().text().trim()
          : ''
      })
    })

    return list
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
    const match = topicLink.match(/t\/(\d+)/)
    return match ? Number(match[1]) : undefined
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

    return this.parseMemberInfo(home$, username)
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

    return this.parseMemberContent($, username, tab, page)
  }

  /**
   * 根据标签获取话题列表
   * @param tab 标签
   */
  async getTopicListByTab(tab: string): Promise<Topic[]> {
    const { data: html } = await this.http.get(`/?tab=${tab}`)
    const $ = cheerio.load(html)
    const cells = $('#Main > .box').eq(0).children('.cell.item')

    return this.parseTopicListCells($, cells)
  }

  /**
   * 根据节点获取话题列表
   * @param nodeName 节点 name
   * @param page 页码
   * @example https://www.v2ex.com/go/python?p=2
   */
  async getTopicListByNode(
    nodeName: string,
    page = 1
  ): Promise<{ totalPage: number; totalCount: number; list: Topic[] }> {
    const { data: html } = await this.http.get(`/go/${nodeName}?p=${page}`)
    const $ = cheerio.load(html)
    const nodeTitle = $('.node-breadcrumb').text().split('›')[1].trim()
    const cells = $('#TopicsNode .cell[class*="t_"]')
    return {
      totalPage: this.parsePagerTotalPage($),
      totalCount: this.parseNodeTopicTotalCount($),
      list: this.parseTopicListCells($, cells, {
        name: nodeName,
        title: nodeTitle
      })
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
      const topicId = topicPath ? this.getTopicIdByLink(topicPath) : undefined
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
      totalPage: this.parsePagerTotalPage($),
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
    const topic = this.parseTopicMeta($, topicId)
    topic.replies = this.parseReplies($)
    topic.replyTotalPage = this.parsePagerTotalPage($)
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
    const overview = this.parseAccountOverview($)
    if (!overview) {
      return undefined
    }

    const oldOverview = this.accountOverview
    this.accountOverview = overview

    if (!oldOverview || !this.isSameAccountOverview(overview, oldOverview)) {
      this.notifyAccountOverviewChanged(overview, oldOverview)
    }

    return overview
  }

  /**
   * 从 HTML 中解析账户概览
   * @param $ cheerio 实例
   */
  private parseAccountOverview($: cheerio.CheerioAPI): AccountOverview | undefined {
    const overview: AccountOverview = {
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

    const accountBox = $('#Rightbar > .box').has('#member-activity').first()
    if (!accountBox.length) {
      return undefined
    }

    const avatar = accountBox.find('td[width="48"] img.avatar').first()
    const activityHtml = accountBox.find('#member-activity').html() || ''

    overview.avatar = avatar.attr('src') || ''
    overview.username =
      accountBox.find('a[href^="/member/"]').first().text().trim() || avatar.attr('alt') || ''
    overview.nodeCollectionCount = Number(
      accountBox.find('a[href="/my/nodes"] .bigger').first().text().trim() || 0
    )
    overview.topicCollectionCount = Number(
      accountBox.find('a[href="/my/topics"] .bigger').first().text().trim() || 0
    )
    overview.specialFollowingCount = Number(
      accountBox.find('a[href="/my/following"] .bigger').first().text().trim() || 0
    )
    /*
    V2EX 的活跃度条在不同状态下会使用不同的内部元素类名：

    已满时：
    <div id="member-activity">
      <div class="member-activity-done" style="width: 100%;"></div>
    </div>

    未满时：
    <div id="member-activity">
      <div class="member-activity-bar">
        <div class="member-activity-start" style="width: 18%;"></div>
      </div>
    </div>

    因此这里直接从 #member-activity 的内部 HTML 中匹配 width，避免后续站点调整
    活跃度内部类名或嵌套层级时导致解析遗漏
    */
    overview.activityPercent = Number(activityHtml.match(/width\s*:\s*([\d.]+)%/)?.[1] || 0)

    const unreadText = $('#Rightbar a[href="/notifications"]').first().text().trim()
    overview.unreadNoticeCount = Number(unreadText.match(/(\d+)\s*未读提醒/)?.[1] || 0)

    const balances = ($('#Rightbar .balance_area').first().text().match(/\d+/g) || []).map(Number)
    overview.gold = balances[0] || 0
    overview.silver = balances[1] || 0
    overview.bronze = balances[2] || 0

    if (!overview.username && !overview.avatar) {
      return undefined
    }

    return overview
  }

  /**
   * 解析用户基本信息
   * @param $ cheerio 实例
   * @param fallbackUsername 兜底用户名
   */
  private parseMemberInfo($: cheerio.CheerioAPI, fallbackUsername: string): MemberInfo {
    const profileBox = this.findMemberProfileBox($)
    const avatar = profileBox.find('img.avatar[data-uid]').first()
    const grayText = profileBox
      .find('span.gray')
      .filter((_, element) => {
        const text = $(element).text()
        return text.includes('member #') || text.includes('号会员')
      })
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim()
    const ldJson = this.parseMemberLdJson($)
    const memberNumber =
      Number(avatar.attr('data-uid')) ||
      Number(grayText.match(/member #(\d+)/i)?.[1] || 0) ||
      Number(ldJson?.identifier || 0)
    const joinedAt =
      grayText.match(/(?:joined on|加入于)\s*([\d-]+\s+[\d:]+\s+[+-][\d:]+)/i)?.[1]?.trim() ||
      String(ldJson?.dateCreated || '')
    const activityRank =
      Number(grayText.match(/(?:activity rank|活跃度排名)\s*(\d+)/i)?.[1] || 0) || undefined

    return {
      avatar: avatar.attr('src') || String(ldJson?.image || ''),
      username:
        profileBox.find('h1').first().text().trim() ||
        avatar.attr('alt') ||
        String(ldJson?.name || '') ||
        fallbackUsername,
      memberNumber,
      joinedAt,
      activityRank
    }
  }

  /**
   * 查找用户基本信息容器
   * @param $ cheerio 实例
   */
  private findMemberProfileBox($: cheerio.CheerioAPI): CheerioSelection {
    const boxes = $('#Main > .box')
    const profileBox = boxes
      .filter((_, element) => $(element).find('img.avatar[data-uid]').length > 0)
      .first()

    return profileBox
  }

  /**
   * 解析用户页结构化数据
   * @param $ cheerio 实例
   */
  private parseMemberLdJson($: cheerio.CheerioAPI): Record<string, unknown> | undefined {
    const rawJson = $('script[type="application/ld+json"]').first().text().trim()
    if (!rawJson) {
      return undefined
    }

    try {
      const parsed = JSON.parse(rawJson) as { mainEntity?: Record<string, unknown> }
      return parsed.mainEntity
    } catch {
      return undefined
    }
  }

  /**
   * 解析用户页内容
   * @param $ cheerio 实例
   * @param username 用户名
   * @param tab 标签
   * @param page 页码
   */
  private parseMemberContent(
    $: cheerio.CheerioAPI,
    username: string,
    tab: MemberContentTabKey,
    page: number
  ): MemberContent {
    const content: MemberContent = {
      tab,
      page,
      totalPage: this.parsePagerTotalPage($),
      totalCount: this.parseMemberContentTotalCount($),
      topics: [],
      replies: [],
      hidden: false,
      message: ''
    }

    if (tab === 'replies') {
      content.replies = this.parseMemberReplies($)
      return content
    }

    const topicBox = this.findMemberTopicBox($)
    content.hidden =
      topicBox.text().includes('topics list is hidden') ||
      topicBox.text().includes('主题列表被隐藏') ||
      $('#Main').text().includes('topics list is hidden') ||
      $('#Main').text().includes('主题列表被隐藏')
    content.message = this.parseMemberTopicMessage($, topicBox, username)

    if (!content.hidden) {
      content.topics = this.parseTopicListCells($, topicBox.children('.cell.item'))
    }

    return content
  }

  /**
   * 查找用户页主题列表容器
   * @param $ cheerio 实例
   */
  private findMemberTopicBox($: cheerio.CheerioAPI): CheerioSelection {
    const boxes = $('#Main > .box')
    const tabBox = boxes
      .filter((_, element) => $(element).children('.cell_tabs').length > 0)
      .first()
    if (tabBox.length) {
      return tabBox
    }

    return boxes.filter((_, element) => $(element).children('.cell.item').length > 0).first()
  }

  /**
   * 解析用户主题列表提示
   * @param topicBox 主题列表容器
   * @param username 用户名
   */
  private parseMemberTopicMessage(
    $: cheerio.CheerioAPI,
    topicBox: CheerioSelection,
    username: string
  ): string {
    const hiddenText =
      topicBox.find('.topic_content .gray').first().text().trim() ||
      $('#Main .topic_content .gray')
        .filter(
          (_, element) =>
            $(element).text().includes('topics list is hidden') ||
            $(element).text().includes('主题列表被隐藏')
        )
        .first()
        .text()
        .trim()
    if (hiddenText) {
      return hiddenText
    }

    if (
      topicBox.text().includes('topics list is hidden') ||
      topicBox.text().includes('主题列表被隐藏')
    ) {
      return `${username} 已隐藏主题列表`
    }

    return ''
  }

  /**
   * 解析用户内容总数
   * @param $ cheerio 实例
   */
  private parseMemberContentTotalCount($: cheerio.CheerioAPI): number {
    const text = $('#Main > .box .header .fr strong.gray').first().text().trim()
    return Number(text.replace(/,/g, '')) || 0
  }

  /**
   * 解析用户回复列表
   * @param $ cheerio 实例
   */
  private parseMemberReplies($: cheerio.CheerioAPI): MemberReply[] {
    const replies: MemberReply[] = []

    $('#Main > .box .dock_area').each((_, element) => {
      const dock = $(element)
      const body = dock.next('.inner, .cell')
      const summary = dock.find('.gray').first()
      const topic = summary.find('a[href*="/t/"]').last()
      const topicPath = topic.attr('href') || ''
      const node = summary.find('a[href^="/go/"]').last()
      const topicAuthor = summary.find('a[href^="/member/"]').first()

      replies.push({
        topicId: topicPath ? this.getTopicIdByLink(topicPath) : undefined,
        topicTitle: topic.text().trim(),
        topicPath,
        node: {
          name: (node.attr('href') || '').split('/go/')[1] || '',
          title: node.text().trim()
        },
        topicAuthor: topicAuthor.text().trim(),
        time: dock.find('.fade').first().attr('title') || dock.find('.fade').first().text().trim(),
        summaryHtml: summary.html()?.trim() || '',
        contentHtml: body.find('.reply_content').first().html()?.trim() || ''
      })
    })

    return replies.filter(reply => reply.topicTitle || reply.contentHtml)
  }

  /**
   * 判断账户概览是否一致
   * @param overview 最新账户概览
   * @param oldOverview 旧账户概览
   */
  private isSameAccountOverview(overview: AccountOverview, oldOverview: AccountOverview): boolean {
    return (
      overview.avatar === oldOverview.avatar &&
      overview.username === oldOverview.username &&
      overview.nodeCollectionCount === oldOverview.nodeCollectionCount &&
      overview.topicCollectionCount === oldOverview.topicCollectionCount &&
      overview.specialFollowingCount === oldOverview.specialFollowingCount &&
      overview.activityPercent === oldOverview.activityPercent &&
      overview.unreadNoticeCount === oldOverview.unreadNoticeCount &&
      overview.gold === oldOverview.gold &&
      overview.silver === oldOverview.silver &&
      overview.bronze === oldOverview.bronze
    )
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
   * 解析话题元信息
   * @param $ cheerio 实例
   * @param topicId 话题id
   */
  private parseTopicMeta($: cheerio.CheerioAPI, topicId: number): TopicDetail {
    const topic: TopicDetail = {
      id: topicId,
      title: $('.header > h1').text(),
      node: {
        name: '',
        title: ''
      },
      authorAvatar: '',
      authorName: '',
      displayTime: '',
      visitCount: 0,
      content: '',
      appends: [],
      collectCount: 0,
      thankCount: 0,
      isCollected: false,
      isThanked: false,
      canThank: true,
      collectParamT: null,
      replyCount: 0,
      replyCurrentPage: 1,
      replyTotalPage: 1,
      replies: []
    }
    const node = $('.header a[href^=/go/]')
    topic.node.name = node.attr('href')?.split('go/')[1] || ''
    topic.node.title = node.text().trim()
    topic.authorAvatar = $('.header > .fr img.avatar').attr('src') || ''
    const meta = $('.header > .gray').text().split('·')
    topic.authorName = $('.header > .gray a[href^=/member]').text().trim()
    topic.displayTime = $('.header > .gray > span').last().text().trim()
    topic.visitCount = parseInt(meta[2].trim())
    topic.content = $('#Main .topic_content').html() || ''
    $('.subtle').each((_, element) => {
      topic.appends.push({
        time: $(element).children('.fade').text().split('·')[1].trim(),
        content: $(element).children('.topic_content').html() || ''
      })
    })

    const topicButtons = $('.topic_buttons')
    if (topicButtons.length) {
      const countStr = topicButtons.children('.topic_stats').text()
      if (/(\d+)\s*人收藏/.test(countStr)) {
        topic.collectCount = parseInt(RegExp.$1)
      }
      if (/(\d+)\s*人感谢/.test(countStr)) {
        topic.thankCount = parseInt(RegExp.$1)
      }
      const collectButton = topicButtons.children('a.tb').eq(0)
      topic.isCollected = collectButton.text().indexOf('取消收藏') >= 0
      topic.collectParamT = collectButton.attr('href')?.split('?t=')[1] || null
      topic.canThank = topicButtons.children('#topic_thank').length > 0
      topic.isThanked = topicButtons.find('.topic_thanked').length > 0
    }

    let topicBoxIndex = 1
    const boxes = $('#Main > .box')
    if (boxes.eq(1).attr('id') === 'topic-tip-box') {
      topicBoxIndex = 2
    }
    const topicBox = boxes.eq(topicBoxIndex)
    topic.replyCount = this.parseReplyCount(topicBox)
    return topic
  }

  /**
   * 解析回复总数
   * @param topicBox 回复列表外层容器
   */
  private parseReplyCount(topicBox: CheerioSelection): number {
    const headerText = topicBox.children('div.cell').first().find('span.gray').first().text()
    return Number(headerText.match(/(\d+)\s*条回复/)?.[1] || 0)
  }

  /**
   * 获取回复列表
   * @param $ cheerio 实例
   */
  private parseReplies($: cheerio.CheerioAPI): TopicReply[] {
    const replies: TopicReply[] = []
    let topicBoxIndex = 1
    const boxes = $('#Main > .box')
    if (boxes.eq(1).attr('id') === 'topic-tip-box') {
      topicBoxIndex = 2
    }
    const topicBox = boxes.eq(topicBoxIndex)
    topicBox.children('div[id].cell').each((_, element) => {
      replies.push({
        replyId: $(element).attr('id')?.split('r_')[1] || '0',
        userAvatar: $(element).find('img.avatar').attr('src') || '',
        userName: $(element).find('a.dark').html() || '',
        time: $(element).find('span.ago').text(),
        floor: $(element).find('span.no').text(),
        content: $(element).find('.reply_content').html() || '',
        thanks: parseInt($(element).find('span.small.fade').text().trim() || '0'),
        thanked: $(element).find('.thank_area.thanked').length > 0
      })
    })
    return replies
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
   * @param cookie 待检查的 Cookie
   */
  async tryLogin(cookie: string): Promise<boolean> {
    if (!cookie) {
      return false
    }
    const { data: html } = await axios.get<string>(this.baseUrl, {
      headers: {
        ...v2exRequestHeaders,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Cookie: cookie
      },
      timeout: v2exRequestTimeout
    })
    const $ = cheerio.load(html)
    // 如果显示了用户活跃度，表示cookie有效
    return $('#member-activity').length > 0
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

    $('table.data > tbody > tr').each((_, element) => {
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
   * @param q 查询关键词
   * @param sort 结果排序方式
   * @param from 与第一个结果的偏移量（默认 0），比如 0, 10, 20
   * @param size 结果数量（默认 10）
   */
  async search(
    q: string,
    sort: SoV2exSort = 'sumup',
    from = 0,
    size = 10
  ): Promise<SoV2exSource[]> {
    const { data: res } = await this.http.get('https://www.sov2ex.com/api/search', {
      params: {
        q,
        sort,
        from,
        size
      }
    })
    const hits: any[] = res.hits || []
    return hits.map(h => h._source)
  }
}
