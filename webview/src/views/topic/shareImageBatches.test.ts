import { afterEach, expect, test, vi } from 'vitest'
import { loadCancellableShareImages, loadShareImageBatches } from './shareImageBatches'

afterEach(() => vi.useRealTimers())

test('returns each slow batch within one download window and waits before starting the next RPC', async () => {
  vi.useFakeTimers()
  const sources = Array.from({ length: 25 }, (_, index) => `https://example.com/${index}.png`)
  const load = vi.fn(
    (batch: string[]) =>
      new Promise<Record<string, string>>(resolve => {
        setTimeout(
          () => resolve(Object.fromEntries(batch.map(source => [source, 'resource-uri']))),
          15000
        )
      })
  )
  const batches = loadShareImageBatches(sources, load)
  const first = batches.next()
  expect(load).toHaveBeenCalledExactlyOnceWith(sources.slice(0, 12))
  let firstReady = false
  void first.then(() => {
    firstReady = true
  })
  await vi.advanceTimersByTimeAsync(14999)
  expect(firstReady).toBe(false)
  expect(load).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect((await first).value).toEqual({
    sources: sources.slice(0, 12),
    images: Object.fromEntries(sources.slice(0, 12).map(source => [source, 'resource-uri']))
  })
  // 消费方可以先更新预览，尚未请求下一批
  expect(load).toHaveBeenCalledTimes(1)
  const second = batches.next()
  expect(load).toHaveBeenNthCalledWith(2, sources.slice(12, 24))
  await vi.advanceTimersByTimeAsync(15000)
  expect((await second).value?.sources).toEqual(sources.slice(12, 24))
  const third = batches.next()
  expect(load).toHaveBeenNthCalledWith(3, sources.slice(24))
  await vi.advanceTimersByTimeAsync(15000)
  expect((await third).value?.sources).toEqual(sources.slice(24))
  expect((await batches.next()).done).toBe(true)
})

test('continues with later batches when a slow RPC times out', async () => {
  vi.useFakeTimers()
  const sources = Array.from({ length: 13 }, (_, index) => String(index))
  const load = vi
    .fn<(sources: string[]) => Promise<Record<string, string>>>()
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('RPC timed out')), 30000)
        })
    )
    .mockResolvedValueOnce({ '12': 'resource-uri' })
  const batches = loadShareImageBatches(sources, load)
  const first = batches.next()
  await vi.advanceTimersByTimeAsync(30000)
  expect((await first).value).toEqual({ sources: sources.slice(0, 12), images: {} })
  expect((await batches.next()).value).toEqual({
    sources: ['12'],
    images: { '12': 'resource-uri' }
  })
  expect(load).toHaveBeenCalledTimes(2)
})

test('waits for backend cancellation after RPC timeout before requesting the next batch', async () => {
  vi.useFakeTimers()
  const loadTopicShareImages = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('RPC timeout')), 30000)
        })
    )
    .mockResolvedValueOnce({ '12': 'resource-uri' })
  let finishCancellation!: () => void
  const cancelTopicShareImages = vi.fn(
    () =>
      new Promise<void>(resolve => {
        finishCancellation = resolve
      })
  )
  const client = { loadTopicShareImages, cancelTopicShareImages }
  const iterator = loadShareImageBatches(
    Array.from({ length: 13 }, (_, index) => String(index)),
    sources => loadCancellableShareImages(client, sources)
  )
  const first = iterator.next()
  await vi.advanceTimersByTimeAsync(30000)
  expect(cancelTopicShareImages).toHaveBeenCalledExactlyOnceWith(
    loadTopicShareImages.mock.calls[0][0]
  )
  expect(loadTopicShareImages).toHaveBeenCalledTimes(1)
  finishCancellation()
  expect((await first).value?.images).toEqual({})
  expect((await iterator.next()).value?.images).toEqual({ '12': 'resource-uri' })
  expect(loadTopicShareImages.mock.calls[1][0]).not.toBe(loadTopicShareImages.mock.calls[0][0])
})
