import * as cheerio from 'cheerio/slim'
import type { AxiosResponse } from 'axios'
import picomatch from 'picomatch'
import dayjs, { BEIJING_UTC_OFFSET } from '@/core/dayjs'
import { getConfigUrl, isV2exUrl } from '../clientUtils'
import {
  isSameAccountOverview,
  parseAccountOverview,
  parseBlockedMemberIds,
  parseFollowingMembers,
  parseIgnoredTopicIds,
  parseOnlineCount
} from '../parsers/account'
import { parseBalance, parseLatestDailySignInReward } from '../parsers/balance'
import { parsePagerTotalPage } from '../parsers/common'
import { parseTopicIdByLink, parseTopicListCells } from '../parsers/topic'
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

/**
 * 成员 API `/api/members/show.json` 成功响应字段
 *
 * 成功时 `status` 为 `"found"`；用户不存在时返回
 * `{ status: "error", message: "Object Not Found", ... }`。
 */
interface MemberShowApiInfo {
  /** 用户编号 */
  id: number
  /** 用户名 */
  username: string
  /** 查询状态；成功时为 found */
  status: 'found'
  /** 常规尺寸头像 */
  avatar_normal: string
  /** 大尺寸头像 */
  avatar_large: string
  /** 迷你头像 */
  avatar_mini: string
}

/** 成员 API 用户不存在时的错误响应 */
interface MemberShowApiError {
  /** 错误状态 */
  status: 'error'
  /** 错误信息 */
  message: string
}

/**
 * 主题 API `/api/topics/show.json?id=` 单条成功响应字段
 *
 * 主题不存在时接口返回 `[]`；有结果时这些字段均会给出。
 * `last_reply_by` 无回复时为空字符串。
 */
interface TopicShowApiInfo {
  /** 主题编号 */
  id: number
  /** 标题 */
  title: string
  /** 回复数 */
  replies: number
  /** 创建时间 Unix 秒 */
  created: number
  /** 最后回复用户名；无回复时为空字符串 */
  last_reply_by: string
  /** 作者 */
  member: {
    /** 用户名 */
    username: string
  }
  /** 节点 */
  node: {
    /** 节点 name */
    name: string
    /** 节点标题 */
    title: string
  }
}

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

  constructor(private readonly session: V2exSession) {
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
   * 按主题编号列表补齐主题摘要
   *
   * 逐个请求 `/api/topics/show.json`；单个失败时跳过该编号，不中断整表，并保持入参顺序
   * @param topicIds 主题编号
   */
  async getTopicsByIds(topicIds: number[]): Promise<Topic[]> {
    if (!topicIds.length) {
      return []
    }

    const topics = await Promise.all(
      topicIds.map(async topicId => {
        try {
          return await this.getTopicListItemById(topicId)
        } catch {
          return undefined
        }
      })
    )

    return topics.filter((topic): topic is Topic => !!topic)
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
          return await this.getMemberListItemById(memberId)
        } catch {
          return undefined
        }
      })
    )

    return members.filter((member): member is BlockedMember => !!member)
  }

  /**
   * 按用户编号获取关系列表所需的用户摘要
   * @param memberId 用户编号
   */
  private async getMemberListItemById(memberId: number): Promise<BlockedMember> {
    const { data } = await this.session.get<MemberShowApiInfo | MemberShowApiError>(
      '/api/members/show.json',
      {
        params: { id: memberId }
      }
    )
    if (!isMemberShowApiInfo(data)) {
      throw new Error(`未找到编号为 ${memberId} 的用户`)
    }

    const username = data.username.trim()
    if (!username) {
      throw new Error(`未找到编号为 ${memberId} 的用户`)
    }

    return {
      memberId: data.id > 0 ? data.id : memberId,
      username,
      avatar: pickMemberAvatar(data)
    }
  }

  /**
   * 按主题编号获取忽略列表所需的主题摘要
   * @param topicId 主题编号
   */
  private async getTopicListItemById(topicId: number): Promise<Topic> {
    const { data } = await this.session.get<TopicShowApiInfo[]>('/api/topics/show.json', {
      params: { id: topicId }
    })
    const item = Array.isArray(data) ? data[0] : undefined
    if (!item) {
      throw new Error(`未找到编号为 ${topicId} 的主题`)
    }

    const title = item.title.trim()
    if (!title) {
      throw new Error(`未找到编号为 ${topicId} 的主题`)
    }

    const nodeName = item.node.name.trim()
    const nodeTitle = item.node.title.trim()
    const authorName = item.member.username.trim()
    const lastReplyUser = item.last_reply_by.trim()
    const publishedAt = dayjs
      .unix(item.created)
      .utcOffset(BEIJING_UTC_OFFSET)
      .format('YYYY-MM-DD HH:mm:ss')

    return {
      id: item.id > 0 ? item.id : topicId,
      title,
      node: {
        name: nodeName,
        title: nodeTitle || nodeName
      },
      authorName: authorName || undefined,
      replies: Math.max(0, Math.floor(item.replies)),
      displayTime: publishedAt,
      publishedAt,
      lastReplyUser: lastReplyUser || undefined
    }
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
      const $ = cheerio.load(html)

      // 记录领取前最新奖励，用任务日确认领取后是否产生了新流水
      const previousReward = await this.findDailySignInReward()

      // 签到页尚未刷新到新一天时，页面仍会显示已领取，最新奖励可能属于前一个任务日
      // <span class="gray"><li class="fa fa-ok-sign" style="color: #0c0;"></li> &nbsp;每日登录奖励已领取</span>
      if ($('.fa.fa-ok-sign').length) {
        return {
          result: 'repetitive',
          reward: previousReward?.reward || 0,
          rewardDate: previousReward?.date
        }
      }

      // 尚未签到，从领取按钮中解析本次请求所需的 once 参数
      const once = $('input[value^="领取"]')
        .first()
        .attr('onclick')
        ?.match(/\/mission\/daily\/redeem\?once=(\d+)/)?.[1]

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

/**
 * 判断成员 API 响应是否为成功用户资料
 *
 * 成功与失败响应都带 `status`：成功为 `"found"`，失败为 `"error"`。
 * @param data 成员 API 响应
 */
function isMemberShowApiInfo(
  data: MemberShowApiInfo | MemberShowApiError
): data is MemberShowApiInfo {
  return (
    typeof data === 'object' &&
    data !== null &&
    data.status !== 'error' &&
    'username' in data &&
    typeof data.username === 'string'
  )
}

/**
 * 从成员 API 中选取列表展示头像
 * @param member 成员 API 响应
 */
function pickMemberAvatar(member: MemberShowApiInfo): string {
  for (const value of [member.avatar_normal, member.avatar_large, member.avatar_mini]) {
    const avatar = value.trim()
    if (avatar) {
      return avatar
    }
  }
  return ''
}

/** 归一化页码 */
function normalizePage(page?: number): number {
  return Number.isFinite(page) ? Math.max(1, Math.floor(Number(page))) : 1
}

/** 获取用于识别当前账号的 A2 Cookie */
function getLoginIdentity(session: V2exSession): string {
  return session.getLoginCookie().split(';', 1)[0]
}
