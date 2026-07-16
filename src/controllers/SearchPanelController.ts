import vscode from 'vscode'
import G from '@/global'
import { openExternal } from '@/features/openExternal'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { createV2exWebviewPanel } from '@/controllers/webviewPanel'
import type { MemberPanelInput, NodeTabInput, TopicPanelInput } from '@/controllers/panelTypes'
import type {
  SearchPanelRpcCommands,
  SearchPanelWebviewEvents,
  WebviewRpcController,
  SoV2exSearchParams
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
export class SearchPanelController implements WebviewRpcController<SearchPanelRpcCommands> {
  /** 搜索面板 */
  private readonly panel: vscode.WebviewPanel

  /** Webview RPC 桥接器 */
  private readonly rpc: WebviewRpcBridge<SearchPanelRpcCommands, SearchPanelWebviewEvents>

  /** 外部面板导航依赖 */
  private readonly deps: SearchPanelDeps

  /**
   * @param deps 外部面板导航依赖
   */
  constructor(deps: SearchPanelDeps) {
    this.deps = deps
    this.panel = createV2exWebviewPanel({
      viewType: 'v2ex.search',
      title: '搜索',
      htmlEntry: 'search.html',
      enableFindWidget: true,
      resourceIcon: 'panelSearch.svg'
    })
    this.rpc = new WebviewRpcBridge<SearchPanelRpcCommands, SearchPanelWebviewEvents>(
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

  /** 执行站内搜索 */
  rpc_search(params: SoV2exSearchParams) {
    return G.V2ex.search(params)
  }

  /** 打开外部链接 */
  rpc_openExternal(message: { path: string }) {
    openExternal(message.path)
  }

  /** 打开话题面板 */
  rpc_openTopic(message: { topicId: string | number; title?: string }) {
    this.deps.openTopic({
      label: message.title || `/t/${message.topicId}`,
      topicId: message.topicId
    })
  }

  /** 打开用户面板 */
  rpc_openMember(message: { username: string }) {
    this.deps.openMember({ username: message.username })
  }

  /** 打开节点主题标签 */
  rpc_openNode(message: NodeTabInput) {
    this.deps.openNode(message)
  }
}
