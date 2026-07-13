import type { AuthSessionManager } from '@/features/authSession'
import type { V2exClient } from '@/v2ex'
import { ExtensionContext, Webview, Uri } from 'vscode'

export default class G {
  /** 插件上下文，在插件激活时赋值 */
  static context: ExtensionContext
  /** V2EX API 客户端，在插件激活时赋值 */
  static V2ex: V2exClient
  /** 认证会话管理器，在插件激活时赋值 */
  static authSession: AuthSessionManager

  /**
   * 获取WebView的上下文地址
   * @param webview webview
   */
  static getWebViewContextPath(webview: Webview): string {
    return webview.asWebviewUri(Uri.file(this.context.extensionPath)).toString()
  }
}
