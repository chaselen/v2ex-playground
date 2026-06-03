import vscode from 'vscode'
import path from 'path'
import { EOL } from 'os'
import autoDailySignIn from '@/commands/dailySignIn'
import G from '@/global'
import { LoginRequiredError, Node, Topic, V2exNotification } from '@/v2ex'
import { TopicPanelInput } from '@/controllers/TopicPanelController'
import topicItemClick from '@/commands/topicItemClick'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { renderWebviewHtml } from '@/core/webviewHtml'
import {
  CustomNodesUpdatedData,
  EXPLORE_NODES,
  InitData,
  MainTabKey,
  MainPanelTabKey,
  MainViewRpcCommands,
  MainViewWebviewEvents,
  MyContentTabKey,
  MyNotificationListData,
  MyTopicListData,
  WebviewAccountOverview,
  NodeChildrenData,
  WebviewNotification,
  WebviewNode,
  WebviewTopic
} from '@/shared/webview'
import type { AccountOverview } from '@/v2ex'

export default class MainViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView
  private _rpc?: WebviewRpcBridge<MainViewRpcCommands, MainViewWebviewEvents>
  private _webviewReady = false
  private _pendingSelectedTab?: MainPanelTabKey
  private _accountOverviewChangedDisposable?: { dispose: () => void }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(G.context.extensionPath, 'html'))]
    }

    webviewView.webview.html = this._getHtml(webviewView.webview)

    this._rpc = new WebviewRpcBridge<MainViewRpcCommands, MainViewWebviewEvents>(
      webviewView.webview
    )
    this._registerRpcHandlers(this._rpc)
    this._rpc.listen()
    this._accountOverviewChangedDisposable?.dispose()
    this._accountOverviewChangedDisposable = G.V2ex.onAccountOverviewChanged(
      (overview, oldOverview) => this._handleAccountOverviewChanged(overview, oldOverview)
    )
    if (webviewView.visible) {
      autoDailySignIn()
    }
    const visibilityDisposable = webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        autoDailySignIn()
      }
    })
    webviewView.onDidDispose(() => {
      visibilityDisposable.dispose()
      this._accountOverviewChangedDisposable?.dispose()
      this._accountOverviewChangedDisposable = undefined
      this._rpc?.dispose()
      if (this._view === webviewView) {
        this._view = undefined
        this._rpc = undefined
        this._webviewReady = false
      }
    })
  }

  /**
   * 渲染 Webview 页面
   */
  private _getHtml(webview: vscode.Webview): string {
    return renderWebviewHtml(webview, 'main.html')
  }

  /**
   * 注册 Webview RPC 处理器
   * @param rpc Webview RPC 桥接器
   */
  private _registerRpcHandlers(rpc: WebviewRpcBridge<MainViewRpcCommands, MainViewWebviewEvents>) {
    rpc.handle('ready', () => {
      this._webviewReady = true
      return this._getInitData()
    })
    rpc.handle('refreshAll', () => this._getInitData())
    rpc.handle('expandNode', msg => this._handleExpandNode(msg.tab, msg.nodeId, msg.page))
    rpc.handle('refreshNode', msg => this._handleRefreshNode(msg.tab, msg.nodeId, msg.page))
    rpc.handle('getMyTopics', msg => this._handleGetMyTopics(msg.tab, msg.page))
    rpc.handle('getMyNotifications', msg => this._handleGetMyNotifications(msg.page))
    rpc.handle('addNode', () => this._handleAddNode())
    rpc.handle('removeNode', msg => this._handleRemoveNode(msg.nodeId))
    rpc.handle('openTopic', msg => this._openTopic(msg.topicId, msg.title))
    rpc.handle('openExternal', msg => this._openExternal(msg.path))
    rpc.handle('search', () => vscode.commands.executeCommand('v2ex-main.search'))
    rpc.handle('login', () => vscode.commands.executeCommand('v2ex.login'))
    rpc.handle('ctxCopyLink', msg => this._copyLink(msg.topicId))
    rpc.handle('ctxCopyTitleLink', msg => this._copyTitleLink(msg.topicId, msg.label))
    rpc.handle('ctxViewInBrowser', msg => this._viewInBrowser(msg.topicId))
  }

  /**
   * 处理账户概览变化
   * @param overview 最新账户概览
   * @param oldOverview 旧账户概览
   */
  private _handleAccountOverviewChanged(overview: AccountOverview, oldOverview?: AccountOverview) {
    this._rpc?.post('accountOverviewChanged', {
      overview,
      oldOverview
    })
  }

  /**
   * 获取初始数据
   */
  private async _getInitData(): Promise<InitData> {
    const customNodes = G.getCustomNodes().map(n => ({
      id: n.name,
      label: n.title,
      nodeName: n.name
    }))

    let collectionNodes: WebviewNode[] = []
    let accountOverview: WebviewAccountOverview | undefined
    const loggedIn = !!G.getCookie()

    if (loggedIn) {
      try {
        const rawNodes = await G.V2ex.getCollectionNodes()
        collectionNodes = rawNodes.map(n => ({
          id: n.name,
          label: n.title,
          nodeName: n.name
        }))
      } catch (err) {
        if (err instanceof LoginRequiredError) {
          collectionNodes = []
        }
      }

      try {
        accountOverview = await G.V2ex.getAccountOverview()
      } catch (err) {
        if (!(err instanceof LoginRequiredError)) {
          console.error(err)
        }
      }
    }

    return {
      tabs: {
        explore: EXPLORE_NODES,
        custom: customNodes,
        collection: collectionNodes
      },
      loggedIn,
      accountOverview,
      selectedTab: this.consumePendingSelectedTab()
    }
  }

  /**
   * 展开节点时获取话题列表
   * @param tab 标签 key
   * @param nodeId 节点 id
   * @param page 页码
   */
  private async _handleExpandNode(
    tab: MainTabKey,
    nodeId: string,
    page = 1
  ): Promise<NodeChildrenData> {
    try {
      let topics: Topic[] = []
      let totalPage = 1

      if (tab === 'explore') {
        topics = await G.V2ex.getTopicListByTab(nodeId)
      } else {
        const res = await G.V2ex.getTopicListByNode(nodeId, page)
        topics = res.list
        totalPage = Math.max(res.totalPage || 1, 1)
      }

      const children = topics.map(t => this._toWebviewTopic(t))

      // 检查登录是否有效
      G.V2ex.checkCookie()

      return {
        tab,
        nodeId,
        page,
        totalPage,
        children
      }
    } catch (err) {
      console.error(err)
      return {
        tab,
        nodeId,
        page,
        totalPage: 1,
        children: [],
        error: (err as Error).message
      }
    }
  }

  /**
   * 获取自定义节点视图数据
   */
  private _getCustomNodesData(): CustomNodesUpdatedData {
    const customNodes = G.getCustomNodes()
    return {
      nodes: customNodes.map(n => ({
        id: n.name,
        label: n.title,
        nodeName: n.name
      }))
    }
  }

  /**
   * 添加自定义节点
   */
  private async _handleAddNode(): Promise<CustomNodesUpdatedData> {
    const nodes = await vscode.window.withProgress(
      {
        title: '获取节点信息',
        location: vscode.ProgressLocation.Notification
      },
      () => G.V2ex.getAllNodes()
    )

    const items = nodes.map(n => ({
      label: n.title,
      description: n.name
    }))

    const select = await vscode.window.showQuickPick(items, {
      placeHolder: '搜索节点',
      matchOnDescription: true
    })

    if (!select) {
      return this._getCustomNodesData()
    }

    const isAdd = G.addCustomNode({
      name: select.description!,
      title: select.label
    })

    if (isAdd) {
      return this._getCustomNodesData()
    } else {
      vscode.window.showInformationMessage('节点已经存在，无需再添加')
      return this._getCustomNodesData()
    }
  }

  /**
   * 删除自定义节点
   * @param nodeId 节点 id
   */
  private async _handleRemoveNode(nodeId: string): Promise<CustomNodesUpdatedData> {
    G.removeCustomNode(nodeId)
    return this._getCustomNodesData()
  }

  /**
   * 刷新节点
   * @param tab 标签 key
   * @param nodeId 节点 id
   * @param page 页码
   */
  private async _handleRefreshNode(
    tab: MainTabKey,
    nodeId: string,
    page = 1
  ): Promise<NodeChildrenData> {
    return this._handleExpandNode(tab, nodeId, page)
  }

  /**
   * 获取我的主题内容列表
   * @param tab 我的内容标签 key
   * @param page 页码
   */
  private async _handleGetMyTopics(
    tab: Extract<MyContentTabKey, 'topicCollection' | 'specialFollowing'>,
    page = 1
  ): Promise<MyTopicListData> {
    const result =
      tab === 'topicCollection'
        ? await G.V2ex.getCollectionTopics(page)
        : await G.V2ex.getSpecialFollowingTopics(page)

    return {
      tab,
      page,
      totalPage: Math.max(result.totalPage || 1, 1),
      topics: result.list.map(topic => this._toWebviewTopic(topic))
    }
  }

  /**
   * 获取我的提醒消息列表
   * @param page 页码
   */
  private async _handleGetMyNotifications(page = 1): Promise<MyNotificationListData> {
    const result = await G.V2ex.getNotifications(page)

    return {
      page,
      totalPage: Math.max(result.totalPage || 1, 1),
      totalCount: result.totalCount,
      notifications: result.list.map(notification => this._toWebviewNotification(notification))
    }
  }

  /**
   * 转换 Webview 提醒消息数据
   * @param notification 领域提醒消息
   */
  private _toWebviewNotification(notification: V2exNotification): WebviewNotification {
    return notification
  }

  /**
   * 转换 Webview 话题数据
   * @param topic 领域话题
   */
  private _toWebviewTopic(topic: Topic): WebviewTopic {
    return {
      id: topic.id,
      title: topic.title,
      nodeName: topic.node?.name,
      nodeTitle: topic.node?.title,
      replies: topic.replies
    }
  }

  /**
   * 打开话题
   * @param topicId 话题 id
   * @param title 话题标题
   */
  private _openTopic(topicId: unknown, title: unknown) {
    topicItemClick({
      topicId: Number(topicId),
      label: String(title || '')
    } satisfies TopicPanelInput)
  }

  /**
   * 在浏览器中打开 V2EX 链接
   * @param targetPath 目标路径
   */
  private _openExternal(targetPath: string) {
    const url = new URL(targetPath, G.V2ex.baseUrl)
    vscode.env.openExternal(vscode.Uri.parse(url.toString()))
  }

  /**
   * 复制话题链接
   * @param topicId 话题 id
   */
  private _copyLink(topicId: number) {
    const link = G.V2ex.getTopicLinkById(topicId)
    vscode.env.clipboard.writeText(link)
  }

  /**
   * 复制话题标题和链接
   * @param topicId 话题 id
   * @param label 话题标题
   */
  private _copyTitleLink(topicId: number, label: string) {
    const link = G.V2ex.getTopicLinkById(topicId)
    vscode.env.clipboard.writeText(label + EOL + link)
  }

  /**
   * 在浏览器中打开话题
   * @param topicId 话题 id
   */
  private _viewInBrowser(topicId: number) {
    const link = G.V2ex.getTopicLinkById(topicId)
    vscode.env.openExternal(vscode.Uri.parse(link))
  }

  /**
   * 刷新整个视图数据（外部调用）
   */
  reloadViewData() {
    this._getInitData()
      .then(data => this._rpc?.post('initData', data))
      .catch(err => console.error(err))
  }

  /**
   * 刷新 Webview 中已加载过的节点
   */
  refreshLoadedNodes() {
    this._rpc?.post('refreshLoadedNodes')
  }

  /**
   * 打开指定标签
   * @param tab 标签 key
   */
  async openTab(tab: MainPanelTabKey) {
    this._pendingSelectedTab = tab
    await vscode.commands.executeCommand('v2ex-main.focus')
    this.postPendingSelectedTab()
  }

  /**
   * 发送待切换标签
   */
  private postPendingSelectedTab() {
    if (!this._pendingSelectedTab || !this._rpc || !this._webviewReady) {
      return
    }

    const selectedTab = this._pendingSelectedTab
    this._pendingSelectedTab = undefined
    this._rpc.post('selectMainTab', {
      tab: selectedTab
    })
  }

  /**
   * 取出待切换标签
   */
  private consumePendingSelectedTab() {
    const selectedTab = this._pendingSelectedTab
    this._pendingSelectedTab = undefined
    return selectedTab
  }
}
