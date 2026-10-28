import type { Node, SoV2exSearchParams, SoV2exSearchResult } from '../v2ex/types'
import type { WebviewCommonRpcCommands } from './commonView'
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
export interface SearchPanelRpcCommands extends WebviewCommonRpcCommands {
  /** 获取搜索节点列表 */
  getNodes(): Node[]
  search(params: SoV2exSearchParams): SoV2exSearchResult
}

/** 搜索面板发往 Webview 的事件 */
export interface SearchPanelWebviewEvents {}
