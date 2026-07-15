import vscode from 'vscode'
import path from 'path'
import autoDailySignIn, {
  dailySignIn,
  getDailySignInStatus,
  onDailySignInStatusChanged
} from '@/features/dailySignIn'
import G from '@/global'
import { LoginRequiredError, Topic, V2exNotification } from '@/v2ex'
import { openBalance, openMember, openTopic } from '@/features/panelNavigation'
import { openExternal } from '@/features/openExternal'
import { copyTopicLink, copyTopicTitleLink, viewTopicInBrowser } from '@/features/topicSharing'
import { isTopicRead, onTopicRead } from '@/features/recentBrowse'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { logger } from '@/core/logger'
import { renderWebviewHtml } from '@/core/webviewHtml'
import { addCustomNode, getCustomNodes, removeCustomNode } from '@/features/customNodes'
import {
  EXPLORE_NODES,
  InitData,
  MainTabKey,
  MainPanelTabKey,
  MainViewRpcCommands,
  MainViewWebviewEvents,
  MyContentTabKey,
  MyNotificationListData,
  MyOverviewRefreshData,
  MyTopicListData,
  NodeListData,
  NodeTopicListData,
  WebviewAccountOverview,
  NodeChildrenData,
  WebviewDailySignInData,
  WebviewNotification,
  WebviewNode,
  WebviewTopic,
  WebviewRpcHandlers
} from '@/shared/webview'
import type { AccountOverview } from '@/v2ex'
import type { NodeTabInput } from '@/controllers/panelTypes'

/**
 * 更新视图标题并兼容不同编辑器的标题渲染方式
 * @param view Webview 视图
 * @param detail 标题附加信息
 */
function updateViewTitle(view: vscode.WebviewView, detail?: string): void {
  if (!detail) {
    view.title = 'V2EX'
    return
  }

  // VS Code 会自动添加视图容器标题，Cursor 则直接显示运行时标题
  const titlePrefix = vscode.env.appName.toLowerCase().includes('cursor') ? 'V2EX: ' : ''
  view.title = `${titlePrefix}${detail}`
}

