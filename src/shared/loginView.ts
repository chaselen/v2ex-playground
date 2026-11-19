import type { PasswordLoginInput, PasswordResetInput } from '../v2ex/types'
import type { WebviewStateRpcCommands } from './commonView'

/** 登录页状态不包含账号密码或 Cookie */
export interface LoginPanelViewState {
  captchaImage?: string
  loading: boolean
  submitting: boolean
  passwordError?: string
  cookieError?: string
  twoFactor?: LoginTwoFactorViewState
}

/** 登录页当前的两步验证请求 */
export interface LoginTwoFactorViewState {
  id: number
  submitting: boolean
  error?: string
}

export interface LoginPanelRpcCommands extends WebviewStateRpcCommands<LoginPanelViewState> {
  refreshCaptcha(): void
  loginWithPassword(input: PasswordLoginInput): void
  loginWithCookie(cookie: string): void
  verifyTwoFactor(id: number, code: string): void
  cancelTwoFactor(id: number): void
  startPasswordReset(): Promise<string>
  refreshPasswordResetCaptcha(): Promise<string>
  submitPasswordReset(input: PasswordResetInput): Promise<string>
  closePasswordReset(): void
}

export interface LoginPanelWebviewEvents {
  state: LoginPanelViewState
}
