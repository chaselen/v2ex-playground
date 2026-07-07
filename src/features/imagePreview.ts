import vscode from 'vscode'
import {
  cacheRemoteImageFile,
  cleanupExpiredCacheFiles,
  normalizeRemoteImageSrc
} from '@/core/remoteImageCache'

/**
 * 图片预览缓存目录名
 */
const IMAGE_PREVIEW_CACHE_DIR = 'image-previews'

/**
 * 图片缓存保留天数
 */
const IMAGE_CACHE_TTL_DAYS = 7

/**
 * 规范化图片预览地址
 * @param imageSrc 图片地址
 */
function normalizeImagePreviewSrc(imageSrc: string) {
  const normalizedImageSrc = normalizeRemoteImageSrc(imageSrc)

  if (!imageSrc.trim()) {
    vscode.window.showWarningMessage('图片地址为空')
    return ''
  }
  if (!normalizedImageSrc) {
    vscode.window.showWarningMessage('仅支持预览格式正确的 http 或 https 图片')
    return ''
  }

  return normalizedImageSrc
}

/**
 * 清理过期的图片缓存文件
 */
export async function cleanupImagePreviewCache() {
  try {
    await cleanupExpiredCacheFiles(
      IMAGE_PREVIEW_CACHE_DIR,
      IMAGE_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000
    )
  } catch (err) {
    console.warn('清理图片缓存失败', err)
  }
}

/**
 * 打开图片预览
 * @param imageSrc 图片地址
 */
export async function openImagePreview(imageSrc: string) {
  const normalizedImageSrc = normalizeImagePreviewSrc(imageSrc)
  if (!normalizedImageSrc) {
    return
  }

  console.log('打开大图：', normalizedImageSrc)

  try {
    const image = await vscode.window.withProgress(
      {
        title: '正在下载图片',
        location: vscode.ProgressLocation.Notification,
        cancellable: true
      },
      async (progress, token) => {
        const abortController = new AbortController()
        token.onCancellationRequested(() => abortController.abort())

        return cacheRemoteImageFile({
          imageSrc: normalizedImageSrc,
          cacheDirName: IMAGE_PREVIEW_CACHE_DIR,
          signal: abortController.signal,
          onProgress: message => progress.report({ message })
        })
      }
    )

    await vscode.commands.executeCommand('vscode.open', image.uri)
  } catch (e: any) {
    if (e?.code === 'ERR_CANCELED') {
      return
    }

    vscode.window.showErrorMessage(`下载图片失败：${e.message}`)
  }
}
