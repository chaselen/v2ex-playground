import vscode from 'vscode'
import G from '@/global'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { createV2exWebviewPanel } from '@/controllers/webviewPanel'
import {
  WebviewNavigationController,
  type WebviewNavigationDeps
} from '@/controllers/WebviewNavigationController'
import type {
  SearchPanelRpcCommands,
  SearchPanelWebviewEvents,
  WebviewRpcController,
  SoV2exSearchParams
} from '@/shared/webview'

/** 搜索面板控制器 */
export class SearchPanelController
  extends WebviewNavigationController
  implements WebviewRpcController<SearchPanelRpcCommands>
{
  /** 搜索面板 */
  private readonly panel: vscode.WebviewPanel

  /** Webview RPC 桥接器 */
  private readonly rpc: WebviewRpcBridge<SearchPanelRpcCommands, SearchPanelWebviewEvents>

  /**
   * @param deps 外部面板导航依赖
   */
  constructor(deps: WebviewNavigationDeps) {
    super(deps)
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
}
