import { TreeNode } from './providers/BaseProvider'
import { AccountRestrictedError, LoginRequiredError } from './error'
import * as cheerio from 'cheerio'
import template from 'art-template'
import http from './http'
import { AxiosResponse } from 'axios'
import path from 'path'
import G from './global'
import topicItemClick from './commands/topicItemClick'
import vscode from 'vscode'
import querystring from 'node:querystring'
import {
  Topic,
  Node,
  DailyRes,
  TopicDetail,
  TopicReply,
  ThankReplyResp,
  SoV2exSort,
  SoV2exSource
} from './type'

export class V2ex {
  /** 域名 */
  static baseUrl = 'https://www.v2ex.com'

  /**
   * 根据标签获取话题列表
   * @param tab 标签
   */
  static async getTopicListByTab(tab: string): Promise<Topic[]> {
    const { data: html } = await http.get(`https://www.v2ex.com/?tab=${tab}`)
    const $ = cheerio.load(html)
    const cells = $('#Main > .box').eq(0).children('.cell.item')

    const list: Topic[] = []
    cells.each((_, cell) => {
      const topicElement = $(cell).find('a.topic-link')
      const nodeElement = $(cell).find('a.node')

      const topic = new Topic()
      topic.title = topicElement.text().trim()
      topic.link = 'https://www.v2ex.com' + topicElement.attr('href')?.split('#')[0]
      topic.node.name = nodeElement.attr('href')?.split('go/')[1] || ''
      topic.node.title = nodeElement.text().trim()
      list.push(topic)
    })

    // 判断是否需要签到
    const signRes = await this.daily()
    if (signRes !== DailyRes.repetitive) {
      vscode.window.showInformationMessage(signRes)
    }

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
    const { data: html } = await http.get(`https://www.v2ex.com/go/${nodeName}?p=${page}`)
    const $ = cheerio.load(html)
    const nodeTitle = $('.node-breadcrumb').text().split('›')[1].trim()
    const cells = $('#TopicsNode .cell[class*="t_"]')
    const totalPage = $('.ps_container .page_normal').last().text()

    const list: Topic[] = []
    cells.each((_, cell) => {
      const topicElement = $(cell).find('a.topic-link')

      const topic = new Topic()
      topic.title = topicElement.text().trim()
      topic.link = 'https://www.v2ex.com' + topicElement.attr('href')?.split('#')[0]
      topic.node = new Node(nodeName, nodeTitle)
      list.push(topic)
    })
    return {
      totalPage: Number(totalPage),
      list: list
    }
  }

