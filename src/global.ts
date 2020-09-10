import { ExtensionContext, Webview, Uri, WebviewPanel } from 'vscode';

export default class G {
  static context: ExtensionContext | undefined;

  /**
   * 获取WebView的上下文地址
   * @param webview webview
   */
  static getWebViewContextPath(webview: Webview): string {
    return webview.asWebviewUri(Uri.file(this.context!.extensionPath)).toString();
  }

  /**
   * 设置cookie
   * @param cookie cookie
   */
  static async setCookie(cookie: string) {
    await this.context?.globalState.update('cookie', cookie);
  }

  /**
   * 获取cookie
   */
  static getCookie(): string | undefined {
    return this.context?.globalState.get('cookie');
  }
}
