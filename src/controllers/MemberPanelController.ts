import vscode from 'vscode'
import G from '@/global'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { logger } from '@/core/logger'
import { setRemotePanelIcon } from '@/features/panelIcon'
import { createV2exWebviewPanel, formatPanelTitle } from '@/controllers/webviewPanel'
import {
  WebviewCommonController,
  type WebviewNavigationDeps
} from '@/controllers/WebviewCommonController'
import { LoginRequiredError } from '@/v2ex'
import type {
  BlockedMember,
  FollowingMember,
  MemberContent,
  MemberContentTabKey,
  MemberInfo,
  MemberProfile
} from '@/v2ex'
import type {
  MemberPanelRpcCommands,
  MemberPanelViewState,
  MemberPanelWebviewEvents,
  WebviewRpcController
} from '@/shared/webview'

/** 用户关系操作 */
type MemberRelationAction = 'follow' | 'unfollow' | 'block' | 'unblock'

/** 已忽略主题列表每页数量 */
const IGNORED_TOPICS_PAGE_SIZE = 20

/**
 * 用户面板控制器
 */
export class MemberPanelController
  extends WebviewCommonController
  implements WebviewRpcController<MemberPanelRpcCommands>
{
  /** 用户面板缓存 key */
  readonly key: string

  /** 用户名 */
  private readonly username: string

  /** 用户面板 */
  private readonly panel: vscode.WebviewPanel

  /** Webview RPC 桥接器 */
  private readonly rpc: WebviewRpcBridge<MemberPanelRpcCommands, MemberPanelWebviewEvents>

  /** 当前用户资料，仅在扩展侧维护 */
  private profile?: MemberProfile

  /** 当前页面是否为登录用户本人 */
  private isSelf = false

  /** 当前视图状态 */
  private viewState: MemberPanelViewState = {
    status: 'loading',
    loggedIn: G.V2ex.hasLoginSession(),
    isSelf: false
  }

  /**
   * @param username 用户名
   * @param deps 外部面板导航依赖
   */
  constructor(username: string, deps: WebviewNavigationDeps) {
    super(deps)
    this.username = username
    this.key = G.V2ex.getMemberLink(this.username)
    this.panel = createV2exWebviewPanel({
      viewType: this.key,
      title: this.username,
      htmlEntry: 'member.html',
      enableFindWidget: true,
      useDefaultIcon: true
    })
    this.rpc = new WebviewRpcBridge<MemberPanelRpcCommands, MemberPanelWebviewEvents>(
      this.panel.webview,
      this
    )
    this.panel.onDidDispose(() => {
      this.rpc.dispose()
    })
  }

  /**
   * 激活当前面板
   */
  reveal() {
    this.panel.reveal()
  }

  /**
   * 销毁当前面板
   */
  dispose() {
    this.rpc.dispose()
    this.panel.dispose()
  }

  /**
   * 监听面板销毁
   * @param listener 销毁回调
   */
  onDidDispose(listener: () => void) {
    this.panel.onDidDispose(listener)
  }

  /**
   * 加载当前用户页
   */
  async load() {
    try {
      await this.reloadMember(true)
    } catch (err) {
      logger.error('用户信息加载失败', err, { username: this.username })
      this.renderError(err as Error)
    }
  }

  /**
   * 向 webview 同步最新视图状态
   * @param state 页面状态
   */
  private postViewState(state: Omit<MemberPanelViewState, 'loggedIn' | 'isSelf'>) {
    this.viewState = {
      ...state,
      loggedIn: G.V2ex.hasLoginSession(),
      isSelf: this.isSelf
    }
    this.rpc.post('memberStateChanged', {
      state: this.viewState
    })
  }

  /**
   * 渲染用户资料
   * @param profile 用户资料
   */
  private render(profile: MemberProfile) {
    this.postViewState({
      status: 'member',
      profile
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
      showRefresh: true
    })
  }

  /** 获取当前视图状态 */
  rpc_ready() {
    return this.viewState
  }

  /** 刷新用户资料 */
  rpc_refresh() {
    return this.refreshMember()
  }

  /** 登录态变化后刷新用户页 */
  refreshForAuthChange() {
    this.reloadMember(true).catch(err => {
      logger.error('用户登录态刷新失败', err, { username: this.username })
    })
  }

  /** 加入用户特别关注 */
  rpc_followMember() {
    return this.mutateMemberRelation('follow')
  }

  /** 取消用户特别关注 */
  rpc_unfollowMember() {
    return this.mutateMemberRelation('unfollow')
  }

  /** 屏蔽用户 */
  rpc_blockMember() {
    return this.mutateMemberRelation('block')
  }

  /** 取消屏蔽用户 */
  rpc_unblockMember() {
    return this.mutateMemberRelation('unblock')
  }

  /**
   * 从本人页关系列表取消特别关注
   * @param memberId 用户编号
   */
  rpc_unfollowListedMember(memberId: number) {
    return this.mutateListedMemberRelation('unfollow', memberId)
  }

  /**
   * 从本人页关系列表取消屏蔽
   * @param memberId 用户编号
   */
  rpc_unblockListedMember(memberId: number) {
    return this.mutateListedMemberRelation('unblock', memberId)
  }

  /**
   * 从本人页已忽略列表取消忽略主题
   * @param topicId 主题编号
   */
  rpc_unignoreListedTopic(topicId: number) {
    return this.unignoreListedTopic(topicId)
  }

  /** 加载用户标签内容 */
  rpc_loadMemberTab(message: { tab: MemberContentTabKey; page?: number }) {
    return this.loadMemberContent(message.tab, message.page)
  }

  /** 加载用户内容页 */
  rpc_loadMemberPage(message: { tab: MemberContentTabKey; page?: number }) {
    return this.loadMemberContent(message.tab, message.page)
  }

  /**
   * 刷新用户页并向页面同步
   * @param showLoading 是否显示整页加载状态
   */
  private async reloadMember(showLoading: boolean) {
    if (showLoading) {
      this.postViewState({
        status: 'loading'
      })
    }

    const [member, content] = await Promise.all([
      G.V2ex.getMemberInfo(this.username),
      G.V2ex.getMemberContent(this.username)
    ])
    this.isSelf = await this.resolveIsSelf(member.username)
    const relationMembers = this.isSelf ? await this.loadRelationMembers() : undefined
    this.profile = this.createProfile(
      member,
      content,
      relationMembers?.followingMembers,
      relationMembers?.blockedMembers,
      relationMembers?.ignoredTopicIds
    )
    this.panel.title = formatPanelTitle(this.profile.member.username)
    setRemotePanelIcon(this.panel, this.profile.member.avatar).catch(err =>
      logger.error('用户面板图标更新失败', err)
    )
    this.render(this.profile)
  }

  /**
   * 手动刷新用户页
   */
  private async refreshMember() {
    try {
      await this.reloadMember(true)
    } catch (err) {
      this.renderError(err as Error)
      throw err
    }
  }

  /**
   * 加载用户页标签内容
   * @param tab 标签
   * @param page 页码
   */
  private async loadMemberContent(tab: MemberContentTabKey, page = 1): Promise<MemberProfile> {
    if (tab === 'ignored') {
      return this.loadIgnoredTopicsContent(page)
    }

    const content = await G.V2ex.getMemberContent(this.username, { tab, page })
    const member = this.profile?.member || (await G.V2ex.getMemberInfo(this.username))
    this.profile = this.createProfile(member, content)
    this.panel.title = formatPanelTitle(this.profile.member.username)
    return this.profile
  }

  /**
   * 加载本人页已忽略主题列表
   *
   * 优先复用本人页已缓存的 `ignoredTopicIds`，避免重复读取页面脚本；
   * 整页刷新会经 `loadBlockedAndIgnored` 重新拉取编号。
   * @param page 页码
   */
  private async loadIgnoredTopicsContent(page = 1): Promise<MemberProfile> {
    if (!this.isSelf) {
      throw new Error('仅本人页可查看已忽略主题')
    }

    const ignoredTopicIds =
      this.profile?.ignoredTopicIds ?? toIgnoredTopicDisplayOrder(await G.V2ex.getIgnoredTopicIds())
    return this.applyIgnoredTopicsContent(ignoredTopicIds, page)
  }

  /**
   * 从本人页已忽略列表取消忽略，并刷新当前页内容
   * @param topicId 主题编号
   */
  private async unignoreListedTopic(topicId: number): Promise<MemberProfile> {
    if (!this.isSelf) {
      throw new Error('仅本人页可管理已忽略主题')
    }
    if (!(await G.V2ex.ensureAuthenticated())) {
      throw new LoginRequiredError('取消忽略前请先登录')
    }
    if (!Number.isInteger(topicId) || topicId <= 0) {
      throw new Error('未找到主题编号，无法取消忽略')
    }

    await G.V2ex.cancelIgnoreTopic(topicId)

    const ignoredTopicIds = (this.profile?.ignoredTopicIds ?? []).filter(id => id !== topicId)
    const currentPage = this.profile?.content.tab === 'ignored' ? this.profile.content.page : 1
    const profile = await this.applyIgnoredTopicsContent(ignoredTopicIds, currentPage)
    this.render(profile)
    return profile
  }

  /**
   * 按忽略主题编号构建当前页内容并写回资料
   * @param ignoredTopicIds 展示顺序的忽略主题编号
   * @param page 页码
   */
  private async applyIgnoredTopicsContent(
    ignoredTopicIds: number[],
    page: number
  ): Promise<MemberProfile> {
    const {
      page: currentPage,
      pageTopicIds,
      totalCount,
      totalPage
    } = paginateIds(ignoredTopicIds, page, IGNORED_TOPICS_PAGE_SIZE)
    const topics = await G.V2ex.getTopicsByIds(pageTopicIds)
    const member = this.profile?.member || (await G.V2ex.getMemberInfo(this.username))
    const content: MemberContent = {
      tab: 'ignored',
      page: currentPage,
      totalPage,
      totalCount,
      topics,
      replies: [],
      hidden: false,
      message: ''
    }
    this.profile = this.createProfile(
      member,
      content,
      this.profile?.followingMembers,
      this.profile?.blockedMembers,
      ignoredTopicIds
    )
    this.panel.title = formatPanelTitle(this.profile.member.username)
    return this.profile
  }

  /**
   * 更新用户关系并刷新当前资料状态
   * @param action 关系操作
   */
  private async mutateMemberRelation(action: MemberRelationAction): Promise<MemberProfile> {
    if (!(await G.V2ex.ensureAuthenticated())) {
      throw new LoginRequiredError(`${getMemberRelationLabel(action)}前请先登录`)
    }

    const member = this.profile?.member || (await G.V2ex.getMemberInfo(this.username))
    if (!member.memberId) {
      throw new Error('未找到用户编号，无法更新用户关系')
    }

    await updateMemberRelation(action, member.memberId)

    try {
      await G.V2ex.getAccountOverview({ force: true })
    } catch (err) {
      logger.error('用户关系更新后刷新账户概览失败', err, {
        username: this.username,
        action
      })
    }

    const [nextMember, content] = await Promise.all([
      G.V2ex.getMemberInfo(this.username),
      this.profile?.content
        ? Promise.resolve(this.profile.content)
        : G.V2ex.getMemberContent(this.username)
    ])
    this.profile = this.createProfile(nextMember, content)
    this.panel.title = formatPanelTitle(this.profile.member.username)
    setRemotePanelIcon(this.panel, this.profile.member.avatar).catch(err =>
      logger.error('用户面板图标更新失败', err)
    )
    this.render(this.profile)
    return this.profile
  }

  /**
   * 更新本人页关系列表中的用户，并刷新关注/屏蔽列表
   * @param action 取消关注或取消屏蔽
   * @param memberId 用户编号
   */
  private async mutateListedMemberRelation(
    action: 'unfollow' | 'unblock',
    memberId: number
  ): Promise<MemberProfile> {
    if (!this.isSelf) {
      throw new Error('仅本人页可管理关注与屏蔽列表')
    }
    if (!(await G.V2ex.ensureAuthenticated())) {
      throw new LoginRequiredError(`${getMemberRelationLabel(action)}前请先登录`)
    }
    if (!Number.isInteger(memberId) || memberId <= 0) {
      throw new Error('未找到用户编号，无法更新用户关系')
    }

    await updateMemberRelation(action, memberId)

    try {
      await G.V2ex.getAccountOverview({ force: true })
    } catch (err) {
      logger.error('关系列表更新后刷新账户概览失败', err, {
        memberId,
        action
      })
    }

    const relationMembers = await this.loadRelationMembers()
    const member = this.profile?.member || (await G.V2ex.getMemberInfo(this.username))
    const content = this.profile?.content || (await G.V2ex.getMemberContent(this.username))
    this.profile = this.createProfile(
      member,
      content,
      relationMembers.followingMembers,
      relationMembers.blockedMembers,
      relationMembers.ignoredTopicIds
    )
    this.render(this.profile)
    return this.profile
  }

  /**
   * 创建用户资料
   * @param member 用户基本信息
   * @param content 用户活动内容
   * @param followingMembers 特别关注列表
   * @param blockedMembers 屏蔽列表
   * @param ignoredTopicIds 忽略主题编号
   */
  private createProfile(
    member: MemberInfo,
    content: MemberContent,
    followingMembers = this.profile?.followingMembers,
    blockedMembers = this.profile?.blockedMembers,
    ignoredTopicIds = this.profile?.ignoredTopicIds
  ): MemberProfile {
    return {
      member,
      content,
      followingMembers,
      blockedMembers,
      ignoredTopicIds
    }
  }

  /** 获取本人页的特别关注、屏蔽与忽略主题编号 */
  private async loadRelationMembers(): Promise<{
    followingMembers: FollowingMember[]
    blockedMembers: BlockedMember[]
    ignoredTopicIds: number[]
  }> {
    const [followingMembers, relationLists] = await Promise.all([
      this.loadFollowingMembers(),
      this.loadBlockedAndIgnored()
    ])
    return {
      followingMembers,
      blockedMembers: relationLists.blockedMembers,
      ignoredTopicIds: relationLists.ignoredTopicIds
    }
  }

  /** 获取本人页的特别关注列表 */
  private async loadFollowingMembers(): Promise<FollowingMember[]> {
    try {
      return await G.V2ex.getFollowingMembers()
    } catch (err) {
      logger.error('特别关注列表加载失败', err, { username: this.username })
      return []
    }
  }

  /** 获取本人页的屏蔽列表与忽略主题编号 */
  private async loadBlockedAndIgnored(): Promise<{
    blockedMembers: BlockedMember[]
    ignoredTopicIds: number[]
  }> {
    try {
      const { blockedMembers, ignoredTopicIds } = await G.V2ex.getBlockedMembersAndIgnoredTopicIds()
      return {
        blockedMembers,
        ignoredTopicIds: toIgnoredTopicDisplayOrder(ignoredTopicIds)
      }
    } catch (err) {
      logger.error('屏蔽与忽略列表加载失败', err, { username: this.username })
      return {
        blockedMembers: [],
        ignoredTopicIds: []
      }
    }
  }

  /** 判断当前成员页是否属于登录用户本人 */
  private async resolveIsSelf(memberUsername: string): Promise<boolean> {
    let authenticatedUsername = G.V2ex.getAuthenticatedUsername()
    if (!authenticatedUsername && G.V2ex.hasLoginSession()) {
      try {
        await G.V2ex.ensureAuthenticated()
        authenticatedUsername = G.V2ex.getAuthenticatedUsername()
      } catch (err) {
        logger.debug('判断用户页归属失败', err, { username: this.username })
      }
    }

    return (
      normalizeMemberUsername(authenticatedUsername) === normalizeMemberUsername(memberUsername)
    )
  }
}

