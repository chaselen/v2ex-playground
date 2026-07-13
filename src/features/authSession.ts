import { LoginCredentialStore } from '@/features/loginCredentialStore'
import { requestTwoFactorVerification } from '@/features/twoFactorAuth'
import {
  normalizeLoginCookie,
  TwoFactorRequiredError,
  type LoginExpiredHandler,
  type TwoFactorRequiredHandler,
  type V2exClient
} from '@/v2ex'

/** 候选登录结果 */
export type AuthenticateResult = 'authenticated' | 'canceled' | 'invalid'

/** 已验证的登录会话；对象身份用于判断异步任务是否仍属于当前账号 */
export interface AuthenticatedSession {
  /** 当前登录用户名 */
  username: string
}

/** 创建候选 V2EX 客户端 */
export type CandidateClientFactory = (
  cookie: string,
  onTwoFactorRequired: () => Promise<boolean>
) => V2exClient

/** 业务客户端认证回调 */
export interface BusinessClientAuthHandlers {
  /** 登录失效回调 */
  onLoginExpired: LoginExpiredHandler
  /** 需要两步验证时的回调 */
  onTwoFactorRequired: TwoFactorRequiredHandler
}

/** 创建正式业务客户端 */
export type BusinessClientFactory = (
  cookie: string,
  handlers: BusinessClientAuthHandlers
) => V2exClient

/** 登录会话检查任务 */
interface AuthenticationCheckTask {
  /** 请求发起时的登录会话 */
  session: object
  /** 登录会话检查 Promise */
  promise: Promise<boolean>
}

/** 统一管理认证状态、运行时会话与持久化凭据 */
export class AuthSessionManager {
  /** 当前业务客户端 */
  private client?: V2exClient

  /** 当前持久化登录 Cookie 的内存副本 */
  private loginCookie = ''

  /** 当前已验证的登录会话 */
  private authenticatedSession?: AuthenticatedSession

  /** 正式 Cookie 会话标识，整体替换 Cookie 时同步替换 */
  private session: object = {}

  /** 最近一次候选登录编号 */
  private latestLoginAttempt = 0

  /** 凭据写入队列 */
  private credentialMutation = Promise.resolve()

  /** 当前登录会话检查任务 */
  private authenticationCheckTask?: AuthenticationCheckTask

  /**
   * @param credentialStore 登录凭据存储
   * @param createBusinessClient 正式业务客户端工厂
   * @param createCandidateClient 候选客户端工厂
   */
  constructor(
    private readonly credentialStore: LoginCredentialStore,
    private readonly createBusinessClient: BusinessClientFactory,
    private readonly createCandidateClient: CandidateClientFactory
  ) {}

  /** 加载持久化凭据并创建正式业务客户端 */
  async initialize(): Promise<V2exClient> {
    this.loginCookie = await this.credentialStore.load()
    this.client = this.createBusinessClient(this.loginCookie, {
      onLoginExpired: () => this.handleLoginExpired(),
      onTwoFactorRequired: () => this.requestBusinessTwoFactorVerification()
    })
    return this.client
  }

  /** 当前是否已经验证登录 */
  isAuthenticated(): boolean {
    return !!this.authenticatedSession
  }

  /** 获取当前已验证的登录会话 */
  getAuthenticatedSession(): AuthenticatedSession | undefined {
    return this.authenticatedSession
  }

  /** 判断异步任务是否仍属于当前登录会话 */
  isCurrentSession(session: AuthenticatedSession): boolean {
    return this.authenticatedSession === session
  }

  /** 获取当前持久化登录 Cookie 的内存副本 */
  getLoginCookie(): string {
    return this.loginCookie
  }

  /** 强制检查当前登录状态 */
  refreshAuthentication(): Promise<boolean> {
    return this.getAuthenticationCheck(true)
  }

  /** 确保当前登录状态已经检查 */
  ensureAuthenticated(): Promise<boolean> {
    return this.getAuthenticationCheck()
  }

