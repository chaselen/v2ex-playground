import { afterEach, expect, test, vi } from 'vitest'
import { copyImageToClipboard } from './imageClipboard'

afterEach(() => vi.unstubAllGlobals())

test.each(['direct', 'remote-jpeg', 'remote-png'] as const)(
  'writes PNG with source path: %s',
  async path => {
    const crossOrigin = path !== 'direct'
    const png = new Blob(['fixture'], { type: 'image/png' })
    const canvas = {
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: vi.fn((callback: (blob: Blob) => void) => callback(png))
    }
    if (crossOrigin) {
      canvas.toBlob.mockImplementationOnce(() => {
        throw new DOMException('Tainted canvas', 'SecurityError')
      })
    }
    const image = {
      naturalWidth: 10,
      naturalHeight: 10,
      currentSrc: 'https://example.com/image.jpg',
      ownerDocument: { createElement: () => canvas }
    }
    vi.stubGlobal(
      'Image',
      class {
        constructor() {
          Object.assign(this, image)
        }
        async decode() {}
      }
    )
    class Item {
      constructor(readonly data: Record<string, Promise<Blob>>) {}
    }
    vi.stubGlobal('ClipboardItem', Item)
    const onPngReady = vi.fn()
    const write = vi.fn(async ([item]: Item[]) => {
      expect(await item.data['image/png']).toBe(png)
      expect(onPngReady).toHaveBeenCalledOnce()
    })
    vi.stubGlobal('navigator', { clipboard: { write } })
    const dataUrl =
      path === 'remote-png' ? 'data:image/png;base64,AA==' : 'data:image/jpeg;base64,AA=='
    const fetchImage = vi.fn(async () => ({ blob: async () => png }))
    vi.stubGlobal('fetch', fetchImage)
    const load = vi.fn(async () => dataUrl)
    await copyImageToClipboard(image as unknown as HTMLImageElement, load, onPngReady)
    expect(write).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledTimes(crossOrigin ? 1 : 0)
    if (crossOrigin) expect(load).toHaveBeenCalledWith(image.currentSrc)
    expect(canvas.toBlob).toHaveBeenCalledTimes(path === 'remote-jpeg' ? 2 : 1)
    if (path === 'remote-png') expect(fetchImage).toHaveBeenCalledWith(dataUrl)
  }
)
