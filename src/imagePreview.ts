import vscode from 'vscode'
import os from 'node:os'
import path from 'path'
import crypto from 'node:crypto'
import http from './http'

/**
 * 图片临时文件目录名
 */
const IMAGE_PREVIEW_DIR = 'v2ex-playground-images'

/**
 * 图片缓存保留天数
 */
const IMAGE_CACHE_TTL_DAYS = 7

/**
 * 获取图片缓存目录
 */
function getImagePreviewDir() {
  return path.join(os.tmpdir(), IMAGE_PREVIEW_DIR)
}

/**
 * 检查文件是否存在
 * @param uri 文件 uri
 */
async function fileExists(uri: vscode.Uri) {
  try {
    await vscode.workspace.fs.stat(uri)
    return true
  } catch {
    return false
  }
}

/**
 * 清理过期的图片缓存文件
 */
export async function cleanupImagePreviewCache() {
  const imageDir = getImagePreviewDir()
  const imageDirUri = vscode.Uri.file(imageDir)
  const expireBefore = Date.now() - IMAGE_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000

  try {
    if (!(await fileExists(imageDirUri))) {
      return
    }

    const cacheFiles = await vscode.workspace.fs.readDirectory(imageDirUri)
    await Promise.all(
      cacheFiles.map(async ([fileName, fileType]) => {
        if (fileType !== vscode.FileType.File) {
          return
        }

        const fileUri = vscode.Uri.file(path.join(imageDir, fileName))
        const stat = await vscode.workspace.fs.stat(fileUri)
        if (stat.mtime < expireBefore) {
          await vscode.workspace.fs.delete(fileUri)
        }
      })
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
  console.log('打开大图：', imageSrc)

  try {
    /**
     * VS Code 内置图片预览更适合这个场景
     * 这里将远程图片落到临时文件，再交给 vscode.open 打开
     */
    const imageDir = getImagePreviewDir()
    const imageHash = crypto.createHash('sha1').update(imageSrc).digest('hex')
    const imageDirUri = vscode.Uri.file(imageDir)

    await vscode.workspace.fs.createDirectory(imageDirUri)

    /**
     * 优先复用已下载的图片缓存
     * 文件名以图片 url 的哈希作为前缀，因此同一张图只会命中一个缓存文件
     */
    const cacheFiles = await vscode.workspace.fs.readDirectory(imageDirUri)
    const cachedFile = cacheFiles.find(([fileName, fileType]) => {
      return fileType === vscode.FileType.File && fileName.startsWith(`${imageHash}.`)
    })

    if (cachedFile) {
      await vscode.commands.executeCommand(
        'vscode.open',
        vscode.Uri.file(path.join(imageDir, cachedFile[0]))
      )
      return
    }

    const res = await http.get(imageSrc, { responseType: 'arraybuffer' })
    const imageBuffer = Buffer.from(res.data)

    const ft = await import('file-type').then(m => m.fileTypeFromBuffer(imageBuffer))
    if (!ft) {
      throw new Error('获取文件类型失败')
    }
    if (!ft.mime.startsWith('image/')) {
      throw new Error(`不是有效的图片类型：${ft.mime}`)
    }

    const imageUri = vscode.Uri.file(path.join(imageDir, `${imageHash}.${ft.ext}`))
    if (!(await fileExists(imageUri))) {
      await vscode.workspace.fs.writeFile(imageUri, imageBuffer)
    }
    await vscode.commands.executeCommand('vscode.open', imageUri)
  } catch (e: any) {
    vscode.window.showErrorMessage(`下载图片失败：${e.message}`)
  }
}
