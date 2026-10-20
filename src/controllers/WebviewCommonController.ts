import { openWebviewUrl } from '@/features/webviewNavigation'
import { downloadImage } from '@/features/imageDownload'
import type { WebviewCommonRpcCommands, WebviewRpcController } from '@/shared/webview'

/** Webview 公共导航依赖 */
export interface WebviewNavigationDeps {
  /** 打开用户面板 */
  openMember: (username: string) => void
  /** 打开话题面板 */
  openTopic: (topicId: string | number, title?: string) => void
  /** 打开节点主题标签 */
  openNode: (name: string, title?: string) => void
}

/** 提供 Webview 公共 RPC 的控制器 */
export abstract class WebviewCommonController<
  Deps extends WebviewNavigationDeps = WebviewNavigationDeps
> implements WebviewRpcController<WebviewCommonRpcCommands> {
  /**
   * @param navigation Webview 公共导航依赖
   */
  constructor(protected readonly navigation: Deps) {}

  /** 优先打开插件支持的站内页面，其余链接交给浏览器 */
  rpc_openExternal(path: string, title?: string) {
    openWebviewUrl(path, title)
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
