import { homedir } from 'node:os'
import { extname } from 'node:path'
import vscode, { Uri } from 'vscode'
import { logger } from '@/core/logger'
import { normalizeRemoteImageSrc } from '@/core/remoteImageCache'
import G from '@/global'
import { loadImageFileForDownload } from '@/features/topicShareImage'
import { showSavedFileNotification } from '@/features/savedFileNotification'

/** 上次图片保存目录状态 key */
const LAST_IMAGE_DOWNLOAD_DIRECTORY_KEY = 'v2ex.imageDownload.lastDirectory'

/**
 * 下载远程图片并保存到用户选择的位置
 * @param imageSrc 远程图片地址
 */
export async function downloadImage(imageSrc: string) {
  const normalizedSrc = normalizeRemoteImageSrc(imageSrc)
  if (!normalizedSrc) {
    vscode.window.showWarningMessage('仅支持下载格式正确的 http 或 https 图片')
    return
  }

  try {
    const image = await prepareImage(normalizedSrc)
    if (!image) return
    const extension = extname(image.path).slice(1)
    const filename = createImageFilename(normalizedSrc, extension)
    const defaultUri = getDefaultSaveUri(filename)
    const destination = await vscode.window.showSaveDialog({
      ...(defaultUri ? { defaultUri } : {}),
      filters: {
        图片: [extension]
      },
      saveLabel: '保存图片'
    })
    if (!destination) {
      return
    }

    await vscode.workspace.fs.copy(image, destination, { overwrite: true })
    try {
      await rememberSaveDirectory(destination)
    } catch (err) {
      logger.warn('记录图片保存目录失败', err)
    }
    await showSavedFileNotification(destination, '图片已保存')
  } catch (err) {
    logger.error('图片下载失败', err, { target: normalizedSrc })
    const message = err instanceof Error ? err.message : String(err)
    vscode.window.showErrorMessage(`图片下载失败：${message}`)
  }
}

/**
 * 使用上次保存目录或用户目录生成默认文件 URI
 * @param filename 建议文件名
 */
function getDefaultSaveUri(filename: string) {
  try {
    const savedDirectory = G.context.globalState.get<string>(LAST_IMAGE_DOWNLOAD_DIRECTORY_KEY)
    const directory = savedDirectory ? Uri.parse(savedDirectory) : Uri.file(homedir())
    return Uri.joinPath(directory, filename)
  } catch {
    return undefined
  }
}

/**
 * 记录本次保存目录
 * @param destination 已保存文件 URI
 */
function rememberSaveDirectory(destination: Uri) {
  const directory = Uri.joinPath(destination, '..')
  return G.context.globalState.update(LAST_IMAGE_DOWNLOAD_DIRECTORY_KEY, directory.toString())
}

/** 在网络传输阶段报告实际字节进度，缓存命中时直接返回文件 */
async function prepareImage(imageSrc: string): Promise<Uri | undefined> {
  return vscode.window.withProgress(
    {
      title: '正在准备保存图片',
      location: vscode.ProgressLocation.Notification,
      cancellable: true
    },
    async (progress, token) => {
      const controller = new AbortController()
      const cancellation = token.onCancellationRequested(() => controller.abort())
      if (token.isCancellationRequested) controller.abort()
      let reportedPercent = 0
      try {
        return await loadImageFileForDownload(imageSrc, {
          signal: controller.signal,
          onDownloadProgress: ({ loaded, total }) => {
            if (!total || total <= 0) {
              progress.report({ message: `已接收 ${loaded.toLocaleString()} 字节` })
              return
            }
            const percent = Math.min(100, Math.floor((loaded / total) * 100))
            progress.report({ message: `${percent}%`, increment: percent - reportedPercent })
            reportedPercent = percent
          }
        })
      } catch (error) {
        if (controller.signal.aborted) return undefined
        throw error
      } finally {
        cancellation.dispose()
      }
    }
  )
}

/**
 * 根据图片地址和真实类型生成下载文件名
 * @param imageSrc 图片地址
 * @param extension 图片扩展名
 */
function createImageFilename(imageSrc: string, extension: string) {
  let sourceName = ''
  try {
    sourceName = decodeURIComponent(new URL(imageSrc).pathname.split('/').pop() || '')
  } catch {
    // 无法解码路径时使用默认文件名
  }

  const safeName = sourceName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim()
  const baseName = safeName.replace(/\.[^.]+$/, '') || 'image'
  return `${baseName.slice(0, 120)}.${extension}`
}
