import vscode from 'vscode'
import MainViewProvider from '@/providers/MainViewProvider'
import login, { LoginResult } from '@/commands/login'
import G from '@/global'
import { V2exClient } from '@/v2ex'
import setting from '@/commands/setting'
import openTopic from '@/commands/openTopic'
import { cleanupImagePreviewCache } from '@/features/imagePreview'
import { refreshLoginSession } from '@/features/loginSession'
import {
  openRecentBrowse,
  openSearch,
  refreshTopicPanelsForAuthChange,
  setOpenNodeTabHandler
} from '@/features/panelNavigation'
import { requestTwoFactorVerification } from '@/features/twoFactorAuth'
import { startConnectivityCheck } from '@/features/connectivityCheck'
import { initializeLogger, logger } from '@/core/logger'

export function activate(context: vscode.ExtensionContext) {
  initializeLogger(context)
  logger.info('扩展已激活')
  G.context = context
  const mainViewProvider = new MainViewProvider()
  G.V2ex = new V2exClient(G.getCookie(), {
    onLoginExpired: async () => {
      await G.setCookie('')
      G.unreadNoticeCount = 0
      await mainViewProvider.reloadViewData()
    },
    onTwoFactorRequired: requestTwoFactorVerification,
    onHttpFailure: summary => logger.warn('HTTP 请求失败', summary)
  })
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
  startConnectivityCheck(context)

  // 插件激活后直接获取节点信息缓存下来
  // G.V2ex.getAllNodes()
  // 刷新登录会话后再尝试自动签到
  refreshLoginSession({ autoDailySignIn: true }).catch(err => {
    logger.error('登录会话刷新失败', err)
  })

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
        refreshTopicPanelsForAuthChange()
      }
      if (loginResult === LoginResult.success) {
        refreshLoginSession({
          autoDailySignIn: true,
          dailySignInOptions: { notifyOnSuccess: true }
        }).catch(err => {
          logger.error('登录会话刷新失败', err)
        })
      }
    })
  )

  // 搜索
  context.subscriptions.push(vscode.commands.registerCommand('v2ex.search', () => openSearch()))

  // 打开帖子
  context.subscriptions.push(vscode.commands.registerCommand('v2ex.openTopic', () => openTopic()))

  // 最近浏览
  context.subscriptions.push(
    vscode.commands.registerCommand('v2ex.recentBrowse', () => openRecentBrowse())
  )

  // 设置
  context.subscriptions.push(vscode.commands.registerCommand('v2ex.settings', () => setting()))

  // 查看扩展日志
  context.subscriptions.push(vscode.commands.registerCommand('v2ex.showLogs', () => logger.show()))
}

export function deactivate() {
  // G.context = undefined
}
