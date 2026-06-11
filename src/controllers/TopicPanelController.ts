import path from 'path'
import vscode from 'vscode'
import { AccountRestrictedError, LoginRequiredError, TopicDetail } from '@/v2ex'
import G from '@/global'
import { openImagePreview } from '@/features/imagePreview'
import { openExternal } from '@/features/openExternal'
import Config from '@/config'
import { renderWebviewHtml } from '@/core/webviewHtml'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import type { MemberPanelInput, TopicPanelInput } from '@/controllers/panelTypes'
import {
  TopicPanelRpcCommands,
  TopicPanelViewState,
  TopicPanelWebviewEvents,
  WebviewRpcHandlers
} from '@/shared/webview'

/**
 * 话题面板外部依赖
 */
export interface TopicPanelDeps {
  /** 打开用户面板 */
  openMember: (member: MemberPanelInput) => void
  /** 打开话题面板 */
  openTopic: (topic: TopicPanelInput) => void
}

/**
 * 话题面板控制器
 */
export class TopicPanelController {
  /** 话题面板缓存 key */
  readonly key: string

  /** 话题 id */
  private readonly topicId: number

  /** 话题面板 */
  private readonly panel: vscode.WebviewPanel

  /** Webview RPC 桥接器 */
  private readonly rpc: WebviewRpcBridge<TopicPanelRpcCommands, TopicPanelWebviewEvents>

  /** 外部面板导航依赖 */
  private readonly deps: TopicPanelDeps

  /** 当前话题详情，仅在扩展侧维护 */
  private detail: TopicDetail = {
    id: 0,
    title: '',
    node: {
      name: '',
      title: ''
    },
    authorAvatar: '',
    authorName: '',
    displayTime: '',
    visitCount: 0,
    content: '',
    appends: [],
    collectCount: 0,
    thankCount: 0,
    isCollected: false,
    isThanked: false,
    canThank: true,
    collectParamT: null,
    replyCount: 0,
    replyCurrentPage: 1,
    replyTotalPage: 1,
    replies: []
  }

  /** 当前视图状态 */
  private viewState: TopicPanelViewState = { status: 'loading' }

  /** 配置变更监听 */
  private readonly configListener: vscode.Disposable

