import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { fileTypeFromBuffer } from 'file-type'
import vscode from 'vscode'
import http from '@/core/http'
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
  const cacheDir = path.join(G.context.globalStorageUri.fsPath, panelIconCacheDirName)
  await fs.mkdir(cacheDir, { recursive: true })

  const cacheKey = crypto.createHash('sha256').update(imageSrc).digest('hex')
  const cachedIcon = await findCachedPanelIcon(cacheDir, cacheKey)
  if (cachedIcon) {
    return vscode.Uri.file(cachedIcon)
  }

  const res = await http.get(imageSrc, { responseType: 'arraybuffer' })
  const buffer = Buffer.from(res.data)
  const fileType = await fileTypeFromBuffer(buffer)
  if (!fileType?.mime.startsWith('image/')) {
    throw new Error('面板图标不是有效图片')
  }

  const iconPath = path.join(cacheDir, `${cacheKey}.${fileType.ext}`)
  await fs.writeFile(iconPath, buffer)
  return vscode.Uri.file(iconPath)
}

/**
 * 查找已缓存的面板图标
 * @param cacheDir 缓存目录
 * @param cacheKey 缓存 key
 */
async function findCachedPanelIcon(
  cacheDir: string,
  cacheKey: string
): Promise<string | undefined> {
  try {
    const entries = await fs.readdir(cacheDir)
    const cachedFile = entries.find(entry => entry.startsWith(`${cacheKey}.`))
    return cachedFile ? path.join(cacheDir, cachedFile) : undefined
  } catch {
    return undefined
  }
}

/**
 * 归一化远程图片地址
 * @param imageSrc 图片地址
 */
function normalizeRemoteImageSrc(imageSrc?: string): string {
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
