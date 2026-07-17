import { openExternal } from '@/features/openExternal'
import { downloadImage } from '@/features/imageDownload'
import type {
  OpenNodePayload,
  OpenTopicPayload,
  WebviewCommonRpcCommands,
  WebviewRpcController
} from '@/shared/webview'

/** Webview 公共导航依赖 */
export interface WebviewNavigationDeps {
  /** 打开用户面板 */
  openMember: (username: string) => void
  /** 打开话题面板 */
  openTopic: (topic: OpenTopicPayload) => void
  /** 打开节点主题标签 */
  openNode: (node: OpenNodePayload) => void
}

/** 提供 Webview 公共 RPC 的控制器 */
export abstract class WebviewCommonController<
  Deps extends WebviewNavigationDeps = WebviewNavigationDeps
> implements WebviewRpcController<WebviewCommonRpcCommands> {
  /**
   * @param navigation Webview 公共导航依赖
   */
  constructor(protected readonly navigation: Deps) {}

  /** 打开外部链接 */
  rpc_openExternal(path: string) {
    openExternal(path)
  }

  /** 打开话题面板 */
  rpc_openTopic(payload: OpenTopicPayload) {
    this.navigation.openTopic(payload)
  }

  /** 打开用户面板 */
  rpc_openMember(username: string) {
    this.navigation.openMember(username)
  }

  /** 打开节点主题标签 */
  rpc_openNode(payload: OpenNodePayload) {
    this.navigation.openNode(payload)
  }

  /** 下载远程图片 */
  rpc_downloadImage(imageSrc: string) {
    void downloadImage(imageSrc)
  }
}
