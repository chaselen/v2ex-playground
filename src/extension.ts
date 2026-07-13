import vscode from 'vscode'
import MainViewProvider from '@/providers/MainViewProvider'
import login, { LoginResult } from '@/commands/login'
import G from '@/global'
import { V2exClient } from '@/v2ex'
import setting from '@/commands/setting'
import openTopic from '@/commands/openTopic'
import { cleanupImagePreviewCache } from '@/features/imagePreview'
import autoDailySignIn, { startDailySignInScheduler } from '@/features/dailySignIn'
import {
  openRecentBrowse,
  openSearch,
  refreshTopicPanelsForAuthChange,
  setOpenNodeTabHandler
} from '@/features/panelNavigation'
import { requestTwoFactorVerification } from '@/features/twoFactorAuth'
import { startConnectivityCheck } from '@/features/connectivityCheck'
import { initializeLogger, logger } from '@/core/logger'
import { AuthSessionManager } from '@/features/authSession'
import { LoginCredentialStore } from '@/features/loginCredentialStore'

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  initializeLogger(context)
  logger.info('扩展已激活')
  G.context = context
  const mainViewProvider = new MainViewProvider()
  const authSession = new AuthSessionManager(
    new LoginCredentialStore(context),
    (cookie, onTwoFactorRequired) =>
      new V2exClient(cookie, {
        onTwoFactorRequired,
        onHttpFailure: summary => logger.warn('候选登录请求失败', summary)
      })
  )
  G.authSession = authSession
  const initialCookie = await authSession.initialize()
  let client!: V2exClient
  client = new V2exClient(initialCookie, {
    onLoginExpired: async () => {
      try {
        await authSession.handleLoginExpired()
      } catch (err) {
        logger.error('清理失效登录凭据失败', err)
      }
      await mainViewProvider.reloadViewData()
      refreshTopicPanelsForAuthChange()
      const action = await vscode.window.showWarningMessage(
        'V2EX 登录状态已失效，请重新登录',
        '重新登录'
      )
      if (action === '重新登录') {
        await vscode.commands.executeCommand('v2ex.login')
      }
    },
    onTwoFactorRequired: () => {
      return requestTwoFactorVerification(client, {
        verify: async code => {
          await client.submitTwoFactorCode(code)
          await authSession.persistRuntimeLoginCookie()
        }
      })
    },
    onHttpFailure: summary => logger.warn('HTTP 请求失败', summary)
  })
  G.V2ex = client
  authSession.attachClient(client)
  const refreshLoginAndAutoSignIn = async () => {
    const authenticated = await authSession.refreshAuthentication()
    if (authenticated) {
      autoDailySignIn({ notifyOnSuccess: true }).catch(err => logger.error('自动签到失败', err))
    }
    return authenticated
  }
  setOpenNodeTabHandler(node => mainViewProvider.openNode(node))

  cleanupImagePreviewCache()
  startConnectivityCheck(context)
  context.subscriptions.push(startDailySignInScheduler())

  // 插件激活后直接获取节点信息缓存下来
  // G.V2ex.getAllNodes()
  // 刷新登录会话后再尝试自动签到
  refreshLoginAndAutoSignIn()
    .then(authenticated => {
      if (!authenticated) return
      return mainViewProvider.reloadViewData().then(() => refreshTopicPanelsForAuthChange())
    })
    .catch(err => {
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
        refreshLoginAndAutoSignIn().catch(err => {
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
