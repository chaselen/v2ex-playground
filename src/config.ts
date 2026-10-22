import vscode from 'vscode'

import type { BrowseSettings } from '@/shared/browseSettings'

/**
 * 获取配置
 */
export default class Config {
  /** 监听浏览设置的变化，调用方负责在视图销毁时释放 */
  static onDidChange(listener: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('v2ex.browse')) {
        listener()
      }
    })
  }

  /** 获取发往 Webview 的完整浏览设置快照 */
  static getBrowseSettings(): BrowseSettings {
    return {
      openInNewTab: this.openInNewTab(),
      autoSignIn: this.autoSignIn(),
      showImagesInTopic: this.showImagesInTopic(),
      showAvatar: this.showAvatar()
    }
  }

  /** 是否在新标签页打开 */
  static openInNewTab(): boolean {
    return vscode.workspace.getConfiguration().get<boolean>('v2ex.browse.openInNewTab', true)
  }

  /** 是否自动签到 */
  static autoSignIn(): boolean {
    return vscode.workspace.getConfiguration().get<boolean>('v2ex.browse.autoSignIn', true)
  }

  /** 查看帖子时是否显示图片 */
  static showImagesInTopic(): boolean {
    return vscode.workspace.getConfiguration().get<boolean>('v2ex.browse.showImagesInTopic', true)
  }

  /** 查看帖子时是否显示头像 */
  static showAvatar(): boolean {
    return vscode.workspace.getConfiguration().get<boolean>('v2ex.browse.showAvatar', true)
  }
}
