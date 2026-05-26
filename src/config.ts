import vscode from 'vscode'

/**
 * 获取配置
 */
export default class Config {
  /** 是否在新标签页打开 */
  static openInNewTab(): boolean {
    return vscode.workspace.getConfiguration().get<boolean>('v2ex.browse.openInNewTab', true)
  }

  /** 代理url */
  static proxyUrl(): string {
    return vscode.workspace.getConfiguration().get<string>('v2ex.browse.proxyUrl', '')
  }

  /** 是否自动签到 */
  static autoSignIn(): boolean {
    return vscode.workspace.getConfiguration().get<boolean>('v2ex.browse.autoSignIn', true)
  }

  /** 查看帖子时是否显示图片 */
  static showImagesInTopic(): boolean {
    return vscode.workspace.getConfiguration().get<boolean>('v2ex.browse.showImagesInTopic', true)
  }
}
