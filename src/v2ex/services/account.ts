import * as cheerio from 'cheerio/slim'
import dayjs from 'dayjs'
import type { AxiosResponse } from 'axios'
import picomatch from 'picomatch'
import { getConfigUrl, isV2exUrl } from '../clientUtils'
import {
  isSameAccountOverview,
  parseAccountOverview,
  parseOnlineCount,
} from '../parsers/account'
import { parseBalance } from '../parsers/balance'
import { parsePagerTotalPage } from '../parsers/common'
import { parseTopicIdByLink, parseTopicListCells } from '../parsers/topic'
import type { V2exSession } from '../session'
import type {
  AccountOverview,
  AccountOverviewChangedHandler,
  BalanceDetail,
  DailySignInResult,
  OnlineCountChangedHandler,
  Topic,
  V2exNotification,
} from '../types'

/** 会返回账户概览的 V2EX 页面路径 */
const isAccountOverviewPath = picomatch([
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
  '/mission/daily/*',
])

/** V2EX 账户内容领域服务 */
export class AccountService {
  /** 缓存的账户概览 */
  private accountOverview?: AccountOverview
  /** 缓存的在线人数 */
  private onlineCount?: number
  /** 账户概览变化监听器 */
  private readonly accountOverviewChangedHandlers =
    new Set<AccountOverviewChangedHandler>()
  /** 在线人数变化监听器 */
  private readonly onlineCountChangedHandlers =
    new Set<OnlineCountChangedHandler>()

  constructor(
    private readonly session: V2exSession,
    private readonly checkCookie: () => Promise<boolean>,
  ) {
    this.session.onResponse(response => this.updateFromResponse(response))
  }

  /** 清理账户摘要缓存 */
  reset(): void {
    this.accountOverview = undefined
    this.onlineCount = undefined
  }

  /** 监听账户概览变化 */
  onAccountOverviewChanged(handler: AccountOverviewChangedHandler): {
    dispose: () => void
  } {
    this.accountOverviewChangedHandlers.add(handler)
    return {
      dispose: () => this.accountOverviewChangedHandlers.delete(handler),
    }
  }

  /** 监听在线人数变化 */
  onOnlineCountChanged(handler: OnlineCountChangedHandler): {
    dispose: () => void
  } {
    this.onlineCountChangedHandlers.add(handler)
    return { dispose: () => this.onlineCountChangedHandlers.delete(handler) }
  }

  /** 获取账户概览 */
  async getAccountOverview(
    options: { force?: boolean } = {},
  ): Promise<AccountOverview> {
    if (!options.force && this.accountOverview) return this.accountOverview
    await this.session.get<string>('/')
    return this.accountOverview || createEmptyAccountOverview()
  }

  /** 获取在线人数 */
  async getOnlineCount(
    options: { force?: boolean } = {},
  ): Promise<number | undefined> {
    if (!options.force && this.onlineCount !== undefined)
      return this.onlineCount
    await this.session.get<string>('/')
    return this.onlineCount
  }

  /** 从 V2EX HTML 响应同步账户摘要 */
  private updateFromResponse(response: AxiosResponse): void {
    if (typeof response.data !== 'string') return
    const requestUrl = getConfigUrl(response.config, this.session.baseUrl)
    if (!isV2exUrl(requestUrl)) return
    const $ = cheerio.load(response.data)
    if (isAccountOverviewPath(requestUrl.pathname)) {
      const overview = parseAccountOverview($)
      if (overview) {
        const oldOverview = this.accountOverview
        this.accountOverview = overview
        if (!oldOverview || !isSameAccountOverview(overview, oldOverview)) {
          this.accountOverviewChangedHandlers.forEach(
            handler => void handler(overview, oldOverview),
          )
        }
      }
    }
    const onlineCount = parseOnlineCount($)
    if (onlineCount !== undefined && onlineCount !== this.onlineCount) {
      const oldOnlineCount = this.onlineCount
      this.onlineCount = onlineCount
      this.onlineCountChangedHandlers.forEach(
        handler => void handler(onlineCount, oldOnlineCount),
      )
    }
  }

  /** 获取收藏话题 */
  getCollectionTopics(page = 1): Promise<{ totalPage: number; list: Topic[] }> {
    return this.getTopicList('/my/topics', page)
  }

  /** 获取特别关注话题 */
  getSpecialFollowingTopics(
    page = 1,
  ): Promise<{ totalPage: number; list: Topic[] }> {
    return this.getTopicList('/my/following', page)
  }

