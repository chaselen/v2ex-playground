import vscode from 'vscode'
import { AccountRestrictedError, LoginRequiredError, TopicDetail } from '@/v2ex'
import type { MemberInfo } from '@/v2ex'
import G from '@/global'
import Config from '@/config'
import { uploadImage } from '@/core/imageUpload'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { logger } from '@/core/logger'
import { updateRecentBrowseTopic } from '@/features/recentBrowse'
import { setRemotePanelIcon } from '@/features/panelIcon'
import { createV2exWebviewPanel, formatPanelTitle } from '@/controllers/webviewPanel'
import { checkImgurConnectivity } from '@/features/connectivityCheck'
import { copyTopicLink, copyTopicTitleLink, viewTopicInBrowser } from '@/features/topicSharing'
import {
  getTopicShareImageCacheDir,
  loadTopicShareImages,
  saveTopicShareImage
} from '@/features/topicShareImage'
import {
  WebviewCommonController,
  type WebviewNavigationDeps
} from '@/controllers/WebviewCommonController'
import {
  TopicPanelRpcCommands,
  TopicPanelViewState,
  TopicPanelWebviewEvents,
  TopicActionTarget,
  OpenTopicPayload,
  WebviewRpcController
} from '@/shared/webview'

/**
 * 话题面板外部依赖
 */
export interface TopicPanelDeps extends WebviewNavigationDeps {
  /** 打开标签主题面板 */
  openTag: (tag: string) => void
}

/**
 * 话题面板控制器
 */
