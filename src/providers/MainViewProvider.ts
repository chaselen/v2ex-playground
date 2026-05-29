import vscode from 'vscode'
import path from 'path'
import G from '@/global'
import { LoginRequiredError, Node, Topic } from '@/v2ex'
import { TopicPanelInput } from '@/controllers/TopicPanelController'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { renderWebviewHtml } from '@/core/webviewHtml'
import {
  CustomNodesUpdatedData,
  EXPLORE_NODES,
  InitData,
  MainTabKey,
  MainViewRpcCommands,
  MainViewWebviewEvents,
  NodeChildrenData,
  WebviewNode,
  WebviewTopic
} from '@/shared/webview'

export default class MainViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView
  private _rpc?: WebviewRpcBridge<MainViewRpcCommands, MainViewWebviewEvents>

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
    webviewView.onDidDispose(() => {
      this._rpc?.dispose()
      if (this._view === webviewView) {
        this._view = undefined
        this._rpc = undefined
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
    rpc.handle('ready', () => this._getInitData())
    rpc.handle('refreshAll', () => this._getInitData())
    rpc.handle('expandNode', msg => this._handleExpandNode(msg.tab, msg.nodeId))
    rpc.handle('refreshNode', msg => this._handleRefreshNode(msg.tab, msg.nodeId))
    rpc.handle('addNode', () => this._handleAddNode())
    rpc.handle('removeNode', msg => this._handleRemoveNode(msg.nodeId))
    rpc.handle('openTopic', msg => this._openTopic(msg.topicId, msg.title))
    rpc.handle('search', () => vscode.commands.executeCommand('v2ex-main.search'))
    rpc.handle('login', () => vscode.commands.executeCommand('v2ex.login'))
    rpc.handle('ctxCopyLink', msg => vscode.commands.executeCommand('v2ex.copyLink', msg))
    rpc.handle('ctxCopyTitleLink', msg => vscode.commands.executeCommand('v2ex.copyTitleLink', msg))
    rpc.handle('ctxViewInBrowser', msg => vscode.commands.executeCommand('v2ex.viewInBrowser', msg))
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

    const loggedIn = !!G.getCookie()

    return {
      tabs: {
        explore: EXPLORE_NODES,
        custom: customNodes,
        collection: collectionNodes
      },
      loggedIn
    }
  }

  /**
   * 展开节点时获取话题列表
   * @param tab 标签 key
   * @param nodeId 节点 id
   */
  private async _handleExpandNode(tab: MainTabKey, nodeId: string): Promise<NodeChildrenData> {
    try {
      let topics: Topic[] = []

      if (tab === 'explore') {
        topics = await G.V2ex.getTopicListByTab(nodeId)
      } else {
        const res = await G.V2ex.getTopicListByNode(nodeId)
        topics = res.list
      }

      const children: WebviewTopic[] = topics.map(t => ({
        id: t.id,
        title: t.title,
        replies: t.replies
      }))

      // 检查登录是否有效
      G.V2ex.checkCookie(G.getCookie()!)

      return {
        tab,
        nodeId,
        children
      }
    } catch (err) {
      console.error(err)
      return {
        tab,
        nodeId,
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
   */
  private async _handleRefreshNode(tab: MainTabKey, nodeId: string): Promise<NodeChildrenData> {
    return this._handleExpandNode(tab, nodeId)
  }

  /**
   * 打开话题
   * @param topicId 话题 id
   * @param title 话题标题
   */
  private _openTopic(topicId: unknown, title: unknown) {
    vscode.commands.executeCommand('v2ex.topicItemClick', {
      topicId: Number(topicId),
      label: String(title || '')
    } satisfies TopicPanelInput)
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
}
