import G from '@/global'
import { LoginCooldownError } from '@/v2ex'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { createV2exWebviewPanel } from './webviewPanel'
import type {
  PasswordLoginAttempt,
  PasswordLoginInput,
  LoginCookieSwitchResult,
  PasswordResetAttempt,
  PasswordResetInput
} from '@/v2ex'
import type {
  LoginPanelRpcCommands,
  LoginPanelWebviewEvents,
  LoginPanelViewState,
  WebviewRpcController
} from '@/shared/webview'

/** 登录面板结果；关闭页面表示取消 */
export type LoginPanelResult = 'authenticated' | 'canceled'

/** 登录页只持有隔离候选流程，正式认证状态由客户端管理 */
export class LoginPanelController implements WebviewRpcController<LoginPanelRpcCommands> {
  private readonly panel = createV2exWebviewPanel({
    viewType: 'v2ex.login',
    title: '登录 V2EX',
    htmlEntry: 'login.html',
    resourceIcon: 'panelTwoFactor.svg'
  })
  private readonly rpc = new WebviewRpcBridge<LoginPanelRpcCommands, LoginPanelWebviewEvents>(
    this.panel.webview,
    this
  )
  private state: LoginPanelViewState = { loading: false, submitting: false }
  private attempt?: PasswordLoginAttempt
  private passwordReset?: PasswordResetAttempt
  private initialized = false
  private challengeRevision = 0
  private disposed = false
  private readonly abort = new AbortController()
  private resolve!: (result: LoginPanelResult) => void
  readonly result = new Promise<LoginPanelResult>(resolve => {
    this.resolve = resolve
  })

  constructor() {
    G.context.subscriptions.push(this)
    this.panel.onDidDispose(() => {
      this.disposed = true
      this.abort.abort()
      this.attempt?.dispose()
      this.passwordReset?.dispose()
      this.rpc.dispose()
      this.resolve('canceled')
    })
  }

  reveal(): void {
    this.panel.reveal()
  }

  dispose(): void {
    this.panel.dispose()
  }

  rpc_ready(): LoginPanelViewState {
    if (!this.initialized) {
      this.initialized = true
      this.rpc_refreshCaptcha()
    }
    return this.state
  }

  rpc_startPasswordReset(): Promise<string> {
    this.passwordReset?.dispose()
    this.passwordReset = G.V2ex.createPasswordReset()
    return this.passwordReset.loadChallenge()
  }

  rpc_refreshPasswordResetCaptcha(): Promise<string> {
    if (!this.passwordReset) throw new Error('请重新打开找回密码表单')
    return this.passwordReset.loadChallenge()
  }

  rpc_submitPasswordReset(input: PasswordResetInput): Promise<string> {
    if (!this.passwordReset) throw new Error('请重新打开找回密码表单')
    return this.passwordReset.submit(input)
  }

  rpc_closePasswordReset(): void {
    this.passwordReset?.dispose()
    this.passwordReset = undefined
  }

  /** 立即确认 RPC，较长认证操作通过状态事件反馈，避免等待 2FA 时 RPC 超时 */
  rpc_refreshCaptcha(): void {
    if (this.state.loading || this.state.submitting || this.disposed) return
    const revision = ++this.challengeRevision
    this.update({ ...this.state, loading: true, submitting: false, passwordError: undefined })
    void this.loadChallenge()
      .then(captchaImage => {
        if (revision === this.challengeRevision)
          this.update({ ...this.state, captchaImage, loading: false })
      })
      .catch(error => {
        if (revision === this.challengeRevision)
          this.update({
            ...this.state,
            captchaImage: undefined,
            loading: false,
            passwordError: this.errorMessage(error)
          })
      })
  }

  rpc_loginWithPassword(input: PasswordLoginInput): void {
    this.startLogin(async () => {
      if (!this.attempt) throw new Error('请先刷新验证码')
      return this.attempt.submit(input)
    }, true)
  }

  rpc_loginWithCookie(cookie: string): void {
    if (this.state.submitting || this.disposed) return
    this.update({ ...this.state, loading: false, submitting: false })
    this.startLogin(() => G.V2ex.switchLoginCookie(cookie, { signal: this.abort.signal }), false)
  }

  private startLogin(login: () => Promise<LoginCookieSwitchResult>, password: boolean): void {
    if (this.disposed || this.state.loading || this.state.submitting) return
    const errorKey = password ? 'passwordError' : 'cookieError'
    this.update({ ...this.state, submitting: true, [errorKey]: undefined })
    void (async () => {
      let error: string | undefined
      let cooldown = false
      try {
        const result = await login()
        if (result === 'authenticated') {
          this.resolve('authenticated')
          this.panel.dispose()
          return
        }
        error =
          result === 'canceled'
            ? '登录已取消，请重试'
            : password
              ? '登录失败，请检查账号、密码和验证码'
              : 'Cookie 格式不正确或已失效，请确认包含有效的 A2'
      } catch (cause) {
        error = this.errorMessage(cause)
        cooldown = cause instanceof LoginCooldownError
      }
      if (this.disposed) return
      if (cooldown) this.update({ ...this.state, captchaImage: undefined })
      if (password && !cooldown) {
        this.update({
          ...this.state,
          captchaImage: undefined,
          loading: true,
          submitting: true,
          passwordError: error
        })
        try {
          const captchaImage = await this.loadChallenge()
          this.update({ ...this.state, captchaImage })
        } catch (cause) {
          error += `；${this.errorMessage(cause)}`
        }
      }
      if (this.disposed) return
      this.update({ ...this.state, loading: false, submitting: false, [errorKey]: error })
      this.panel.reveal()
    })()
  }

  private async loadChallenge(): Promise<string> {
    this.attempt?.dispose()
    this.attempt = G.V2ex.createPasswordLogin()
    return this.attempt.loadChallenge()
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : '登录操作失败，请稍后重试'
  }

  private update(state: LoginPanelViewState): void {
    if (this.disposed) return
    this.state = state
    this.rpc.post('state', state)
  }
}
