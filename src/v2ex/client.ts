import type { HttpFailureHandler } from '@/core/httpFailureLogging'
import { HelpService } from './services/help'
import { AccountService } from './services/account'
import { AuthService } from './services/auth'
import { PasswordResetService } from './services/passwordReset'
import { MemberService } from './services/member'
import { NodeService } from './services/node'
import { SearchService } from './services/search'
import { TopicService } from './services/topic'
import { V2exSession } from './session'
import { normalizeLoginCookie } from './cookie'
import { getConfigUrl } from './clientUtils'
import { TwoFactorRequiredError } from './types'
import type {
  CheckCookieResult,
  LoginExpiredHandler,
  TwoFactorRequiredHandler,
  TwoFactorVerification,
  PasswordLoginAttempt,
  PasswordResetAttempt
} from './types'

/** 普通响应中的认证 Cookie 更新合并为最多每分钟一次保存 */
const LOGIN_COOKIE_SAVE_DELAY = 60_000

/** 凭据保存或失效清理失败后的重试间隔 */
const LOGIN_COOKIE_SAVE_RETRY_DELAY = 30_000

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
  /** 后台凭据保存失败通知，不改变已完成业务操作的结果 */
  onCredentialSaveFailed?: (error: unknown) => void
}

/** 管理 V2EX 会话与认证，并提供共享会话的领域 API */
export class V2exClient {
  /** V2EX 服务地址 */
  readonly baseUrl: string

  /** V2EX HTTP 与登录会话 */
  private readonly session: V2exSession
  /** 话题领域服务 */
  readonly topics: TopicService
  /** 用户领域服务 */
  readonly members: MemberService
  /** 节点领域服务 */
  readonly nodes: NodeService
  /** 账户内容领域服务 */
  readonly account: Omit<AccountService, 'reset'>
  /** 账户服务内部生命周期操作，不向业务调用方公开 */
  private readonly accountService: AccountService
  /** 登录认证领域服务 */
  private readonly auth: AuthService
  /** SoV2EX 搜索领域服务 */
  readonly search: SearchService
  /** 原站帮助领域服务 */
  readonly help: HelpService

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

