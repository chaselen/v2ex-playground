import { AccountRestrictedError, LoginRequiredError } from './error'
import * as cheerio from 'cheerio'
import http from './http'
import { AxiosResponse } from 'axios'
import G from './global'
import vscode from 'vscode'
import querystring from 'node:querystring'
import Config from './config'
import { Topic, Node, DailyRes, TopicDetail, TopicReply, SoV2exSort, SoV2exSource } from './type'

/** 感谢接口响应 */
type ThankResponse = {
  /** 是否成功 */
  success: boolean
  /** 错误消息 */
  message?: string
}

export class V2ex {
  /** 域名 */
  static baseUrl = 'https://www.v2ex.com'

  /**
   * 根据话题 id 获取话题链接
   * @param topicId 话题 id
   * @example "703733" -> "https://www.v2ex.com/t/703733"
   */
  static getTopicLinkById(topicId: string | number) {
    return `${this.baseUrl}/t/${topicId}`
  }

  /**
   * 获取 once 参数
   * @returns once 参数
   */
  static async getOnce(): Promise<string> {
    const { data } = await http.get<string>('/poll_once', {
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
  static getTopicIdByLink(topicLink: string): number | undefined {
    const match = topicLink.match(/t\/(\d+)/)
    return match ? Number(match[1]) : undefined
  }

  /**
   * 根据标签获取话题列表
   * @param tab 标签
   */
  static async getTopicListByTab(tab: string): Promise<Topic[]> {
    const { data: html } = await http.get(`/?tab=${tab}`)
    const $ = cheerio.load(html)
    const cells = $('#Main > .box').eq(0).children('.cell.item')

    const list: Topic[] = []
    cells.each((_, cell) => {
      const topicElement = $(cell).find('a.topic-link')
      const nodeElement = $(cell).find('a.node')
      const countLivid = $(cell).find('.count_livid')

      const topicId = this.getTopicIdByLink(topicElement.attr('href')!)
      const topic = new Topic(topicId!)
      topic.title = topicElement.text().trim()
      topic.node.name = nodeElement.attr('href')?.split('go/')[1] || ''
      topic.node.title = nodeElement.text().trim()
      topic.replies = Number(countLivid.text().trim()) || 0
      list.push(topic)
    })

    return list
  }

  /**
   * 根据节点获取话题列表
   * @param nodeName 节点名
   * @param page 页码
   * @example https://www.v2ex.com/go/python?p=2
   */
  static async getTopicListByNode(
    nodeName: string,
    page = 1
  ): Promise<{ totalPage: number; list: Topic[] }> {
    const { data: html } = await http.get(`/go/${nodeName}?p=${page}`)
    const $ = cheerio.load(html)
    const nodeTitle = $('.node-breadcrumb').text().split('›')[1].trim()
    const cells = $('#TopicsNode .cell[class*="t_"]')
    const totalPage = $('.ps_container .page_normal').last().text()

    const list: Topic[] = []
    cells.each((_, cell) => {
      const topicElement = $(cell).find('a.topic-link')
      const countLivid = $(cell).find('.count_livid')

      const topicId = this.getTopicIdByLink(topicElement.attr('href')!)
      const topic = new Topic(topicId!)
      topic.title = topicElement.text().trim()
      topic.node = new Node(nodeName, nodeTitle)
      topic.replies = Number(countLivid.text().trim()) || 0
      list.push(topic)
    })
    return {
      totalPage: Number(totalPage),
      list: list
    }
  }

  /**
   * 获取话题详情内容
   * @param topicId 话题id
   */
  static async getTopicDetail(topicId: number): Promise<TopicDetail> {
    const res = await http.get<string>(`/t/${topicId}?p=1`)
    this.checkRedirect(res)

    const $ = cheerio.load(res.data)
    const topic = this.parseTopicMeta($, topicId)
    topic.replies = this.parseReplies($)
    G.unreadNoticeCount = parseInt(
      $('title')
        .text()
        .match(/V2EX \((\d+)\)/)?.[1] ?? '0'
    )

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
   * 检查请求是否被重定向，处理登录受限等情况
   *
   * 部分帖子需要登录查看
   * 第1种：会重定向到登录页（https://www.v2ex.com/signin?next=/t/xxxxxx），并提示：你要查看的页面需要先登录。如交易区：https://www.v2ex.com/t/704753
   * 第2种：会重定向到首页，无提示。如：https://www.v2ex.com/t/704716
   * 第3种：账号访问受限（如新用户），会重定向到 https://www.v2ex.com/restricted
   */
  private static checkRedirect(res: AxiosResponse): void {
    if (res.request._redirectable._redirectCount > 0) {
      if (res.request.path.indexOf('/signin') >= 0) {
        // 登录失效，删除cookie
        G.setCookie('')
        throw new LoginRequiredError('你要查看的页面需要先登录')
      }
      if (res.request.path === '/') {
        if (G.getCookie()) {
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
  private static parseTopicMeta($: cheerio.CheerioAPI, topicId: number): TopicDetail {
    const topic = new TopicDetail()
    topic.id = topicId
    topic.title = $('.header > h1').text()
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
  private static parseReplies($: cheerio.CheerioAPI): TopicReply[] {
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
  private static findReplyPager($: cheerio.CheerioAPI): { totalPage: number } | null {
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
  private static async fetchAllReplies(topicId: number, totalPage: number): Promise<TopicReply[]> {
    const replies: TopicReply[] = []
    const promises = Array.from({ length: totalPage - 1 }, (_, i) =>
      http.get<string>(`/t/${topicId}?p=${i + 2}`)
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
   * @param topicLink 话题链接，如：https://www.v2ex.com/t/703733
   * @param content 回复内容
   */
  static async postReply(topicLink: string, content: string) {
    const once = await this.getOnce()
    const params = {
      content,
      once
    }
    await http.post(topicLink, querystring.stringify(params))
  }

  /**
   * 感谢回复者
   * @param replyId 回复id
   */
  static async thankReply(replyId: string): Promise<void> {
    const once = await this.getOnce()
    const resp = await http.post<ThankResponse>(
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
  static async thankTopic(topicId: number): Promise<void> {
    const once = await this.getOnce()
    const resp = await http.post<ThankResponse>(`/thank/topic/${topicId}?once=${once}`)
    if (resp.status !== 200) {
      throw new Error('感谢帖子失败')
    }
    if (!resp.data.success) {
      throw new Error(resp.data.message || '感谢帖子失败')
    }
  }

  /**
   * 检查cookie是否有效
   * @param cookie 检查的cookie
   * @param autoSignIn 是否自动签到
   */
  static async checkCookie(cookie: string, autoSignIn = false): Promise<boolean> {
    if (!cookie) {
      return false
    }
    /* 前往一个需要登录的页面检测，如果被重定向，说明cookie无效 */
    const res = await http.get('/t', {
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Cookie: cookie
      }
    })
    const isValid = res.request._redirectable._redirectCount <= 0
    if (isValid && autoSignIn && Config.autoSignIn()) {
      const signRes = await this.daily()
      if (signRes !== DailyRes.repetitive) {
        vscode.window.showInformationMessage(signRes)
      }
    }
    return isValid
  }

  /** 缓存的节点信息 */
  private static _cachedNodes: Node[] = []
  /**
   * 获取所有节点
   */
  static async getAllNodes(): Promise<Node[]> {
    if (this._cachedNodes.length) {
      return this._cachedNodes
    }
    const { data: html } = await http.get<string>('/planes')
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
  static async getCollectionNodes(): Promise<Node[]> {
    const res = await http.get<string>('/my/nodes')
    if (res.request._redirectable._redirectCount > 0) {
      // 登录失效，删除cookie
      G.setCookie('')
      throw new LoginRequiredError('你要查看的页面需要先登录')
    }

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
  static async daily(): Promise<DailyRes> {
    /* 查询时上次签到时间 */
    const timestamp = new Date().getTime() / 1000
    const lastSignTime = G.context.globalState.get<number>('lastSignTime')
    if (lastSignTime !== undefined && timestamp - lastSignTime < 86400) {
      /* 最后签到时间小于1天 */
      return DailyRes.repetitive
    }

    const { data: html } = await http.get<string>('/mission/daily')
    const $ = cheerio.load(html)
    /* 已领取过时会提示：每日登录奖励已领取 */
    if ($('.fa-ok-sign').length) {
      G.context.globalState.update('lastSignTime', timestamp)
      return DailyRes.repetitive
    }
    /* 未领取时有一个领取按钮 */
    const btn = $('input.super.normal.button')
    if (btn.length) {
      const once = await this.getOnce()
      const { data: html2 } = await http.get<string>(`/mission/daily/redeem?once=${once}`)
      const $2 = cheerio.load(html2)
      if ($2('.fa-ok-sign').length) {
        G.context.globalState.update('lastSignTime', timestamp)
        return DailyRes.success
      }
    }
    return DailyRes.failed
  }

  /**
   * 收藏帖子
   * @param topicId 帖子id
   */
  static async collectTopic(topicId: number) {
    const once = await this.getOnce()
    const resp = await http.get<string>(`/favorite/topic/${topicId}?once=${once}`, {
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
  static async cancelCollectTopic(topicId: number) {
    const once = await this.getOnce()
    const resp = await http.get<string>(`/unfavorite/topic/${topicId}?once=${once}`, {
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
  static async search(
    q: string,
    sort: SoV2exSort = 'sumup',
    from = 0,
    size = 10
  ): Promise<SoV2exSource[]> {
    const { data: res } = await http.get('https://www.sov2ex.com/api/search', {
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
