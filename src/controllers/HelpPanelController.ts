import G from '@/global'
import { createV2exWebviewPanel, formatPanelTitle } from './webviewPanel'
import { WebviewCommonController, type WebviewNavigationDeps } from './WebviewCommonController'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { openExternal } from '@/features/openExternal'
import type {
  HelpRpcCommands,
  HelpViewState,
  HelpWebviewEvents,
  WebviewRpcController
} from '@/shared/webview'

/** 可复用的帮助面板，保留最新状态并隔离并发导航结果 */
export class HelpPanelController
  extends WebviewCommonController
  implements WebviewRpcController<HelpRpcCommands>
{
  private readonly panel = createV2exWebviewPanel({
    viewType: 'v2ex.help',
    title: '站点帮助',
    htmlEntry: 'help.html',
    enableFindWidget: true,
    useDefaultIcon: true
  })
  private readonly rpc = new WebviewRpcBridge<HelpRpcCommands, HelpWebviewEvents>(
    this.panel.webview,
    this
  )
  private state: HelpViewState = { status: 'loading', slug: 'home' }
  private revision = 0

  constructor(deps: WebviewNavigationDeps) {
    super(deps)
    this.panel.onDidDispose(() => {
      this.revision++
      this.rpc.dispose()
    })
  }

  /** 激活已有帮助面板 */
  reveal() {
    this.panel.reveal()
  }
  /** 监听面板销毁 */
  onDidDispose(listener: () => void) {
    this.panel.onDidDispose(listener)
  }
  /** 读取最新页面状态 */
  rpc_ready() {
    return this.state
  }
  /** 切换帮助主题 */
  rpc_load(slug: string) {
    return this.load(slug)
  }
  /** 刷新当前主题 */
  rpc_refresh() {
    return this.load(this.state.slug, true)
  }
  /** 在浏览器中查看原文 */
  rpc_openSource() {
    void openExternal(`${G.V2ex.baseUrl}/help/${this.state.slug}`)
  }

  /** 请求主题并同步状态，旧请求不得覆盖后续导航 */
  async load(slug = 'home', refresh = false) {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('帮助主题无效')
    if (!refresh && this.state.status === 'result' && this.state.slug === slug) return
    const revision = ++this.revision
    this.post({ status: 'loading', slug, data: this.state.data })
    try {
      const data = await G.V2ex.help.getPage(slug)
      if (revision !== this.revision) return
      this.panel.title = formatPanelTitle(data.title)
      this.post({ status: 'result', slug, data })
    } catch (error) {
      if (revision !== this.revision) return
      this.post({
        status: 'error',
        slug,
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
