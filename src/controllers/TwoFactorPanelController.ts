import vscode from 'vscode'
import G from '@/global'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import { createV2exWebviewPanel } from '@/controllers/webviewPanel'
import type {
  TwoFactorPanelRpcCommands,
  TwoFactorPanelWebviewEvents,
  WebviewRpcHandlers
} from '@/shared/webview'

/** 两步验证完成回调 */
type TwoFactorResolve = (verified: boolean) => void

/** 两步验证面板控制器 */
export class TwoFactorPanelController {
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

  constructor() {
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
      this.createRpcHandlers()
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

  /**
   * 等待验证结果
   */
  wait(): Promise<boolean> {
    return this.verified
  }

  /**
   * 创建 Webview RPC 处理器
   */
  private createRpcHandlers(): WebviewRpcHandlers<TwoFactorPanelRpcCommands> {
    return {
      verify: async payload => {
        await G.V2ex.submitTwoFactorCode(payload.code)
        // 2FA 成功响应会更新 A2O，持久化前先过滤掉内部 Cookie
        await G.setCookie(G.V2ex.getLoginCookie())
        vscode.window.showInformationMessage('V2EX 两步验证成功')
        this.resolve(true)
        this.panel.dispose()
      },
      cancel: () => {
        this.resolve(false)
        this.panel.dispose()
      }
    }
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
