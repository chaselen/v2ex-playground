import vscode from 'vscode'
import G from '@/global'
import { logger } from '@/core/logger'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { createV2exWebviewPanel } from '@/controllers/webviewPanel'
import {
  WebviewNavigationController,
  type WebviewNavigationDeps
} from '@/controllers/WebviewNavigationController'
import type {
  TagPanelRpcCommands,
  TagPanelViewState,
  TagPanelWebviewEvents,
  WebviewRpcController
} from '@/shared/webview'

/** 标签主题面板控制器 */
export class TagPanelController
  extends WebviewNavigationController
  implements WebviewRpcController<TagPanelRpcCommands>
{
  /** 标签面板缓存 key */
  readonly key: string

  /** 标签名称 */
  private readonly tag: string

  /** 标签主题面板 */
  private readonly panel: vscode.WebviewPanel

  /** Webview RPC 桥接器 */
  private readonly rpc: WebviewRpcBridge<TagPanelRpcCommands, TagPanelWebviewEvents>

  /** 当前视图状态 */
  private viewState: TagPanelViewState = { status: 'loading' }

  /**
   * @param tag 标签名称
   * @param deps 外部面板导航依赖
   */
  constructor(tag: string, deps: WebviewNavigationDeps) {
    super(deps)
    this.tag = normalizeTag(tag)
    this.key = G.V2ex.getTagLink(this.tag)
    this.panel = createV2exWebviewPanel({
      viewType: this.key,
      title: this.tag,
      htmlEntry: 'tag.html',
      enableFindWidget: true,
      resourceIcon: 'panelTag.svg'
    })
    this.rpc = new WebviewRpcBridge<TagPanelRpcCommands, TagPanelWebviewEvents>(
      this.panel.webview,
      this
    )
    this.panel.onDidDispose(() => this.rpc.dispose())
  }

  /** 激活当前面板 */
  reveal() {
    this.panel.reveal()
  }

  /** 销毁当前面板 */
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

  /** 加载当前标签主题 */
  load() {
    return this.reload()
  }

  /** 获取当前视图状态 */
  rpc_ready() {
    return this.viewState
  }

  /** 刷新标签主题列表 */
  rpc_refresh() {
    return this.reload()
  }

  /** 加载标签主题并同步页面状态 */
  private async reload() {
    this.postViewState({ status: 'loading', data: this.viewState.data })

    try {
      const data = await G.V2ex.getTopicListByTag(this.tag)
      this.postViewState({ status: 'result', data })
    } catch (err) {
      logger.error('标签主题加载失败', err, { tag: this.tag })
      this.postViewState({
        status: 'error',
        data: this.viewState.data,
        message: (err as Error).message || '标签主题加载失败'
      })
      throw err
    }
  }

  /**
   * 同步最新页面状态
   * @param state 页面状态
   */
  private postViewState(state: TagPanelViewState) {
    this.viewState = state
    this.rpc.post('tagStateChanged', { state })
  }
}

/**
 * 归一化标签名称
 * @param tag 标签名称
 */
function normalizeTag(tag: string): string {
  const normalizedTag = tag.trim()
  if (!normalizedTag) {
    throw new Error('打开标签面板缺少必要参数')
  }
  return normalizedTag
}