  /** 获取提醒列表 */
  async getNotifications(page = 1): Promise<{
    totalPage: number
    totalCount: number
    list: V2exNotification[]
  }> {
    const { data: html } = await this.session.get<string>(
      `/notifications?p=${page}`,
    )
    const $ = cheerio.load(html)
    const list: V2exNotification[] = []
    $('#notifications > .cell[id^="n_"]').each((_, element) => {
      const cell = $(element)
      const avatar = cell.find('img.avatar').first()
      const member = cell.find('a[href^="/member/"]').first()
      const summary = cell.find('span.fade').first()
      const topic = summary.find('a.topic-link').first()
      const topicPath = topic.attr('href') || ''
      const id = Number((cell.attr('id') || '').replace(/^n_/, '')) || 0
      if (!id) return
      list.push({
        id,
        avatar: avatar.attr('src') || '',
        username: member.text().trim() || avatar.attr('alt') || '',
        memberPath: member.attr('href') || '',
        summaryHtml: summary.html()?.trim() || '',
        topicId: topicPath ? parseTopicIdByLink(topicPath) : undefined,
        topicTitle: topic.text().trim() || undefined,
        topicPath: topicPath || undefined,
        time: cell.find('span.snow').first().text().trim(),
        payloadHtml: cell.find('.payload').first().html()?.trim() || '',
      })
    })
    return {
      totalPage: parsePagerTotalPage($),
      totalCount: Number(
        $('.header .fr strong.gray').first().text().trim() || 0,
      ),
      list,
    }
  }

  /** 获取余额详情 */
  async getBalance(page = 1): Promise<BalanceDetail> {
    const balancePage = normalizePage(page)
    const { data: html } = await this.session.get<string>(
      `/balance?p=${balancePage}`,
    )
    return parseBalance(cheerio.load(html), balancePage)
  }

  /** 查询每日签到状态 */
  async getDailySignInStatus(): Promise<boolean> {
    return (await this.getDailySignInReward()) > 0
  }

  /** 查询当日签到奖励 */
  async getDailySignInReward(): Promise<number> {
    return this.getDailySignInRewardByDate(dayjs().format('YYYY-MM-DD'))
  }

  /**
   * 查询指定日期的签到奖励
   * @param date 日期，格式为 YYYY-MM-DD
   */
  private async getDailySignInRewardByDate(date: string): Promise<number> {
    const { data: html } = await this.session.get<string>('/balance')
    const $ = cheerio.load(html)
    let reward = 0
    $('table.data tr').each((_, element) => {
      const cells = $(element).children('td')
      if (!reward && cells.eq(0).text().trim().startsWith(date)) {
        if (cells.eq(1).text().trim() === '每日登录奖励') {
          reward = Number(cells.eq(2).text().trim()) || 0
        }
      }
    })
    return reward
  }

  /** 执行每日签到 */
  async dailySignIn(): Promise<DailySignInResult> {
    // 场景 1：未登录，无法执行签到
    if (!(await this.checkCookie())) return { result: 'failed', reward: 0 }

    // 场景 2：当日余额中已有登录奖励，说明已经签到
    const currentReward = await this.getDailySignInReward()
    if (currentReward > 0)
      return { result: 'repetitive', reward: currentReward }

    const { data: html } = await this.session.get<string>('/mission/daily')
    const $ = cheerio.load(html)

    // 场景 3：签到状态并非在本地零点刷新，0:30分时，页面可能仍显示已领取，但奖励记录属于前一天
    // <span class="gray"><li class="fa fa-ok-sign" style="color: #0c0;"></li> &nbsp;每日登录奖励已领取</span>
    if ($('.fa.fa-ok-sign').length) {
      const previousReward = await this.getDailySignInRewardByDate(
        dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
      )
      return { result: 'repetitive', reward: previousReward }
    }

    // 场景 4：尚未签到，从领取按钮中解析本次请求所需的 once 参数
    const once = $('input[value^="领取"]')
      .first()
      .attr('onclick')
      ?.match(/\/mission\/daily\/redeem\?once=(\d+)/)?.[1]

    // 页面既没有已领取标记，也没有有效的领取入口
    if (!once) return { result: 'failed', reward: 0 }

    // 领取奖励后通过余额记录确认签到结果
    await this.session.get(`/mission/daily/redeem?once=${once}`)
    const reward = await this.getDailySignInReward()

    return { result: reward > 0 ? 'success' : 'failed', reward }
  }

  /** 获取账户话题列表 */
  private async getTopicList(path: string, page: number) {
    const { data: html } = await this.session.get<string>(`${path}?p=${page}`)
    const $ = cheerio.load(html)
    return {
      totalPage: parsePagerTotalPage($),
      list: parseTopicListCells(
        $,
        $('#Main > .box').last().children('.cell.item'),
      ),
    }
  }
}

/** 创建未登录时的空账户概览 */
function createEmptyAccountOverview(): AccountOverview {
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
    bronze: 0,
  }
}

/** 归一化页码 */
function normalizePage(page?: number): number {
  return Number.isFinite(page) ? Math.max(1, Math.floor(Number(page))) : 1
}
