import { composeWebviewRpcControllers } from '@/core/composeWebviewRpcControllers'
import G from '@/global'
import {
  formatPanelTitle,
  type CreateWebviewContentPanel,
  type WebviewContentPanel
} from './webviewPanel'
import type { HelpPage } from '@/v2ex'
import { WebviewCommonRpc, type WebviewNavigationDeps } from './WebviewCommonRpc'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { openExternal } from '@/features/openExternal'
import type {
  HelpRpcCommands,
  HelpViewState,
  HelpWebviewEvents,
  WebviewPageRpcController
} from '@/shared/webview'

interface HelpPanelNavigationDeps extends WebviewNavigationDeps {
  openHelp: (slug: string, anchor?: string) => void
}

/** 帮助页状态按主题加载，隔离并发刷新与章节定位 */
export class HelpPanelController implements WebviewPageRpcController<HelpRpcCommands> {
  private readonly panel: WebviewContentPanel
  private readonly rpc: WebviewRpcBridge<HelpRpcCommands, HelpWebviewEvents>
  private state: HelpViewState = { status: 'loading', slug: 'home' }
  private revision = 0

  constructor(
    private readonly deps: HelpPanelNavigationDeps,
    createPanel: CreateWebviewContentPanel,
    previousPage?: HelpPage
  ) {
    this.panel = createPanel({
      viewType: 'v2ex.help',
      title: '站点帮助',
      htmlEntry: 'help.html',
      enableFindWidget: true,
      useDefaultIcon: true
    })
    if (previousPage) {
      this.state = { status: 'result', slug: previousPage.slug, data: previousPage }
    }
    const commonRpc = new WebviewCommonRpc(deps)
    this.rpc = new WebviewRpcBridge<HelpRpcCommands, HelpWebviewEvents>(
      this.panel.webview,
      composeWebviewRpcControllers(this, commonRpc)
    )
    this.panel.onDidDispose(() => {
      this.revision++
      this.rpc.dispose()
    })
  }

  /** 读取最新页面状态 */
  rpc_ready() {
    return this.state
  }
  /** 切换帮助主题 */
  rpc_load(slug: string, anchor?: string) {
    this.deps.openHelp(slug, anchor)
  }
  /** 刷新当前主题 */
  rpc_refresh() {
    return this.load(this.state.slug, true, this.state.anchor)
  }
  /** 在浏览器中查看原文 */
  rpc_openSource() {
    const url = new URL(`/help/${this.state.slug}`, G.V2ex.baseUrl)
    if (this.state.anchor) url.hash = encodeURIComponent(this.state.anchor)
    void openExternal(url.toString())
  }

  /** 请求主题并同步状态，旧请求不得覆盖后续导航 */
  async load(slug = 'home', refresh = false, anchor?: string) {
    if (!refresh && this.state.status === 'result' && this.state.data?.slug === slug) {
      // 已加载的文档仍需推送导航，支持再次点击同一章节重新定位
      this.panel.title = formatPanelTitle(this.state.data.title)
      this.post({ ...this.state, anchor })
      return
    }
    const revision = ++this.revision
    this.post({ status: 'loading', slug, anchor, data: this.state.data })
    try {
      const data = await G.V2ex.help.getPage(slug)
      if (revision !== this.revision) return
      this.panel.title = formatPanelTitle(data.title)
      this.post({ status: 'result', slug, anchor, data })
    } catch (error) {
      if (revision !== this.revision) return
      this.post({
        status: 'error',
        slug,
        anchor,
        data: this.state.data,
        message: error instanceof Error ? error.message : '帮助内容加载失败'
      })
    }
  }

  private post(state: HelpViewState) {
    this.state = state
    this.rpc.post('helpStateChanged', { state })
  }
}