export default class MainViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView
  private _rpc?: WebviewRpcBridge<MainViewRpcCommands, MainViewWebviewEvents>
  private _webviewReady = false
  private _pendingSelectedTab?: MainPanelTabKey
  private _pendingNode?: WebviewNode
  private _accountOverviewChangedDisposable?: { dispose: () => void }
  private _onlineCountChangedDisposable?: { dispose: () => void }
  private _dailySignInStatusDisposable?: { dispose: () => void }
  private _topicReadDisposable?: { dispose: () => void }
  /** 当前主视图徽标上的未读提醒数量 */
  private _badgeUnreadNoticeCount = 0
  /** Webview 恢复可见时的自动签到任务 */
  private _visibleAutoSignInPromise?: Promise<void>

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView
    this._syncUnreadNoticeBadge(this._badgeUnreadNoticeCount)

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(G.context.extensionPath, 'html'))]
    }

    webviewView.webview.html = this._getHtml(webviewView.webview)

    this._rpc = new WebviewRpcBridge<MainViewRpcCommands, MainViewWebviewEvents>(
      webviewView.webview,
      this._createRpcHandlers()
    )
    this._accountOverviewChangedDisposable?.dispose()
    this._accountOverviewChangedDisposable = G.V2ex.onAccountOverviewChanged(
      (overview, oldOverview) => this._handleAccountOverviewChanged(overview, oldOverview)
    )
    this._onlineCountChangedDisposable?.dispose()
    this._onlineCountChangedDisposable = G.V2ex.onOnlineCountChanged(onlineCount =>
      this._updateOnlineCountTitle(onlineCount)
    )
    this._dailySignInStatusDisposable?.dispose()
    this._dailySignInStatusDisposable = onDailySignInStatusChanged(data =>
      this._rpc?.post('dailySignInStatusChanged', data)
    )
    this._topicReadDisposable?.dispose()
    this._topicReadDisposable = onTopicRead(topicId => this._rpc?.post('topicRead', { topicId }))
    const visibilityDisposable = webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.autoSignInWhenVisible()
      }
    })
    webviewView.onDidDispose(() => {
      visibilityDisposable.dispose()
      this._accountOverviewChangedDisposable?.dispose()
      this._accountOverviewChangedDisposable = undefined
      this._onlineCountChangedDisposable?.dispose()
      this._onlineCountChangedDisposable = undefined
      this._dailySignInStatusDisposable?.dispose()
      this._dailySignInStatusDisposable = undefined
      this._topicReadDisposable?.dispose()
      this._topicReadDisposable = undefined
      this._rpc?.dispose()
      if (this._view === webviewView) {
        this._view = undefined
        this._rpc = undefined
        this._webviewReady = false
        this._visibleAutoSignInPromise = undefined
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
   * 创建 Webview RPC 处理器
   */
  private _createRpcHandlers(): WebviewRpcHandlers<MainViewRpcCommands> {
    return {
      ready: () => {
        this._webviewReady = true
        return this._getInitData()
      },
      refreshCollectionNodes: () => this._handleRefreshCollectionNodes(),
      refreshMyOverview: () => this._handleRefreshMyOverview(),
      expandNode: msg => this._handleExpandNode(msg.tab, msg.itemKey, msg.page),
      refreshNode: msg => this._handleRefreshNode(msg.tab, msg.itemKey, msg.page),
      getNodeTopics: msg => this._handleGetNodeTopics(msg.nodeName, msg.page),
      getMyTopics: msg => this._handleGetMyTopics(msg.tab, msg.page),
      getMyNotifications: msg => this._handleGetMyNotifications(msg.page),
      getDailySignInStatus: () => this._handleGetDailySignInStatus(),
      dailySignIn: () => this._handleDailySignIn(),
      addNode: () => this._handleAddNode(),
      removeNode: msg => this._handleRemoveNode(msg.nodeName),
      cancelCollectNode: msg => this._handleCancelCollectNode(msg.nodeName),
      openTopic: msg =>
        openTopic({ topicId: msg.topicId, label: msg.title || `/t/${msg.topicId}` }),
      openMember: msg => openMember({ username: msg.username }),
      openNode: msg => this.openNode(msg),
      openBalance: () => openBalance(),
      openExternal: msg => {
        openExternal(msg.path)
      },
      search: async () => {
        await vscode.commands.executeCommand('v2ex.search')
      },
      login: async () => {
        await vscode.commands.executeCommand('v2ex.login')
      },
      ctxCopyLink: msg => copyTopicLink(msg.topicId),
      ctxCopyTitleLink: msg => copyTopicTitleLink(msg.topicId, msg.label),
      ctxViewInBrowser: msg => viewTopicInBrowser(msg.topicId)
    }
  }

  /**
   * 处理账户概览变化
   * @param overview 最新账户概览
   * @param oldOverview 旧账户概览
   */
  private _handleAccountOverviewChanged(overview: AccountOverview, oldOverview?: AccountOverview) {
    this._syncUnreadNoticeBadge(overview.unreadNoticeCount)
    this._rpc?.post('accountOverviewChanged', {
      overview,
      oldOverview
    })
  }

  /**
   * 更新视图标题区在线人数
   * @param onlineCount 在线人数
   */
  private _updateOnlineCountTitle(onlineCount?: number): void {
    if (!this._view) {
      return
    }

    updateViewTitle(this._view, onlineCount === undefined ? undefined : `${onlineCount} 人在线`)
  }

  /**
   * 同步主视图未读提醒徽标
   * @param count 未读提醒数量
   */
  private _syncUnreadNoticeBadge(count: number): void {
    this._badgeUnreadNoticeCount = Math.max(count, 0)

    if (!this._view) {
      return
    }

    if (this._badgeUnreadNoticeCount <= 0) {
      // VS Code 运行时设置 undefined 无法稳定清除已有徽标
      this._view.badge = {
        value: 0,
        tooltip: ''
      }
      return
    }

    this._view.badge = {
      value: this._badgeUnreadNoticeCount,
      tooltip: `${this._badgeUnreadNoticeCount} 条未读提醒`
    }
  }

  /**
   * 获取初始数据
   */
  private async _getInitData(): Promise<InitData> {
    const customNodes = getCustomNodes().map(n => ({
      name: n.name,
      title: n.title
    }))
    // 持久化凭据可能仍在后台验证，此时先保留登录态以展示受保护标签的骨架屏
    const loggedIn = G.V2ex.isAuthenticated() || !!G.V2ex.getLoginCookie()

    if (!loggedIn) {
      this._syncUnreadNoticeBadge(0)
    }

    return {
      tabs: {
        explore: EXPLORE_NODES,
        custom: customNodes,
        collection: []
      },
      loggedIn,
      selectedTab: this.consumePendingSelectedTab(),
      selectedNode: this.consumePendingNode()
    }
  }

  /**
   * 刷新收藏节点列表
   */
  private async _handleRefreshCollectionNodes(): Promise<NodeListData> {
    if (!(await G.V2ex.ensureAuthenticated())) {
      return { nodes: [] }
    }

    const nodes = await G.V2ex.getCollectionNodes()
    return {
      nodes: nodes.map(node => ({
        name: node.name,
        title: node.title
      }))
    }
  }

  /**
   * 刷新我的账户概览
   */
  private async _handleRefreshMyOverview(): Promise<MyOverviewRefreshData> {
    if (!(await G.V2ex.refreshAuthentication())) {
      return { loggedIn: false }
    }

    return {
      loggedIn: true,
      accountOverview: await G.V2ex.getAccountOverview({ force: true })
    }
  }

  /**
   * 展开节点时获取话题列表
   * @param tab 标签 key
   * @param itemKey 列表项 key，首页中为 tab 名，其他列表中为节点 name
   * @param page 页码
   */
  private async _handleExpandNode(
    tab: MainTabKey,
    itemKey: string,
    page = 1
  ): Promise<NodeChildrenData> {
    try {
      let topics: Topic[] = []
      let totalPage = 1
      let totalCount = 0

      if (tab === 'explore') {
        topics = await G.V2ex.getTopicListByTab(itemKey)
      } else {
        const res = await G.V2ex.getTopicListByNode(itemKey, page)
        topics = res.list
        totalPage = Math.max(res.totalPage || 1, 1)
        totalCount = Math.max(res.totalCount || 0, 0)
      }

      const children = topics.map(t => this._toWebviewTopic(t))

      return {
        tab,
        itemKey,
        page,
        totalPage,
        totalCount,
        children
      }
    } catch (err) {
      logger.error('主视图数据加载失败', err, { tab, itemKey, page })
      return {
        tab,
        itemKey,
        page,
        totalPage: 1,
        totalCount: 0,
        children: [],
        error: (err as Error).message
      }
    }
  }

  /**
   * 获取节点主题列表
   * @param nodeName 节点 name
   * @param page 页码
   */
  private async _handleGetNodeTopics(nodeName: string, page = 1): Promise<NodeTopicListData> {
    const result = await G.V2ex.getTopicListByNode(nodeName, page)

    return {
      node: result.node,
      page,
      totalPage: Math.max(result.totalPage || 1, 1),
      totalCount: Math.max(result.totalCount || 0, 0),
      topics: result.list.map(topic => this._toWebviewTopic(topic))
    }
  }

  /**
   * 获取自定义节点视图数据
   */
  private _getCustomNodesData(): NodeListData {
    const customNodes = getCustomNodes()
    return {
      nodes: customNodes.map(n => ({
        name: n.name,
        title: n.title
      }))
    }
  }

  /**
   * 添加自定义节点
   */
  private async _handleAddNode(): Promise<NodeListData> {
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

    const isAdd = await addCustomNode({
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
   * @param nodeName 节点 name
   */
  private async _handleRemoveNode(nodeName: string): Promise<NodeListData> {
    await removeCustomNode(nodeName)
    return this._getCustomNodesData()
  }

  /**
   * 取消收藏节点
   * @param nodeName 节点 name
   */
  private async _handleCancelCollectNode(nodeName: string): Promise<void> {
    if (!(await G.V2ex.ensureAuthenticated())) {
      throw new LoginRequiredError('取消收藏节点前请先登录')
    }

    await G.V2ex.cancelCollectNode(nodeName)
    try {
      await G.V2ex.getAccountOverview({ force: true })
    } catch (err) {
      logger.error('主视图操作失败', err)
    }
  }

  /**
   * 刷新节点
   * @param tab 标签 key
   * @param itemKey 列表项 key，首页中为 tab 名，其他列表中为节点 name
   * @param page 页码
   */
  private async _handleRefreshNode(
    tab: MainTabKey,
    itemKey: string,
    page = 1
  ): Promise<NodeChildrenData> {
    return this._handleExpandNode(tab, itemKey, page)
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
    if (!(await G.V2ex.ensureAuthenticated())) {
      return {
        tab,
        page,
        totalPage: 1,
        topics: []
      }
    }

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
    if (!(await G.V2ex.ensureAuthenticated())) {
      return {
        page,
        totalPage: 1,
        totalCount: 0,
        notifications: []
      }
    }

    const result = await G.V2ex.getNotifications(page)

    return {
      page,
      totalPage: Math.max(result.totalPage || 1, 1),
      totalCount: result.totalCount,
      notifications: result.list.map(notification => this._toWebviewNotification(notification))
    }
  }

  /**
   * 获取每日签到状态
   */
  private async _handleGetDailySignInStatus(): Promise<WebviewDailySignInData> {
    if (!(await G.V2ex.ensureAuthenticated())) return { signedIn: false }

    return getDailySignInStatus()
  }

  /**
   * 执行每日签到
   */
  private async _handleDailySignIn(): Promise<WebviewDailySignInData> {
    if (!(await G.V2ex.ensureAuthenticated())) return { signedIn: false }

    return dailySignIn()
  }

  /**
   * Webview 恢复可见时尝试自动签到
   */
  private autoSignInWhenVisible() {
    if (this._visibleAutoSignInPromise) {
      return
    }

    this._visibleAutoSignInPromise = autoDailySignIn({ notifyOnSuccess: true })
      .then(() => undefined)
      .catch(err => logger.error('自动签到失败', err))
      .finally(() => {
        this._visibleAutoSignInPromise = undefined
      })
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
      replies: topic.replies,
      displayTime: topic.displayTime,
      lastReplyUser: topic.lastReplyUser,
      isRead: isTopicRead(topic.id)
    }
  }

  /**
   * 刷新整个视图数据（外部调用）
   */
  async reloadViewData(): Promise<void> {
    try {
      const data = await this._getInitData()
      this._rpc?.post('initData', data)
    } catch (err) {
      logger.error('主视图刷新失败', err)
    }
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
   * 打开节点主题标签
   * @param node 节点
   */
  async openNode(node: NodeTabInput) {
    this._pendingNode = {
      name: node.name,
      title: node.title || node.name
    }
    await vscode.commands.executeCommand('v2ex-main.focus')
    this.postPendingNode()
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

  /**
   * 发送待打开节点
   */
  private postPendingNode() {
    if (!this._pendingNode || !this._rpc || !this._webviewReady) {
      return
    }

    const node = this._pendingNode
    this._pendingNode = undefined
    this._rpc.post('openNode', node)
  }

  /**
   * 取出待打开节点
   */
  private consumePendingNode() {
    const node = this._pendingNode
    this._pendingNode = undefined
    return node
  }
}
