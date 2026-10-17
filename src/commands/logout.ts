import vscode from 'vscode'
import G from '@/global'
import { logger } from '@/core/logger'

/** 源站注销成功后才提示退出完成 */
export default async function logout(): Promise<boolean> {
  try {
    const loggedOut = await vscode.window.withProgress(
      { title: '正在退出 V2EX', location: vscode.ProgressLocation.Notification },
      () => G.V2ex.logout()
    )
    if (!loggedOut) return false
    void vscode.window.showInformationMessage('已退出 V2EX')
    return true
  } catch (error) {
    logger.error('退出登录失败', error instanceof Error ? error.message : String(error))
    void vscode.window.showErrorMessage(
      error instanceof Error ? error.message : '退出登录失败，请稍后重试'
    )
    return false
  }
}
