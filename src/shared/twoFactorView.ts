/**
 * 两步验证面板 Webview RPC 命令
 */
export interface TwoFactorPanelRpcCommands {
  verify(payload: { code: string }): void
  cancel(): void
}

/**
 * 两步验证面板发往 Webview 的事件
 */
export interface TwoFactorPanelWebviewEvents {}
