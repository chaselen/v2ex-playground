import { fileTypeFromBuffer } from 'file-type'
import vscode, { Uri } from 'vscode'
import {
  cacheRemoteImageFile,
  cleanupExpiredCacheFiles,
  normalizeRemoteImageSrc
} from '@/core/remoteImageCache'
import { logger } from '@/core/logger'
import G from '@/global'

/** 面板图标缓存目录名 */
const PANEL_ICON_CACHE_DIR = 'panel-icons'

/** 面板图标缓存保留天数 */
const PANEL_ICON_CACHE_TTL_DAYS = 30

/** 面板图标缓存清理周期 */
const PANEL_ICON_CACHE_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000

/**
 * 启动面板图标缓存定期清理
 */
export function startPanelIconCacheCleanup() {
  void cleanupPanelIconCache()
  const timer = setInterval(() => {
    void cleanupPanelIconCache()
  }, PANEL_ICON_CACHE_CLEANUP_INTERVAL_MS)

  return new vscode.Disposable(() => clearInterval(timer))
}

/** 清理过期的面板图标缓存 */
async function cleanupPanelIconCache() {
  try {
    await cleanupExpiredCacheFiles(
      PANEL_ICON_CACHE_DIR,
      PANEL_ICON_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000
    )
  } catch (err) {
    logger.warn('清理面板图标缓存失败', err)
  }
}

/**
 * 设置默认面板图标
 * @param panel Webview 面板
 */
export function setDefaultPanelIcon(panel: vscode.WebviewPanel) {
  panel.iconPath = Uri.joinPath(G.context.extensionUri, 'resources', 'favicon.png')
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
  panel.iconPath = await createPanelIconDataUri(iconUri)
}

/**
 * 将缓存图片转换为面板图标 data URI
 * @param cacheUri 缓存文件 URI
 */
async function createPanelIconDataUri(cacheUri: Uri): Promise<Uri> {
  const imageBuffer = Buffer.from(await vscode.workspace.fs.readFile(cacheUri))
  const fileType = await fileTypeFromBuffer(imageBuffer)
  if (!fileType?.mime.startsWith('image/')) {
    throw new Error('缓存文件不是有效的图片类型')
  }

  return Uri.parse(`data:${fileType.mime};base64,${imageBuffer.toString('base64')}`)
}

/**
 * 缓存远程面板图标
 * @param imageSrc 远程图片地址
 */
async function cacheRemotePanelIcon(imageSrc: string): Promise<Uri> {
  const cachedIcon = await cacheRemoteImageFile({
    imageSrc,
    cacheDirName: PANEL_ICON_CACHE_DIR
  })
  return cachedIcon.uri
}
