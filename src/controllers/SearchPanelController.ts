import vscode from 'vscode'
import G from '@/global'
import { showNodeQuickPick } from '@/features/nodeQuickPick'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { createV2exWebviewPanel } from '@/controllers/webviewPanel'
import {
  WebviewCommonController,
  type WebviewNavigationDeps
} from '@/controllers/WebviewCommonController'
import type {
  SearchPanelRpcCommands,
  SearchPanelWebviewEvents,
  WebviewRpcController,
  SoV2exSearchParams
} from '@/shared/webview'

/** 搜索面板控制器 */
export class SearchPanelController
  extends WebviewCommonController
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

  /** 打开搜索节点选择器 */
  async rpc_selectNode(currentNodeName?: string) {
    const nodes = await G.V2ex.nodes.getAll()
    const selected = await showNodeQuickPick(nodes, {
      title: '选择搜索节点',
      placeHolder: '输入节点标题或 name 搜索',
      currentNodeName,
      countField: 'topicCount',
      sortByCountDescending: true
    })
    return selected ? nodes.find(node => node.name === selected.name) : undefined
  }

  /** 执行站内搜索 */
  rpc_search(params: SoV2exSearchParams) {
    return G.V2ex.search.query(params)
  }
}
