import vscode, { Uri } from 'vscode'
import autoDailySignIn, {
  dailySignIn,
  getDailySignInStatus,
  onDailySignInStatusChanged
} from '@/features/dailySignIn'
import G from '@/global'
import { LoginRequiredError, Topic, V2exNotification } from '@/v2ex'
import { openBalance, openMember, openNode, openTopic } from '@/features/panelNavigation'
import { openExternal } from '@/features/openExternal'
import { downloadImage } from '@/features/imageDownload'
import { copyTopicLink, copyTopicTitleLink, viewTopicInBrowser } from '@/features/topicSharing'
import { getReadTopicIds, isTopicRead, onTopicRead } from '@/features/recentBrowse'
import { onCollectionNodesChanged } from '@/features/nodeCollection'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { logger } from '@/core/logger'
import { renderWebviewHtml } from '@/core/webviewHtml'
import { addCustomNode, getCustomNodes, removeCustomNode } from '@/features/customNodes'
import { toWebviewNodesWithAvatars } from '@/features/nodeAvatars'
import { showAddCustomNodeQuickPick } from '@/features/nodeQuickPick'
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
  NodeChildrenData,
  OpenNodePayload,
  OpenTopicPayload,
  WebviewDailySignInData,
  WebviewNotification,
  WebviewTopic,
  WebviewRpcController
} from '@/shared/webview'
import type { AccountOverview } from '@/v2ex'

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

  // 踩坑：VS Code 会自动加视图容器标题前缀，Cursor 则直接显示运行时标题
  const titlePrefix = vscode.env.appName.toLowerCase().includes('cursor') ? 'V2EX: ' : ''
  view.title = `${titlePrefix}${detail}`
}

