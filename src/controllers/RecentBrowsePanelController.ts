import { composeWebviewRpcControllers } from '@/core/composeWebviewRpcControllers'
import vscode from 'vscode'
import {
  clearRecentBrowseTopics,
  deleteRecentBrowseTopic,
  getRecentBrowseTopics
} from '@/features/recentBrowse'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { createV2exWebviewPanel } from '@/controllers/webviewPanel'
import { WebviewCommonRpc, type WebviewNavigationDeps } from '@/controllers/WebviewCommonRpc'
import type {
  DeleteRecentBrowseTopicRequest,
  RecentBrowsePanelRpcCommands,
  RecentBrowsePanelWebviewEvents,
  RecentBrowseQuery,
  WebviewPageRpcController
} from '@/shared/webview'

/** 最近浏览面板控制器 */
export class RecentBrowsePanelController implements WebviewPageRpcController<RecentBrowsePanelRpcCommands> {
  /** 最近浏览面板 */
  private readonly panel: vscode.WebviewPanel

  /** Webview RPC 桥接器 */
  private readonly rpc: WebviewRpcBridge<
    RecentBrowsePanelRpcCommands,
    RecentBrowsePanelWebviewEvents
  >

  /**
   * @param deps 外部面板导航依赖
   */
  constructor(deps: WebviewNavigationDeps) {
    const commonRpc = new WebviewCommonRpc(deps)
    this.panel = createV2exWebviewPanel({
      viewType: 'v2ex.recentBrowse',
      title: '最近浏览',
      htmlEntry: 'recent-browse.html',
      enableFindWidget: true,
      resourceIcon: 'panelRecentBrowse.svg'
    })
    this.rpc = new WebviewRpcBridge<RecentBrowsePanelRpcCommands, RecentBrowsePanelWebviewEvents>(
      this.panel.webview,
      composeWebviewRpcControllers(this, commonRpc)
    )
    commonRpc.bindBrowseSettings(this.panel, this.rpc)
    this.panel.onDidDispose(() => this.rpc.dispose())
  }

  /** 激活当前面板 */
  reveal() {
    this.panel.reveal()
  }

  /**
   * 监听面板销毁
   * @param listener 销毁回调
   */
  onDidDispose(listener: () => void) {
    this.panel.onDidDispose(listener)
  }

  /** 获取最近浏览话题 */
  rpc_getRecentBrowseTopics(message: RecentBrowseQuery) {
    return getRecentBrowseTopics(message.page, message.pageSize, message.query)
  }

  /** 删除最近浏览话题 */
  async rpc_deleteRecentBrowseTopic(message: DeleteRecentBrowseTopicRequest) {
    await deleteRecentBrowseTopic(message.topicId)
    return getRecentBrowseTopics(message.page, message.pageSize, message.query)
  }

  /** 清空最近浏览话题 */
  async rpc_clearRecentBrowseTopics() {
    await clearRecentBrowseTopics()
    return getRecentBrowseTopics()
  }
}