  /**
   * 在隔离会话中验证并提交候选登录 Cookie
   * @param cookie 候选登录 Cookie
   */
  async authenticate(cookie: string): Promise<AuthenticateResult> {
    const loginCookie = normalizeLoginCookie(cookie)
    if (!loginCookie) return 'invalid'
    const attempt = ++this.latestLoginAttempt

    let twoFactorCanceled = false
    let candidateClient!: V2exClient
    candidateClient = this.createCandidateClient(loginCookie, async () => {
      const verified = await requestTwoFactorVerification(candidateClient, {
        verify: code => candidateClient.submitTwoFactorCode(code)
      })
      twoFactorCanceled = !verified
      return verified
    })

    let username: string
    try {
      const result = await candidateClient.checkCookie()
      if (!result.isValid) return 'invalid'
      username = result.username
    } catch (err) {
      if (twoFactorCanceled && err instanceof TwoFactorRequiredError) {
        return 'canceled'
      }
      throw err
    }

    const committed = await this.commitAuthenticatedLogin(
      candidateClient.getLoginCookie(),
      username,
      attempt
    )
    return committed ? 'authenticated' : 'canceled'
  }

  /** 保存当前运行时会话中的登录 Cookie */
  private async persistRuntimeLoginCookie(session: object): Promise<void> {
    await this.enqueueCredentialMutation(async () => {
      if (this.session !== session) return
      const client = this.getClient()
      const loginCookie = client.getLoginCookie()
      await this.credentialStore.save(loginCookie)
      this.loginCookie = loginCookie
    })
  }

  /** 清理已经失效的持久化登录凭据 */
  private handleLoginExpired(): Promise<void> {
    const session = this.session
    return this.enqueueCredentialMutation(async () => {
      if (this.session !== session) return
      this.loginCookie = ''
      this.authenticatedSession = undefined
      this.session = {}
      await this.credentialStore.save('')
    })
  }

  /** 主动退出登录 */
  async logout(): Promise<void> {
    this.latestLoginAttempt += 1
    await this.enqueueCredentialMutation(async () => {
      await this.credentialStore.save('')
      this.getClient().setCookie('')
      this.loginCookie = ''
      this.authenticatedSession = undefined
      this.session = {}
    })
  }

  /**
   * 提交已经验证的登录 Cookie
   * @param cookie 登录 Cookie
   * @param username 已验证用户名
   * @param attempt 候选登录编号
   */
  private commitAuthenticatedLogin(
    cookie: string,
    username: string,
    attempt: number
  ): Promise<boolean> {
    const loginCookie = normalizeLoginCookie(cookie)
    return this.enqueueCredentialMutation(async () => {
      if (this.latestLoginAttempt !== attempt) return false
      await this.credentialStore.save(loginCookie)
      this.getClient().setCookie(loginCookie)
      this.loginCookie = loginCookie
      this.authenticatedSession = { username }
      this.session = {}
      return true
    })
  }

  /** 获取正式业务客户端 */
  private getClient(): V2exClient {
    if (!this.client) throw new Error('认证会话尚未初始化 V2EX 客户端')
    return this.client
  }

  /** 使用正式业务会话完成两步验证并持久化更新后的登录 Cookie */
  private requestBusinessTwoFactorVerification(): Promise<boolean> {
    const client = this.getClient()
    const session = this.session
    return requestTwoFactorVerification(session, {
      verify: async code => {
        if (this.session !== session) throw new Error('登录状态已更新，请重新操作')
        await client.submitTwoFactorCode(code)
        if (this.session !== session) throw new Error('登录状态已更新，请重新操作')
        await this.persistRuntimeLoginCookie(session)
      }
    })
  }

  /**
   * 获取当前登录状态检查任务
   * @param force 是否忽略已完成的检查结果
   */
  private getAuthenticationCheck(force = false): Promise<boolean> {
    const client = this.getClient()
    const session = this.session

    if (this.authenticationCheckTask?.session === session) {
      return this.authenticationCheckTask.promise
    }
    if (!force && this.authenticatedSession) {
      return Promise.resolve(true)
    }
    if (!this.loginCookie) {
      return Promise.resolve(false)
    }

    const task: AuthenticationCheckTask = {
      session,
      promise: client
        .checkCookie()
        .then(result => {
          if (this.client !== client || this.session !== session) {
            return this.isAuthenticated()
          }
          if (!result.isValid) return false
          if (this.authenticatedSession?.username !== result.username) {
            this.authenticatedSession = { username: result.username }
          }
          return result.isValid
        })
        .finally(() => {
          if (this.authenticationCheckTask === task) {
            this.authenticationCheckTask = undefined
          }
        })
    }
    this.authenticationCheckTask = task
    return task.promise
  }

  /**
   * 串行执行凭据写入
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
