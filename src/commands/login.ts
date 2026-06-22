import vscode from 'vscode'
import G from '@/global'
import { normalizeLoginCookie } from '@/shared/cookie'
import { requestTwoFactorVerification } from '@/features/twoFactorAuth'
import { TwoFactorRequiredError } from '@/v2ex'

/**
 * 登录逻辑
 * @returns 返回是否成功登录成功
 */
export default async function login(): Promise<LoginResult> {
  let cookie = await vscode.window.showInputBox({
    placeHolder: 'V2EX Cookie',
    prompt:
      '粘贴完整 Cookie、A2="..."、A2+A2O 或单独的 A2 值以登录。（如要退出，请清空 Cookie 并回车确认）',
    value: G.getCookie()
  })
  // 如果用户撤销输入，如ESC，则为undefined
  if (cookie === undefined) {
    return LoginResult.cancel
  }
  cookie = (cookie || '').trim()

  // 清除cookie
  if (!cookie) {
    await G.setCookie('')
    return LoginResult.logout
  }
  const loginCookie = normalizeLoginCookie(cookie)
  if (!loginCookie) {
    vscode.window.showErrorMessage(
      '登录失败，Cookie 格式不正确，请确认内容包含 A2="..." 或直接粘贴 A2 值'
    )
    return LoginResult.failed
  }

  const isLoginSuccess = await vscode.window.withProgress(
    {
      title: '正在登录',
      location: vscode.ProgressLocation.Notification
    },
    async () => {
      let isCookieValid = false
      let cookieToPersist = loginCookie
      try {
        isCookieValid = await G.V2ex.tryLogin(loginCookie)
      } catch (err) {
        if (!(err instanceof TwoFactorRequiredError)) {
          throw err
        }

        await G.setCookie(loginCookie)
        isCookieValid = await requestTwoFactorVerification()
        cookieToPersist = G.V2ex.getCookie() || loginCookie
      }
      console.log('Cookie是否有效：', isCookieValid)
      if (isCookieValid) {
        await G.setCookie(cookieToPersist)
        vscode.window.showInformationMessage('登录成功')
      } else {
        vscode.window.showErrorMessage('登录失败，Cookie无效')
      }
      return isCookieValid
    }
  )
  return isLoginSuccess ? LoginResult.success : LoginResult.failed
}

/**
 * 登录结果
 */
export enum LoginResult {
  /** 登录成功 */
  success,
  /** 登录失败 */
  failed,
  /** 退出登录 */
  logout,
  /** 取消登录 */
  cancel
}
