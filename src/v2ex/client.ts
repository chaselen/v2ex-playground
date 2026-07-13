import type { HttpFailureHandler } from '@/core/httpFailureLogging'
import { AccountService } from './services/account'
import { AuthService } from './services/auth'
import { MemberService } from './services/member'
import { NodeService } from './services/node'
import { SearchService } from './services/search'
import { TopicService } from './services/topic'
import { V2exSession } from './session'
import type {
  AccountOverview,
  AccountOverviewChangedHandler,
  AuthSessionIdentity,
  BalanceDetail,
  CheckCookieResult,
  DailySignInResult,
  DailySignInReward,
  DailySignInStatus,
  LoginExpiredHandler,
  MemberContent,
  MemberContentOptions,
  MemberInfo,
  Node,
  NodeTopicList,
  OnlineCountChangedHandler,
  SoV2exSearchParams,
  SoV2exSearchResult,
  Topic,
  TopicDetail,
  TwoFactorRequiredHandler,
  V2exNotification
} from './types'

/** V2EX 客户端配置 */
export interface V2exClientOptions {
  /** 登录失效回调 */
  onLoginExpired?: LoginExpiredHandler
  /** 需要两步验证时的回调 */
  onTwoFactorRequired?: TwoFactorRequiredHandler
  /** HTTP 请求失败回调 */
  onHttpFailure?: HttpFailureHandler
}

/** V2EX 对外客户端门面 */
export class V2exClient {
  /** V2EX 服务地址 */
  readonly baseUrl: string

  /** 当前已验证账户的用户名 */
  private accountUsername?: string
  /** 当前认证会话版本 */
  private authSessionVersion = 0
  /** 登录失效回调 */
  private readonly loginExpiredHandler?: LoginExpiredHandler
  /** V2EX HTTP 与登录会话 */
  private readonly session: V2exSession
  /** 话题领域服务 */
  private readonly topics: TopicService
  /** 用户领域服务 */
  private readonly members: MemberService
  /** 节点领域服务 */
  private readonly nodes: NodeService
  /** 账户内容领域服务 */
  private readonly account: AccountService
  /** 登录认证领域服务 */
  private readonly auth: AuthService
  /** SoV2EX 搜索领域服务 */
  private readonly searchService: SearchService

  /**
   * 创建客户端并组合会话与各领域服务
   * @param initialCookie 初始 V2EX Cookie
   * @param options 客户端配置
   */
  constructor(initialCookie?: string, options: V2exClientOptions = {}) {
    this.loginExpiredHandler = options.onLoginExpired
    this.session = new V2exSession(initialCookie, {
      ...options,
      onLoginExpired: () => this.clearExpiredLogin(this.authSessionVersion)
    })
    this.baseUrl = this.session.baseUrl
    this.auth = new AuthService(this.session)
    this.account = new AccountService(this.session, () => this.checkCookie())
    this.topics = new TopicService(this.session, this.baseUrl, () => this.auth.getOnce())
    this.members = new MemberService(this.session, this.baseUrl)
    this.nodes = new NodeService(this.session, this.baseUrl)
    this.searchService = new SearchService(this.session)
  }

  /**
   * 获取当前 V2EX Cookie
   * @param url 目标链接
   */
  getCookie(url = this.baseUrl): string {
    return this.session.getCookie(url)
  }

  /**
   * 获取可持久化的登录 Cookie
   *
   * 运行时 CookieJar 还包含服务端下发的内部 Cookie，持久化时只保留 A2/A2O
   * @param url 目标链接
   */
  getLoginCookie(url = this.baseUrl): string {
    return this.session.getLoginCookie(url)
  }

  /**
   * 设置当前 V2EX Cookie
   * @param cookie Cookie 字符串
   */
  setCookie(cookie: string): void {
    this.authSessionVersion += 1
    this.accountUsername = undefined
    this.account.reset()
    this.session.setCookie(cookie)
  }

