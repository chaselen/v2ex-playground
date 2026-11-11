import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

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

import { loadImageDataUrl, loadTopicShareImages, TopicShareImageLoader } from './topicShareImage'

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
      cacheDirName: 'topic-share-images',
      maxBytes: 10 * 1024 * 1024,
      validateUrl: expect.any(Function)
    })
    expect(result).toEqual({
      '//cdn.v2ex.com/avatar/test.png': 'vscode-webview://share/test.png'
    })
  })

  test('does not require local DNS resolution for public image hosts', async () => {
    const webview = {
      asWebviewUri: vi.fn(() => ({ toString: () => 'vscode-webview://share/test.png' }))
    }
    await loadTopicShareImages(['https://cdn.v2ex.com/avatar/test.png'], webview as never)

    const requestOptions = mocks.cacheRemoteImageFile.mock.calls[0][0] as {
      validateUrl: (imageSrc: string) => void
    }
    expect(() => requestOptions.validateUrl('https://cdn.v2ex.com/avatar/test.png')).not.toThrow()
  })

  test('rejects local image addresses before a network request', async () => {
    mocks.cacheRemoteImageFile.mockImplementation(
      async ({
        imageSrc,
        validateUrl
      }: {
        imageSrc: string
        validateUrl?: (imageSrc: string) => void | Promise<void>
      }) => {
        await validateUrl?.(imageSrc)
        return { uri: {}, cached: false }
      }
    )
    const webview = {
      asWebviewUri: vi.fn(() => ({ toString: () => 'vscode-webview://share/test.png' }))
    }
    const result = await loadTopicShareImages(
      ['https://127.0.0.1/private.png', 'https://[::1]/private.png'],
      webview as never
    )

    expect(result).toEqual({})
    expect(mocks.cacheRemoteImageFile).toHaveBeenCalledTimes(2)
    expect(mocks.loggerWarn).toHaveBeenCalledTimes(2)
  })

  test('uses the default resource URI format when RPC serializes the format as null', async () => {
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
      'dataUrl'
    )

    expect(mocks.readFile).toHaveBeenCalled()
    expect(result).toEqual({
      'https://cdn.v2ex.com/avatar/fallback.png': 'data:image/png;base64,AQID'
    })
  })

  test('reads clipboard data from the same cache as the share image', async () => {
    const src = 'https://cdn.v2ex.com/avatar/test.png'
    await expect(loadImageDataUrl(src)).resolves.toBe('data:image/png;base64,AQID')
    await loadTopicShareImages([src], {} as never, 'dataUrl')

    expect(mocks.cacheRemoteImageFile.mock.calls[0][0]).toEqual(
      mocks.cacheRemoteImageFile.mock.calls[1][0]
    )
    expect(mocks.readFile.mock.calls[0][0]).toBe(mocks.readFile.mock.calls[1][0])
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

  test('refills the rolling concurrency pool as soon as an image finishes', async () => {
    const imageSources = Array.from(
      { length: 13 },
      (_, index) => `https://cdn.v2ex.com/avatar/rolling-${index}.png`
    )
    const resolvers = new Map<string, (value: { uri: object; cached: boolean }) => void>()
    mocks.cacheRemoteImageFile.mockImplementation(
      ({ imageSrc }: { imageSrc: string }) =>
        new Promise(resolve => {
          resolvers.set(imageSrc, resolve)
        })
    )
    const webview = {
      asWebviewUri: vi.fn(() => ({ toString: () => 'vscode-webview://share/rolling.png' }))
    }

    const loading = loadTopicShareImages(imageSources, webview as never)
    await vi.waitFor(() => expect(mocks.cacheRemoteImageFile).toHaveBeenCalledTimes(12))
    expect(resolvers.has(imageSources[12])).toBe(false)

    resolvers.get(imageSources[0])?.({ uri: {}, cached: false })
    await vi.waitFor(() => expect(mocks.cacheRemoteImageFile).toHaveBeenCalledTimes(13))

    resolvers.forEach(resolve => resolve({ uri: {}, cached: false }))
    await loading
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

describe('TopicShareImageLoader', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()
    mocks.cleanupExpiredCacheFiles.mockResolvedValue(undefined)
  })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  test('caps one panel at 12 workers across overlapping RPCs and drains cancellation before the next batch', async () => {
    let active = 0
    let peak = 0
    const requests: Array<{ signal: AbortSignal; finish: () => void }> = []
    mocks.cacheRemoteImageFile.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((resolve, reject) => {
          active += 1
          peak = Math.max(peak, active)
          requests.push({
            signal,
            finish: () => {
              active -= 1
              resolve({ uri: {}, cached: false })
            }
          })
          signal.addEventListener(
            'abort',
            () => {
              setTimeout(() => {
                active -= 1
                reject(new Error('cancelled'))
              }, 100)
            },
            { once: true }
          )
        })
    )
    const webview = { asWebviewUri: () => ({ toString: () => 'resource-uri' }) }
    const loader = new TopicShareImageLoader(webview as never)
    const sources = Array.from({ length: 13 }, (_, index) => `https://example.com/${index}.png`)
    const first = loader.load('first', sources)
    const rejection = expect(first).rejects.toBeDefined()
    const second = loader.load('second', ['https://example.com/next.png'])
    await vi.advanceTimersByTimeAsync(0)
    expect(requests).toHaveLength(12)
    const cancelling = loader.cancel('first')
    expect(requests.every(request => request.signal.aborted)).toBe(true)
    await vi.advanceTimersByTimeAsync(99)
    expect(requests).toHaveLength(12)
    await vi.advanceTimersByTimeAsync(1)
    await rejection
    await cancelling
    expect(requests).toHaveLength(13)
    requests[12].finish()
    expect(await second).toEqual({ 'https://example.com/next.png': 'resource-uri' })
    expect(peak).toBe(12)
    expect(active).toBe(0)
    expect(mocks.loggerWarn).not.toHaveBeenCalled()
  })

  test('does not cancel another panel downloading the same URL', async () => {
    const requests: Array<{ signal: AbortSignal; finish: () => void }> = []
    mocks.cacheRemoteImageFile.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((resolve, reject) => {
          requests.push({ signal, finish: () => resolve({ uri: {}, cached: false }) })
          signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })
        })
    )
    const webview = { asWebviewUri: () => ({ toString: () => 'resource-uri' }) }
    const a = new TopicShareImageLoader(webview as never)
    const b = new TopicShareImageLoader(webview as never)
    const sources = ['https://example.com/shared.png']
    const first = a.load('a', sources)
    const rejection = expect(first).rejects.toBeDefined()
    const second = b.load('b', sources)
    await vi.advanceTimersByTimeAsync(0)
    expect(requests).toHaveLength(2)
    await a.cancel('a')
    await rejection
    expect(requests[1].signal.aborted).toBe(false)
    requests[1].finish()
    expect(await second).toEqual({ [sources[0]]: 'resource-uri' })
  })

  test('aborts active work and prevents queued or future downloads after panel disposal', async () => {
    mocks.cacheRemoteImageFile.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })
        })
    )
    const loader = new TopicShareImageLoader({} as never)
    const first = loader.load('active', ['https://example.com/active.png'])
    const second = loader.load('queued', ['https://example.com/queued.png'])
    const rejected = Promise.all([
      expect(first).rejects.toBeDefined(),
      expect(second).rejects.toBeDefined()
    ])
    await vi.advanceTimersByTimeAsync(0)
    loader.dispose()
    await rejected
    expect(mocks.cacheRemoteImageFile).toHaveBeenCalledOnce()
    await expect(loader.load('late', ['https://example.com/late.png'])).rejects.toThrow('已失效')
  })
})
