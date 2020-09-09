import { ExtensionContext } from 'vscode';

export default class G {
  static context: ExtensionContext | undefined;

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
