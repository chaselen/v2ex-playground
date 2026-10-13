import vscode from 'vscode'
import G from '@/global'
import { logger } from '@/core/logger'

/**
 * 登录逻辑
 * @returns 登录操作结果
 */
export default async function login(): Promise<LoginResult> {
  let cookie = await vscode.window.showInputBox({
    title: '登录 V2EX',
    placeHolder: 'V2EX Cookie',
    prompt:
      '粘贴完整 Cookie、A2="..."、A2+A2O 或单独的 A2 值以登录。（如要退出，请清空 Cookie 并回车确认）',
    value: G.V2ex.getLoginCookie()
  })
  // 如果用户撤销输入，如ESC，则为undefined
  if (cookie === undefined) {
    return LoginResult.cancel
  }
  cookie = (cookie || '').trim()

  try {
    // 清除cookie
    if (!cookie) {
      await G.V2ex.logout()
      logger.info('已退出登录')
      return LoginResult.logout
    }

    const result = await vscode.window.withProgress(
      {
        title: '正在登录',
        location: vscode.ProgressLocation.Notification
      },
      () => G.V2ex.switchLoginCookie(cookie)
    )

    if (result === 'canceled') {
      logger.info('登录已取消或被其他认证操作取代')
      return LoginResult.cancel
    }
    if (result === 'invalid') {
      logger.warn('登录失败，Cookie 无效')
      vscode.window.showErrorMessage('登录失败，Cookie 格式不正确或已失效，请确认内容包含有效的 A2')
      return LoginResult.failed
    }

    logger.info('登录成功')
    vscode.window.showInformationMessage('登录成功')
    return LoginResult.success
  } catch (error) {
    logger.error('登录操作失败', error)
    void vscode.window.showErrorMessage(
      error instanceof Error ? error.message : '登录操作失败，请稍后重试'
    )
    return LoginResult.failed
  }
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
