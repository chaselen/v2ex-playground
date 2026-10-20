import type {
  BlockedMember,
  FollowingMember,
  MemberContent,
  MemberContentTabKey,
  MemberInfo
} from '../v2ex/types'
import type { WebviewCommonRpcCommands, WebviewStateRpcCommands } from './commonView'
export type {
  BlockedMember,
  FollowingMember,
  MemberContentTabKey,
  MemberReply
} from '../v2ex/types'

/**
 * 用户页资料
 */
export interface MemberProfile {
  /** 用户基本信息 */
  member: MemberInfo
  /** 当前内容 */
  content: MemberContent
  /** 当前登录用户的特别关注列表，仅本人页提供 */
  followingMembers?: FollowingMember[]
  /** 当前登录用户的屏蔽列表，仅本人页提供 */
  blockedMembers?: BlockedMember[]
  /** 当前登录用户忽略的主题编号，仅本人页提供，用于「已忽略主题」标签计数 */
  ignoredTopicIds?: number[]
  /** 当前登录用户忽略的节点数量，仅本人页提供；读取失败时为 undefined */
  ignoredNodeCount?: number
}

/**
 * 发往 Webview 的用户页面状态
 */
export interface MemberPanelViewState {
  /** 页面状态 */
  status: 'loading' | 'member' | 'error'
  /** 是否存在登录会话 */
  loggedIn: boolean
  /** 当前页面是否为登录用户本人 */
  isSelf: boolean
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
export interface MemberPanelRpcCommands
  extends WebviewCommonRpcCommands, WebviewStateRpcCommands<MemberPanelViewState> {
  /** 清除本人全部屏蔽用户 */
  clearBlockedMembers(): MemberProfile
  /** 清除本人全部忽略主题 */
  clearIgnoredTopics(): MemberProfile
  /** 清除本人全部忽略节点 */
  clearIgnoredNodes(): MemberProfile
  refresh(): void
  loadMemberTab(tab: MemberContentTabKey, page?: number): MemberProfile
  loadMemberPage(tab: MemberContentTabKey, page?: number): MemberProfile
  followMember(): MemberProfile
  unfollowMember(): MemberProfile
  blockMember(): MemberProfile
  unblockMember(): MemberProfile
  /** 从本人页关系列表取消特别关注 */
  unfollowListedMember(memberId: number): MemberProfile
  /** 从本人页关系列表取消屏蔽 */
  unblockListedMember(memberId: number): MemberProfile
  /** 从本人页已忽略列表取消忽略主题 */
  unignoreListedTopic(topicId: number): MemberProfile
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
