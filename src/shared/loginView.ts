import type { PasswordLoginInput, PasswordResetInput } from '../v2ex/types'
import type { WebviewStateRpcCommands } from './commonView'

/** 登录页状态不包含账号密码或 Cookie */
export interface LoginPanelViewState {
  captchaImage?: string
  loading: boolean
  submitting: boolean
  passwordError?: string
  cookieError?: string
}

export interface LoginPanelRpcCommands extends WebviewStateRpcCommands<LoginPanelViewState> {
  refreshCaptcha(): void
  loginWithPassword(input: PasswordLoginInput): void
  loginWithCookie(cookie: string): void
  startPasswordReset(): Promise<string>
  refreshPasswordResetCaptcha(): Promise<string>
  submitPasswordReset(input: PasswordResetInput): Promise<string>
  closePasswordReset(): void
}

export interface LoginPanelWebviewEvents {
  state: LoginPanelViewState
}
