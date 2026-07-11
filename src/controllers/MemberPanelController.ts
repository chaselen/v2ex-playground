import vscode from 'vscode'
import G from '@/global'
import { openImagePreview } from '@/features/imagePreview'
import { openExternal } from '@/features/openExternal'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { logger } from '@/core/logger'
import { setRemotePanelIcon } from '@/features/panelIcon'
import { createV2exWebviewPanel, formatPanelTitle } from '@/controllers/webviewPanel'
import type { MemberPanelInput, NodeTabInput, TopicPanelInput } from '@/controllers/panelTypes'
import type { MemberContent, MemberContentTabKey, MemberInfo, MemberProfile } from '@/v2ex'
import type {
  MemberPanelRpcCommands,
  MemberPanelViewState,
  MemberPanelWebviewEvents,
  WebviewRpcHandlers
} from '@/shared/webview'

/**
 * 用户面板外部依赖
 */
export interface MemberPanelDeps {
  /** 打开用户面板 */
  openMember: (member: MemberPanelInput) => void
  /** 打开话题面板 */
  openTopic: (topic: TopicPanelInput) => void
  /** 打开节点主题标签 */
  openNode: (node: NodeTabInput) => void
}

/**
 * 用户面板控制器
 */
export class MemberPanelController {
  /** 用户面板缓存 key */
  readonly key: string

  /** 用户名 */
  private readonly username: string

  /** 用户面板 */
  private readonly panel: vscode.WebviewPanel

  /** Webview RPC 桥接器 */
  private readonly rpc: WebviewRpcBridge<MemberPanelRpcCommands, MemberPanelWebviewEvents>

  /** 外部面板导航依赖 */
  private readonly deps: MemberPanelDeps

  /** 当前用户资料，仅在扩展侧维护 */
  private profile?: MemberProfile

  /** 当前视图状态 */
  private viewState: MemberPanelViewState = { status: 'loading' }

  /**
   * @param input 用户面板输入参数
   * @param deps 外部面板导航依赖
   */
  constructor(input: MemberPanelInput, deps: MemberPanelDeps) {
    this.username = input.username
    this.key = G.V2ex.getMemberLink(this.username)
    this.deps = deps
    this.panel = createV2exWebviewPanel({
      viewType: this.key,
      title: input.label || this.username,
      htmlEntry: 'member.html',
      enableFindWidget: true,
      useDefaultIcon: true
    })
    this.rpc = new WebviewRpcBridge<MemberPanelRpcCommands, MemberPanelWebviewEvents>(
      this.panel.webview,
      this.createRpcHandlers()
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
      logger.error('用户信息加载失败', err)
      this.renderError(err as Error)
    }
  }

  /**
   * 向 webview 同步最新视图状态
   * @param state 页面状态
   */
  private postViewState(state: MemberPanelViewState) {
    this.viewState = state
    this.rpc.post('memberStateChanged', {
      state
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

  /**
   * 注册 Webview RPC 处理器
   */
  private createRpcHandlers(): WebviewRpcHandlers<MemberPanelRpcCommands> {
    return {
      ready: () => this.viewState,
      browseImage: msg => {
        openImagePreview(msg.src)
      },
      openExternal: msg => {
        openExternal(msg.path)
      },
      openTopic: msg =>
        this.deps.openTopic({
          label: msg.title || `/t/${msg.topicId}`,
          topicId: msg.topicId
        }),
      openMember: msg => this.deps.openMember({ username: msg.username }),
      openNode: msg => this.deps.openNode(msg),
      refresh: () => this.refreshMember(),
      loadMemberTab: msg => this.loadMemberContent(msg.tab, msg.page),
      loadMemberPage: msg => this.loadMemberContent(msg.tab, msg.page)
    }
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
    this.profile = this.createProfile(member, content)
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
      logger.error('用户内容加载失败', err)
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
    const content = await G.V2ex.getMemberContent(this.username, { tab, page })
    const member = this.profile?.member || (await G.V2ex.getMemberInfo(this.username))
    this.profile = this.createProfile(member, content)
    this.panel.title = formatPanelTitle(this.profile.member.username)
    setRemotePanelIcon(this.panel, this.profile.member.avatar).catch(err =>
      logger.error('用户面板图标更新失败', err)
    )
    return this.profile
  }

  /**
   * 创建用户资料
   * @param member 用户基本信息
   * @param content 用户活动内容
   */
  private createProfile(member: MemberInfo, content: MemberContent): MemberProfile {
    return {
      member,
      content
    }
  }
}
