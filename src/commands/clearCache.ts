import vscode, { Uri } from 'vscode'
import { logger } from '@/core/logger'
import { getExtensionFileCacheDir, isFileNotFoundError } from '@/core/remoteImageCache'
import { PANEL_ICON_CACHE_DIR } from '@/features/panelIcon'
import { TOPIC_SHARE_IMAGE_CACHE_DIR } from '@/features/topicShareImage'

let clearingCache = false

/** 统计图片缓存，并在用户确认后删除已统计的文件 */
export default async function clearCache() {
  if (clearingCache) return
  clearingCache = true

  try {
    const files = (
      await Promise.all([PANEL_ICON_CACHE_DIR, TOPIC_SHARE_IMAGE_CACHE_DIR].map(listCacheFiles))
    ).flat()
    if (files.length === 0) {
      void vscode.window.showInformationMessage('没有可清理的图片缓存')
      return
    }

    const totalBytes = files.reduce((total, file) => total + file.size, 0)
    const confirm = '清空缓存'
    const action = await vscode.window.showWarningMessage(
      '确定要清空 V2EX 图片缓存吗？',
      {
        modal: true,
        detail: `共 ${files.length} 个文件，总大小 ${formatCacheSize(totalBytes)}。`
      },
      confirm
    )
    if (action !== confirm) return

    // 等待所有删除完成，避免部分删除失败时提前允许再次执行
    const results = await Promise.allSettled(
      files.map(({ uri }) => ignoreMissingFile(() => vscode.workspace.fs.delete(uri)))
    )
    const failures = results.filter(result => result.status === 'rejected')
    if (failures.length > 0) {
      for (const failure of failures) logger.error('删除图片缓存文件失败', failure.reason)
      void vscode.window.showErrorMessage(`有 ${failures.length} 个图片缓存文件清理失败，请重试`)
      return
    }

    void vscode.window.showInformationMessage('V2EX 图片缓存已清空')
  } catch (error) {
    logger.error('统计图片缓存失败', error)
    void vscode.window.showErrorMessage('无法统计 V2EX 图片缓存，请重试')
  } finally {
    clearingCache = false
  }
}

function formatCacheSize(bytes: number) {
  const kilobyte = 1024
  const megabyte = kilobyte ** 2
  const options = { maximumFractionDigits: 2 }

  if (bytes >= megabyte) return `${(bytes / megabyte).toLocaleString('zh-CN', options)} MB`
  if (bytes >= kilobyte) return `${(bytes / kilobyte).toLocaleString('zh-CN', options)} KB`
  return `${bytes} B`
}

async function listCacheFiles(dirName: string) {
  const directory = getExtensionFileCacheDir(dirName)
  const entries = await ignoreMissingFile(() => vscode.workspace.fs.readDirectory(directory))
  const files = await Promise.all(
    (entries ?? [])
      // 下载中的临时文件仍由写入方管理
      .filter(([name, type]) => type === vscode.FileType.File && !name.startsWith('.pending-'))
      .map(async ([name]) => {
        const uri = Uri.joinPath(directory, name)
        const stat = await ignoreMissingFile(() => vscode.workspace.fs.stat(uri))
        return stat && { uri, size: stat.size }
      })
  )
  return files.filter(file => file !== undefined)
}

async function ignoreMissingFile<T>(operation: () => Thenable<T>) {
  try {
    return await operation()
  } catch (error) {
    if (!isFileNotFoundError(error)) throw error
  }
}
