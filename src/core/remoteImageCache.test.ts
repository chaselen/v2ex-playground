import axios from 'axios'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  delete: vi.fn(),
  readDirectory: vi.fn(),
  stat: vi.fn()
}))
vi.mock('@/core/http', () => ({ default: { defaults: { timeout: 15000 }, get: mocks.get } }))
vi.mock('@/global', () => ({ default: { context: { globalStorageUri: 'storage' } } }))
vi.mock('vscode', () => ({
  default: {
    FileType: { File: 1 },
    workspace: {
      fs: {
        createDirectory: vi.fn(),
        readDirectory: mocks.readDirectory,
        writeFile: mocks.writeFile,
        rename: mocks.rename,
        delete: mocks.delete,
        stat: mocks.stat
      }
    }
  },
  Uri: { joinPath: (...parts: string[]) => parts.join('/') }
}))
vi.mock('file-type', () => ({
  fileTypeFromBuffer: async () => ({ ext: 'png', mime: 'image/png' })
}))
import { cacheRemoteImageFile } from './remoteImageCache'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.readDirectory.mockResolvedValue([])
  vi.useFakeTimers()
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

function delayedResponse(delay: number, response: object) {
  return (_url: string, options: { signal: AbortSignal }) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        options.signal.removeEventListener('abort', abort)
        resolve(response)
      }, delay)
      const abort = () => {
        clearTimeout(timer)
        reject(new axios.CanceledError())
      }
      options.signal.addEventListener('abort', abort, { once: true })
    })
}
const options = { imageSrc: 'https://public.example/first', cacheDirName: 'images' }

