import vscode from 'vscode'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { createV2exWebviewPanel } from '@/controllers/webviewPanel'
import type {
  TwoFactorPanelRpcCommands,
  TwoFactorPanelWebviewEvents,
  WebviewRpcController
} from '@/shared/webview'

/** 两步验证完成回调 */
type TwoFactorResolve = (verified: boolean) => void

/** 两步验证面板选项 */
export interface TwoFactorPanelControllerOptions {
  /** 提交验证码 */
  verify(code: string): Promise<void>
}

/** 两步验证面板控制器 */
export class TwoFactorPanelController implements WebviewRpcController<TwoFactorPanelRpcCommands> {
  /** 两步验证面板 */
  private readonly panel: vscode.WebviewPanel

  /** Webview RPC 桥接器 */
  private readonly rpc: WebviewRpcBridge<TwoFactorPanelRpcCommands, TwoFactorPanelWebviewEvents>

  /** 验证完成 Promise */
  private readonly verified: Promise<boolean>

  /** Promise 完成回调 */
  private resolveVerified: TwoFactorResolve = () => undefined

  /** 是否已完成验证流程 */
  private settled = false

  /**
   * @param options 两步验证操作
   */
  constructor(private readonly options: TwoFactorPanelControllerOptions) {
    this.panel = createV2exWebviewPanel({
      viewType: 'v2ex.twoFactor',
      title: '两步验证',
      htmlEntry: 'two-factor.html',
      retainContextWhenHidden: true,
      resourceIcon: 'panelTwoFactor.svg'
    })
    this.verified = new Promise(resolve => {
      this.resolveVerified = resolve
    })
    this.rpc = new WebviewRpcBridge<TwoFactorPanelRpcCommands, TwoFactorPanelWebviewEvents>(
      this.panel.webview,
      this
    )
    this.panel.onDidDispose(() => {
      this.rpc.dispose()
      this.resolve(false)
    })
  }

  /** 激活当前面板 */
  reveal() {
    this.panel.reveal()
  }

  /** 关闭两步验证面板 */
  dispose(): void {
    this.panel.dispose()
  }

  /**
   * 等待验证结果
   */
  wait(): Promise<boolean> {
    return this.verified
  }

  /** 提交两步验证码 */
  async rpc_verify(payload: { code: string }) {
    await this.options.verify(payload.code)
    vscode.window.showInformationMessage('V2EX 两步验证成功')
    this.resolve(true)
    this.panel.dispose()
  }

  /** 取消两步验证 */
  rpc_cancel() {
    this.resolve(false)
    this.panel.dispose()
  }

  /**
   * 完成验证流程
   * @param verified 是否验证成功
   */
  private resolve(verified: boolean) {
    if (this.settled) {
      return
    }
    this.settled = true
    this.resolveVerified(verified)
  }
}
