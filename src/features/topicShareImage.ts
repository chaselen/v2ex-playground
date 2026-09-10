import { homedir } from 'node:os'
import { isIP } from 'node:net'
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

/** 单张分享图允许缓存的最大字节数 */
const TOPIC_SHARE_IMAGE_MAX_BYTES = 10 * 1024 * 1024

/** 分享图远程图片最大并发下载数 */
const TOPIC_SHARE_IMAGE_CONCURRENCY = 12

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
  const entries = await loadTopicShareImageEntries(sources, webview, options)
  return Object.fromEntries(entries.filter(entry => entry !== undefined))
}

/**
 * 使用滑动并发池加载分享图片
 * @param imageSources 去重后的图片地址
 * @param webview 当前 Webview
 * @param options 图片返回格式
 */
async function loadTopicShareImageEntries(
  imageSources: string[],
  webview: vscode.Webview,
  options: LoadTopicShareImagesOptions | null
) {
  /** 按输入顺序保存每张图片的加载结果 */
  const entries: Array<readonly [string, string] | undefined> = new Array(imageSources.length)
  /** 下一个待领取的图片任务下标 */
  let nextIndex = 0

  /** 持续领取下一个图片任务，直到队列耗尽 */
  async function runWorker() {
    while (nextIndex < imageSources.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      entries[currentIndex] = await loadTopicShareImageEntry(
        imageSources[currentIndex],
        webview,
        options
      )
    }
  }

  /** 实际启动的并发工作数量 */
  const workerCount = Math.min(TOPIC_SHARE_IMAGE_CONCURRENCY, imageSources.length)
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
  return entries
}

/**
 * 加载单张分享图并转换为 Webview 可用地址
 * @param imageSrc 原始图片地址
 * @param webview 当前 Webview
 * @param options 图片返回格式
 */
async function loadTopicShareImageEntry(
  imageSrc: string,
  webview: vscode.Webview,
  options: LoadTopicShareImagesOptions | null
) {
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
}

/** 加载单张分享图远程图片文件 */
function loadTopicShareImage(imageSrc: string) {
  const pendingLoad = pendingShareImageLoads.get(imageSrc)
  if (pendingLoad) {
    return pendingLoad
  }

  const request = cacheRemoteImageFile({
    imageSrc,
    cacheDirName: TOPIC_SHARE_IMAGE_CACHE_DIR,
    maxBytes: TOPIC_SHARE_IMAGE_MAX_BYTES,
    validateUrl: validateTopicShareImageUrl
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

/**
 * 校验分享图远程地址，避免访问本机或内网资源
 * @param imageSrc 待校验的图片地址
 */
function validateTopicShareImageUrl(imageSrc: string) {
  let url: URL
  try {
    url = new URL(imageSrc)
  } catch {
    throw new Error('分享图片地址无效')
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('分享图片地址不安全')
  }

  const hostname = url.hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase()
  if (isBlockedRemoteHostname(hostname) || isPrivateIpAddress(hostname)) {
    throw new Error('分享图片地址不安全')
  }
}

/**
 * 判断是否为不应访问的特殊主机名
 * @param hostname 主机名
 */
function isBlockedRemoteHostname(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  )
}

/**
 * 判断 IPv4 或 IPv6 地址是否指向本机、内网或保留网段
 * @param address 待判断的 IP 地址
 */
function isPrivateIpAddress(address: string): boolean {
  const normalizedAddress = address.replace(/^\[|\]$/g, '').toLowerCase()
  const version = isIP(normalizedAddress)
  if (version === 4) {
    const octets = normalizedAddress.split('.').map(Number)
    const [first, second] = octets
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 0) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19)) ||
      first >= 224
    )
  }

  if (version !== 6) {
    return false
  }

  const hextets = parseIpv6Hextets(normalizedAddress)
  if (!hextets) {
    return false
  }
  const isAllZero = hextets.every(hextet => hextet === 0)
  const isLoopback =
    isAllZero || (hextets.slice(0, 7).every(hextet => hextet === 0) && hextets[7] === 1)
  const firstHextet = hextets[0]
  const isUniqueLocal = (firstHextet & 0xfe00) === 0xfc00
  const isLinkLocal = (firstHextet & 0xffc0) === 0xfe80
  const isMulticast = (firstHextet & 0xff00) === 0xff00
  const isIpv4Mapped = hextets.slice(0, 5).every(hextet => hextet === 0) && hextets[5] === 0xffff

  return (
    isLoopback ||
    isUniqueLocal ||
    isLinkLocal ||
    isMulticast ||
    (isIpv4Mapped && isPrivateIpAddress(toIpv4Address(hextets.slice(6))))
  )
}

/**
 * 将 IPv6 地址解析为八段十六进制数字
 * @param address IPv6 地址
 */
function parseIpv6Hextets(address: string): number[] | undefined {
  const sections = address.split('::')
  if (sections.length > 2) {
    return undefined
  }

  const parseSection = (section: string) => {
    if (!section) {
      return []
    }
    const parts = section.split(':')
    const hextets: number[] = []
    for (const part of parts) {
      if (part.includes('.')) {
        const octets = part.split('.').map(Number)
        if (
          octets.length !== 4 ||
          octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)
        ) {
          return undefined
        }
        hextets.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3])
        continue
      }
      if (!/^[0-9a-f]{1,4}$/i.test(part)) {
        return undefined
      }
      hextets.push(parseInt(part, 16))
    }
    return hextets
  }

  const left = parseSection(sections[0])
  const right = sections.length === 2 ? parseSection(sections[1]) : []
  if (!left || !right) {
    return undefined
  }
  if (sections.length === 1) {
    return left.length === 8 ? left : undefined
  }
  const missing = 8 - left.length - right.length
  return missing > 0 ? [...left, ...Array.from({ length: missing }, () => 0), ...right] : undefined
}

/**
 * 将两个 IPv6 末段转换为 IPv4 地址
 * @param hextets IPv6 末两段
 */
function toIpv4Address(hextets: number[]) {
  return hextets.flatMap(hextet => [hextet >> 8, hextet & 0xff]).join('.')
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
