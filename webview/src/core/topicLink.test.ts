import { describe, expect, it } from 'vitest'
import { getV2exTopicId, getTopicReplyTarget } from './topicLink'

describe('getV2exTopicId', () => {
  const baseUrl = 'https://www.v2ex.com/t/100'

  it.each([
    ['/t/123', '123'],
    ['/t/123?p=2#reply10', '123'],
    ['https://v2ex.com/t/456/', '456'],
    ['https://www.v2ex.com/t/789', '789']
  ])('从站内话题链接 %s 提取 id', (href, expected) => {
    expect(getV2exTopicId(href, baseUrl)).toBe(expected)
  })

  it.each([
    'https://example.com/t/123',
    'https://notv2ex.com/t/123',
    'https://www.v2ex.com/member/123',
    'https://www.v2ex.com/t/not-a-number'
  ])('忽略非站内话题链接 %s', href => {
    expect(getV2exTopicId(href, baseUrl)).toBeUndefined()
  })
})

describe('getTopicReplyTarget', () => {
  it('recognizes local and cross-page reply anchors without accepting other topics or hosts', () => {
    expect(getTopicReplyTarget('#r_20', 100)).toEqual({ replyId: '20', page: 1 })
    expect(getTopicReplyTarget('/t/100?p=2#r_30', 100)).toEqual({ replyId: '30', page: 2 })
    for (const link of [
      '/t/101#r_20',
      'https://example.com/t/100#r_20',
      '/t/100?p=-1#r_20',
      '#reply20'
    ]) {
      expect(getTopicReplyTarget(link, 100)).toBeUndefined()
    }
  })
})
