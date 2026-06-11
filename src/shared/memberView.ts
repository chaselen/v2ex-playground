import type { MemberContentTabKey, MemberProfile } from '../v2ex/types'
import type { WebviewContentRpcCommands } from './commonView'
export type { MemberContentTabKey, MemberProfile, MemberReply } from '../v2ex/types'

/**
 * 发往 Webview 的用户页面状态
 */
export interface MemberPanelViewState {
  /** 页面状态 */
  status: 'loading' | 'member' | 'error'
  /** 用户资料 */
  profile?: MemberProfile
  /** 错误文案 */
  message?: string
  /** 是否显示刷新按钮 */
  showRefresh?: boolean
}

/**
 * 用户面板 Webview RPC 命令
 */
export interface MemberPanelRpcCommands extends WebviewContentRpcCommands {
  refresh(): void
  loadMemberTab(payload: { tab: MemberContentTabKey; page?: number }): MemberProfile
  loadMemberPage(payload: { tab: MemberContentTabKey; page?: number }): MemberProfile
}

/**
 * 用户面板发往 Webview 的事件
 */
export interface MemberPanelWebviewEvents {
  memberStateChanged: {
    /** 页面状态 */
    state: MemberPanelViewState
  }
}
