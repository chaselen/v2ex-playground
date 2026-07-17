import { describe, expect, it } from 'vitest'
import { detectCompactImageEmoticon, isCompactImageEmoticonSize } from './imageEmoticons'

/** 创建满足图片表情识别逻辑所需接口的图片元素 */
function createImage(
  naturalWidth: number,
  naturalHeight: number,
  complete = true
): {
  classNames: Set<string>
  dispatchLoad: () => void
  image: HTMLImageElement
} {
  const classNames = new Set<string>()
  let loadHandler: (() => void) | undefined
  const image = {
    classList: {
      add: (...tokens: string[]) => tokens.forEach(token => classNames.add(token)),
      contains: (token: string) => classNames.has(token)
    },
    complete,
    dataset: {} as DOMStringMap,
    naturalHeight,
    naturalWidth,
    addEventListener: (event: string, handler: () => void) => {
      if (event === 'load') {
        loadHandler = handler
      }
    }
  } as unknown as HTMLImageElement

  return {
    classNames,
    dispatchLoad: () => loadHandler?.(),
    image
  }
}

describe('isCompactImageEmoticonSize', () => {
  it.each([
    [22, 22],
    [32, 24],
    [24, 32]
  ])('将 %d×%d 的小尺寸近方形图片识别为表情', (width, height) => {
    expect(isCompactImageEmoticonSize(width, height)).toBe(true)
  })

  it.each([
    [0, 0],
    [33, 22],
    [22, 33],
    [32, 16]
  ])('不将 %d×%d 的图片识别为表情', (width, height) => {
    expect(isCompactImageEmoticonSize(width, height)).toBe(false)
  })
})

describe('detectCompactImageEmoticon', () => {
  it('立即标记已加载的小尺寸图片', () => {
    const { classNames, image } = createImage(22, 22)

    detectCompactImageEmoticon(image)

    expect(classNames.has('v2ex-emoticon-image')).toBe(true)
  })

  it('等待图片加载完成后再按自然尺寸标记', () => {
    const { classNames, dispatchLoad, image } = createImage(22, 22, false)

    detectCompactImageEmoticon(image)
    expect(classNames.has('v2ex-emoticon-image')).toBe(false)

    dispatchLoad()
    expect(classNames.has('v2ex-emoticon-image')).toBe(true)
  })

  it('保留普通内容图片样式', () => {
    const { classNames, image } = createImage(640, 480)

    detectCompactImageEmoticon(image)

    expect(classNames.has('v2ex-emoticon-image')).toBe(false)
  })
})