export class TopicPanelController
  extends WebviewCommonController<TopicPanelDeps>
  implements WebviewRpcController<TopicPanelRpcCommands>
{
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
    tags: [],
    authorAvatar: '',
    topicIcon: '',
    authorName: '',
    isAuthorPro: false,
    displayTime: '',
    publishedAt: '',
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

  /** 用户快速信息请求缓存 */
  private readonly memberQuickInfoCache = new Map<string, Promise<MemberInfo>>()

  /** 回复翻页请求序号 */
  private replyPageRequestId = 0

  /** 配置变更监听 */
  private readonly configListener: vscode.Disposable

  /**
   * @param input 话题面板输入参数
   * @param deps 外部面板导航依赖
   */
  constructor(input: OpenTopicPayload, deps: TopicPanelDeps) {
    super(deps)
    const topicId = normalizeTopicId(input.topicId)
    this.key = G.V2ex.getTopicLinkById(topicId)
    this.topicId = topicId
    this.panel = createV2exWebviewPanel({
      viewType: this.key,
      title: input.title || `/t/${topicId}`,
      htmlEntry: 'topic.html',
      enableFindWidget: true,
      useDefaultIcon: true,
      additionalLocalResourceRoots: [getTopicShareImageCacheDir()]
    })
    this.rpc = new WebviewRpcBridge<TopicPanelRpcCommands, TopicPanelWebviewEvents>(
      this.panel.webview,
      this
    )
    this.configListener = vscode.workspace.onDidChangeConfiguration(event => {
      if (
        event.affectsConfiguration('v2ex.browse.showImagesInTopic') ||
        event.affectsConfiguration('v2ex.browse.showAvatar')
      ) {
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
      logger.error('话题详情加载失败', err, { topicId: this.topicId })
      this.renderError(err as Error)
    }
  }

  /**
   * 登录态变化后刷新话题
   */
  refreshForAuthChange() {
    this.refreshTopic().catch(err => {
      logger.error('话题登录态刷新失败', err, { topicId: this.topicId })
    })
  }

  /**
   * 渲染话题详情
   * @param topicDetail 话题详情
   */
  render(topicDetail: TopicDetail) {
    this.postViewState({
      status: 'topic',
      topic: topicDetail,
      canOperate: G.V2ex.hasLoginSession()
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
      state: this.getViewState()
    })
  }

  /**
   * 获取包含当前配置的话题视图状态
   */
  private getViewState(): TopicPanelViewState {
    return {
      ...this.viewState,
      showImages: Config.showImagesInTopic(),
      showAvatar: Config.showAvatar()
    }
  }

  /** 获取当前视图状态 */
  rpc_ready() {
    return this.getViewState()
  }

  /** 打开标签主题面板 */
  rpc_openTag(tag: string) {
    this.navigation.openTag(tag)
  }

  /** 执行登录 */
  async rpc_login() {
    await vscode.commands.executeCommand('v2ex.login')
  }

  /** 刷新话题 */
  rpc_refresh() {
    return this.refreshTopic()
  }

  /** 复制话题链接 */
  rpc_copyTopicLink(topicId: string | number) {
    copyTopicLink(topicId)
  }

  /** 复制话题标题和链接 */
  rpc_copyTopicTitleLink(message: { topicId: string | number; title: string }) {
    copyTopicTitleLink(message.topicId, message.title)
  }

  /** 在浏览器中打开话题 */
  rpc_viewTopicInBrowser(topicId: string | number) {
    viewTopicInBrowser(topicId)
  }

  /** 保存话题分享图 */
  rpc_saveTopicShareImage(message: { topicId: string | number; base64: string }) {
    void saveTopicShareImage(message)
  }

  /** 加载分享图使用的本地资源 URI 或 data URL */
  rpc_loadTopicShareImages(
    imageSources: string[],
    options?: { format?: 'resourceUri' | 'dataUrl' }
  ) {
    return loadTopicShareImages(imageSources, this.panel.webview, options)
  }

  /** 收藏话题 */
  rpc_collectTopic(target: TopicActionTarget) {
    return this.runTopicMutation(target, topicId => G.V2ex.collectTopic(topicId))
  }

  /** 取消收藏话题 */
  rpc_cancelCollectTopic(target: TopicActionTarget) {
    return this.runTopicMutation(target, topicId => G.V2ex.cancelCollectTopic(topicId))
  }

  /** 感谢话题创建者 */
  rpc_thankTopic(target: TopicActionTarget) {
    return this.runTopicMutation(target, topicId => G.V2ex.thankTopic(topicId))
  }

  /** 提交话题回复 */
  rpc_postTopicReply(message: TopicActionTarget & { content: string }) {
    return this.handlePostTopicReply(message)
  }

  /** 上传回复图片 */
  rpc_uploadImage(message: { filename: string; mimeType: string; base64: string }) {
    return uploadImage(message)
  }

  /** 检测 Imgur 连通性 */
  rpc_checkImgurConnectivity(message: { target: 'image' | 'upload'; refresh?: boolean }) {
    return checkImgurConnectivity(message.target, message.refresh)
  }

  /** 预览回复内容 */
  rpc_previewReply(content: string) {
    return this.handlePreviewReply(content)
  }

  /** 加载站内话题预览 */
  rpc_getTopicPreview(message: { topicId: string | number; replyPage?: number }) {
    return this.loadTopicPreview(message)
  }

  /** 感谢话题回复者 */
  rpc_thankTopicReply(message: TopicActionTarget & { replyId: string }) {
    return this.handleThankTopicReply(message)
  }

  /** 加载话题回复页 */
  rpc_loadReplyPage(replyPage: number) {
    return this.handleLoadReplyPage(replyPage)
  }

  /** 加载用户快速信息 */
  rpc_loadMemberQuickInfo(username: string) {
    return this.loadMemberQuickInfo(username)
  }

  /**
   * 加载用户快速信息
   * @param username 用户名
   */
  private loadMemberQuickInfo(username: string): Promise<MemberInfo> {
    const normalizedUsername = username.trim()
    const cacheKey = normalizedUsername.toLowerCase()
    const cached = this.memberQuickInfoCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const request = G.V2ex.getMemberInfo(normalizedUsername).catch(err => {
      this.memberQuickInfoCache.delete(cacheKey)
      throw err
    })
    this.memberQuickInfoCache.set(cacheKey, request)
    return request
  }

  /**
   * 执行话题操作并同步受影响的主面板
   * @param target 操作目标
   * @param task 话题操作
   */
  private async runTopicMutation(
    target: TopicActionTarget,
    task: (topicId: number) => Promise<unknown>
  ): Promise<TopicDetail> {
    const topicId = normalizeTopicId(target.topicId)
    const replyPage = normalizeReplyPage(target.replyPage)

    await task(topicId)
    const detail = await G.V2ex.getTopicDetail(topicId, replyPage)

    if (topicId === this.topicId) {
      if (replyPage === this.detail.replyCurrentPage) {
        this.detail = detail
        this.render(detail)
      } else {
        const panelDetail = await G.V2ex.getTopicDetail(this.topicId, this.detail.replyCurrentPage)
        this.detail = panelDetail
        this.render(panelDetail)
      }
    }

    return detail
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
    updateRecentBrowseTopic(detail).catch(err =>
      logger.error('最近浏览详情保存失败', err, { topicId: detail.id })
    )
    this.panel.title = formatPanelTitle(detail.title)
    setRemotePanelIcon(this.panel, detail.topicIcon).catch(err =>
      logger.error('话题面板图标更新失败', err)
    )
    this.render(detail)
  }

  /**
   * 手动刷新话题
   */
  private async refreshTopic() {
    try {
      await this.reloadTopic(true)
    } catch (err) {
      this.renderError(err as Error)
      throw err
    }
  }

  /**
   * 处理回复预览
   * @param content 回复内容
   */
  private handlePreviewReply(content: string) {
    if (!content.trim()) {
      throw new Error('请输入回复内容')
    }

    return G.V2ex.previewReply(content, 'default')
  }

  /**
   * 加载站内话题预览
   * @param message 预览请求
   */
  private loadTopicPreview(message: { topicId: string | number; replyPage?: number }) {
    const topicId = normalizeTopicId(message.topicId)
    const replyPage = normalizeReplyPage(message.replyPage)
    return G.V2ex.getTopicDetail(topicId, replyPage)
  }

  /**
   * 提交话题回复
   * @param message 回复请求
   */
  private handlePostTopicReply(message: TopicActionTarget & { content: string }) {
    if (!message.content) {
      throw new Error('请输入回复内容')
    }

    return this.runTopicMutation(message, topicId => G.V2ex.postReply(topicId, message.content))
  }

  /**
   * 感谢话题回复者
   * @param message 感谢请求
   */
  private handleThankTopicReply(message: TopicActionTarget & { replyId: string }) {
    if (!message.replyId) {
      throw new Error('缺少回复 id')
    }

    return this.runTopicMutation(message, () => G.V2ex.thankReply(message.replyId))
  }

  /**
   * 处理回复翻页
   * @param replyPage 回复页码
   */
  private async handleLoadReplyPage(replyPage: number) {
    replyPage = Number(replyPage)
    if (!Number.isFinite(replyPage)) {
      throw new Error('回复页码无效')
    }

    const requestId = ++this.replyPageRequestId
    const detail = await G.V2ex.getTopicDetail(this.topicId, replyPage)
    if (requestId !== this.replyPageRequestId) {
      return detail
    }

    this.detail = detail
    this.render(detail)
    return detail
  }
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

/**
 * 归一化回复页码
 * @param replyPage 回复页码
 */
function normalizeReplyPage(replyPage?: number): number {
  const normalizedReplyPage = Number(replyPage || 1)
  return Number.isFinite(normalizedReplyPage) && normalizedReplyPage > 0 ? normalizedReplyPage : 1
}
