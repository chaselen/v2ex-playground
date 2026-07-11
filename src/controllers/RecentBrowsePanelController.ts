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
  WebviewRpcHandlers
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
export class RecentBrowsePanelController {
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
  constructor(deps: RecentBrowsePanelDeps) {
    this.panel = createV2exWebviewPanel({
      viewType: 'v2ex.recentBrowse',
      title: '最近浏览',
      htmlEntry: 'recent-browse.html',
      enableFindWidget: true,
      resourceIcon: 'panelRecentBrowse.svg'
    })
    this.rpc = new WebviewRpcBridge<RecentBrowsePanelRpcCommands, RecentBrowsePanelWebviewEvents>(
      this.panel.webview,
      this.createRpcHandlers(deps)
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

  /**
   * 创建 Webview RPC 处理器
   * @param deps 外部面板导航依赖
   */
  private createRpcHandlers(
    deps: RecentBrowsePanelDeps
  ): WebviewRpcHandlers<RecentBrowsePanelRpcCommands> {
    return {
      getRecentBrowseTopics: msg => getRecentBrowseTopics(msg.page, msg.pageSize, msg.query),
      deleteRecentBrowseTopic: async msg => {
        await deleteRecentBrowseTopic(msg.topicId)
        return getRecentBrowseTopics(msg.page, msg.pageSize, msg.query)
      },
      clearRecentBrowseTopics: async () => {
        await clearRecentBrowseTopics()
        return getRecentBrowseTopics()
      },
      openExternal: msg => {
        openExternal(msg.path)
      },
      openTopic: msg =>
        deps.openTopic({
          label: msg.title || `/t/${msg.topicId}`,
          topicId: msg.topicId
        }),
      openMember: msg => deps.openMember({ username: msg.username }),
      openNode: msg => deps.openNode(msg)
    }
  }
}
