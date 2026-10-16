import type { HelpPage } from '../v2ex/types'
import type { WebviewCommonRpcCommands, WebviewStateRpcCommands } from './commonView'

/** 帮助页面的最新状态 */
export interface HelpViewState {
  status: 'loading' | 'result' | 'error'
  slug: string
  /** 页面加载后定位的章节 id，不含 # */
  anchor?: string
  data?: HelpPage
  message?: string
}

/** 帮助页面 RPC 契约 */
export interface HelpRpcCommands
  extends WebviewCommonRpcCommands, WebviewStateRpcCommands<HelpViewState> {
  load(slug: string): void
  refresh(): void
  openSource(): void
}

/** 帮助页面状态事件 */
export interface HelpWebviewEvents {
  helpStateChanged: { state: HelpViewState }
}