  /** 最近一次成功持久化的登录 Cookie */
  private persistedLoginCookie: string
  /** 合并普通更新或重试失败清理的定时任务 */
  private credentialSaveTimer?: ReturnType<typeof setTimeout>
  /** 当前保存失败是否已经通知，成功保存后重置 */
  private credentialSaveFailureNotified = false
  /** 当前已通知失效的认证修订号 */
  private loginExpirationRevision?: number
  private disposed = false
  private logoutTask?: Promise<boolean>
  private twoFactorAbort = new AbortController()

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
    this.persistedLoginCookie = normalizeLoginCookie(initialCookie)
    this.session = new V2exSession(initialCookie, {
      onLoginExpired: () => this.handleLoginExpired(),
      onTwoFactorRequired: () => this.handleTwoFactorRequired(),
      onTwoFactorVerified: () => this.handleTwoFactorVerified(),
      onHttpFailure: options.onHttpFailure
    })
    this.baseUrl = this.session.baseUrl
    this.auth = new AuthService(this.session)
    this.topics = new TopicService(this.session, this.baseUrl)
    this.members = new MemberService(this.session)
    this.accountService = new AccountService(this.session, this.members)
    this.account = this.accountService
    this.nodes = new NodeService(this.session, this.baseUrl)
    this.search = new SearchService(this.session)
    this.help = new HelpService(this.session)
    this.twoFactorVerification = this.createTwoFactorVerification()
    this.session.onResponse(response => {
      if (getConfigUrl(response.config, this.baseUrl).pathname === '/2fa') return
      if (this.isAuthenticated() && this.getLoginCookie() !== this.persistedLoginCookie) {
        this.scheduleCredentialSave(LOGIN_COOKIE_SAVE_DELAY)
      }
    })
  }

  /** 释放凭据保存和清理重试任务 */
  dispose(): void {
    this.disposed = true
    this.twoFactorAbort.abort()
    this.clearCredentialSaveTimer()
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
  async switchLoginCookie(
    cookie: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<LoginCookieSwitchResult> {
    const loginCookie = normalizeLoginCookie(cookie)
    if (!loginCookie) return 'invalid'

    const revision = this.authRevision
    let twoFactorCanceled = false
    const candidate = new V2exClient(loginCookie, {
      onTwoFactorRequired: async verification => {
        if (options.signal?.aborted || this.authRevision !== revision) return false
        const verified = (await this.options.onTwoFactorRequired?.(verification)) ?? false
        twoFactorCanceled = !verified
        return verified && !options.signal?.aborted && this.authRevision === revision
      },
      onHttpFailure: this.options.onHttpFailure
    })

    const cancel = () => candidate.dispose()
    const parentSignal = this.twoFactorAbort.signal
    parentSignal.addEventListener('abort', cancel, { once: true })
    options.signal?.addEventListener('abort', cancel, { once: true })
    if (options.signal?.aborted) cancel()
    try {
      let result: CheckCookieResult
      try {
        result = await candidate.auth.checkCookie()
      } catch (err) {
        if (
          (twoFactorCanceled || options.signal?.aborted || parentSignal.aborted) &&
          err instanceof TwoFactorRequiredError
        ) {
          return 'canceled'
        }
        throw err
      }
      if (!result.isValid) return 'invalid'

      return await this.commitCandidate(
        candidate,
        result,
        revision,
        () => !options.signal?.aborted && !parentSignal.aborted
      )
    } finally {
      options.signal?.removeEventListener('abort', cancel)
      parentSignal.removeEventListener('abort', cancel)
      candidate.dispose()
    }
  }

  /** 创建独立的找回密码流程，调用方在关闭表单后释放 */
  createPasswordReset(): PasswordResetAttempt {
    return new PasswordResetService()
  }

  /** 创建独立的密码登录流程，挑战 Cookie 不进入正式业务会话 */
  createPasswordLogin(): PasswordLoginAttempt {
    const revision = this.authRevision
    let active = true
    let busy = false
    let twoFactorCanceled = false
    const candidate = new V2exClient('', {
      onTwoFactorRequired: async verification => {
        if (!active || this.authRevision !== revision) return false
        const verified = (await this.options.onTwoFactorRequired?.(verification)) ?? false
        twoFactorCanceled = !verified
        return verified && active && this.authRevision === revision
      },
      onHttpFailure: this.options.onHttpFailure
    })
    const parentSignal = this.twoFactorAbort.signal
    const dispose = () => {
      active = false
      candidate.dispose()
      parentSignal.removeEventListener('abort', dispose)
    }
    parentSignal.addEventListener('abort', dispose, { once: true })
    const run = async <T>(operation: () => Promise<T>): Promise<T> => {
      if (!active || this.authRevision !== revision)
        throw new Error('登录流程已结束，请重新打开登录页面')
      if (busy) throw new Error('登录请求正在处理中')
      busy = true
      try {
        return await operation()
      } finally {
        busy = false
      }
    }
    return {
      loadChallenge: () => run(() => candidate.auth.loadSigninChallenge()),
      submit: input =>
        run(async () => {
          twoFactorCanceled = false
          await candidate.auth.submitPasswordLogin(input)
          let result: CheckCookieResult
          try {
            result = await candidate.auth.checkCookie()
          } catch (error) {
            if (twoFactorCanceled && error instanceof TwoFactorRequiredError) return 'canceled'
            throw error
          }
          if (!result.isValid) return 'invalid'
          return this.commitCandidate(candidate, result, revision, () => active)
        }),
      dispose
    }
  }

  /** 候选验证成功后，在凭据写入队列内原子提交 */
  private async commitCandidate(
    candidate: V2exClient,
    result: Extract<CheckCookieResult, { isValid: true }>,
    revision: number,
    isActive = () => true
  ): Promise<LoginCookieSwitchResult> {
    const committed = await this.enqueueCredentialMutation(async () => {
      if (this.authRevision !== revision || !isActive()) return false
      const previousCookie = this.options.loginCookieStore
        ? normalizeLoginCookie(await this.options.loginCookieStore.load())
        : this.persistedLoginCookie
      if (this.authRevision !== revision || !isActive()) return false
      const candidateCookie = candidate.getLoginCookie()
      await this.saveLoginCookie(candidateCookie)
      if (this.authRevision !== revision || !isActive()) {
        try {
          await this.saveLoginCookie(previousCookie)
        } catch (error) {
          throw new Error('登录已取消，但恢复原登录凭据失败，请重新登录', { cause: error })
        }
        return false
      }
      this.replaceLoginCookie(candidateCookie, result.username)
      return true
    })
    return committed ? 'authenticated' : 'canceled'
  }

  /**
   * 注销网站会话后清理本地凭据；并发调用复用同一任务
   * @returns 完成当前会话退出时为 true，被其他认证操作取代时为 false
   */
  logout(): Promise<boolean> {
    if (this.logoutTask) return this.logoutTask
    const task = this.logoutFromSite().finally(() => {
      if (this.logoutTask === task) this.logoutTask = undefined
    })
    this.logoutTask = task
    return task
  }

  private async logoutFromSite(): Promise<boolean> {
    this.clearCredentialSaveTimer()
    const revision = ++this.authRevision
    this.twoFactorVerification = this.createTwoFactorVerification()
    const snapshot = new V2exSession(this.session.getCookie(), {
      onHttpFailure: this.options.onHttpFailure,
      onTwoFactorRequired: async () => {
        if (this.authRevision !== revision) return false
        const verified = await this.options.onTwoFactorRequired?.(verification)
        return !!verified && this.authRevision === revision
      }
    })
    const auth = new AuthService(snapshot)
    const verification: TwoFactorVerification = {
      signal: this.twoFactorAbort.signal,
      submitCode: async code => {
        if (verification.signal?.aborted || this.authRevision !== revision)
          throw new Error('登录状态已更新，请重新操作')
        await auth.submitTwoFactorCode(code)
        if (verification.signal?.aborted || this.authRevision !== revision)
          throw new Error('登录状态已更新，请重新操作')
      }
    }
    try {
      if (snapshot.getLoginCookie()) await auth.signout()
    } catch (error) {
      if (this.authRevision !== revision) return false
      if (this.getLoginCookie() !== this.persistedLoginCookie) {
        this.scheduleCredentialSave(LOGIN_COOKIE_SAVE_RETRY_DELAY)
      }
      throw error
    }
    if (this.authRevision !== revision) return false
    try {
      await this.clearLogin()
    } catch (error) {
      // 源站会话已经注销，不能因本地删除失败继续显示已登录
      if (this.authRevision === revision + 1)
        await this.session.expireLogin().catch(() => undefined)
      throw error
    }
    return true
  }

  /** 仅清理本地凭据，由已完成网站退出的流程调用 */
  private async clearLogin(): Promise<void> {
    this.clearCredentialSaveTimer()
    const revision = ++this.authRevision
    this.twoFactorVerification = this.createTwoFactorVerification()
    try {
      await this.enqueueCredentialMutation(async () => {
        await this.saveLoginCookie('')
        if (this.authRevision !== revision) return
        this.clearAuthentication()
      })
    } catch (error) {
      if (
        this.loginExpirationRevision !== undefined ||
        (this.isAuthenticated() && this.getLoginCookie() !== this.persistedLoginCookie)
      ) {
        this.scheduleCredentialSave(LOGIN_COOKIE_SAVE_RETRY_DELAY)
      }
      throw error
    }
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
      await this.session.expireLogin().catch(() => undefined)
      return false
    }
    this.authenticatedUsername = result.username
    await this.persistLoginCookie(revision)
    return this.isAuthenticated()
  }

  /** 处理当前业务会话的两步验证 */
  private async handleTwoFactorRequired(): Promise<boolean> {
    const revision = this.authRevision
    const verified = (await this.options.onTwoFactorRequired?.(this.twoFactorVerification)) ?? false
    return verified && this.authRevision === revision
  }

  /** 两步验证完成且原请求重试成功后持久化最新登录 Cookie */
  private async handleTwoFactorVerified(): Promise<void> {
    await this.persistLoginCookie(this.authRevision)
  }

  /** 创建只作用于当前认证状态的两步验证操作 */
  private createTwoFactorVerification(): TwoFactorVerification {
    this.twoFactorAbort.abort()
    this.twoFactorAbort = new AbortController()
    const signal = this.twoFactorAbort.signal
    const revision = this.authRevision
    return {
      signal,
      submitCode: async code => {
        if (signal.aborted || this.disposed || this.authRevision !== revision) {
          throw new Error('登录状态已更新，请重新操作')
        }
        await this.auth.submitTwoFactorCode(code)
        if (signal.aborted || this.disposed || this.authRevision !== revision) {
          throw new Error('登录状态已更新，请重新操作')
        }
      }
    }
  }

  /** 登录失效后清理认证状态和持久化凭据 */
  private async handleLoginExpired(): Promise<void> {
    const firstExpiration = this.loginExpirationRevision === undefined
    if (firstExpiration) {
      this.invalidateAuthentication()
      this.loginExpirationRevision = this.authRevision
    }
    const revision = this.authRevision
    try {
      await this.enqueueCredentialMutation(async () => {
        if (this.authRevision !== revision) throw new Error('登录状态已更新，失效凭据清理稍后重试')
        await this.saveLoginCookie('')
      })
      if (this.authRevision === revision) this.clearCredentialSaveTimer()
    } catch (error) {
      if (this.authRevision === revision) this.notifyCredentialSaveFailure(error)
      if (this.loginExpirationRevision !== undefined) {
        this.scheduleCredentialSave(LOGIN_COOKIE_SAVE_RETRY_DELAY)
      }
      throw error
    } finally {
      if (firstExpiration && this.loginExpirationRevision === revision) {
        await this.options.onLoginExpired?.()
      }
    }
  }

  /**
   * 替换已经验证的登录 Cookie
   * @param cookie 登录 Cookie
   * @param username 已验证用户名
   */
  private replaceLoginCookie(cookie: string, username: string): void {
    // 切换成功后，后续退出必须绑定新账号，不能复用旧账号的退出任务
    this.logoutTask = undefined
    this.clearCredentialSaveTimer()
    this.loginExpirationRevision = undefined
    this.authRevision += 1
    this.session.setCookie(cookie)
    this.authenticatedUsername = username
    this.accountService.reset()
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
    this.clearCredentialSaveTimer()
    this.loginExpirationRevision = undefined
    this.authenticatedUsername = undefined
    this.accountService.reset()
    this.twoFactorVerification = this.createTwoFactorVerification()
  }

  /** 保存已确认的认证 Cookie；失败单独通知并重试，不覆盖业务结果 */
  private async persistLoginCookie(revision: number): Promise<void> {
    if (!this.options.loginCookieStore || this.disposed || this.authRevision !== revision) return
    this.clearCredentialSaveTimer()
    try {
      await this.enqueueCredentialMutation(async () => {
        if (this.authRevision !== revision) return
        const cookie = this.getLoginCookie()
        if (!cookie || cookie === this.persistedLoginCookie) return
        await this.saveLoginCookie(cookie)
      })
    } catch (error) {
      if (this.authRevision !== revision) return
      this.notifyCredentialSaveFailure(error)
      this.scheduleCredentialSave(LOGIN_COOKIE_SAVE_RETRY_DELAY)
    }
  }

  /** 在凭据写入队列内更新存储及其成功快照 */
  private async saveLoginCookie(cookie: string): Promise<void> {
    await this.options.loginCookieStore?.save(cookie)
    this.persistedLoginCookie = cookie
    this.credentialSaveFailureNotified = false
  }

  /** 合并认证 Cookie 更新；失效状态下重试清理 */
  private scheduleCredentialSave(delay: number): void {
    if (!this.options.loginCookieStore || this.disposed || this.credentialSaveTimer) return
    const revision = this.authRevision
    this.credentialSaveTimer = setTimeout(() => {
      this.credentialSaveTimer = undefined
      if (this.authRevision !== revision) return
      if (this.loginExpirationRevision !== undefined) {
        void this.session.expireLogin().catch(() => undefined)
      } else {
        void this.persistLoginCookie(revision)
      }
    }, delay)
    this.credentialSaveTimer.unref()
  }

  private clearCredentialSaveTimer(): void {
    if (this.credentialSaveTimer) clearTimeout(this.credentialSaveTimer)
    this.credentialSaveTimer = undefined
  }

  /** 同一轮保存失败只通知一次，通知异常不能影响已经成功的请求 */
  private notifyCredentialSaveFailure(error: unknown): void {
    if (this.credentialSaveFailureNotified) return
    this.credentialSaveFailureNotified = true
    try {
      this.options.onCredentialSaveFailed?.(error)
    } catch {
      // 凭据重试继续执行，不让通知回调改写业务请求结果
    }
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
