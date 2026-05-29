import path from 'path'
import vscode from 'vscode'
import { AccountRestrictedError, LoginRequiredError, TopicDetail } from '@/v2ex'
import G from '@/global'
import { openImagePreview } from '@/features/imagePreview'
import Config from '@/config'
import { renderWebviewHtml } from '@/core/webviewHtml'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import {
  TopicPanelMessage,
  TopicPanelRpcCommands,
  TopicPanelViewState,
  TopicPanelWebviewEvents
} from '@/shared/webview'

/**
 * 打开话题面板所需的最小参数
 */
export interface TopicPanelInput {
  /** 话题标题 */
  label: string
  /** 话题 id */
  topicId: number
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
    replies: []
  }

  /** 当前视图状态 */
  private viewState: TopicPanelViewState = { status: 'loading' }

  /** 配置变更监听 */
  private readonly configListener: vscode.Disposable

  /**
   * @param input 话题面板输入参数
   */
  constructor(input: TopicPanelInput) {
    this.key = G.V2ex.getTopicLinkById(input.topicId)
    this.topicId = input.topicId
    this.panel = createPanel(this.key, input.label)
    this.panel.webview.html = renderWebviewHtml(this.panel.webview, 'topic.html')
    this.rpc = new WebviewRpcBridge<TopicPanelRpcCommands, TopicPanelWebviewEvents>(
      this.panel.webview
    )
    this.registerRpcHandlers()
    this.rpc.listen()
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
    this.rpc.post('renderState', {
      state: {
        ...state,
        showImages: Config.showImagesInTopic()
      }
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
        this.openTopic(msg.topicId)
      }
    })
    this.rpc.handle('login', () => vscode.commands.executeCommand('v2ex.login'))
    this.rpc.handle('refresh', () => this.refreshTopic())
    this.rpc.handle('collect', () =>
      this.runTopicMutation(() => G.V2ex.collectTopic(this.detail.id))
    )
    this.rpc.handle('cancelCollect', () =>
      this.runTopicMutation(() => G.V2ex.cancelCollectTopic(this.detail.id))
    )
    this.rpc.handle('thank', () => this.runTopicMutation(() => G.V2ex.thankTopic(this.detail.id)))
    this.rpc.handle('postReply', msg => this.handlePostReply(msg))
    this.rpc.handle('thankReply', msg => this.handleThankReply(msg))
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

    const detail = await G.V2ex.getTopicDetail(this.topicId)
    this.detail = detail
    this.panel.title = fmtPanelTitle(detail.title)
    this.render(detail)
    G.checkUnreadNotification()
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
    const nextTopicId = Number(topicId)
    vscode.commands.executeCommand('v2ex.topicItemClick', {
      label: `/t/${nextTopicId}`,
      topicId: nextTopicId
    } satisfies TopicPanelInput)
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

  /**
   * 处理提交回复
   * @param message 页面消息
   */
  private handlePostReply(message: TopicPanelMessage) {
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
  private async handleThankReply(message: TopicPanelMessage) {
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
