import path from 'path'
import vscode from 'vscode'
import { cacheRemoteImageFile, normalizeRemoteImageSrc } from '@/core/remoteImageCache'
import G from '@/global'

/** 面板图标缓存目录名 */
const panelIconCacheDirName = 'panel-icons'

/**
 * 设置默认面板图标
 * @param panel Webview 面板
 */
export function setDefaultPanelIcon(panel: vscode.WebviewPanel) {
  panel.iconPath = vscode.Uri.file(path.join(G.context.extensionPath, 'resources/favicon.png'))
}

/**
 * 缓存远程图片并设置为面板图标
 * @param panel Webview 面板
 * @param imageSrc 远程图片地址
 */
export async function setRemotePanelIcon(panel: vscode.WebviewPanel, imageSrc?: string) {
  const normalizedImageSrc = normalizeRemoteImageSrc(imageSrc)
  if (!normalizedImageSrc) {
    return
  }

  const iconUri = await cacheRemotePanelIcon(normalizedImageSrc)
  panel.iconPath = iconUri
}

/**
 * 缓存远程面板图标
 * @param imageSrc 远程图片地址
 */
async function cacheRemotePanelIcon(imageSrc: string): Promise<vscode.Uri> {
  const cachedIcon = await cacheRemoteImageFile({
    imageSrc,
    cacheDirName: panelIconCacheDirName
  })
  return cachedIcon.uri
}
