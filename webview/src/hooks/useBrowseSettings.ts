import { useSyncExternalStore } from 'react'
import type {
  BrowseSettings,
  BrowseSettingsRpcCommands,
  BrowseSettingsWebviewEvents
} from '@extension/shared/webview'
import { createVsCodeClient, subscribeWebviewState } from '@/core/vscode'

const vscode = createVsCodeClient<BrowseSettingsRpcCommands, BrowseSettingsWebviewEvents>()
// 读取设置前暂不加载远程图片和头像
const initialSettings: BrowseSettings = {
  openInNewTab: true,
  autoSignIn: true,
  showImagesInTopic: false,
  showAvatar: false
}
let settings = initialSettings
const listeners = new Set<() => void>()
let disposeSubscription: (() => void) | undefined

/** 共用设置订阅，避免每个组件重复读取配置 */
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!disposeSubscription) {
    disposeSubscription = subscribeWebviewState(
      handler => vscode.on('browseSettingsChanged', event => handler(event.settings)),
      () => vscode.getBrowseSettings(),
      value => {
        settings = value
        listeners.forEach(notify => notify())
      }
    )
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      disposeSubscription?.()
      disposeSubscription = undefined
      settings = initialSettings
    }
  }
}

/** 读取并实时同步浏览设置，同一 Webview 内共用订阅 */
export function useBrowseSettings() {
  return useSyncExternalStore(subscribe, () => settings)
}
