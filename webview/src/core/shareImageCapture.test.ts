import { describe, expect, test } from 'vitest'
import { calculateShareImagePixelRatio, isOriginalRemoteShareImage } from './shareImageCapture'

const BASE_URL = 'https://www.v2ex.com/t/1227680'

describe('calculateShareImagePixelRatio', () => {
  test('keeps 2x output for a first page reply list near 14000 CSS pixels tall', () => {
    expect(calculateShareImagePixelRatio(13800)).toBe(2)
  })

  test('reduces the ratio only when the 2x output would exceed the safe raster height', () => {
    expect(calculateShareImagePixelRatio(20000)).toBe(1.5)
  })
})

describe('isOriginalRemoteShareImage', () => {
  test('recognizes unchanged absolute and protocol-relative remote sources', () => {
    const avatar = 'https://cdn.v2ex.com/avatar/3068/ad40/528274_xlarge.png?m=1715355515'

    expect(isOriginalRemoteShareImage(avatar, avatar, BASE_URL)).toBe(true)
    expect(
      isOriginalRemoteShareImage(
        '//cdn.v2ex.com/avatar/3068/ad40/528274_xlarge.png?m=1715355515',
        avatar,
        BASE_URL
      )
    ).toBe(true)
  })

  test('does not treat a Webview resource URI or data URL as the remote source', () => {
    const avatar = 'https://cdn.v2ex.com/avatar/test.png'

    expect(isOriginalRemoteShareImage(avatar, 'vscode-webview://share/test.png', BASE_URL)).toBe(
      false
    )
    expect(isOriginalRemoteShareImage(avatar, 'data:image/png;base64,AQID', BASE_URL)).toBe(false)
  })
})
