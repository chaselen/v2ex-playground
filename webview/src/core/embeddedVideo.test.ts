import { describe, expect, it } from 'vitest'
import { getEmbeddedVideoInfo } from './embeddedVideo'

describe('getEmbeddedVideoInfo', () => {
  it.each([
    [
      'https://www.youtube.com/embed/YhxnffqiegU',
      'youtube.com',
      'https://www.youtube.com/watch?v=YhxnffqiegU'
    ],
    ['https://player.vimeo.com/video/123', 'player.vimeo.com', 'https://vimeo.com/123'],
    ['//video.example.com/embed/456', 'video.example.com', 'https://video.example.com/embed/456']
  ])('解析嵌入视频地址 %s', (src, source, externalUrl) => {
    expect(getEmbeddedVideoInfo(src, 'https://www.v2ex.com/t/1')).toEqual({
      externalUrl,
      source
    })
  })

  it.each(['http://video.example.com/embed/1', 'javascript:alert(1)', 'not a url'])(
    '忽略不安全的嵌入视频地址 %s',
    src => {
      expect(getEmbeddedVideoInfo(src, 'about:blank')).toBeUndefined()
    }
  )
})
