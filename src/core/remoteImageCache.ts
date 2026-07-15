import crypto from 'node:crypto'
import path from 'node:path'
import { fileTypeFromBuffer } from 'file-type'
import vscode from 'vscode'
import http from '@/core/http'
import G from '@/global'

/** 远程图片缓存参数 */
interface CacheRemoteImageFileOptions {
  /** 远程图片地址 */
  imageSrc: string
  /** 缓存子目录名 */
  cacheDirName: string
  /** 下载取消信号 */
  signal?: AbortSignal
  /** 缓存进度回调 */
  onProgress?: (message: string) => void
}

/** 已缓存的远程图片 */
interface CachedRemoteImageFile {
  /** 缓存文件地址 */
  uri: vscode.Uri
  /** 是否命中已有缓存 */
  cached: boolean
}

/**
 * 获取扩展文件缓存目录
 * @param cacheDirName 缓存子目录名
 */
export function getExtensionFileCacheDir(cacheDirName: string) {
  return vscode.Uri.file(path.join(G.context.globalStorageUri.fsPath, cacheDirName))
}

/**
 * 规范化 http 图片地址
 * @param imageSrc 图片地址
 */
export function normalizeRemoteImageSrc(imageSrc?: string) {
  if (!imageSrc?.trim()) {
    return ''
  }

  try {
    const url = new URL(imageSrc)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

/**
 * 缓存远程图片文件
 * @param options 缓存参数
 */
export async function cacheRemoteImageFile(
  options: CacheRemoteImageFileOptions
): Promise<CachedRemoteImageFile> {
  const cacheDirUri = getExtensionFileCacheDir(options.cacheDirName)
  const cacheKey = createImageCacheKey(options.imageSrc)

  await vscode.workspace.fs.createDirectory(cacheDirUri)

  const cachedImageUri = await findCachedImageFile(cacheDirUri, cacheKey)
  if (cachedImageUri) {
    return { uri: cachedImageUri, cached: true }
  }

  options.onProgress?.('请求图片')
  const res = await http.get(options.imageSrc, {
    responseType: 'arraybuffer',
    signal: options.signal
  })
  const imageBuffer = Buffer.from(res.data)

  options.onProgress?.('识别图片类型')
  const fileType = await fileTypeFromBuffer(imageBuffer)
  if (!fileType) {
    throw new Error('获取文件类型失败')
  }
  if (!fileType.mime.startsWith('image/')) {
    throw new Error(`不是有效的图片类型：${fileType.mime}`)
  }

  const imageUri = vscode.Uri.joinPath(cacheDirUri, `${cacheKey}.${fileType.ext}`)
  await vscode.workspace.fs.writeFile(imageUri, imageBuffer)
  return { uri: imageUri, cached: false }
}

/**
 * 删除扩展文件缓存目录
 * @param cacheDirName 缓存子目录名
 */
export async function deleteExtensionFileCacheDir(cacheDirName: string) {
  const cacheDirUri = getExtensionFileCacheDir(cacheDirName)

  try {
    await vscode.workspace.fs.delete(cacheDirUri, { recursive: true })
  } catch (err) {
    if (isFileNotFoundError(err)) {
      return
    }

    throw err
  }
}

/**
 * 查找已缓存的图片文件
 * @param cacheDirUri 缓存目录
 * @param cacheKey 缓存 key
 */
async function findCachedImageFile(cacheDirUri: vscode.Uri, cacheKey: string) {
  try {
    const entries = await vscode.workspace.fs.readDirectory(cacheDirUri)
    const cachedFile = entries.find(([fileName, fileType]) => {
      return fileType === vscode.FileType.File && fileName.startsWith(`${cacheKey}.`)
    })
    return cachedFile ? vscode.Uri.joinPath(cacheDirUri, cachedFile[0]) : undefined
  } catch (err) {
    if (isFileNotFoundError(err)) {
      return undefined
    }

    throw err
  }
}

/**
 * 创建图片缓存 key
 * @param imageSrc 图片地址
 */
function createImageCacheKey(imageSrc: string) {
  return crypto.createHash('sha256').update(imageSrc).digest('hex')
}

/**
 * 判断是否为文件不存在错误
 * @param err 错误对象
 */
function isFileNotFoundError(err: unknown) {
  if (err instanceof vscode.FileSystemError && err.code === 'FileNotFound') {
    return true
  }

  // Cursor 的文件系统实现可能直接透传 Node.js ENOENT 错误
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err.code === 'FileNotFound' || err.code === 'ENOENT')
  )
}