export default class MainViewProvider
  implements vscode.WebviewViewProvider, WebviewRpcController<MainViewRpcCommands>
{
  private _view?: vscode.WebviewView
  private _rpc?: WebviewRpcBridge<MainViewRpcCommands, MainViewWebviewEvents>
  private _webviewReady = false
  private _pendingSelectedTab?: MainPanelTabKey
  private _accountOverviewChangedDisposable?: { dispose: () => void }
  private _onlineCountChangedDisposable?: { dispose: () => void }
  private _dailySignInStatusDisposable?: { dispose: () => void }
  private _topicReadDisposable?: { dispose: () => void }
  private _windowStateDisposable?: { dispose: () => void }
  private _collectionNodesChangedDisposable?: { dispose: () => void }
  /** 当前主视图徽标上的未读提醒数量 */
  private _badgeUnreadNoticeCount = 0
  /** Webview 恢复可见时的自动签到任务 */
  private _visibleAutoSignInPromise?: Promise<void>

  async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
    this._view = webviewView
    this._syncUnreadNoticeBadge(this._badgeUnreadNoticeCount)

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(G.context.extensionUri, 'html')]
    }

    webviewView.webview.html = await renderWebviewHtml(webviewView.webview, 'main.html')

    this._rpc = new WebviewRpcBridge<MainViewRpcCommands, MainViewWebviewEvents>(
      webviewView.webview,
      this
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
    this._topicReadDisposable = onTopicRead(topicId =>
      this._rpc?.post('topicRead', { topicIds: [topicId] })
    )
    this._windowStateDisposable?.dispose()
    this._windowStateDisposable = vscode.window.onDidChangeWindowState(state => {
      if (state.focused) {
        this._syncTopicReadFromStorage()
      }
    })
    this._collectionNodesChangedDisposable?.dispose()
    this._collectionNodesChangedDisposable = onCollectionNodesChanged(data =>
      this._rpc?.post('collectionNodesChanged', data)
    )
    const visibilityDisposable = webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.autoSignInWhenVisible()
        this._syncTopicReadFromStorage()
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
      this._windowStateDisposable?.dispose()
      this._windowStateDisposable = undefined
      this._collectionNodesChangedDisposable?.dispose()
      this._collectionNodesChangedDisposable = undefined
      this._rpc?.dispose()
      if (this._view === webviewView) {
        this._view = undefined
        this._rpc = undefined
        this._webviewReady = false
        this._visibleAutoSignInPromise = undefined
      }
    })
  }

  /** 获取主视图初始化数据 */
  rpc_ready() {
    this._webviewReady = true
    return this._getInitData()
  }

  /** 刷新收藏节点 */
  rpc_refreshCollectionNodes() {
    return this._handleRefreshCollectionNodes()
  }

  /** 刷新账户概览 */
  rpc_refreshMyOverview() {
    return this._handleRefreshMyOverview()
  }

  /** 展开节点 */
  rpc_expandNode(message: { tab: MainTabKey; itemKey: string; page?: number }) {
    return this._handleExpandNode(message.tab, message.itemKey, message.page)
  }

  /** 刷新节点 */
  rpc_refreshNode(message: { tab: MainTabKey; itemKey: string; page?: number }) {
    return this._handleRefreshNode(message.tab, message.itemKey, message.page)
  }

  /** 获取我的主题 */
  rpc_getMyTopics(message: {
    tab: Extract<MyContentTabKey, 'topicCollection' | 'specialFollowing'>
    page?: number
  }) {
    return this._handleGetMyTopics(message.tab, message.page)
  }

  /** 获取我的提醒 */
  rpc_getMyNotifications(page?: number) {
    return this._handleGetMyNotifications(page)
  }

  /** 获取每日签到状态 */
  rpc_getDailySignInStatus() {
    return this._handleGetDailySignInStatus()
  }

  /** 执行每日签到 */
  rpc_dailySignIn() {
    return this._handleDailySignIn()
  }

  /** 添加自定义节点 */
  rpc_addNode() {
    return this._handleAddNode()
  }

  /** 删除自定义节点 */
  rpc_removeNode(nodeName: string) {
    return this._handleRemoveNode(nodeName)
  }

  /** 取消收藏节点 */
  rpc_cancelCollectNode(nodeName: string) {
    return this._handleCancelCollectNode(nodeName)
  }

  /** 打开话题面板 */
  rpc_openTopic(message: OpenTopicPayload) {
    openTopic(message)
  }

  /** 打开用户面板 */
  rpc_openMember(username: string) {
    openMember(username)
  }

  /** 打开节点主题面板 */
  rpc_openNode(message: OpenNodePayload) {
    openNode(message)
  }

  /** 打开账户余额面板 */
  rpc_openBalance() {
    openBalance()
  }

  /** 打开创作新主题面板 */
  async rpc_createTopic() {
    await vscode.commands.executeCommand('v2ex.createTopic')
  }

  /** 打开外部链接 */
  rpc_openExternal(path: string) {
    openExternal(path)
  }

  /** 下载远程图片 */
  rpc_downloadImage(imageSrc: string) {
    void downloadImage(imageSrc)
  }

  /** 打开搜索面板 */
  async rpc_search() {
    await vscode.commands.executeCommand('v2ex.search')
  }

  /** 执行登录 */
  async rpc_login() {
    await vscode.commands.executeCommand('v2ex.login')
  }

  /** 复制话题链接 */
  rpc_ctxCopyLink(message: { topicId: number; label: string }) {
    copyTopicLink(message.topicId)
  }

  /** 复制话题标题和链接 */
  rpc_ctxCopyTitleLink(message: { topicId: number; label: string }) {
    copyTopicTitleLink(message.topicId, message.label)
  }

  /** 在浏览器中打开话题 */
  rpc_ctxViewInBrowser(message: { topicId: number; label: string }) {
    viewTopicInBrowser(message.topicId)
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
    const customNodes = toWebviewNodesWithAvatars(getCustomNodes())
    // 持久化凭据可能仍在后台验证，此时先保留登录态以展示受保护标签的骨架屏
    const loggedIn = G.V2ex.hasLoginSession()

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
      selectedTab: this.consumePendingSelectedTab()
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
      nodes: toWebviewNodesWithAvatars(nodes)
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
   * 获取自定义节点视图数据
   */
  private _getCustomNodesData(): NodeListData {
    return {
      nodes: toWebviewNodesWithAvatars(getCustomNodes())
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

    const customNodeNames = new Set(getCustomNodes().map(node => node.name))
    const select = await showAddCustomNodeQuickPick(nodes, customNodeNames)

    if (!select) {
      return this._getCustomNodesData()
    }

    const isAdd = await addCustomNode({
      name: select.name,
      title: select.title,
      avatar: select.avatar
    })

    if (isAdd) {
      return this._getCustomNodesData()
    }

    vscode.window.showInformationMessage('节点已经存在，无需再添加')
    return this._getCustomNodesData()
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
   * 按当前 globalState 把已读话题再推给主面板
   *
   * 多窗口没有 Memento 变更事件，只在窗口聚焦或主面板重新可见时重读；
   * 复用现有 topicRead 一次推送当前已读 id，只补已读，不改回未读
   */
  private _syncTopicReadFromStorage() {
    if (!this._webviewReady || !this._view?.visible) {
      return
    }

    this._rpc?.post('topicRead', { topicIds: getReadTopicIds() })
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
