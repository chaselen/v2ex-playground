import type vscode from 'vscode'
import Config from '@/config'
import { downloadImage } from '@/features/imageDownload'
import type {
  BrowseSettingsWebviewEvents,
  WebviewCommonRpcCommands,
  WebviewRpcController
} from '@/shared/webview'

/** Webview 公共导航依赖 */
export interface WebviewNavigationDeps {
  /** 按 URL 打开插件页面或浏览器 */
  openExternal: (path: string, title?: string) => void
  /** 打开用户面板 */
  openMember: (username: string) => void
  /** 打开话题面板 */
  openTopic: (topicId: string | number, title?: string) => void
  /** 打开节点主题标签 */
  openNode: (name: string, title?: string) => void
}

/** 可供侧栏 Provider 与面板 Controller 组合使用的公共 RPC */
export class WebviewCommonRpc implements WebviewRpcController<WebviewCommonRpcCommands> {
  /**
   * @param navigation Webview 公共导航依赖
   */
  constructor(private readonly navigation: WebviewNavigationDeps) {}

  /** 获取当前浏览设置 */
  rpc_getBrowseSettings() {
    return Config.getBrowseSettings()
  }

  /** 绑定浏览设置推送，订阅随对应视图销毁释放 */
  bindBrowseSettings(
    view: Pick<vscode.WebviewPanel | vscode.WebviewView, 'onDidDispose'>,
    rpc: {
      post(
        command: 'browseSettingsChanged',
        data: BrowseSettingsWebviewEvents['browseSettingsChanged']
      ): void
    }
  ): void {
    const subscription = Config.onDidChange(() => {
      rpc.post('browseSettingsChanged', { settings: Config.getBrowseSettings() })
    })
    view.onDidDispose(() => subscription.dispose())
  }

  /** 优先打开插件支持的站内页面，其余链接交给浏览器 */
  rpc_openExternal(path: string, title?: string) {
    this.navigation.openExternal(path, title)
  }

  /** 打开话题面板 */
  rpc_openTopic(topicId: string | number, title?: string) {
    this.navigation.openTopic(topicId, title)
  }

  /** 打开用户面板 */
  rpc_openMember(username: string) {
    this.navigation.openMember(username)
  }

  /** 打开节点主题标签 */
  rpc_openNode(name: string, title?: string) {
    this.navigation.openNode(name, title)
  }

  /** 下载远程图片 */
  rpc_downloadImage(imageSrc: string) {
    void downloadImage(imageSrc)
  }
}
