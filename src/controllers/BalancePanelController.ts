import path from 'path'
import vscode from 'vscode'
import { LoginRequiredError, type BalanceDetail } from '@/v2ex'
import G from '@/global'
import { openExternal } from '@/features/openExternal'
import { renderWebviewHtml } from '@/core/webviewHtml'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import type { MemberPanelInput, TopicPanelInput } from '@/controllers/panelTypes'
import type {
  BalancePanelRpcCommands,
  BalancePanelViewState,
  BalancePanelWebviewEvents,
  WebviewRpcHandlers
} from '@/shared/webview'

/**
 * 账户余额面板外部依赖
 */
export interface BalancePanelDeps {
  /** 打开用户面板 */
  openMember: (member: MemberPanelInput) => void
  /** 打开话题面板 */
  openTopic: (topic: TopicPanelInput) => void
}

/**
 * 账户余额面板控制器
 */
export class BalancePanelController {
  /** 账户余额面板 */
  private readonly panel: vscode.WebviewPanel

  /** Webview RPC 桥接器 */
  private readonly rpc: WebviewRpcBridge<BalancePanelRpcCommands, BalancePanelWebviewEvents>

  /** 外部面板导航依赖 */
  private readonly deps: BalancePanelDeps

  /** 当前账户余额详情 */
  private detail?: BalanceDetail

  /**
   * @param deps 外部面板导航依赖
   */
  constructor(deps: BalancePanelDeps) {
    this.deps = deps
    this.panel = createPanel()
    this.panel.webview.html = renderWebviewHtml(this.panel.webview, 'balance.html')
    this.rpc = new WebviewRpcBridge<BalancePanelRpcCommands, BalancePanelWebviewEvents>(
      this.panel.webview,
      this.createRpcHandlers()
    )
    this.panel.onDidDispose(() => this.rpc.dispose())
  }

  /**
   * 激活当前面板
   */
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
   * 加载账户余额页
   */
  async load() {
    try {
      await this.reload(true)
    } catch (err) {
      console.error(err)
      this.renderError(err as Error)
    }
  }

  /**
   * 注册 Webview RPC 处理器
   */
  private createRpcHandlers(): WebviewRpcHandlers<BalancePanelRpcCommands> {
    return {
      openExternal: msg => {
        openExternal(msg.path)
      },
      openTopic: msg => this.deps.openTopic({ label: `/t/${msg.topicId}`, topicId: msg.topicId }),
      openMember: msg => this.deps.openMember({ username: msg.username }),
      login: async () => {
        await vscode.commands.executeCommand('v2ex.login')
        if (G.getCookie()) {
          await this.reload(true)
        }
      },
      refresh: () => this.refresh(),
      loadPage: msg => this.loadPage(msg.page)
    }
  }

  /**
   * 重新加载账户余额
   * @param showLoading 是否显示整页加载状态
   */
  private async reload(showLoading: boolean) {
    if (showLoading) {
      this.postViewState({ status: 'loading' })
    }

    this.detail = await G.V2ex.getBalance(this.detail?.page || 1)
    this.render(this.detail)
  }

  /**
   * 刷新账户余额
   */
  private async refresh() {
    try {
      await this.reload(true)
    } catch (err) {
      console.error(err)
      this.renderError(err as Error)
      throw err
    }
  }

  /**
   * 加载指定流水页
   * @param page 页码
   */
  private async loadPage(page: number): Promise<BalanceDetail> {
    this.detail = await G.V2ex.getBalance(page)
    return this.detail
  }

  /**
   * 渲染账户余额
   * @param detail 账户余额详情
   */
  private render(detail: BalanceDetail) {
    this.postViewState({
      status: 'balance',
      detail,
      showRefresh: true
    })
  }

  /**
   * 渲染异常页面
   * @param err 异常对象
   */
  private renderError(err: Error) {
    this.postViewState({
      status: 'error',
      message: err.message,
      showLogin: err instanceof LoginRequiredError,
      showRefresh: true
    })
  }

  /**
   * 向 Webview 同步最新视图状态
   * @param state 页面状态
   */
  private postViewState(state: BalancePanelViewState) {
    this.rpc.post('balanceStateChanged', { state })
  }
}

/**
 * 创建账户余额 Webview 面板
 */
function createPanel(): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'v2ex.balance',
    '账户余额',
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
  panel.iconPath = vscode.Uri.file(path.join(G.context.extensionPath, 'resources/favicon.png'))
  return panel
}
