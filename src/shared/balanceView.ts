import type { BalanceDetail } from '../v2ex/types'
import type { WebviewNavigationRpcCommands } from './commonView'
export type { BalanceDetail, BalanceTransaction } from '../v2ex/types'

/**
 * 发往 Webview 的账户余额页面状态
 */
export interface BalancePanelViewState {
  /** 页面状态 */
  status: 'loading' | 'balance' | 'error'
  /** 账户余额详情 */
  detail?: BalanceDetail
  /** 错误文案 */
  message?: string
  /** 是否显示登录按钮 */
  showLogin?: boolean
  /** 是否显示刷新按钮 */
  showRefresh?: boolean
}

/**
 * 账户余额面板 Webview RPC 命令
 */
export interface BalancePanelRpcCommands extends WebviewNavigationRpcCommands {
  login(): void
  refresh(): void
  loadPage(payload: { page: number }): BalanceDetail
}

/**
 * 账户余额面板发往 Webview 的事件
 */
export interface BalancePanelWebviewEvents {
  balanceStateChanged: {
    /** 页面状态 */
    state: BalancePanelViewState
  }
}
