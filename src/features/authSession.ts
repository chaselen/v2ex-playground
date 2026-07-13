import { LoginCredentialStore } from '@/features/loginCredentialStore'
import { requestTwoFactorVerification } from '@/features/twoFactorAuth'
import { normalizeLoginCookie, TwoFactorRequiredError, type V2exClient } from '@/v2ex'

/** 候选登录结果 */
export type AuthenticateResult = 'authenticated' | 'canceled' | 'invalid'

/** 创建候选 V2EX 客户端 */
export type CandidateClientFactory = (
  cookie: string,
  onTwoFactorRequired: () => Promise<boolean>
) => V2exClient

/** 登录会话检查任务 */
interface AuthenticationCheckTask {
  /** 对应的认证会话版本 */
  sessionVersion: number
  /** 登录会话检查 Promise */
  promise: Promise<boolean>
}

/** 统一管理认证状态、运行时会话与持久化凭据 */
export class AuthSessionManager {
  /** 当前业务客户端 */
  private client?: V2exClient

  /** 当前持久化登录 Cookie 的内存副本 */
  private loginCookie = ''

  /** 当前登录凭据是否已经验证 */
  private authenticated = false

  /** 候选登录尝试版本 */
  private authenticationAttemptVersion = 0

  /** 凭据写入队列 */
  private credentialMutation = Promise.resolve()

  /** 最近完成登录检查的认证会话版本 */
  private checkedSessionVersion?: number

  /** 当前登录会话检查任务 */
  private authenticationCheckTask?: AuthenticationCheckTask

  /**
   * @param credentialStore 登录凭据存储
   * @param createCandidateClient 候选客户端工厂
   */
  constructor(
    private readonly credentialStore: LoginCredentialStore,
    private readonly createCandidateClient: CandidateClientFactory
  ) {}

  /** 加载持久化凭据 */
  async initialize(): Promise<string> {
    this.loginCookie = await this.credentialStore.load()
    return this.loginCookie
  }

  /**
   * 绑定业务客户端
   * @param client V2EX 业务客户端
   */
  attachClient(client: V2exClient): void {
    this.client = client
    this.checkedSessionVersion = undefined
    this.authenticationCheckTask = undefined
  }

  /** 当前是否已经验证登录 */
  isAuthenticated(): boolean {
    return this.authenticated
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
    const attemptVersion = ++this.authenticationAttemptVersion

    let twoFactorCanceled = false
    let candidateClient!: V2exClient
    candidateClient = this.createCandidateClient(loginCookie, async () => {
      const verified = await requestTwoFactorVerification(candidateClient, {
        verify: code => candidateClient.submitTwoFactorCode(code)
      })
      twoFactorCanceled = !verified
      return verified
    })

    try {
      if (!(await candidateClient.checkCookie()).isValid) return 'invalid'
    } catch (err) {
      if (twoFactorCanceled && err instanceof TwoFactorRequiredError) {
        return 'canceled'
      }
      throw err
    }

    const committed = await this.commitAuthenticatedLogin(
      candidateClient.getLoginCookie(),
      attemptVersion
    )
    return committed ? 'authenticated' : 'canceled'
  }

  /** 保存当前运行时会话中的登录 Cookie */
  async persistRuntimeLoginCookie(): Promise<void> {
    await this.enqueueCredentialMutation(async () => {
      const client = this.getClient()
      const loginCookie = client.getLoginCookie()
      await this.credentialStore.save(loginCookie)
      this.loginCookie = loginCookie
      this.authenticated = !!loginCookie
      this.checkedSessionVersion = client.getAuthSessionVersion()
    })
  }

  /** 清理已经失效的持久化登录凭据 */
  handleLoginExpired(): Promise<void> {
    return this.enqueueCredentialMutation(async () => {
      this.loginCookie = ''
      this.authenticated = false
      this.checkedSessionVersion = this.getClient().getAuthSessionVersion()
      await this.credentialStore.save('')
    })
  }

  /** 主动退出登录 */
  async logout(): Promise<void> {
    this.authenticationAttemptVersion += 1
    await this.enqueueCredentialMutation(async () => {
      await this.credentialStore.save('')
      this.getClient().setCookie('')
      this.loginCookie = ''
      this.authenticated = false
      this.checkedSessionVersion = this.getClient().getAuthSessionVersion()
    })
  }

  /**
   * 提交已经验证的登录 Cookie
   * @param cookie 登录 Cookie
   */
  private commitAuthenticatedLogin(cookie: string, attemptVersion: number): Promise<boolean> {
    const loginCookie = normalizeLoginCookie(cookie)
    return this.enqueueCredentialMutation(async () => {
      if (this.authenticationAttemptVersion !== attemptVersion) return false
      await this.credentialStore.save(loginCookie)
      const client = this.getClient()
      client.setCookie(loginCookie)
      this.loginCookie = loginCookie
      this.authenticated = true
      this.checkedSessionVersion = client.getAuthSessionVersion()
      return true
    })
  }

  /** 获取已绑定的业务客户端 */
  private getClient(): V2exClient {
    if (!this.client) throw new Error('认证会话尚未绑定 V2EX 客户端')
    return this.client
  }

  /**
   * 获取当前登录状态检查任务
   * @param force 是否忽略已完成的检查结果
   */
  private getAuthenticationCheck(force = false): Promise<boolean> {
    const client = this.getClient()
    const sessionVersion = client.getAuthSessionVersion()

    if (this.authenticationCheckTask?.sessionVersion === sessionVersion) {
      return this.authenticationCheckTask.promise
    }
    if (!force && this.checkedSessionVersion === sessionVersion) {
      return Promise.resolve(this.authenticated)
    }

    const task: AuthenticationCheckTask = {
      sessionVersion,
      promise: client
        .checkCookie()
        .then(result => {
          if (this.client === client && client.getAuthSessionVersion() === sessionVersion) {
            this.authenticated = result.isValid
            this.checkedSessionVersion = sessionVersion
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
