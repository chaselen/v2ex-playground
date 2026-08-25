import type { HttpFailureHandler } from '@/core/httpFailureLogging'
import { AccountService } from './services/account'
import { AuthService } from './services/auth'
import { MemberService } from './services/member'
import { NodeService } from './services/node'
import { SearchService } from './services/search'
import { TopicService } from './services/topic'
import { V2exSession } from './session'
import { normalizeLoginCookie } from './cookie'
import { TwoFactorRequiredError } from './types'
import type {
  AccountOverview,
  AccountOverviewChangedHandler,
  BalanceDetail,
  CheckCookieResult,
  CreateTopicInput,
  CreateTopicResult,
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
  TagTopicList,
  Topic,
  TopicDetail,
  TopicSyntax,
  TwoFactorRequiredHandler,
  TwoFactorVerification,
  V2exNotification
} from './types'

/** 登录 Cookie 持久化存储 */
export interface LoginCookieStore {
  /** 读取持久化登录 Cookie */
  load(): Promise<string>
  /** 保存持久化登录 Cookie */
  save(cookie: string): Promise<void>
}

/** 切换登录 Cookie 的结果 */
export type LoginCookieSwitchResult = 'authenticated' | 'canceled' | 'invalid'

/** V2EX 客户端配置 */
export interface V2exClientOptions {
  /** 登录 Cookie 持久化存储 */
  loginCookieStore?: LoginCookieStore
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

  /** 当前已验证用户名 */
  private authenticatedUsername?: string

  /** 当前认证状态修订号 */
  private authRevision = 0

  /** 当前登录状态检查任务 */
  private authenticationCheckTask?: {
    /** 检查发起时的认证状态修订号 */
    revision: number
    /** 登录状态检查 Promise */
    promise: Promise<boolean>
  }

  /** 当前认证状态对应的两步验证操作 */
  private twoFactorVerification!: TwoFactorVerification

  /** 凭据写入队列 */
  private credentialMutation = Promise.resolve()

  /** 客户端配置 */
  private readonly options: V2exClientOptions

  /**
   * 从持久化存储创建 V2EX 客户端
   * @param options 客户端配置
   */
  static async create(options: V2exClientOptions = {}): Promise<V2exClient> {
    const initialCookie = await options.loginCookieStore?.load()
    return new V2exClient(initialCookie, options)
  }

  /**
   * 创建客户端并组合会话与各领域服务
   * @param initialCookie 初始 V2EX Cookie
   * @param options 客户端配置
   */
  constructor(initialCookie?: string, options: V2exClientOptions = {}) {
    this.options = options
    this.session = new V2exSession(initialCookie, {
      onLoginExpired: () => this.handleLoginExpired(),
      onTwoFactorRequired: () => this.handleTwoFactorRequired(),
      onTwoFactorVerified: () => this.handleTwoFactorVerified(),
      onHttpFailure: options.onHttpFailure
    })
    this.baseUrl = this.session.baseUrl
    this.auth = new AuthService(this.session)
    this.account = new AccountService(this.session)
    this.topics = new TopicService(this.session, this.baseUrl, () => this.auth.getOnce())
    this.members = new MemberService(this.session, this.baseUrl)
    this.nodes = new NodeService(this.session, this.baseUrl)
    this.searchService = new SearchService(this.session)
    this.twoFactorVerification = this.createTwoFactorVerification()
  }

  /**
   * 获取可持久化的登录 Cookie
   *
   * 运行时 CookieJar 还包含服务端下发的内部 Cookie，持久化时只保留 A2/A2O
   */
  getLoginCookie(): string {
    return this.session.getLoginCookie()
  }

  /** 当前登录 Cookie 是否已验证有效且已取得登录用户名 */
  isAuthenticated(): boolean {
    return !!this.authenticatedUsername
  }

  /** 当前是否存在已验证账号或待验证登录凭据，仅用于决定登录态 UI */
  hasLoginSession(): boolean {
    return this.isAuthenticated() || !!this.getLoginCookie()
  }

  /** 获取当前已验证用户名 */
  getAuthenticatedUsername(): string | undefined {
    return this.authenticatedUsername
  }

  /** 确保当前登录 Cookie 已经通过验证 */
  ensureAuthenticated(): Promise<boolean> {
    return this.getAuthenticationCheck()
  }

  /** 强制刷新当前登录 Cookie 的验证状态 */
  refreshAuthentication(): Promise<boolean> {
    return this.getAuthenticationCheck(true)
  }

  /**
   * 在隔离会话中验证并切换登录 Cookie
   * @param cookie 候选登录 Cookie
   */
  async switchLoginCookie(cookie: string): Promise<LoginCookieSwitchResult> {
    const loginCookie = normalizeLoginCookie(cookie)
    if (!loginCookie) return 'invalid'

    const revision = this.authRevision
    let twoFactorCanceled = false
    const candidate = new V2exClient(loginCookie, {
      onTwoFactorRequired: async verification => {
        const verified = (await this.options.onTwoFactorRequired?.(verification)) ?? false
        twoFactorCanceled = !verified
        return verified
      },
      onHttpFailure: this.options.onHttpFailure
    })

    let result: CheckCookieResult
    try {
      result = await candidate.auth.checkCookie()
    } catch (err) {
      if (twoFactorCanceled && err instanceof TwoFactorRequiredError) {
        return 'canceled'
      }
      throw err
    }
    if (!result.isValid) return 'invalid'

    const committed = await this.enqueueCredentialMutation(async () => {
      if (this.authRevision !== revision) return false
      const candidateCookie = candidate.getLoginCookie()
      await this.options.loginCookieStore?.save(candidateCookie)
      if (this.authRevision !== revision) return false
      this.replaceLoginCookie(candidateCookie, result.username)
      return true
    })
    return committed ? 'authenticated' : 'canceled'
  }

