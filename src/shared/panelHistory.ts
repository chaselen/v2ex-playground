/** 位置相同的历史条目在每次激活时仍获得独立的 RPC 作用域 */
export interface PanelHistoryState {
  entryId: number
  activationId: number
  /** 当前导航目标的原站地址 */
  url: string
  canGoBack: boolean
  canGoForward: boolean
}

export interface PanelHistoryRpcCommands {
  historyReady(): PanelHistoryState
  traverseHistory(activationId: number, direction: 'back' | 'forward'): void
}

export interface PanelHistoryWebviewEvents {
  panelHistoryChanged: { state: PanelHistoryState }
}

/** 第一页使用不带参数的地址，避免 ?p=1 与省略页码成为两条历史 */
export function getPanelPageUrl(url: string, page: number): string {
  return page > 1 ? `${url}?p=${page}` : url
}
