import vscode from 'vscode'
import { openExternal } from '@/features/openExternal'
import {
  clearRecentBrowseTopics,
  deleteRecentBrowseTopic,
  getRecentBrowseTopics
} from '@/features/recentBrowse'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { createV2exWebviewPanel } from '@/controllers/webviewPanel'
import type { MemberPanelInput, NodeTabInput, TopicPanelInput } from '@/controllers/panelTypes'
import type {
  RecentBrowsePanelRpcCommands,
  RecentBrowsePanelWebviewEvents,
  WebviewRpcController
} from '@/shared/webview'

/** 最近浏览面板外部依赖 */
export interface RecentBrowsePanelDeps {
  /** 打开用户面板 */
  openMember: (member: MemberPanelInput) => void
  /** 打开话题面板 */
  openTopic: (topic: TopicPanelInput) => void
  /** 打开节点主题标签 */
  openNode: (node: NodeTabInput) => void
}

/** 最近浏览面板控制器 */
export class RecentBrowsePanelController implements WebviewRpcController<RecentBrowsePanelRpcCommands> {
  /** 最近浏览面板 */
  private readonly panel: vscode.WebviewPanel

  /** Webview RPC 桥接器 */
  private readonly rpc: WebviewRpcBridge<
    RecentBrowsePanelRpcCommands,
    RecentBrowsePanelWebviewEvents
  >

  /** 外部面板导航依赖 */
  private readonly deps: RecentBrowsePanelDeps

  /**
   * @param deps 外部面板导航依赖
   */
  constructor(deps: RecentBrowsePanelDeps) {
    this.deps = deps
    this.panel = createV2exWebviewPanel({
      viewType: 'v2ex.recentBrowse',
      title: '最近浏览',
      htmlEntry: 'recent-browse.html',
      enableFindWidget: true,
      resourceIcon: 'panelRecentBrowse.svg'
    })
    this.rpc = new WebviewRpcBridge<RecentBrowsePanelRpcCommands, RecentBrowsePanelWebviewEvents>(
      this.panel.webview,
      this
    )
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
  rpc_getRecentBrowseTopics(message: { page?: number; pageSize?: number; query?: string }) {
    return getRecentBrowseTopics(message.page, message.pageSize, message.query)
  }

  /** 删除最近浏览话题 */
  async rpc_deleteRecentBrowseTopic(message: {
    topicId: number
    page?: number
    pageSize?: number
    query?: string
  }) {
    await deleteRecentBrowseTopic(message.topicId)
    return getRecentBrowseTopics(message.page, message.pageSize, message.query)
  }

  /** 清空最近浏览话题 */
  async rpc_clearRecentBrowseTopics() {
    await clearRecentBrowseTopics()
    return getRecentBrowseTopics()
  }

  /** 打开外部链接 */
  rpc_openExternal(path: string) {
    openExternal(path)
  }

  /** 打开话题面板 */
  rpc_openTopic(message: { topicId: string | number; title?: string }) {
    this.deps.openTopic({
      label: message.title || `/t/${message.topicId}`,
      topicId: message.topicId
    })
  }

  /** 打开用户面板 */
  rpc_openMember(username: string) {
    this.deps.openMember({ username })
  }

  /** 打开节点主题标签 */
  rpc_openNode(message: NodeTabInput) {
    this.deps.openNode(message)
  }
}
