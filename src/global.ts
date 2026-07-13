import { normalizeLoginCookie, type V2exClient } from '@/v2ex'
import { ExtensionContext, Webview, Uri } from 'vscode'

export default class G {
  /** 插件上下文，在插件激活时赋值 */
  static context: ExtensionContext
  /** V2EX API 客户端，在插件激活时赋值 */
  static V2ex: V2exClient

  /**
   * 获取WebView的上下文地址
   * @param webview webview
   */
  static getWebViewContextPath(webview: Webview): string {
    return webview.asWebviewUri(Uri.file(this.context.extensionPath)).toString()
  }

  /**
   * 设置cookie
   * @param cookie cookie
   */
  static async setCookie(cookie: string) {
    const loginCookie = normalizeLoginCookie(cookie)
    this.V2ex?.setCookie(loginCookie)
    await this.context.globalState.update('cookie', loginCookie)
  }

  /** 清除持久化 Cookie，运行时会话由调用方负责清理 */
  static async clearPersistedCookie() {
    await this.context.globalState.update('cookie', '')
  }

  /**
   * 获取cookie
   */
  static getCookie(): string | undefined {
    return this.context.globalState.get('cookie')
  }
}
