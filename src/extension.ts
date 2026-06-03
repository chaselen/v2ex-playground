import vscode from 'vscode'
import MainViewProvider from '@/providers/MainViewProvider'
import login, { LoginResult } from '@/commands/login'
import autoDailySignIn from '@/commands/dailySignIn'
import G from '@/global'
import { V2exClient } from '@/v2ex'
import search from '@/commands/search'
import setting from '@/commands/setting'
import { cleanupImagePreviewCache } from '@/features/imagePreview'

export function activate(context: vscode.ExtensionContext) {
  G.context = context
  G.V2ex = new V2exClient(G.getCookie(), () => G.setCookie(''))
  const mainViewProvider = new MainViewProvider()

  context.subscriptions.push(
    G.V2ex.onAccountOverviewChanged((overview, oldOverview) => {
      G.unreadNoticeCount = overview.unreadNoticeCount
      G.checkUnreadNotification(overview.unreadNoticeCount, oldOverview?.unreadNoticeCount, () =>
        mainViewProvider.openTab('my')
      )
    })
  )
  cleanupImagePreviewCache()

  // 插件激活后直接获取节点信息缓存下来
  G.V2ex.getAllNodes()
  // 检查登录是否有效
  G.V2ex.checkCookie()
  // 插件激活后尝试自动签到
  autoDailySignIn()

  // 注册主视图 WebviewView
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('v2ex-main', mainViewProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  )

  // 公共事件：登录
  context.subscriptions.push(
    vscode.commands.registerCommand('v2ex.login', async () => {
      const loginResult = await login()
      if (loginResult === LoginResult.success || loginResult === LoginResult.logout) {
        mainViewProvider.reloadViewData()
      }
      if (loginResult === LoginResult.success) {
        autoDailySignIn({ notifyOnSuccess: true })
      }
    })
  )

  // 搜索
  context.subscriptions.push(vscode.commands.registerCommand('v2ex-main.search', () => search()))

  // 设置
  context.subscriptions.push(vscode.commands.registerCommand('v2ex-main.settings', () => setting()))

  // 刷新全部（view/title 按钮）
  context.subscriptions.push(
    vscode.commands.registerCommand('v2ex-main.refresh', () =>
      mainViewProvider.refreshLoadedNodes()
    )
  )
}

export function deactivate() {
  // G.context = undefined
}
