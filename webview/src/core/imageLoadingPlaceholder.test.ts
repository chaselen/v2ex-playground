import { afterEach, expect, test, vi } from 'vitest'
import { showImageLoadingPlaceholder } from './imageLoadingPlaceholder'

function setup({ complete = false, naturalWidth = 0, emoticon = false, loading = 'auto' } = {}) {
  const classes = new Set(emoticon ? ['v2ex-emoticon-image'] : [])
  const placeholder = {
    className: '',
    classList: { add: vi.fn() },
    setAttribute: vi.fn(),
    textContent: '',
    remove: vi.fn()
  }
  vi.stubGlobal('document', { createElement: () => placeholder })
  const img = Object.assign(new EventTarget(), {
    complete,
    naturalWidth,
    loading,
    classList: {
      contains: (value: string) => classes.has(value),
      add: (value: string) => classes.add(value),
      remove: (value: string) => classes.delete(value)
    },
    getAttribute: () => '/image.png',
    insertAdjacentElement: vi.fn()
  })
  const addEventListener = vi.spyOn(img, 'addEventListener')
  const dispose = showImageLoadingPlaceholder(img as unknown as HTMLImageElement)
  return { img, classes, placeholder, dispose, addEventListener }
}

afterEach(() => vi.unstubAllGlobals())

test('shows a placeholder until loading completes', () => {
  const { img, classes, placeholder, dispose } = setup()
  expect(classes.has('content-image-pending')).toBe(true)
  expect(placeholder.textContent).toBe('图片加载中')
  img.dispatchEvent(new Event('load'))
  expect(classes.has('content-image-pending')).toBe(false)
  expect(placeholder.remove).toHaveBeenCalled()
  dispose()
})

test('shows failures and recovers when an image later loads', () => {
  const { img, placeholder, dispose } = setup()
  img.dispatchEvent(new Event('error'))
  expect(placeholder.textContent).toBe('图片加载失败')
  img.dispatchEvent(new Event('load'))
  expect(placeholder.remove).toHaveBeenCalled()
  dispose()
})

test('skips placeholders and listeners for successfully loaded images', () => {
  const success = setup({ complete: true, naturalWidth: 100 })
  expect(success.classes.has('content-image-pending')).toBe(false)
  expect(success.img.insertAdjacentElement).not.toHaveBeenCalled()
  expect(success.addEventListener).not.toHaveBeenCalled()
  expect(success.img.loading).toBe('auto')
  success.dispose()
})

test('shows a failure for images that have already failed', () => {
  const failure = setup({ complete: true })
  expect(failure.placeholder.textContent).toBe('图片加载失败')
  failure.dispose()
})

test('loads lazy images eagerly while their placeholder hides them', () => {
  const { img, classes, placeholder, dispose } = setup({ loading: 'lazy' })
  expect(img.loading).toBe('eager')
  expect(classes.has('content-image-pending')).toBe(true)
  img.dispatchEvent(new Event('load'))
  expect(classes.has('content-image-pending')).toBe(false)
  expect(placeholder.remove).toHaveBeenCalledOnce()
  dispose()
})

test('keeps emoticons inline and removes listeners on cleanup', () => {
  const emoticon = setup({ emoticon: true })
  expect(emoticon.img.insertAdjacentElement).not.toHaveBeenCalled()
  emoticon.dispose()
  const pending = setup()
  pending.dispose()
  pending.img.dispatchEvent(new Event('error'))
  expect(pending.placeholder.textContent).toBe('图片加载中')
  expect(pending.classes.has('content-image-pending')).toBe(false)
})
