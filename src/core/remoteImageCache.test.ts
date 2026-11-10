import axios from 'axios'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ get: vi.fn(), writeFile: vi.fn() }))
vi.mock('@/core/http', () => ({ default: { defaults: { timeout: 15000 }, get: mocks.get } }))
vi.mock('@/global', () => ({ default: { context: { globalStorageUri: 'storage' } } }))
vi.mock('vscode', () => ({
  default: {
    workspace: {
      fs: { createDirectory: vi.fn(), readDirectory: async () => [], writeFile: mocks.writeFile }
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
