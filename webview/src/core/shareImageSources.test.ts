import { describe, expect, test } from 'vitest'
import { getShareImageSourceCandidates, parseShareImageSrcset } from './shareImageSources'

describe('share image sources', () => {
  test('prefers the normalized preview source and keeps srcset fallbacks', () => {
    expect(
      getShareImageSourceCandidates({
        previewSrc: ' https://example.com/original.png ',
        src: 'https://example.com/thumb.png',
        srcset: 'https://example.com/small.png 480w, https://example.com/large.png 1280w',
        pictureSrcsets: ['https://example.com/retina.png 2x']
      })
    ).toEqual([
      'https://example.com/original.png',
      'https://example.com/thumb.png',
      'https://example.com/small.png',
      'https://example.com/large.png',
      'https://example.com/retina.png'
    ])
  })

  test('deduplicates empty and repeated srcset candidates', () => {
    expect(
      parseShareImageSrcset(
        'https://example.com/image.png 1x, https://example.com/image.png 2x, , '
      )
    ).toEqual(['https://example.com/image.png'])
    expect(
      getShareImageSourceCandidates({
        src: 'https://example.com/image.png',
        srcset: 'https://example.com/image.png 1x'
      })
    ).toEqual(['https://example.com/image.png'])
  })
})