  /**
   * 监听账户概览变化
   * @param handler 账户概览变化回调
   */
  onAccountOverviewChanged(handler: AccountOverviewChangedHandler): { dispose: () => void } {
    return this.account.onAccountOverviewChanged(handler)
  }

  /**
   * 监听在线人数变化
   * @param handler 在线人数变化回调
   */
  onOnlineCountChanged(handler: OnlineCountChangedHandler): { dispose: () => void } {
    return this.account.onOnlineCountChanged(handler)
  }

  /**
   * 根据话题 id 获取话题链接
   * @param topicId 话题 id
   * @example "703733" -> "https://www.v2ex.com/t/703733"
   */
  getTopicLinkById(topicId: string | number) {
    return this.topics.getLink(topicId)
  }

  /**
   * 获取 once 参数
   * @returns once 参数
   */
  getOnce(): Promise<string> {
    return this.auth.getOnce()
  }

  /**
   * 从链接中提取话题 id
   * @param topicLink 话题链接
   * @example "/t/1136705#reply50" -> 1136705
   * @returns 话题 id
   */
  getTopicIdByLink(topicLink: string): number | undefined {
    return this.topics.getIdByLink(topicLink)
  }

  /**
   * 根据用户名获取用户主页链接
   * @param username 用户名
   */
  getMemberLink(username: string) {
    return this.members.getLink(username)
  }

  /**
   * 获取用户基本信息
   * @param username 用户名
   */
  getMemberInfo(username: string): Promise<MemberInfo> {
    return this.members.getInfo(username)
  }

  /**
   * 获取用户活动内容
   * @param username 用户名
   * @param options 获取选项
   */
  getMemberContent(username: string, options: MemberContentOptions = {}): Promise<MemberContent> {
    return this.members.getContent(username, options)
  }

  /**
   * 根据首页标签获取话题列表
   * @param tab 标签
   */
  getTopicListByTab(tab: string): Promise<Topic[]> {
    return this.topics.getListByTab(tab)
  }

  /**
   * 根据节点获取话题列表
   * @param nodeName 节点 name
   * @param page 页码
   */
  getTopicListByNode(nodeName: string, page = 1): Promise<NodeTopicList> {
    return this.nodes.getTopics(nodeName, page)
  }

  /**
   * 获取已收藏话题
   * @param page 页码
   */
  getCollectionTopics(page = 1): Promise<{ totalPage: number; list: Topic[] }> {
    return this.account.getCollectionTopics(page)
  }

  /**
   * 获取特别关注话题
   * @param page 页码
   */
  getSpecialFollowingTopics(page = 1): Promise<{ totalPage: number; list: Topic[] }> {
    return this.account.getSpecialFollowingTopics(page)
  }

  /**
   * 获取提醒消息列表
   * @param page 页码
   */
  getNotifications(
    page = 1
  ): Promise<{ totalPage: number; totalCount: number; list: V2exNotification[] }> {
    return this.account.getNotifications(page)
  }

  /**
   * 获取话题详情
   * @param topicId 话题 id
   * @param page 回复页码
   */
  getTopicDetail(topicId: number, page = 1): Promise<TopicDetail> {
    return this.topics.getDetail(topicId, page)
  }

  /**
   * 获取账户概览
   * @param options 获取选项
   */
  async getAccountOverview(options: { force?: boolean } = {}): Promise<AccountOverview> {
    return this.account.getAccountOverview(options)
  }

  /** 获取当前已验证的认证会话身份 */
  getAuthIdentity(): AuthSessionIdentity | undefined {
    if (!this.accountUsername) return undefined
    return {
      sessionVersion: this.authSessionVersion,
      username: this.accountUsername
    }
  }

  /** 判断认证会话身份是否仍然有效 */
  isAuthIdentityCurrent(identity: AuthSessionIdentity): boolean {
    return (
      identity.sessionVersion === this.authSessionVersion &&
      identity.username === this.accountUsername
    )
  }

  /** 获取当前认证会话版本 */
  getAuthSessionVersion(): number {
    return this.authSessionVersion
  }

