import vscode from 'vscode'
import { LoginRequiredError, type BalanceDetail } from '@/v2ex'
import G from '@/global'
import { openExternal } from '@/features/openExternal'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { logger } from '@/core/logger'
import { createV2exWebviewPanel } from '@/controllers/webviewPanel'
import type { MemberPanelInput, NodeTabInput, TopicPanelInput } from '@/controllers/panelTypes'
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
  /** 打开节点主题标签 */
  openNode: (node: NodeTabInput) => void
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

  /** 当前视图状态 */
  private viewState: BalancePanelViewState = { status: 'loading' }

  /**
   * @param deps 外部面板导航依赖
   */
  constructor(deps: BalancePanelDeps) {
    this.deps = deps
    this.panel = createV2exWebviewPanel({
      viewType: 'v2ex.balance',
      title: '账户余额',
      htmlEntry: 'balance.html',
      enableFindWidget: true,
      resourceIcon: 'panelBalance.svg'
    })
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
      logger.error('账户余额加载失败', err)
      this.renderError(err as Error)
    }
  }

  /** 登录态变化后刷新余额 */
  refreshForAuthChange(): void {
    this.refresh().catch(err => logger.error('账户余额登录态刷新失败', err))
  }

  /**
   * 注册 Webview RPC 处理器
   */
  private createRpcHandlers(): WebviewRpcHandlers<BalancePanelRpcCommands> {
    return {
      ready: () => this.viewState,
      openExternal: msg => {
        openExternal(msg.path)
      },
      openTopic: msg => this.deps.openTopic({ label: `/t/${msg.topicId}`, topicId: msg.topicId }),
      openMember: msg => this.deps.openMember({ username: msg.username }),
      openNode: msg => this.deps.openNode(msg),
      login: async () => {
        await vscode.commands.executeCommand('v2ex.login')
        if (G.V2ex.isAuthenticated()) {
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
    this.viewState = state
    this.rpc.post('balanceStateChanged', { state })
  }
}
