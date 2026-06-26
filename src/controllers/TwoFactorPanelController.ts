import path from 'path'
import vscode from 'vscode'
import G from '@/global'
import { renderWebviewHtml } from '@/core/webviewHtml'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
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
    this.panel = createPanel()
    this.panel.webview.html = renderWebviewHtml(this.panel.webview, 'two-factor.html')
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

/** 创建两步验证 Webview 面板 */
function createPanel(): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'v2ex.twoFactor',
    '两步验证',
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(G.context.extensionPath, 'html')),
        vscode.Uri.file(path.join(G.context.extensionPath, 'resources'))
      ]
    }
  )
  panel.iconPath = vscode.Uri.file(path.join(G.context.extensionPath, 'resources/favicon.png'))
  return panel
}
