import vscode from 'vscode'
import MainViewProvider from '@/providers/MainViewProvider'
import login, { LoginResult } from '@/commands/login'
import G from '@/global'
import { V2exClient } from '@/v2ex'
import setting from '@/commands/setting'
import openTopic from '@/commands/openTopic'
import autoDailySignIn, { startDailySignInScheduler } from '@/features/dailySignIn'
import {
  openRecentBrowse,
  openSearch,
  refreshTopicPanelsForAuthChange,
  setOpenNodeTabHandler
} from '@/features/panelNavigation'
import { startConnectivityCheck } from '@/features/connectivityCheck'
import { initializeLogger, logger } from '@/core/logger'
import { LoginCredentialStore } from '@/features/loginCredentialStore'
import { requestTwoFactorVerification } from '@/features/twoFactorAuth'
import { deleteExtensionFileCacheDir } from '@/core/remoteImageCache'
import { startPanelIconCacheCleanup } from '@/features/panelIcon'

/** 旧版图片预览缓存目录名 */
const LEGACY_IMAGE_PREVIEW_CACHE_DIR = 'image-previews'

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // 初始化扩展运行时上下文
  initializeLogger(context)
  logger.info('扩展已激活')
  G.context = context

  // 创建主视图与 V2EX 客户端
  const mainViewProvider = new MainViewProvider()
  const client = await V2exClient.create({
    loginCookieStore: new LoginCredentialStore(context),
    onLoginExpired: async () => {
      logger.warn('登录状态已失效')
      await mainViewProvider.reloadViewData()
      refreshTopicPanelsForAuthChange()
      void vscode.window
        .showWarningMessage('V2EX 登录状态已失效，请重新登录', '重新登录')
        .then(action => {
          if (action === '重新登录') {
            void vscode.commands.executeCommand('v2ex.login')
          }
        })
    },
    onTwoFactorRequired: requestTwoFactorVerification,
    onHttpFailure: summary => logger.warn('HTTP 请求失败', summary)
  })
  G.V2ex = client

  // 刷新登录状态，并在登录有效时尝试自动签到
  const refreshLoginAndAutoSignIn = async () => {
    const authenticated = await client.refreshAuthentication()
    if (authenticated) {
      autoDailySignIn({ notifyOnSuccess: true }).catch(err => logger.error('自动签到失败', err))
    }
    return authenticated
  }

  setOpenNodeTabHandler(node => mainViewProvider.openNode(node))

  // 启动后台清理、网络检查与每日签到调度
  void deleteExtensionFileCacheDir(LEGACY_IMAGE_PREVIEW_CACHE_DIR).catch(err => {
    logger.warn('清理旧版图片预览缓存失败', err)
  })
  context.subscriptions.push(startPanelIconCacheCleanup())
  startConnectivityCheck(context)
  context.subscriptions.push(startDailySignInScheduler())

  // 首次刷新登录会话与已打开页面
  refreshLoginAndAutoSignIn()
    .then(authenticated => {
      if (!authenticated) return
      return mainViewProvider.reloadViewData().then(() => refreshTopicPanelsForAuthChange())
    })
    .catch(err => {
      logger.error('登录会话刷新失败', err)
    })

  // 注册主视图
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('v2ex-main', mainViewProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  )

  // 注册登录命令
  context.subscriptions.push(
    vscode.commands.registerCommand('v2ex.login', async () => {
      const loginResult = await login()
      if (loginResult === LoginResult.success || loginResult === LoginResult.logout) {
        mainViewProvider.reloadViewData()
        refreshTopicPanelsForAuthChange()
      }
      if (loginResult === LoginResult.success) {
        autoDailySignIn({ notifyOnSuccess: true }).catch(err => logger.error('自动签到失败', err))
      }
    })
  )

  // 注册页面与设置命令
  context.subscriptions.push(vscode.commands.registerCommand('v2ex.search', () => openSearch()))
  context.subscriptions.push(vscode.commands.registerCommand('v2ex.openTopic', () => openTopic()))
  context.subscriptions.push(
    vscode.commands.registerCommand('v2ex.recentBrowse', () => openRecentBrowse())
  )
  context.subscriptions.push(vscode.commands.registerCommand('v2ex.settings', () => setting()))
  context.subscriptions.push(vscode.commands.registerCommand('v2ex.showLogs', () => logger.show()))
}

export function deactivate() {
  // G.context = undefined
}
