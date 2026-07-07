import path from 'path'
import vscode from 'vscode'
import G from '@/global'
import { openExternal } from '@/features/openExternal'
import { clearRecentBrowseTopics, getRecentBrowseTopics } from '@/features/recentBrowse'
import { renderWebviewHtml } from '@/core/webviewHtml'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
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
    this.panel = createPanel()
    this.panel.webview.html = renderWebviewHtml(this.panel.webview, 'recent-browse.html')
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
      getRecentBrowseTopics: msg => getRecentBrowseTopics(msg.page, msg.pageSize),
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

/** 创建最近浏览 Webview 面板 */
function createPanel(): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'v2ex.recentBrowse',
    '最近浏览',
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      enableFindWidget: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(G.context.extensionPath, 'html')),
        vscode.Uri.file(path.join(G.context.extensionPath, 'resources'))
      ]
    }
  )
  panel.iconPath = {
    light: vscode.Uri.file(
      path.join(G.context.extensionPath, 'resources/light/panelRecentBrowse.svg')
    ),
    dark: vscode.Uri.file(
      path.join(G.context.extensionPath, 'resources/dark/panelRecentBrowse.svg')
    )
  }
  return panel
}