  /**
   * 获取话题详情内容
   * @param topicLink 话题链接
   */
  static async getTopicDetail(topicLink: string): Promise<TopicDetail> {
    // topicLink = 'https://www.v2ex.com/t/703733';
    // topicLink = 'https://www.v2ex.com/t/704716';
    const res = await http.get<string>(topicLink + '?p=1')
    const $ = cheerio.load(res.data)

    /**
     * 部分帖子需要登录查看
     * 第1种：会重定向到登录页（https://www.v2ex.com/signin?next=/t/xxxxxx），并提示：你要查看的页面需要先登录。如交易区：https://www.v2ex.com/t/704753
     * 第2种：会重定向到首页，无提示。如：https://www.v2ex.com/t/704716
     * 第3种：账号访问受限（如新用户），会重定向到 https://www.v2ex.com/restricted
     */
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

    const topic = new TopicDetail()
    topic.id = parseInt(topicLink.split('/t/')[1] || '0')
    topic.link = topicLink
    topic.once = $('a.light-toggle').attr('href')?.split('?once=')[1] || ''
    topic.title = $('.header > h1').text()
    const node = $('.header > a').eq(1)
    topic.node.name = node.attr('href')?.split('go/')[1] || ''
    topic.node.title = node.text().trim()
    topic.authorAvatar = $('.header > .fr img.avatar').attr('src') || ''
    const meta = $('.header > .gray').text().split('·')
    topic.authorName = meta[0].trim()
    topic.displayTime = meta[1].trim()
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

    topic.replyCount =
      parseInt(
        $('#Main > .box').eq(1).children('div.cell').eq(0).find('span.gray').text().split('•')[0]
      ) || 0

    /**
     * 获取回复
     * @param $ 页面加载后的文档
     */
    const _getTopicReplies = ($: cheerio.CheerioAPI): TopicReply[] => {
      const replies: TopicReply[] = []
      $('#Main > .box')
        .eq(1)
        .children('div[id].cell')
        .each((_, element) => {
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

    // 获取评论
    topic.replies = _getTopicReplies($)
    const pager = $('#Main > .box').eq(1).find('.cell:not([id]) table')
    if (pager.length) {
      // 如果获取分页组件，表示有多页评论
      const totalPage = parseInt(pager.find('td').eq(0).children('a').last().text())
      console.log(`${topicLink}：一共${totalPage}页回复`)

      const promises: Promise<AxiosResponse<string>>[] = []
      for (let p = 2; p <= totalPage; p++) {
        promises.push(http.get<string>(topicLink + `?p=${p}`))
      }
      try {
        const resList = await Promise.all(promises)
        resList
          .map(res => res.data)
          .forEach(html => {
            const replies = _getTopicReplies(cheerio.load(html))
            topic.replies = topic.replies.concat(replies)
            // 有时候会出现统计的回复数与实际获取到的回复数量不一致的问题，修正一下回复数量
            if (topic.replies.length > topic.replyCount) {
              topic.replyCount = topic.replies.length
            }
          })
      } catch (error) {}
    }

    // 获取是否有未读提醒，如果有的话，则打开浏览器查看
    const title = $('title').text()
    const regex = /V2EX \((\d+)\)/
    const match = title.match(regex)
    const timestamp = new Date().getTime() / 1000
    const unReadLastTipTime = G.context.globalState.get<number>('unReadLastTipTime')
    if (
      match &&
      parseInt(match[1]) > 0 &&
      (unReadLastTipTime === undefined ||
        (unReadLastTipTime !== undefined && timestamp - unReadLastTipTime > 300))
    ) {
      vscode.window
        .showInformationMessage('您有' + match[1] + '条未读提醒', '查看提醒')
        .then(result => {
          if (result === '查看提醒') {
            vscode.env.openExternal(vscode.Uri.parse('https://www.v2ex.com/notifications'))
          }
        })
      G.context.globalState.update('unReadLastTipTime', timestamp)
    }

    return topic
  }

  /**
   * 提交回复
   * @param topicLink 话题链接，如：https://www.v2ex.com/t/703733
   * @param content 回复内容
   * @param once 校验参数，可以从话题页面中获得
   */
  static async postReply(topicLink: string, content: string, once: string) {
    const params = {
      content,
      once
    }
    await http.post(topicLink, querystring.stringify(params)).catch(err => {
      console.error(err)
    })
  }

  /**
   * 感谢回复者
   * @param replyId 回复id
   * @param once 校验参数
   */
  static async thankReply(replyId: string, once: string): Promise<ThankReplyResp> {
    const resp = await http.post<ThankReplyResp>(
      `https://www.v2ex.com/thank/reply/${replyId}?once=${once}`
    )
    if (resp.status !== 200) {
      return {
        success: false,
        once: undefined
      }
    }
    return resp.data
  }

  /**
   * 检查cookie是否有效
   * @param cookie 检查的cookie
   */
  static async checkCookie(cookie: string): Promise<boolean> {
    if (!cookie) {
      return false
    }
    // 前往一个需要登录的页面检测，如果被重定向，说明cookie无效
    const res = await http.get('https://www.v2ex.com/t', {
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Cookie: cookie
      }
    })
    return res.request._redirectable._redirectCount <= 0
  }

  // 缓存的节点信息
  private static _cachedNodes: Node[] = []
  /**
   * 获取所有节点
   */
  static async getAllNodes(): Promise<Node[]> {
    if (this._cachedNodes.length) {
      return this._cachedNodes
    }
    const { data: html } = await http.get<string>('https://www.v2ex.com/planes')
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
    const res = await http.get<string>('https://www.v2ex.com/my/nodes')
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
    // 查询时上次签到时间
    const timestamp = new Date().getTime() / 1000
    const lastSignTime = G.context.globalState.get<number>('lastSignTime')
    if (lastSignTime !== undefined && timestamp - lastSignTime < 86400) {
      // 最后签到时间小于1天
      return DailyRes.repetitive
    }

    const { data: html } = await http.get<string>('/mission/daily')
    const $ = cheerio.load(html)
    // 已领取过时会提示：每日登录奖励已领取
    if ($('.fa-ok-sign').length) {
      G.context.globalState.update('lastSignTime', timestamp) // 设置最后签到时间
      return DailyRes.repetitive
    }
    // 未领取时有一个领取按钮，onclick内容是location.href = '/mission/daily/redeem?once=1111'
    const btn = $('input.super.normal.button')
    if (btn.length) {
      if (/once=(\d+)/.test(btn.attr('onclick') || '')) {
        const once = RegExp.$1
        const { data: html2 } = await http.get<string>(`/mission/daily/redeem?once=${once}`)
        const $2 = cheerio.load(html2)
        if ($2('.fa-ok-sign').length) {
          G.context.globalState.update('lastSignTime', timestamp) // 设置最后签到时间
          return DailyRes.success
        }
      }
    }
    return DailyRes.failed
  }

  /**
   * 收藏帖子
   * @param topicId 帖子id
   * @param once 收藏参数once
   */
  static async collectTopic(topicId: number, once: string) {
    // /favorite/topic/937439?once=34361
    await http.get<string>(`/favorite/topic/${topicId}?once=${once}`).catch(err => {
      console.error(err)
    })
  }

  /**
   * 取消收藏帖子
   * @param topicId 帖子id
   * @param once 收藏参数once
   */
  static async cancelCollectTopic(topicId: number, once: string) {
    // /unfavorite/topic/900126?once=34361
    await http.get<string>(`/unfavorite/topic/${topicId}?once=${once}`).catch(err => {
      console.error(err)
    })
  }

  /**
   * 向帖子发送感谢
   * @param topicId 帖子id
   * @param once once参数
   */
  static async thankTopic(topicId: number, once: string): Promise<boolean> {
    // POST /thank/topic/714502?once=30681
    // 返回结果：{success: true, once: 30681}
    const { data: res } = await http.post(`/thank/topic/${topicId}?once=${once}`)
    return !!res.success
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

  /**
   * 渲染一个页面，返回渲染后的html
   * @param page 要渲染的html页面
   * @param data 传入的数据
   */
  static renderPage(page: string, data: any = {}): string {
    const templatePath = path.join(G.context.extensionPath, 'html', page)
    const html = template(templatePath, data)
    return html
  }

  /**
   * 打开测试页面
   * @param context 插件上下文
   */
  static openTestPage() {
    const item = new TreeNode('写了一个 VSCode 上可以逛 V2EX 的插件', false)
    item.link = 'https://www.v2ex.com/t/703733'
    topicItemClick(item)
  }
}
