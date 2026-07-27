import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cacheRemoteImageFile: vi.fn(),
  cleanupExpiredCacheFiles: vi.fn(),
  fileTypeFromBuffer: vi.fn(),
  loggerWarn: vi.fn(),
  readFile: vi.fn()
}))

vi.mock('file-type', () => ({
  fileTypeFromBuffer: mocks.fileTypeFromBuffer
}))

vi.mock('vscode', () => ({
  default: { workspace: { fs: { readFile: mocks.readFile } } },
  Uri: {}
}))

vi.mock('@/core/logger', () => ({
  logger: { error: vi.fn(), warn: mocks.loggerWarn }
}))

vi.mock('@/core/remoteImageCache', () => ({
  cacheRemoteImageFile: mocks.cacheRemoteImageFile,
  cleanupExpiredCacheFiles: mocks.cleanupExpiredCacheFiles,
  getExtensionFileCacheDir: vi.fn(),
  normalizeRemoteImageSrc: (imageSrc: string) => (imageSrc.startsWith('https://') ? imageSrc : '')
}))

vi.mock('@/features/savedFileNotification', () => ({
  showSavedFileNotification: vi.fn()
}))

vi.mock('@/global', () => ({
  default: {}
}))

import { loadTopicShareImages } from './topicShareImage'

describe('loadTopicShareImages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cacheRemoteImageFile.mockResolvedValue({
      uri: { toString: () => 'file:///cache/test.png' },
      cached: false
    })
    mocks.cleanupExpiredCacheFiles.mockResolvedValue(undefined)
    mocks.fileTypeFromBuffer.mockResolvedValue({ ext: 'png', mime: 'image/png' })
    mocks.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]))
  })

  test('returns a Webview resource URI and preserves the original lookup key', async () => {
    const webview = {
      asWebviewUri: vi.fn(() => ({ toString: () => 'vscode-webview://share/test.png' }))
    }
    const result = await loadTopicShareImages(['//cdn.v2ex.com/avatar/test.png'], webview as never)

    expect(mocks.cacheRemoteImageFile).toHaveBeenCalledWith({
      imageSrc: 'https://cdn.v2ex.com/avatar/test.png',
      cacheDirName: 'topic-share-images'
    })
    expect(result).toEqual({
      '//cdn.v2ex.com/avatar/test.png': 'vscode-webview://share/test.png'
    })
  })

  test('uses the default resource URI format when RPC serializes options as null', async () => {
    const webview = {
      asWebviewUri: vi.fn(() => ({ toString: () => 'vscode-webview://share/test.png' }))
    }
    const result = await loadTopicShareImages(
      ['https://cdn.v2ex.com/avatar/test.png'],
      webview as never,
      null
    )

    expect(result).toEqual({
      'https://cdn.v2ex.com/avatar/test.png': 'vscode-webview://share/test.png'
    })
    expect(mocks.loggerWarn).not.toHaveBeenCalled()
  })

  test('returns a data URL from the same cache file when requested as fallback', async () => {
    const result = await loadTopicShareImages(
      ['https://cdn.v2ex.com/avatar/fallback.png'],
      {} as never,
      { format: 'dataUrl' }
    )

    expect(mocks.readFile).toHaveBeenCalled()
    expect(result).toEqual({
      'https://cdn.v2ex.com/avatar/fallback.png': 'data:image/png;base64,AQID'
    })
  })

  test('keeps successful resources when another image fails', async () => {
    mocks.cacheRemoteImageFile.mockImplementation(({ imageSrc }: { imageSrc: string }) => {
      if (imageSrc.endsWith('/failed.png')) {
        return Promise.reject(new Error('network error'))
      }
      return Promise.resolve({
        uri: { toString: () => 'file:///cache/success.png' },
        cached: false
      })
    })
    const webview = {
      asWebviewUri: vi.fn(() => ({ toString: () => 'vscode-webview://share/success.png' }))
    }

    const result = await loadTopicShareImages(
      ['https://cdn.v2ex.com/avatar/success.png', 'https://cdn.v2ex.com/avatar/failed.png'],
      webview as never
    )

    expect(result).toEqual({
      'https://cdn.v2ex.com/avatar/success.png': 'vscode-webview://share/success.png'
    })
    expect(mocks.loggerWarn).toHaveBeenCalledOnce()
  })

  test('deduplicates concurrent downloads and releases the in-memory task afterward', async () => {
    let resolveDownload!: (value: { uri: object; cached: boolean }) => void
    mocks.cacheRemoteImageFile.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveDownload = resolve
        })
    )
    const webview = {
      asWebviewUri: vi.fn(() => ({ toString: () => 'vscode-webview://share/concurrent.png' }))
    }
    const imageSrc = 'https://cdn.v2ex.com/avatar/concurrent.png'

    const firstLoad = loadTopicShareImages([imageSrc], webview as never)
    const secondLoad = loadTopicShareImages([imageSrc], webview as never)
    await vi.waitFor(() => expect(mocks.cacheRemoteImageFile).toHaveBeenCalledOnce())
    resolveDownload({ uri: {}, cached: false })
    await Promise.all([firstLoad, secondLoad])

    mocks.cacheRemoteImageFile.mockResolvedValue({ uri: {}, cached: true })
    await loadTopicShareImages([imageSrc], webview as never)
    expect(mocks.cacheRemoteImageFile).toHaveBeenCalledTimes(2)
  })
})