  /** 主动退出登录 */
  async logout(): Promise<void> {
    const revision = ++this.authRevision
    this.twoFactorVerification = this.createTwoFactorVerification()
    await this.enqueueCredentialMutation(async () => {
      await this.options.loginCookieStore?.save('')
      if (this.authRevision !== revision) return
      this.clearAuthentication()
    })
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
   * 获取标签页链接
   * @param tag 标签名称
   */
  getTagLink(tag: string): string {
    return this.topics.getTagLink(tag)
  }

  /**
   * 根据标签获取话题列表
   * @param tag 标签名称
   */
  getTopicListByTag(tag: string): Promise<TagTopicList> {
    return this.topics.getListByTag(tag)
  }

  /**
   * 根据节点 name 获取节点页链接
   * @param nodeName 节点 name
   */
  getNodeLink(nodeName: string): string {
    return this.nodes.getLink(nodeName)
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

  /** 创作新主题 */
  createTopic(input: CreateTopicInput): Promise<CreateTopicResult> {
    return this.topics.create(input)
  }

  /**
   * 获取账户概览
   * @param options 获取选项
   */
  async getAccountOverview(options: { force?: boolean } = {}): Promise<AccountOverview> {
    return this.account.getAccountOverview(options)
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

  /** 预览新主题正文 */
  previewTopic(text: string, syntax: TopicSyntax): Promise<string> {
    return this.topics.previewTopic(text, syntax)
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
  dailySignIn(): Promise<DailySignInResult> {
    return this.account.dailySignIn()
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
   * 收藏节点
   * @param nodeName 节点 name
   */
  collectNode(nodeName: string): Promise<void> {
    return this.nodes.collect(nodeName)
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

  /** 获取当前登录状态检查任务 */
  private getAuthenticationCheck(force = false): Promise<boolean> {
    const revision = this.authRevision
    if (this.authenticationCheckTask?.revision === revision) {
      return this.authenticationCheckTask.promise
    }
    if (!force && this.authenticatedUsername) {
      return Promise.resolve(true)
    }
    if (!this.getLoginCookie()) {
      return Promise.resolve(false)
    }

    const task = {
      revision,
      promise: Promise.resolve(false)
    }
    task.promise = this.checkAuthentication(revision).finally(() => {
      if (this.authenticationCheckTask === task) {
        this.authenticationCheckTask = undefined
      }
    })
    this.authenticationCheckTask = task
    return task.promise
  }

  /**
   * 检查指定认证状态的登录 Cookie
   * @param revision 检查发起时的认证状态修订号
   */
  private async checkAuthentication(revision: number): Promise<boolean> {
    const result = await this.auth.checkCookie()
    if (this.authRevision !== revision) return this.isAuthenticated()
    if (!result.isValid) {
      await this.session.expireLogin()
      return false
    }
    this.authenticatedUsername = result.username
    return true
  }

  /** 处理当前业务会话的两步验证 */
  private async handleTwoFactorRequired(): Promise<boolean> {
    const revision = this.authRevision
    const verified = (await this.options.onTwoFactorRequired?.(this.twoFactorVerification)) ?? false
    return verified && this.authRevision === revision
  }

  /** 两步验证完成且原请求重试成功后持久化最新登录 Cookie */
  private async handleTwoFactorVerified(): Promise<void> {
    const revision = this.authRevision
    const loginCookie = this.getLoginCookie()
    if (!loginCookie) return
    await this.enqueueCredentialMutation(async () => {
      if (this.authRevision !== revision) return
      await this.options.loginCookieStore?.save(loginCookie)
    })
  }

  /** 创建只作用于当前认证状态的两步验证操作 */
  private createTwoFactorVerification(): TwoFactorVerification {
    const revision = this.authRevision
    return {
      submitCode: async code => {
        if (this.authRevision !== revision) {
          throw new Error('登录状态已更新，请重新操作')
        }
        await this.auth.submitTwoFactorCode(code)
        if (this.authRevision !== revision) {
          throw new Error('登录状态已更新，请重新操作')
        }
      }
    }
  }

  /** 登录失效后清理认证状态和持久化凭据 */
  private async handleLoginExpired(): Promise<void> {
    this.invalidateAuthentication()
    try {
      await this.enqueueCredentialMutation(async () => {
        await this.options.loginCookieStore?.save('')
      })
    } finally {
      await this.options.onLoginExpired?.()
    }
  }

  /**
   * 替换已经验证的登录 Cookie
   * @param cookie 登录 Cookie
   * @param username 已验证用户名
   */
  private replaceLoginCookie(cookie: string, username: string): void {
    this.authRevision += 1
    this.session.setCookie(cookie)
    this.authenticatedUsername = username
    this.account.reset()
    this.twoFactorVerification = this.createTwoFactorVerification()
  }

  /** 提交清空运行时登录状态 */
  private clearAuthentication(): void {
    this.authRevision += 1
    this.session.setCookie('')
    this.invalidateAuthenticationState()
  }

  /** 标记 Session 已经清理的登录状态失效 */
  private invalidateAuthentication(): void {
    this.authRevision += 1
    this.invalidateAuthenticationState()
  }

  /** 清理认证派生状态 */
  private invalidateAuthenticationState(): void {
    this.authenticatedUsername = undefined
    this.account.reset()
    this.twoFactorVerification = this.createTwoFactorVerification()
  }

  /**
   * 串行执行持久化凭据写入
   * @param operation 凭据写入操作
   */
  private enqueueCredentialMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.credentialMutation.then(operation, operation)
    this.credentialMutation = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}
