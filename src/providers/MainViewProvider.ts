import vscode from 'vscode'
import { readFileSync } from 'fs'
import path from 'path'
import { Eta } from 'eta'
import G from '@/global'
import { LoginRequiredError, Node, Topic, V2ex } from '@/v2ex'
import { TopicPanelInput } from '@/controllers/TopicPanelController'

/**
 * Webview 节点项
 */
export interface WebviewNode {
  id: string
  label: string
  nodeName?: string
}

/**
 * Webview 话题项
 */
export interface WebviewTopic {
  id: number
  title: string
  replies: number
}

/**
 * Webview 接收的初始化数据
 */
export interface InitData {
  tabs: {
    explore: WebviewNode[]
    custom: WebviewNode[]
    collection: WebviewNode[]
  }
  loggedIn: boolean
}

export default class MainViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(G.context.extensionPath, 'html'))]
    }

    webviewView.webview.html = this._getHtml(webviewView.webview)

    webviewView.webview.onDidReceiveMessage(async message => {
      await this._handleMessage(message)
    })
  }

  /**
   * 渲染 Eta 模板
   */
  private _getHtml(webview: vscode.Webview): string {
    const templatePath = path.join(G.context.extensionPath, 'html', 'main.html')
    const eta = new Eta({ useWith: true })
    return eta.renderString(readFileSync(templatePath, 'utf-8'), {
      contextPath: G.getWebViewContextPath(webview)
    })
  }

  /**
   * 处理 webview 消息
   */
  private async _handleMessage(message: any) {
    const msg = message as { command: string; [key: string]: any }

    switch (msg.command) {
      case 'ready':
        await this._sendInitData()
        break

      case 'expandNode':
        await this._handleExpandNode(msg.tab, msg.nodeId)
        break

      case 'openTopic':
        vscode.commands.executeCommand('v2ex.topicItemClick', {
          topicId: msg.topicId,
          label: msg.title
        } satisfies TopicPanelInput)
        break

      case 'search':
        vscode.commands.executeCommand('v2ex-main.search')
        break

      case 'login':
        vscode.commands.executeCommand('v2ex.login')
        break

      case 'addNode':
        await this._handleAddNode()
        break

      case 'removeNode':
        await this._handleRemoveNode(msg.nodeId)
        break

      case 'refreshAll':
        await this._sendInitData()
        break

      case 'refreshNode':
        await this._handleRefreshNode(msg.tab, msg.nodeId)
        break

      case 'ctxCopyLink':
        vscode.commands.executeCommand('v2ex.copyLink', msg)
        break

      case 'ctxCopyTitleLink':
        vscode.commands.executeCommand('v2ex.copyTitleLink', msg)
        break

      case 'ctxViewInBrowser':
        vscode.commands.executeCommand('v2ex.viewInBrowser', msg)
        break

      default:
        break
    }
  }

  /**
   * 发送初始数据
   */
  private async _sendInitData() {
    const exploreNodes = this._getExploreNodes()
    const customNodes = G.getCustomNodes().map(n => ({
      id: n.name,
      label: n.title,
      nodeName: n.name
    }))

    let collectionNodes: WebviewNode[] = []
    try {
      const rawNodes = await V2ex.getCollectionNodes()
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

    this._postMessage('initData', {
      tabs: {
        explore: exploreNodes,
        custom: customNodes,
        collection: collectionNodes
      },
      loggedIn
    } satisfies InitData)
  }

  /**
   * 获取首页预置节点
   */
  private _getExploreNodes(): WebviewNode[] {
    const tabConfig: Array<{ id: string; label: string }> = [
      { id: 'tech', label: '技术' },
      { id: 'creative', label: '创意' },
      { id: 'play', label: '好玩' },
      { id: 'apple', label: 'Apple' },
      { id: 'jobs', label: '酷工作' },
      { id: 'deals', label: '交易' },
      { id: 'city', label: '城市' },
      { id: 'qna', label: '问与答' },
      { id: 'hot', label: '最热' },
      { id: 'all', label: '全部' },
      { id: 'r2', label: 'R2' },
      { id: 'nodes', label: '节点' }
    ]
    return tabConfig.map(t => ({
      id: t.id,
      label: t.label,
      nodeName: t.id
    }))
  }

  /**
   * 展开节点时获取话题列表
   */
  private async _handleExpandNode(tab: string, nodeId: string) {
    try {
      let topics: Topic[] = []

      if (tab === 'explore') {
        topics = await V2ex.getTopicListByTab(nodeId)
      } else {
        const res = await V2ex.getTopicListByNode(nodeId)
        topics = res.list
      }

      const children: WebviewTopic[] = topics.map(t => ({
        id: t.id,
        title: t.title,
        replies: t.replies
      }))

      // check cookie 自动签到
      V2ex.checkCookie(G.getCookie()!, true)

      this._postMessage('nodeChildren', {
        tab,
        nodeId,
        children
      })
    } catch (err) {
      console.error(err)
      this._postMessage('nodeChildren', {
        tab,
        nodeId,
        children: [],
        error: (err as Error).message
      })
    }
  }

  /**
   * 添加自定义节点
   */
  private async _handleAddNode() {
    const nodes = await vscode.window.withProgress(
      {
        title: '获取节点信息',
        location: vscode.ProgressLocation.Notification
      },
      () => V2ex.getAllNodes()
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
      return
    }

    const isAdd = G.addCustomNode({
      name: select.description!,
      title: select.label
    })

    if (isAdd) {
      const customNodes = G.getCustomNodes()
      this._postMessage('customNodesUpdated', {
        nodes: customNodes.map(n => ({
          id: n.name,
          label: n.title,
          nodeName: n.name
        }))
      })
    } else {
      vscode.window.showInformationMessage('节点已经存在，无需再添加')
    }
  }

  /**
   * 删除自定义节点
   */
  private async _handleRemoveNode(nodeId: string) {
    G.removeCustomNode(nodeId)
    const customNodes = G.getCustomNodes()
    this._postMessage('customNodesUpdated', {
      nodes: customNodes.map(n => ({
        id: n.name,
        label: n.title,
        nodeName: n.name
      }))
    })
  }

  /**
   * 刷新节点
   */
  private async _handleRefreshNode(tab: string, nodeId: string) {
    await this._handleExpandNode(tab, nodeId)
  }

  /**
   * 刷新整个视图数据（外部调用）
   */
  reloadViewData() {
    this._sendInitData()
  }

  /**
   * 刷新 Webview 中已加载过的节点
   */
  refreshLoadedNodes() {
    this._postMessage('refreshLoadedNodes')
  }

  /**
   * 向 webview 发送消息
   */
  private _postMessage(command: string, data?: any) {
    try {
      this._view?.webview.postMessage({ command, ...data })
    } catch (err) {
      console.log(err)
    }
  }
}