test('shares one 15 second budget across redirects and aborts the remaining hop', async () => {
  mocks.get
    .mockImplementationOnce(
      delayedResponse(9000, { status: 302, headers: { location: '/second' } })
    )
    .mockImplementationOnce(delayedResponse(9000, { status: 200, data: new Uint8Array([1]) }))
  const validateUrl = vi.fn()
  const loading = cacheRemoteImageFile({ ...options, validateUrl })
  const rejection = expect(loading).rejects.toMatchObject({
    code: 'ECONNABORTED',
    message: '图片请求总超时 15000ms'
  })
  await vi.advanceTimersByTimeAsync(9000)
  expect(validateUrl.mock.calls).toEqual([
    ['https://public.example/first'],
    ['https://public.example/second']
  ])
  expect(mocks.get.mock.calls[1][1]).toMatchObject({ timeout: 6000, maxRedirects: 0 })
  await vi.advanceTimersByTimeAsync(6000)
  await rejection
  expect(mocks.get.mock.calls[1][1].signal.aborted).toBe(true)
  expect(mocks.writeFile).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

test('validates a redirect before issuing its request', async () => {
  mocks.get.mockResolvedValueOnce({
    status: 302,
    headers: { location: 'https://127.0.0.1/private' }
  })
  const loading = cacheRemoteImageFile({
    ...options,
    validateUrl: url => {
      if (url.includes('127.0.0.1')) throw new Error('blocked')
    }
  })
  await expect(loading).rejects.toThrow('blocked')
  expect(mocks.get).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

test('aborts the active hop on caller cancellation and clears the total deadline', async () => {
  mocks.get.mockImplementationOnce(
    delayedResponse(9000, { status: 302, headers: { location: '/never' } })
  )
  const controller = new AbortController()
  const loading = cacheRemoteImageFile({
    ...options,
    signal: controller.signal,
    validateUrl: vi.fn()
  })
  const rejection = expect(loading).rejects.toMatchObject({ code: 'ERR_CANCELED' })
  await vi.advanceTimersByTimeAsync(1000)
  controller.abort()
  await rejection
  expect(mocks.get).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

test('clears the total deadline after a successful image request', async () => {
  mocks.get.mockImplementationOnce(
    delayedResponse(1000, { status: 200, data: new Uint8Array([1]) })
  )
  const loading = cacheRemoteImageFile({ ...options, validateUrl: vi.fn() })
  await vi.advanceTimersByTimeAsync(1000)
  expect(await loading).toMatchObject({ cached: false })
  expect(vi.getTimerCount()).toBe(0)
})

test('a cache hit skips network progress and honors a bounded caller’s size limit', async () => {
  const key = createHash('sha256').update(options.imageSrc).digest('hex')
  mocks.readDirectory.mockResolvedValue([[key + '.png', 1]])
  mocks.stat.mockResolvedValue({ size: 11 })
  const onDownloadProgress = vi.fn()
  await expect(cacheRemoteImageFile({ ...options, onDownloadProgress })).resolves.toMatchObject({
    cached: true
  })
  await expect(cacheRemoteImageFile({ ...options, maxBytes: 10 })).rejects.toThrow(
    '缓存图片超过大小限制'
  )
  expect(mocks.get).not.toHaveBeenCalled()
  expect(onDownloadProgress).not.toHaveBeenCalled()
})

test('counts only bytes from the final response when reporting download progress', async () => {
  vi.useRealTimers()
  const server = createServer((request, response) => {
    if (request.url === '/redirect') {
      response.writeHead(302, { Location: '/image', 'Content-Length': '8' })
      response.end('redirect')
      return
    }
    response.writeHead(200, { 'Content-Length': '4' })
    response.write('ab')
    setTimeout(() => response.end('cd'), 20)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const { port } = server.address() as AddressInfo
    mocks.get.mockImplementation((url, config) => axios.get(url, { ...config, proxy: false }))
    const onDownloadProgress = vi.fn()
    await cacheRemoteImageFile({
      ...options,
      imageSrc: `http://127.0.0.1:${port}/redirect`,
      validateUrl: vi.fn(),
      onDownloadProgress
    })
    await vi.waitFor(() =>
      expect(onDownloadProgress).toHaveBeenLastCalledWith(
        expect.objectContaining({ loaded: 4, total: 4 })
      )
    )
    expect(onDownloadProgress.mock.calls.every(([event]) => event.total === 4)).toBe(true)
  } finally {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})

test.each(['write', 'cancel', 'rename'] as const)(
  'never publishes a partial cache file when %s interrupts caching',
  async failure => {
    const controller = new AbortController()
    mocks.get.mockResolvedValue({ status: 200, data: new Uint8Array([1, 2, 3]) })
    const error = new Error('filesystem failure')
    if (failure === 'write') mocks.writeFile.mockRejectedValueOnce(error)
    if (failure === 'rename') mocks.rename.mockRejectedValueOnce(error)
    if (failure === 'cancel') mocks.writeFile.mockImplementationOnce(async () => controller.abort())

    await expect(cacheRemoteImageFile({ ...options, signal: controller.signal })).rejects.toThrow()
    const pending = mocks.writeFile.mock.calls[0][0]
    expect(pending).toMatch(/\/\.pending-/)
    expect(mocks.delete).toHaveBeenCalledWith(pending)
    if (failure !== 'rename') expect(mocks.rename).not.toHaveBeenCalled()

    const result = await cacheRemoteImageFile(options)
    expect(mocks.rename).toHaveBeenLastCalledWith(mocks.writeFile.mock.calls[1][0], result.uri, {
      overwrite: true
    })
    expect(result.cached).toBe(false)
  }
)

test('ignores a temporary file left by an interrupted extension host', async () => {
  mocks.readDirectory.mockResolvedValue([['.pending-interrupted', 1]])
  mocks.get.mockResolvedValue({ status: 200, data: new Uint8Array([1, 2, 3]) })
  await expect(cacheRemoteImageFile(options)).resolves.toMatchObject({ cached: false })
  expect(mocks.get).toHaveBeenCalledOnce()
  expect(mocks.rename).toHaveBeenCalledOnce()
})
