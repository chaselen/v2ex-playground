import type { SoV2exSearchParams, SoV2exSearchResult } from '../v2ex/types'
import type { WebviewNavigationRpcCommands } from './commonView'
export type {
  SoV2exHit,
  SoV2exHighlight,
  SoV2exOperator,
  SoV2exOrder,
  SoV2exSearchParams,
  SoV2exSearchResult,
  SoV2exSort,
  SoV2exSource
} from '../v2ex/types'

/** 搜索面板 Webview RPC 命令 */
export interface SearchPanelRpcCommands extends WebviewNavigationRpcCommands {
  search(params: SoV2exSearchParams): SoV2exSearchResult
}

/** 搜索面板发往 Webview 的事件 */
export interface SearchPanelWebviewEvents {}
