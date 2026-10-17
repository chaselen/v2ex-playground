import vscode from 'vscode'
import { LoginPanelController, type LoginPanelResult } from '@/controllers/LoginPanelController'

let activePanel: LoginPanelController | undefined

/** 打开或聚焦独立登录页，登录完成后由命令注册处刷新业务页面 */
export default async function login(): Promise<LoginPanelResult> {
  if (activePanel) {
    activePanel.reveal()
    return 'canceled'
  }
  const panel = new LoginPanelController()
  activePanel = panel
  try {
    const result = await panel.result
    if (result === 'authenticated') {
      void vscode.window.showInformationMessage('登录成功')
    }
    return result
  } finally {
    if (activePanel === panel) activePanel = undefined
  }
}
