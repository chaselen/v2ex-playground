import * as cheerio from 'cheerio'
import axios, { AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { parse as parseCookieHeader } from 'cookie'
import { CookieJar } from 'tough-cookie'
import type { AnyNode } from 'domhandler'
import {
  AccountRestrictedError,
  Topic,
  Node,
  DailyRes,
  LoginExpiredHandler,
  LoginRequiredError,
  ThankResponse,
  TopicDetail,
  TopicReply,
  SoV2exSort,
  SoV2exSource,
  AccountOverview
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

export class V2exClient {
  /** 域名 */
  readonly baseUrl = 'https://www.v2ex.com'

  /** V2EX Cookie 存储 */
  private readonly cookieJar = new CookieJar()

  /** v2ex 请求客户端 */
  private readonly http = axios.create({
    baseURL: this.baseUrl,
    headers: v2exRequestHeaders,
    timeout: v2exRequestTimeout
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
      if (reqUrl.host === 'v2ex.com' || reqUrl.host.endsWith('.v2ex.com')) {
        if (config.headers['Cookie'] === undefined) {
          config.headers['Cookie'] = this.getCookie(reqUrl.toString())
        }
      }
      return config
    })
    this.http.interceptors.response.use(response => {
      this.updateCookieFromResponse(response)
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
    if (!cookie) {
      return
    }
    this.writeCookie(cookie, this.baseUrl)
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
    const setCookie = response.headers['set-cookie']
    if (!setCookie) {
      return
    }

    const responseUrl = this.getResponseUrl(response)
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie]
    cookies.forEach(cookie => this.cookieJar.setCookieSync(cookie, responseUrl))
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
    this.checkRedirect(res)

    const $ = cheerio.load(res.data)
    const cells = $('#Main > .box').last().children('.cell.item')

    return {
      totalPage: this.parseTopicListTotalPage($),
      list: this.parseTopicListCells($, cells)
    }
  }

  /**
   * 解析话题列表分页总页数
   * @param $ cheerio 实例
   */
  private parseTopicListTotalPage($: cheerio.CheerioAPI): number {
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
    cells: cheerio.Cheerio<AnyNode>,
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
      const countLivid = $(cell).find('.count_livid')

      list.push({
        id: topicId,
        title: topicElement.text().trim(),
        node: {
          name: fallbackNode?.name || nodeHref.split('go/')[1] || '',
          title: fallbackNode?.title || nodeElement.text().trim()
        },
        replies: Number(countLivid.text().trim()) || 0
      })
    })

    return list
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
   * @param nodeName 节点名
   * @param page 页码
   * @example https://www.v2ex.com/go/python?p=2
   */
  async getTopicListByNode(
    nodeName: string,
    page = 1
  ): Promise<{ totalPage: number; list: Topic[] }> {
    const { data: html } = await this.http.get(`/go/${nodeName}?p=${page}`)
    const $ = cheerio.load(html)
    const nodeTitle = $('.node-breadcrumb').text().split('›')[1].trim()
    const cells = $('#TopicsNode .cell[class*="t_"]')
    return {
      totalPage: this.parseTopicListTotalPage($),
      list: this.parseTopicListCells($, cells, {
        name: nodeName,
        title: nodeTitle
      })
    }
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
   * 获取话题详情内容
   * @param topicId 话题id
   */
  async getTopicDetail(topicId: number): Promise<TopicDetail> {
    const res = await this.http.get<string>(`/t/${topicId}?p=1`)
    this.checkRedirect(res)

    const $ = cheerio.load(res.data)
    const topic = this.parseTopicMeta($, topicId)
    topic.replies = this.parseReplies($)

    const pager = this.findReplyPager($)
    if (pager) {
      const replies = await this.fetchAllReplies(topicId, pager.totalPage)
      topic.replies.push(...replies)
      /*
       * 有时候会出现统计的回复数与实际获取到的回复数量不一致的问题，修正一下回复数量
       */
      if (topic.replies.length > topic.replyCount) {
        topic.replyCount = topic.replies.length
      }
    }
    return topic
  }

  /**
   * 获取账户概览
   *
   * 包含未读提醒数量和账户余额
   */
  async getAccountOverview(): Promise<AccountOverview> {
    const { data: html } = await this.http.get<string>('/')
    const $ = cheerio.load(html)
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

    return overview
  }

  /**
   * 检查请求是否被重定向，处理登录受限等情况
   *
   * 部分帖子需要登录查看
   * 第1种：会重定向到登录页（https://www.v2ex.com/signin?next=/t/xxxxxx），并提示：你要查看的页面需要先登录。如交易区：https://www.v2ex.com/t/704753
   * 第2种：会重定向到首页，无提示。如：https://www.v2ex.com/t/704716
   * 第3种：账号访问受限（如新用户），会重定向到 https://www.v2ex.com/restricted
   */
  private checkRedirect(res: AxiosResponse): void {
    if (res.request._redirectable._redirectCount > 0) {
      if (res.request.path.indexOf('/signin') >= 0) {
        this.notifyLoginExpired()
        throw new LoginRequiredError('你要查看的页面需要先登录')
      }
      if (res.request.path === '/') {
        if (this.getCookie()) {
          throw new Error('您无权访问此页面')
        } else {
          throw new LoginRequiredError('你要查看的页面需要先登录')
        }
      }
      if (res.request.path.indexOf('/restricted') === 0) {
        throw new AccountRestrictedError(
          '访问受限，详情请查看 <a href="https://www.v2ex.com/restricted">https://www.v2ex.com/restricted</a>'
        )
      }
      throw new Error('未知错误')
    }
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
    topic.replyCount =
      parseInt(topicBox.children('div.cell').eq(0).find('span.gray').text().split('•')[0]) || 0
    return topic
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
   * 查找回复分页器
   * @param $ cheerio 实例
   */
  private findReplyPager($: cheerio.CheerioAPI): { totalPage: number } | null {
    let topicBoxIndex = 1
    const boxes = $('#Main > .box')
    if (boxes.eq(1).attr('id') === 'topic-tip-box') {
      topicBoxIndex = 2
    }
    const topicBox = boxes.eq(topicBoxIndex)
    const pager = topicBox.find('.cell:not([id]) table')
    if (!pager.length) return null
    const totalPage = parseInt(pager.find('td').eq(0).children('a').last().text())
    return { totalPage }
  }

  /**
   * 获取所有分页回复
   * @param topicId 话题id
   * @param totalPage 总页数
   */
  private async fetchAllReplies(topicId: number, totalPage: number): Promise<TopicReply[]> {
    const replies: TopicReply[] = []
    const promises = Array.from({ length: totalPage - 1 }, (_, i) =>
      this.http.get<string>(`/t/${topicId}?p=${i + 2}`)
    )
    try {
      const resList = await Promise.all(promises)
      resList.forEach(res => {
        const $ = cheerio.load(res.data)
        replies.push(...this.parseReplies($))
      })
    } catch (error) {
      console.error('获取分页回复失败', error)
    }
    return replies
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
    const isCookieValid = await this.tryLogin(cookie)
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
    console.log(`获取到${nodes.length}个节点`)
    this._cachedNodes = nodes
    return nodes
  }

  /**
   * 获取我收藏的节点
   */
  async getCollectionNodes(): Promise<Node[]> {
    const res = await this.http.get<string>('/my/nodes')
    this.checkRedirect(res)

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
   * 每日签到
   *
   * @returns {Promise<DailyRes>} 返回签到结果
   */
  async daily(): Promise<DailyRes> {
    const { data: html } = await this.http.get<string>('/mission/daily')
    const $ = cheerio.load(html)
    /* 已领取过时会提示：每日登录奖励已领取 */
    if ($('.fa-ok-sign').length) {
      return 'repetitive'
    }
    /* 未领取时有一个领取按钮 */
    const btn = $('input.super.normal.button')
    if (btn.length) {
      const once = await this.getOnce()
      const { data: html2 } = await this.http.get<string>(`/mission/daily/redeem?once=${once}`)
      const $2 = cheerio.load(html2)
      if ($2('.fa-ok-sign').length) {
        return 'success'
      }
    }
    return 'failed'
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
