import vscode from 'vscode'
import MainViewProvider from '@/providers/MainViewProvider'
import login, { LoginResult } from '@/commands/login'
import G from '@/global'
import { V2exClient } from '@/v2ex'
import setting from '@/commands/setting'
import { cleanupImagePreviewCache } from '@/features/imagePreview'
import { openSearch, setOpenNodeTabHandler } from '@/features/panelNavigation'

export function activate(context: vscode.ExtensionContext) {
  G.context = context
  G.V2ex = new V2exClient(G.getCookie(), () => G.setCookie(''))
  const mainViewProvider = new MainViewProvider()
  setOpenNodeTabHandler(node => mainViewProvider.openNode(node))

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
  // G.V2ex.getAllNodes()
  // 刷新登录会话后再尝试自动签到
  G.V2ex.checkCookie()
    .then(isCookieValid => {
      if (isCookieValid) {
        mainViewProvider.autoDailySignIn()
      }
    })
    .catch(err => console.error('V2EX 登录会话刷新失败', err))

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
        mainViewProvider.autoDailySignIn({ notifyOnSuccess: true })
      }
    })
  )

  // 搜索
  context.subscriptions.push(vscode.commands.registerCommand('v2ex.search', () => openSearch()))

  // 设置
  context.subscriptions.push(vscode.commands.registerCommand('v2ex.settings', () => setting()))
}

export function deactivate() {
  // G.context = undefined
}
