import { homedir } from 'node:os'
import { fileTypeFromBuffer } from 'file-type'
import vscode, { Uri } from 'vscode'
import http from '@/core/http'
import { logger } from '@/core/logger'
import { normalizeRemoteImageSrc } from '@/core/remoteImageCache'
import G from '@/global'
import { showSavedFileNotification } from '@/features/savedFileNotification'

/** 上次图片保存目录状态 key */
const LAST_IMAGE_DOWNLOAD_DIRECTORY_KEY = 'v2ex.imageDownload.lastDirectory'

/** 已下载图片 */
interface DownloadedImage {
  /** 图片内容 */
  data: Uint8Array
  /** 图片扩展名 */
  extension: string
}

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
    const image = await fetchImage(normalizedSrc)
    const filename = createImageFilename(normalizedSrc, image.extension)
    const defaultUri = getDefaultSaveUri(filename)
    const destination = await vscode.window.showSaveDialog({
      ...(defaultUri ? { defaultUri } : {}),
      filters: {
        图片: [image.extension]
      },
      saveLabel: '保存图片'
    })
    if (!destination) {
      return
    }

    await vscode.workspace.fs.writeFile(destination, image.data)
    try {
      await rememberSaveDirectory(destination)
    } catch (err) {
      logger.warn('记录图片保存目录失败', err)
    }
    await showSavedFileNotification(destination, '图片已保存')
  } catch (err) {
    if (isCanceledError(err)) {
      return
    }

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

/**
 * 请求并校验远程图片
 * @param imageSrc 图片地址
 */
async function fetchImage(imageSrc: string): Promise<DownloadedImage> {
  return vscode.window.withProgress(
    {
      title: '正在下载图片',
      location: vscode.ProgressLocation.Notification,
      cancellable: true
    },
    async (_, token) => {
      const abortController = new AbortController()
      const cancellation = token.onCancellationRequested(() => abortController.abort())

      try {
        const response = await http.get(imageSrc, {
          responseType: 'arraybuffer',
          signal: abortController.signal
        })
        const imageBuffer = Buffer.from(response.data)
        const fileType = await fileTypeFromBuffer(imageBuffer)
        if (!fileType?.mime.startsWith('image/')) {
          throw new Error('远程内容不是有效图片')
        }

        return {
          data: imageBuffer,
          extension: fileType.ext
        }
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

/** 判断是否是用户取消下载产生的错误 */
function isCanceledError(error: unknown) {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ERR_CANCELED'
  )
}
