import type { WebviewRpcController } from './webviewRpc'
import type { BrowseSettings } from './browseSettings'

/**
 * Webview 公共 RPC 命令
 */
export interface WebviewCommonRpcCommands extends BrowseSettingsRpcCommands {
  /** 按 URL 打开插件页面或浏览器，title 用于面板标题 */
  openExternal(path: string, title?: string): void
  openTopic(topicId: string | number, title?: string): void
  openMember(username: string): void
  openNode(name: string, title?: string): void
  /** 下载远程图片 */
  downloadImage(imageSrc: string): void
}

/**
 * 有状态 Webview 的初始化 RPC 命令
 */
export interface WebviewStateRpcCommands<State> {
  /** 获取当前视图状态 */
  ready(): State
}

/** 浏览设置命令 */
export interface BrowseSettingsRpcCommands {
  /** 获取当前浏览设置 */
  getBrowseSettings(): BrowseSettings
}

/** 浏览设置事件 */
export interface BrowseSettingsWebviewEvents {
  browseSettingsChanged: { settings: BrowseSettings }
}

/** 页面自身实现的 RPC，不包含由公共处理器提供的命令 */
export type WebviewPageRpcController<Commands> = WebviewRpcController<
  Omit<Commands, keyof WebviewCommonRpcCommands>
>