  /**
   * 获取在线人数
   * @param options 获取选项
   */
  async getOnlineCount(options: { force?: boolean } = {}): Promise<number | undefined> {
    return this.account.getOnlineCount(options)
  }

  /**
   * 获取账户余额详情
   * @param page 页码
   */
  getBalance(page = 1): Promise<BalanceDetail> {
    return this.account.getBalance(page)
  }

  /**
   * 提交回复
   * @param topicId 话题 id
   * @param content 回复内容
   */
  postReply(topicId: number, content: string): Promise<void> {
    return this.topics.postReply(topicId, content)
  }

  /**
   * 预览回复内容
   * @param text 回复内容
   * @param syntax 预览语法
   */
  previewReply(text: string, syntax: 'default' | 'markdown'): Promise<string> {
    return this.topics.previewReply(text, syntax)
  }

  /**
   * 感谢回复者
   * @param replyId 回复 id
   */
  thankReply(replyId: string): Promise<void> {
    return this.topics.thankReply(replyId)
  }

  /**
   * 感谢话题
   * @param topicId 话题 id
   */
  thankTopic(topicId: number): Promise<void> {
    return this.topics.thankTopic(topicId)
  }

  /** 检查 Cookie 是否有效 */
  async checkCookie(): Promise<CheckCookieResult> {
    while (true) {
      const sessionVersion = this.authSessionVersion
      const hadCookie = !!this.session.getCookie()
      const result = await this.auth.checkCookie()
      if (this.authSessionVersion !== sessionVersion) continue

      this.accountUsername = result.isValid ? result.username : undefined
      if (!result.isValid && hadCookie) {
        await this.clearExpiredLogin(sessionVersion)
      }
      return result
    }
  }

  /** 清理指定版本的失效登录会话 */
  private async clearExpiredLogin(sessionVersion: number): Promise<void> {
    if (this.authSessionVersion !== sessionVersion) return
    this.setCookie('')
    await this.loginExpiredHandler?.()
  }

  /**
   * 尝试使用 Cookie 登录
   * @param cookie 待检查的 Cookie
   * @throws {TwoFactorRequiredError} 需要两步验证
   */
  tryLogin(cookie: string): Promise<boolean> {
    return this.auth.tryLogin(cookie)
  }

  /**
   * 提交两步验证码
   * @param code 6 位验证码
   */
  submitTwoFactorCode(code: string): Promise<void> {
    return this.auth.submitTwoFactorCode(code)
  }

  /** 获取全部节点 */
  getAllNodes(): Promise<Node[]> {
    return this.nodes.getAll()
  }

  /** 获取已收藏节点 */
  getCollectionNodes(): Promise<Node[]> {
    return this.nodes.getCollection()
  }

  /** 查询每日签到状态 */
  getDailySignInStatus(): Promise<DailySignInStatus> {
    return this.account.getDailySignInStatus()
  }

  /** 查询最新一条签到奖励 */
  getDailySignInReward(): Promise<DailySignInReward | undefined> {
    return this.account.getDailySignInReward()
  }

  /**
   * 每日签到
   * @returns 签到结果
   */
  dailySignIn(sessionVersion = this.authSessionVersion): Promise<DailySignInResult> {
    return this.account.dailySignIn(() => this.authSessionVersion === sessionVersion)
  }

  /**
   * 收藏话题
   * @param topicId 话题 id
   */
  collectTopic(topicId: number): Promise<void> {
    return this.topics.collect(topicId)
  }

  /**
   * 取消收藏话题
   * @param topicId 话题 id
   */
  cancelCollectTopic(topicId: number): Promise<void> {
    return this.topics.cancelCollect(topicId)
  }

  /**
   * 取消收藏节点
   * @param nodeName 节点 name
   */
  cancelCollectNode(nodeName: string): Promise<void> {
    return this.nodes.cancelCollect(nodeName)
  }

  /**
   * 使用 SoV2EX 搜索
   * @param params 搜索参数
   */
  search(params: SoV2exSearchParams): Promise<SoV2exSearchResult> {
    return this.searchService.search(params)
  }
}
