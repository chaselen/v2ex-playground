import * as cheerio from 'cheerio/slim'
import type { AxiosResponse } from 'axios'
import picomatch from 'picomatch'
import { getConfigUrl, isV2exSessionUrl } from '../clientUtils'
import {
  isSameAccountOverview,
  parseAccountOverview,
  parseBlockedMemberIds,
  parseFollowingMembers,
  parseIgnoredTopicIds,
  parseOnlineCount,
  parseAccountTopics
} from '../parsers/account'
import { parseBalance, parseLatestDailySignInReward } from '../parsers/balance'
import { parseNotifications } from '../parsers/notification'
import { parseDailySignInPage } from '../parsers/dailySignIn'
import type { MemberService } from './member'
import type { V2exSession } from '../session'
import {
  LoginRequiredError,
  type AccountOverview,
  type AccountOverviewChangedHandler,
  type BalanceDetail,
  type BlockedMember,
  type DailySignInResult,
  type DailySignInReward,
  type DailySignInStatus,
  type FollowingMember,
  type OnlineCountChangedHandler,
  type Topic,
  type V2exNotification
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
    private readonly members: Pick<MemberService, 'getSummaryById'>
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
    if (!isV2exSessionUrl(requestUrl)) return
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

  /** 获取特别关注的用户 */
  async getFollowingMembers(): Promise<FollowingMember[]> {
    const { data: html } = await this.session.get<string>('/my/following')
    return parseFollowingMembers(cheerio.load(html))
  }

  /**
   * 从登录态页面脚本读取屏蔽用户与忽略主题编号
   *
   * 登录后多个页面会注入 `blocked` 与 `ignored_topics` 数组；此处请求 `/?tab=all` 作为读取入口。
   * 返回顺序均为站点原始顺序：先屏蔽 / 先忽略在前。
   */
  async getBlockedAndIgnoredIds(): Promise<{
    blockedMemberIds: number[]
    ignoredTopicIds: number[]
  }> {
    const { data: html } = await this.session.get<string>('/?tab=all')
    return {
      blockedMemberIds: parseBlockedMemberIds(html),
      ignoredTopicIds: parseIgnoredTopicIds(html)
    }
  }

  /**
   * 获取当前登录用户忽略的主题编号
   *
   * 返回站点原始顺序：先忽略在前
   */
  async getIgnoredTopicIds(): Promise<number[]> {
    const { ignoredTopicIds } = await this.getBlockedAndIgnoredIds()
    return ignoredTopicIds
  }

  /**
   * 获取当前登录用户屏蔽的用户
   *
   * 从页面脚本读取 `blocked` 编号列表，再逐个请求成员 API 补齐头像与用户名。
   * 返回顺序与脚本一致：先屏蔽在前。
   * 成员不存在（`status: "error"`，如已注销）或请求失败时跳过该编号，
   * 因此结果长度可能小于脚本中的 `blocked` 原始数量。
   */
  async getBlockedMembers(): Promise<BlockedMember[]> {
    const { blockedMembers } = await this.getBlockedMembersAndIgnoredTopicIds()
    return blockedMembers
  }

  /**
   * 一次请求同时返回屏蔽用户摘要与忽略主题编号
   *
   * `blockedMembers` / `ignoredTopicIds` 均为站点原始顺序：先屏蔽 / 先忽略在前。
   * `blockedMembers` 在成员 API 查不到或失败时会跳过对应编号，长度可能短于脚本 `blocked`；
   * `ignoredTopicIds` 仍为脚本原始编号列表，不因后续主题详情失败而缩短。
   */
  async getBlockedMembersAndIgnoredTopicIds(): Promise<{
    blockedMembers: BlockedMember[]
    ignoredTopicIds: number[]
  }> {
    const { blockedMemberIds, ignoredTopicIds } = await this.getBlockedAndIgnoredIds()
    return {
      blockedMembers: await this.resolveBlockedMembers(blockedMemberIds),
      ignoredTopicIds
    }
  }

  /**
   * 按屏蔽用户编号补齐头像与用户名
   * @param blockedMemberIds 屏蔽用户编号
   */
  private async resolveBlockedMembers(blockedMemberIds: number[]): Promise<BlockedMember[]> {
    if (!blockedMemberIds.length) {
      return []
    }

    const members = await Promise.all(
      blockedMemberIds.map(async memberId => {
        try {
          return await this.members.getSummaryById(memberId)
        } catch {
          return undefined
        }
      })
    )

    return members.filter((member): member is BlockedMember => !!member)
  }

  /** 获取提醒列表 */
  async getNotifications(page = 1): Promise<{
    totalPage: number
    totalCount: number
    list: V2exNotification[]
  }> {
    const { data: html } = await this.session.get<string>(`/notifications?p=${page}`)
    return parseNotifications(cheerio.load(html))
  }

  /** 删除前获取最新 once，避免使用已被其他写操作消耗的页面令牌 */
  async deleteNotification(notificationId: number): Promise<void> {
    if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
      throw new Error('无效的消息编号')
    }
    const once = await this.session.getOnce()
    await this.session.post(
      `/delete/notification/${notificationId}?once=${encodeURIComponent(once)}`
    )
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
    if (!parseDailySignInPage(cheerio.load(html)).signedIn) {
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

  /** 查询最新一条每日登录奖励 */
  private async findDailySignInReward(): Promise<DailySignInReward | undefined> {
    let page = 1
    let totalPage = 1

    do {
      const detail = await this.getBalance(page)
      const reward = parseLatestDailySignInReward(detail.transactions)
      if (reward) return reward
      totalPage = detail.totalPage
      page += 1
    } while (page <= Math.min(totalPage, MAX_DAILY_SIGN_IN_REWARD_PAGES))

    return undefined
  }

  /** 执行每日签到 */
  async dailySignIn(): Promise<DailySignInResult> {
    const failed: DailySignInResult = { result: 'failed', reward: 0 }
    const loginIdentity = getLoginIdentity(this.session)
    if (!loginIdentity) return failed

    try {
      const { data: html } = await this.session.get<string>('/mission/daily')
      const { signedIn, once } = parseDailySignInPage(cheerio.load(html))

      // 记录领取前最新奖励，用任务日确认领取后是否产生了新流水
      const previousReward = await this.findDailySignInReward()

      // 签到页尚未刷新到新一天时，页面仍会显示已领取，最新奖励可能属于前一个任务日
      if (signedIn) {
        return {
          result: 'repetitive',
          reward: previousReward?.reward || 0,
          rewardDate: previousReward?.date
        }
      }

      // 页面既没有已领取标记，也没有有效的领取入口
      if (!once) return failed

      // 领取奖励后通过余额记录确认签到结果
      if (getLoginIdentity(this.session) !== loginIdentity) return failed
      await this.session.get(`/mission/daily/redeem?once=${once}`)
      if (getLoginIdentity(this.session) !== loginIdentity) return failed
      const latestReward = await this.findDailySignInReward()
      // 比较任务日而非流水墙钟日：同一自然日可先后领到上一任务日与新任务日
      const isNewReward = !!latestReward && latestReward.date !== previousReward?.date

      return {
        result: isNewReward ? 'success' : 'failed',
        reward: isNewReward ? latestReward.reward : 0,
        rewardDate: isNewReward ? latestReward.date : undefined
      }
    } catch (err) {
      if (err instanceof LoginRequiredError) return failed
      throw err
    }
  }

  /** 获取账户话题列表 */
  private async getTopicList(path: string, page: number) {
    const { data: html } = await this.session.get<string>(`${path}?p=${page}`)
    return parseAccountTopics(cheerio.load(html))
  }
}

/** 创建未登录时的空账户概览 */
function createEmptyAccountOverview(): AccountOverview {
  return {
    avatar: '',
    username: '',
    tagline: '',
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

/** 获取用于识别当前账号的 A2 Cookie */
function getLoginIdentity(session: V2exSession): string {
  return session.getLoginCookie().split(';', 1)[0]
}
