import * as cheerio from 'cheerio/slim'
import type { AxiosResponse } from 'axios'
import picomatch from 'picomatch'
import { getConfigUrl, isV2exUrl } from '../clientUtils'
import { isSameAccountOverview, parseAccountOverview, parseOnlineCount } from '../parsers/account'
import { parseBalance, parseLatestDailySignInReward } from '../parsers/balance'
import { parsePagerTotalPage } from '../parsers/common'
import { parseTopicIdByLink, parseTopicListCells } from '../parsers/topic'
import type { V2exSession } from '../session'
import type {
  AccountOverview,
  AccountOverviewChangedHandler,
  BalanceDetail,
  DailySignInResult,
  DailySignInReward,
  DailySignInStatus,
  OnlineCountChangedHandler,
  CheckCookieResult,
  Topic,
  V2exNotification
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
  '/mission/daily/*'
])

/** 查询最新签到奖励时最多扫描的余额页数 */
const MAX_DAILY_SIGN_IN_REWARD_PAGES = 5

/** 认证会话是否仍为请求启动时的版本 */
type IsSessionCurrent = () => boolean

/** V2EX 账户内容领域服务 */
export class AccountService {
  /** 缓存的账户概览 */
  private accountOverview?: AccountOverview
  /** 缓存的在线人数 */
  private onlineCount?: number
  /** 账户概览变化监听器 */
  private readonly accountOverviewChangedHandlers = new Set<AccountOverviewChangedHandler>()
  /** 在线人数变化监听器 */
  private readonly onlineCountChangedHandlers = new Set<OnlineCountChangedHandler>()

  constructor(
    private readonly session: V2exSession,
    private readonly checkCookie: () => Promise<CheckCookieResult>
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
      dispose: () => this.accountOverviewChangedHandlers.delete(handler)
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
  async getAccountOverview(options: { force?: boolean } = {}): Promise<AccountOverview> {
    if (!options.force && this.accountOverview) return this.accountOverview
    await this.session.get<string>('/')
    return this.accountOverview || createEmptyAccountOverview()
  }

  /** 获取在线人数 */
  async getOnlineCount(options: { force?: boolean } = {}): Promise<number | undefined> {
    if (!options.force && this.onlineCount !== undefined) return this.onlineCount
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
            handler => void handler(overview, oldOverview)
          )
        }
      }
    }
    const onlineCount = parseOnlineCount($)
    if (onlineCount !== undefined && onlineCount !== this.onlineCount) {
      const oldOnlineCount = this.onlineCount
      this.onlineCount = onlineCount
      this.onlineCountChangedHandlers.forEach(handler => void handler(onlineCount, oldOnlineCount))
    }
  }

  /** 获取收藏话题 */
  getCollectionTopics(page = 1): Promise<{ totalPage: number; list: Topic[] }> {
    return this.getTopicList('/my/topics', page)
  }

  /** 获取特别关注话题 */
  getSpecialFollowingTopics(page = 1): Promise<{ totalPage: number; list: Topic[] }> {
    return this.getTopicList('/my/following', page)
  }

  /** 获取提醒列表 */
  async getNotifications(page = 1): Promise<{
    totalPage: number
    totalCount: number
    list: V2exNotification[]
  }> {
    const { data: html } = await this.session.get<string>(`/notifications?p=${page}`)
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
        payloadHtml: cell.find('.payload').first().html()?.trim() || ''
      })
    })
    return {
      totalPage: parsePagerTotalPage($),
      totalCount: Number($('.header .fr strong.gray').first().text().trim() || 0),
      list
    }
  }

  /** 获取余额详情 */
  async getBalance(page = 1): Promise<BalanceDetail> {
    const balancePage = normalizePage(page)
    const { data: html } = await this.session.get<string>(`/balance?p=${balancePage}`)
    return parseBalance(cheerio.load(html), balancePage)
  }

  /** 查询每日签到状态 */
  async getDailySignInStatus(): Promise<DailySignInStatus> {
    const { data: html } = await this.session.get<string>('/mission/daily')
    if (!cheerio.load(html)('.fa.fa-ok-sign').length) {
      return { signedIn: false }
    }
    return {
      signedIn: true,
      reward: await this.getDailySignInReward()
    }
  }

  /**
   * 从余额流水中查询最新一条每日登录奖励
   *
   * 余额流水按时间倒序排列；如果第一页没有奖励记录，则继续向后翻页，最多查询 5 页。
   */
  getDailySignInReward(): Promise<DailySignInReward | undefined> {
    return this.findDailySignInReward()
  }

  /**
   * 查询最新一条每日登录奖励，并在认证会话变化后停止翻页
   * @param isSessionCurrent 认证会话是否仍为请求启动时的版本
   */
  private async findDailySignInReward(
    isSessionCurrent?: IsSessionCurrent
  ): Promise<DailySignInReward | undefined> {
    let page = 1
    let totalPage = 1

    do {
      if (isSessionCurrent && !isSessionCurrent()) return undefined
      const detail = await this.getBalance(page)
      if (isSessionCurrent && !isSessionCurrent()) return undefined
      const reward = parseLatestDailySignInReward(detail.transactions)
      if (reward) return reward
      totalPage = detail.totalPage
      page += 1
    } while (page <= Math.min(totalPage, MAX_DAILY_SIGN_IN_REWARD_PAGES))

    return undefined
  }

  /** 执行每日签到 */
  async dailySignIn(isSessionCurrent: IsSessionCurrent = () => true): Promise<DailySignInResult> {
    // 场景 1：未登录，无法执行签到
    if (!isSessionCurrent()) return { result: 'failed', reward: 0 }
    const cookieResult = await this.checkCookie()
    if (!isSessionCurrent() || !cookieResult.isValid) return { result: 'failed', reward: 0 }

    // 记录领取前最新奖励，用于确认领取后是否产生了新流水
    const previousReward = await this.findDailySignInReward(isSessionCurrent)
    if (!isSessionCurrent()) return { result: 'failed', reward: 0 }

    const { data: html } = await this.session.get<string>('/mission/daily')
    if (!isSessionCurrent()) return { result: 'failed', reward: 0 }
    const $ = cheerio.load(html)

    // 签到页尚未进入下一个周期时，页面仍会显示已领取，最新奖励可能属于前一个日期
    // <span class="gray"><li class="fa fa-ok-sign" style="color: #0c0;"></li> &nbsp;每日登录奖励已领取</span>
    if ($('.fa.fa-ok-sign').length) {
      return {
        result: 'repetitive',
        reward: previousReward?.reward || 0,
        rewardDate: previousReward?.date
      }
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
    if (!isSessionCurrent()) return { result: 'failed', reward: 0 }
    const latestReward = await this.findDailySignInReward(isSessionCurrent)
    if (!isSessionCurrent()) return { result: 'failed', reward: 0 }
    const isNewReward = latestReward && latestReward.date !== previousReward?.date

    return {
      result: isNewReward ? 'success' : 'failed',
      reward: isNewReward ? latestReward.reward : 0,
      rewardDate: isNewReward ? latestReward.date : undefined
    }
  }

  /** 获取账户话题列表 */
  private async getTopicList(path: string, page: number) {
    const { data: html } = await this.session.get<string>(`${path}?p=${page}`)
    const $ = cheerio.load(html)
    return {
      totalPage: parsePagerTotalPage($),
      list: parseTopicListCells($, $('#Main > .box').last().children('.cell.item'))
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
    bronze: 0
  }
}

/** 归一化页码 */
function normalizePage(page?: number): number {
  return Number.isFinite(page) ? Math.max(1, Math.floor(Number(page))) : 1
}
