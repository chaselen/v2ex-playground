import { homedir } from 'node:os'
import { fileTypeFromBuffer } from 'file-type'
import vscode, { Uri } from 'vscode'
import G from '@/global'
import { logger } from '@/core/logger'
import {
  cacheRemoteImageFile,
  cleanupExpiredCacheFiles,
  getExtensionFileCacheDir,
  normalizeRemoteImageSrc
} from '@/core/remoteImageCache'
import { showSavedFileNotification } from '@/features/savedFileNotification'

/** 上次分享图保存目录状态 key */
const LAST_TOPIC_SHARE_DIRECTORY_KEY = 'v2ex.topicShareImage.lastDirectory'

/** 分享图图片缓存目录名 */
const TOPIC_SHARE_IMAGE_CACHE_DIR = 'topic-share-images'

/** 分享图图片缓存保留时间 */
const TOPIC_SHARE_IMAGE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** 分享图远程图片并发加载任务 */
const pendingShareImageLoads = new Map<string, Promise<Uri>>()

/** 分享图缓存清理任务 */
let shareImageCacheCleanup: Promise<void> | undefined

/** 分享图保存参数 */
interface TopicShareImageInput {
  /** 话题 id */
  topicId: string | number
  /** PNG 图片 base64 内容 */
  base64: string
}

/** 分享图图片加载选项 */
interface LoadTopicShareImagesOptions {
  /** 返回格式 */
  format?: 'resourceUri' | 'dataUrl'
}

/** 获取分享图图片缓存目录 */
export function getTopicShareImageCacheDir() {
  return getExtensionFileCacheDir(TOPIC_SHARE_IMAGE_CACHE_DIR)
}

/** 批量加载分享图使用的远程图片 */
export async function loadTopicShareImages(
  imageSources: string[],
  webview: vscode.Webview,
  options: LoadTopicShareImagesOptions | null = {}
) {
  await cleanupTopicShareImageCache()
  const sources = Array.from(new Set(imageSources.map(source => source.trim()).filter(Boolean)))
  const entries = await Promise.all(
    sources.map(async imageSrc => {
      try {
        const normalizedSrc = normalizeRemoteImageSrc(
          new URL(imageSrc, 'https://www.v2ex.com/').toString()
        )
        if (!normalizedSrc) {
          return undefined
        }
        const imageUri = await loadTopicShareImage(normalizedSrc)
        // 默认仅返回短资源 URI，data URL 只用于 Webview 无法读取资源时的回退
        const displaySrc =
          options?.format === 'dataUrl'
            ? await readImageDataUrl(imageUri)
            : webview.asWebviewUri(imageUri).toString()
        return [imageSrc, displaySrc] as const
      } catch (err) {
        logger.warn('分享图远程图片加载失败', err, { imageSrc })
        return undefined
      }
    })
  )
  return Object.fromEntries(entries.filter(entry => entry !== undefined))
}

/** 加载单张分享图远程图片文件 */
function loadTopicShareImage(imageSrc: string) {
  const pendingLoad = pendingShareImageLoads.get(imageSrc)
  if (pendingLoad) {
    return pendingLoad
  }

  const request = cacheRemoteImageFile({
    imageSrc,
    cacheDirName: TOPIC_SHARE_IMAGE_CACHE_DIR
  })
    .then(({ uri }) => uri)
    .finally(() => {
      // Map 只合并并发请求，长期复用由磁盘缓存负责
      pendingShareImageLoads.delete(imageSrc)
    })
  pendingShareImageLoads.set(imageSrc, request)
  return request
}

/** 从缓存文件生成 data URL 回退内容 */
async function readImageDataUrl(imageUri: Uri) {
  const image = Buffer.from(await vscode.workspace.fs.readFile(imageUri))
  const fileType = await fileTypeFromBuffer(image)
  if (!fileType?.mime.startsWith('image/')) {
    throw new Error('远程内容不是有效图片')
  }
  return `data:${fileType.mime};base64,${image.toString('base64')}`
}

/** 清理过期分享图图片缓存 */
async function cleanupTopicShareImageCache() {
  shareImageCacheCleanup ||= cleanupExpiredCacheFiles(
    TOPIC_SHARE_IMAGE_CACHE_DIR,
    TOPIC_SHARE_IMAGE_CACHE_TTL_MS
  ).catch(err => {
    logger.warn('清理分享图图片缓存失败', err)
  })
  await shareImageCacheCleanup
}

/** 保存 Webview 生成的话题分享图 */
export async function saveTopicShareImage({ topicId, base64 }: TopicShareImageInput) {
  try {
    const image = decodePng(base64)
    const destination = await vscode.window.showSaveDialog({
      defaultUri: getDefaultSaveUri(`V2EX-topic-${topicId}.png`),
      filters: { PNG: ['png'] },
      saveLabel: '保存分享图'
    })
    if (!destination) {
      return
    }

    await vscode.workspace.fs.writeFile(destination, image)
    await rememberSaveDirectory(destination)
    await showSavedFileNotification(destination, '分享图已保存')
  } catch (err) {
    logger.error('保存话题分享图失败', err, { topicId })
    vscode.window.showErrorMessage(`分享图保存失败：${(err as Error).message || String(err)}`)
  }
}

/** 解码并校验 PNG base64 内容 */
function decodePng(base64: string) {
  const image = Buffer.from(base64, 'base64')
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (image.length < pngSignature.length || !image.subarray(0, 8).equals(pngSignature)) {
    throw new Error('图片数据格式不正确')
  }
  return image
}

/** 获取分享图默认保存位置 */
function getDefaultSaveUri(filename: string) {
  const savedDirectory = G.context.globalState.get<string>(LAST_TOPIC_SHARE_DIRECTORY_KEY)
  const directory = savedDirectory ? Uri.parse(savedDirectory) : Uri.file(homedir())
  return Uri.joinPath(directory, filename)
}

/** 记录分享图保存目录 */
function rememberSaveDirectory(destination: Uri) {
  const directory = Uri.joinPath(destination, '..')
  return G.context.globalState.update(LAST_TOPIC_SHARE_DIRECTORY_KEY, directory.toString())
}
