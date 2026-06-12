import path from 'path'
import vscode from 'vscode'
import G from '@/global'
import { openExternal } from '@/features/openExternal'
import { renderWebviewHtml } from '@/core/webviewHtml'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import type { MemberPanelInput, NodeTabInput, TopicPanelInput } from '@/controllers/panelTypes'
import type {
  SearchPanelRpcCommands,
  SearchPanelWebviewEvents,
  WebviewRpcHandlers
} from '@/shared/webview'

/** 搜索面板外部依赖 */
export interface SearchPanelDeps {
  /** 打开用户面板 */
  openMember: (member: MemberPanelInput) => void
  /** 打开话题面板 */
  openTopic: (topic: TopicPanelInput) => void
  /** 打开节点主题标签 */
  openNode: (node: NodeTabInput) => void
}

/** 搜索面板控制器 */
export class SearchPanelController {
  /** 搜索面板 */
  private readonly panel: vscode.WebviewPanel

  /** Webview RPC 桥接器 */
  private readonly rpc: WebviewRpcBridge<SearchPanelRpcCommands, SearchPanelWebviewEvents>

  /**
   * @param deps 外部面板导航依赖
   */
  constructor(deps: SearchPanelDeps) {
    this.panel = createPanel()
    this.panel.webview.html = renderWebviewHtml(this.panel.webview, 'search.html')
    this.rpc = new WebviewRpcBridge<SearchPanelRpcCommands, SearchPanelWebviewEvents>(
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
  private createRpcHandlers(deps: SearchPanelDeps): WebviewRpcHandlers<SearchPanelRpcCommands> {
    return {
      search: params => G.V2ex.search(params),
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

/** 创建搜索 Webview 面板 */
function createPanel(): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel('v2ex.search', '搜索', vscode.ViewColumn.Active, {
    enableScripts: true,
    retainContextWhenHidden: true,
    enableFindWidget: true,
    localResourceRoots: [
      vscode.Uri.file(path.join(G.context.extensionPath, 'html')),
      vscode.Uri.file(path.join(G.context.extensionPath, 'resources'))
    ]
  })
  panel.iconPath = vscode.Uri.file(path.join(G.context.extensionPath, 'resources/favicon.png'))
  return panel
}
