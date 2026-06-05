import path from 'path'
import vscode from 'vscode'
import G from '@/global'
import openTopic from '@/features/openTopic'
import { openImagePreview } from '@/features/imagePreview'
import { renderWebviewHtml } from '@/core/webviewHtml'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import type { MemberContent, MemberContentTabKey, MemberInfo, MemberProfile } from '@/v2ex'
import type {
  MemberPanelRpcCommands,
  MemberPanelViewState,
  MemberPanelWebviewEvents
} from '@/shared/webview'

/**
 * 打开用户面板所需的最小参数
 */
export interface MemberPanelInput {
  /** 面板标题 */
  label?: string
  /** 用户名 */
  username: string
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

  /** 当前用户资料，仅在扩展侧维护 */
  private profile?: MemberProfile

  /** 当前视图状态 */
  private viewState: MemberPanelViewState = { status: 'loading' }

  /**
   * @param input 用户面板输入参数
   */
  constructor(input: MemberPanelInput) {
    this.username = input.username
    this.key = G.V2ex.getMemberLink(this.username)
    this.panel = createPanel(this.key, input.label || this.username)
    this.panel.webview.html = renderWebviewHtml(this.panel.webview, 'member.html')
    this.rpc = new WebviewRpcBridge<MemberPanelRpcCommands, MemberPanelWebviewEvents>(
      this.panel.webview
    )
    this.registerRpcHandlers()
    this.rpc.listen()
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
      console.error(err)
      this.renderError(err as Error)
    }
  }

  /**
   * 向 webview 同步最新视图状态
   * @param state 页面状态
   */
  private postViewState(state: MemberPanelViewState) {
    this.viewState = state
    this.rpc.post('renderState', {
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
  private registerRpcHandlers() {
    this.rpc.handle('browseImage', msg => openImagePreview(String(msg.src || '')))
    this.rpc.handle('openExternal', msg => this.openExternal(String(msg.src || '')))
    this.rpc.handle('openTopic', msg => {
      if (msg.topicId !== undefined) {
        openTopic({
          label: msg.title || `/t/${msg.topicId}`,
          topicId: msg.topicId
        })
      }
    })
    this.rpc.handle('openMember', msg => {
      if (msg.username) {
        import('@/features/openMember').then(({ default: openMember }) =>
          openMember({ username: String(msg.username) })
        )
      }
    })
    this.rpc.handle('refresh', () => this.refreshMember())
    this.rpc.handle('loadMemberTab', msg => this.loadMemberContent(msg.tab, msg.page))
    this.rpc.handle('loadMemberPage', msg => this.loadMemberContent(msg.tab, msg.page))
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
    this.panel.title = fmtPanelTitle(this.profile.member.username)
    this.render(this.profile)
  }

  /**
   * 手动刷新用户页
   */
  private async refreshMember() {
    try {
      await this.reloadMember(true)
    } catch (err) {
      console.error(err)
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
    this.panel.title = fmtPanelTitle(this.profile.member.username)
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

  /**
   * 在浏览器中打开链接
   * @param link 链接地址
   */
  private openExternal(link?: string) {
    if (!link) {
      vscode.window.showWarningMessage('链接地址为空')
      return
    }

    const uri = vscode.Uri.parse(link)
    if (uri.scheme !== 'http' && uri.scheme !== 'https') {
      vscode.window.showWarningMessage('仅支持打开 http 或 https 链接')
      return
    }

    return vscode.env.openExternal(uri)
  }
}

/**
 * 截断面板标题
 * @param title 原始标题
 */
function fmtPanelTitle(title: string) {
  return title.length <= 15 ? title : title.slice(0, 15) + '...'
}

/**
 * 创建用户 webview 面板
 * @param id 面板 id
 * @param label 面板标题
 */
function createPanel(id: string, label: string): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    id,
    fmtPanelTitle(label),
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