  /**
   * @param input 话题面板输入参数
   * @param deps 外部面板导航依赖
   */
  constructor(input: TopicPanelInput, deps: TopicPanelDeps) {
    const topicId = normalizeTopicId(input.topicId)
    this.key = G.V2ex.getTopicLinkById(topicId)
    this.topicId = topicId
    this.deps = deps
    this.panel = createPanel(this.key, input.label)
    this.panel.webview.html = renderWebviewHtml(this.panel.webview, 'topic.html')
    this.rpc = new WebviewRpcBridge<TopicPanelRpcCommands, TopicPanelWebviewEvents>(
      this.panel.webview,
      this.createRpcHandlers()
    )
    this.configListener = vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('v2ex.browse.showImagesInTopic')) {
        this.postViewState(this.viewState)
      }
    })
    this.panel.onDidDispose(() => {
      this.configListener.dispose()
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
    this.configListener.dispose()
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
   * 加载当前话题
   */
  async load() {
    try {
      await this.reloadTopic(true)
    } catch (err) {
      console.error(err)
      this.renderError(err as Error)
    }
  }

  /**
   * 渲染话题详情
   * @param topicDetail 话题详情
   */
  render(topicDetail: TopicDetail) {
    this.postViewState({
      status: 'topic',
      topic: topicDetail,
      canOperate: !!G.getCookie()
    })
  }

  /**
   * 渲染异常页面
   * @param err 异常对象
   */
  private renderError(err: Error) {
    if (err instanceof LoginRequiredError) {
      this.postViewState({
        status: 'error',
        message: err.message,
        showLogin: true,
        showRefresh: true
      })
      return
    }

    if (err instanceof AccountRestrictedError) {
      this.postViewState({
        status: 'error',
        message: err.message,
        showRefresh: false
      })
      return
    }

    this.postViewState({
      status: 'error',
      message: err.message,
      showRefresh: true
    })
  }

  /**
   * 向 webview 同步最新视图状态
   * @param state 页面状态
   */
  private postViewState(state: TopicPanelViewState) {
    this.viewState = state
    this.rpc.post('topicStateChanged', {
      state: {
        ...state,
        showImages: Config.showImagesInTopic()
      }
    })
  }

  /**
   * 注册 Webview RPC 处理器
   */
  private createRpcHandlers(): WebviewRpcHandlers<TopicPanelRpcCommands> {
    return {
      browseImage: msg => {
        openImagePreview(msg.src)
      },
      openExternal: msg => {
        openExternal(msg.path)
      },
      openTopic: msg => this.openTopic(msg.topicId),
      openMember: msg => this.deps.openMember({ username: msg.username }),
      login: async () => {
        await vscode.commands.executeCommand('v2ex.login')
      },
      refresh: () => this.refreshTopic(),
      collect: () => this.runTopicMutation(() => G.V2ex.collectTopic(this.detail.id)),
      cancelCollect: () => this.runTopicMutation(() => G.V2ex.cancelCollectTopic(this.detail.id)),
      thank: () => this.runTopicMutation(() => G.V2ex.thankTopic(this.detail.id)),
      postReply: msg => this.handlePostReply(msg),
      thankReply: msg => this.handleThankReply(msg),
      loadReplyPage: msg => this.handleLoadReplyPage(msg)
    }
  }

  /**
   * 统一处理会导致页面整体刷新的话题操作
   * @param task 具体任务
   */
  private async runTopicMutation(task: () => Promise<unknown>) {
    await task()
    await this.reloadTopic(false)
  }

  /**
   * 刷新话题并向页面同步
   * @param showLoading 是否显示整页加载状态
   */
  private async reloadTopic(showLoading: boolean) {
    if (showLoading) {
      this.postViewState({
        status: 'loading'
      })
    }

    const detail = await G.V2ex.getTopicDetail(this.topicId, this.detail.replyCurrentPage)
    this.detail = detail
    this.panel.title = fmtPanelTitle(detail.title)
    this.render(detail)
  }

  /**
   * 手动刷新话题
   */
  private async refreshTopic() {
    try {
      await this.reloadTopic(true)
    } catch (err) {
      console.error(err)
      this.renderError(err as Error)
      throw err
    }
  }

  /**
   * 打开扩展内另一个话题
   * @param topicId 话题 id
   */
  private openTopic(topicId: string | number) {
    this.deps.openTopic({
      label: `/t/${topicId}`,
      topicId
    } satisfies TopicPanelInput)
  }

  /**
   * 处理提交回复
   * @param message 页面消息
   */
  private handlePostReply(message: { content: string }) {
    const { content } = message
    if (!content) {
      throw new Error('请输入回复内容')
    }

    return this.runTopicMutation(() => G.V2ex.postReply(this.topicId, content))
  }

  /**
   * 处理感谢回复者
   * @param message 页面消息
   */
  private async handleThankReply(message: { replyId: string }) {
    const { replyId } = message
    if (!replyId) {
      return
    }

    const reply = this.detail.replies.find(r => r.replyId === replyId)
    if (!reply) {
      return
    }

    await G.V2ex.thankReply(replyId)
    reply.thanked = true
    reply.thanks++
    this.render(this.detail)
  }

  /**
   * 处理回复翻页
   * @param message 页面消息
   */
  private async handleLoadReplyPage(message: { replyPage: number }) {
    const replyPage = Number(message.replyPage)
    if (!Number.isFinite(replyPage)) {
      return
    }

    const detail = await G.V2ex.getTopicDetail(this.topicId, replyPage)
    this.detail = detail
    this.render(detail)
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
 * 创建话题 webview 面板
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

/**
 * 归一化话题 id
 * @param topicId 话题 id
 */
function normalizeTopicId(topicId: number | string): number {
  const normalizedTopicId = Number(topicId)
  if (Number.isNaN(normalizedTopicId)) {
    throw new Error('打开话题面板缺少必要参数')
  }
  return normalizedTopicId
}
