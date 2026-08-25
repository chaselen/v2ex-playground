import vscode from 'vscode'
import G from '@/global'
import { logger } from '@/core/logger'
import { setRemotePanelIcon } from '@/features/panelIcon'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { createV2exWebviewPanel, formatPanelTitle } from '@/controllers/webviewPanel'
import {
  WebviewCommonController,
  type WebviewNavigationDeps
} from '@/controllers/WebviewCommonController'
import { LoginRequiredError } from '@/v2ex'
import { notifyCollectionNodesChanged } from '@/features/nodeCollection'
import type {
  NodePanelRpcCommands,
  NodePanelTopicList,
  NodePanelViewState,
  NodePanelWebviewEvents,
  WebviewRpcController
} from '@/shared/webview'

/** 节点面板导航依赖 */
interface NodePanelNavigationDeps extends WebviewNavigationDeps {
  /** 打开创作新主题面板 */
  openCreateTopic: (nodeName?: string) => void
}

/** 节点主题面板控制器 */
export class NodePanelController
  extends WebviewCommonController<NodePanelNavigationDeps>
  implements WebviewRpcController<NodePanelRpcCommands>
{
  /** 节点面板缓存 key */
  readonly key: string

  /** 节点 name */
  private readonly nodeName: string

  /** 节点主题面板 */
  private readonly panel: vscode.WebviewPanel

  /** Webview RPC 桥接器 */
  private readonly rpc: WebviewRpcBridge<NodePanelRpcCommands, NodePanelWebviewEvents>

  /** 当前视图状态 */
  private viewState: NodePanelViewState = {
    status: 'loading',
    loggedIn: false
  }

  /** 当前页码 */
  private page = 1

  /**
   * @param nodeName 节点 name
   * @param title 初始面板标题
   * @param deps 外部面板导航依赖
   */
  constructor(nodeName: string, title: string, deps: NodePanelNavigationDeps) {
    super(deps)
    this.nodeName = nodeName
    this.key = G.V2ex.getNodeLink(this.nodeName)
    this.panel = createV2exWebviewPanel({
      viewType: this.key,
      title,
      htmlEntry: 'node.html',
      enableFindWidget: true,
      useDefaultIcon: true
    })
    this.rpc = new WebviewRpcBridge<NodePanelRpcCommands, NodePanelWebviewEvents>(
      this.panel.webview,
      this
    )
    this.panel.onDidDispose(() => this.rpc.dispose())
  }

  /** 激活当前面板 */
  reveal() {
    this.panel.reveal()
  }

  /** 销毁当前面板 */
  dispose() {
    this.rpc.dispose()
    this.panel.dispose()
  }

  /**
   * 监听面板销毁
   * @param listener 销毁回调
   */
  onDidDispose(listener: () => void) {
    this.panel.onDidDispose(listener)
  }

  /** 加载当前节点主题 */
  load() {
    return this.reload(1)
  }

  /**
   * 登录态变化后刷新节点页
   * 用于同步收藏按钮可见性与收藏状态
   */
  refreshForAuthChange() {
    this.reload(this.page).catch(err => {
      logger.error('节点登录态刷新失败', err, { nodeName: this.nodeName })
    })
  }

  /** 获取当前视图状态 */
  rpc_ready() {
    return this.viewState
  }

  /** 刷新当前页主题列表 */
  rpc_refresh() {
    return this.reload(this.page)
  }

  /**
   * 加载指定页主题列表
   * @param page 页码
   */
  rpc_loadPage(page: number) {
    return this.reload(page)
  }

  /** 打开创作新主题面板并预选当前节点 */
  rpc_createTopic() {
    this.navigation.openCreateTopic(this.nodeName)
  }

  /** 收藏当前节点 */
  rpc_collectNode() {
    return this.mutateCollection(true)
  }

  /** 取消收藏当前节点 */
  rpc_cancelCollectNode() {
    return this.mutateCollection(false)
  }

  /**
   * 收藏或取消收藏后刷新账户概览与页面
   * @param collect 是否收藏
   */
  private async mutateCollection(collect: boolean) {
    if (!(await G.V2ex.ensureAuthenticated())) {
      throw new LoginRequiredError(collect ? '收藏节点前请先登录' : '取消收藏节点前请先登录')
    }

    if (collect) {
      await G.V2ex.collectNode(this.nodeName)
    } else {
      await G.V2ex.cancelCollectNode(this.nodeName)
    }

    try {
      await G.V2ex.getAccountOverview({ force: true })
    } catch (err) {
      logger.error('节点收藏后刷新账户概览失败', err, { nodeName: this.nodeName })
    }

    // 同步主面板「收藏节点」标签，不阻塞当前节点页刷新
    void notifyCollectionNodesChanged()
    await this.reload(this.page)
  }

  /**
   * 加载节点主题并同步页面状态
   * @param page 页码
   */
  private async reload(page: number) {
    const nextPage = Math.max(1, Math.floor(page) || 1)
    this.page = nextPage
    this.postViewState({
      status: 'loading',
      data: this.viewState.data
    })

    try {
      const result = await G.V2ex.getTopicListByNode(this.nodeName, nextPage)
      const data: NodePanelTopicList = {
        node: result.node,
        page: nextPage,
        totalPage: Math.max(result.totalPage || 1, 1),
        totalCount: Math.max(result.totalCount || 0, 0),
        list: result.list
      }
      this.panel.title = formatPanelTitle(data.node.title)
      setRemotePanelIcon(this.panel, data.node.avatar).catch(err =>
        logger.error('节点面板图标更新失败', err, { nodeName: this.nodeName })
      )
      this.postViewState({ status: 'result', data })
    } catch (err) {
      logger.error('节点主题加载失败', err, { nodeName: this.nodeName, page: nextPage })
      this.postViewState({
        status: 'error',
        data: this.viewState.data,
        message: (err as Error).message || '节点主题加载失败'
      })
      throw err
    }
  }

  /**
   * 同步最新页面状态
   * @param state 页面状态
   */
  private postViewState(state: Omit<NodePanelViewState, 'loggedIn'>) {
    this.viewState = {
      ...state,
      loggedIn: G.V2ex.hasLoginSession()
    }
    this.rpc.post('nodeStateChanged', { state: this.viewState })
  }
}