/**
 * 页面脚本中的 `ignored_topics` 为先忽略在前；展示改为新忽略在前
 * @param topicIds 脚本中的忽略主题编号
 */
function toIgnoredTopicDisplayOrder(topicIds: number[]): number[] {
  return topicIds.slice().reverse()
}

/**
 * 对编号列表做应用层分页
 * @param ids 全量编号
 * @param page 页码
 * @param pageSize 每页数量
 */
function paginateIds(
  ids: number[],
  page: number,
  pageSize: number
): {
  page: number
  totalPage: number
  totalCount: number
  pageTopicIds: number[]
} {
  const safePageSize = Math.max(1, Math.floor(pageSize) || IGNORED_TOPICS_PAGE_SIZE)
  const totalCount = ids.length
  const totalPage = Math.max(Math.ceil(totalCount / safePageSize), 1)
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPage)
  const start = (safePage - 1) * safePageSize

  return {
    page: safePage,
    totalPage,
    totalCount,
    pageTopicIds: ids.slice(start, start + safePageSize)
  }
}

/**
 * 获取用户关系操作的登录提示文案
 * @param action 关系操作
 */
function getMemberRelationLabel(action: MemberRelationAction): string {
  switch (action) {
    case 'follow':
      return '加入特别关注'
    case 'unfollow':
      return '取消特别关注'
    case 'block':
      return '屏蔽用户'
    case 'unblock':
      return '取消屏蔽用户'
  }
}

/**
 * 调用用户关系更新接口
 * @param action 关系操作
 * @param memberId 用户编号
 */
function updateMemberRelation(action: MemberRelationAction, memberId: number): Promise<void> {
  switch (action) {
    case 'follow':
      return G.V2ex.followMember(memberId)
    case 'unfollow':
      return G.V2ex.unfollowMember(memberId)
    case 'block':
      return G.V2ex.blockMember(memberId)
    case 'unblock':
      return G.V2ex.unblockMember(memberId)
  }
}

/** 归一化用户名用于比较 */
function normalizeMemberUsername(username?: string): string {
  return username?.trim().toLocaleLowerCase() || ''
}
