import vscode from 'vscode'
import { EOL } from 'os'
import MainViewProvider from '@/providers/MainViewProvider'
import topicItemClick from '@/commands/topicItemClick'
import login, { LoginResult } from '@/commands/login'
import G from '@/global'
import { V2exClient } from '@/v2ex'
import search from '@/commands/search'
import setting from '@/commands/setting'
import { cleanupImagePreviewCache } from '@/features/imagePreview'
import Config from '@/config'

export function activate(context: vscode.ExtensionContext) {
  G.context = context
  G.V2ex = new V2exClient(
    () => G.getCookie(),
    cookie => G.setCookie(cookie),
    () => Config.proxyUrl()
  )
  cleanupImagePreviewCache()

  // 插件激活后直接获取节点信息缓存下来
  G.V2ex.getAllNodes()
  // 检查登录是否有效
  G.V2ex.checkCookie(G.getCookie()!)

  // 注册主视图 WebviewView
  const mainViewProvider = new MainViewProvider()
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
    })
  )

  // 公共事件：复制链接
  context.subscriptions.push(
    vscode.commands.registerCommand('v2ex.copyLink', (item: any) => {
      const link = item?.link || G.V2ex.getTopicLinkById(item?.topicId)
      if (link) vscode.env.clipboard.writeText(link)
    })
  )

  // 公共事件：复制标题和链接
  context.subscriptions.push(
    vscode.commands.registerCommand('v2ex.copyTitleLink', (item: any) => {
      const link = item?.link || G.V2ex.getTopicLinkById(item?.topicId)
      if (link) vscode.env.clipboard.writeText(item?.label + EOL + link)
    })
  )

  // 公共事件：在浏览器中打开
  context.subscriptions.push(
    vscode.commands.registerCommand('v2ex.viewInBrowser', (item: any) => {
      const link = item?.link || G.V2ex.getTopicLinkById(item?.topicId)
      if (link) vscode.env.openExternal(vscode.Uri.parse(link))
    })
  )

  // 公共事件：点击浏览帖子
  context.subscriptions.push(
    vscode.commands.registerCommand('v2ex.topicItemClick', item => topicItemClick(item))
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
